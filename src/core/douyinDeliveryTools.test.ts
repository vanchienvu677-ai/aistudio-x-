import test from 'node:test';
import assert from 'node:assert/strict';
import { VESSEL_PRESETS } from '../data/presets';
import {
  buildDefaultLifecycleData,
  computeLifecycleAssessment,
  exportLifecycleDossierCsv,
  exportNozzleTableCsv,
  generateAssemblyDrawingDxf,
  parseNozzleTableText,
  TOWER_NOZZLE_SAMPLE_CSV,
} from './douyinDeliveryTools';

test('generateAssemblyDrawingDxf outputs valid layered AutoCAD R12 DXF for horizontal and vertical vessels', () => {
  const uEx = VESSEL_PRESETS.find((p) => p.id === 'u_exchanger')!;
  const dxfH = generateAssemblyDrawingDxf(uEx.assemblies[0], uEx.spec, uEx.assemblies);
  assert.ok(dxfH.includes('AC1009'), 'Expected R12 DXF header');
  assert.ok(dxfH.includes('OUTLINE') && dxfH.includes('NOZZLE') && dxfH.includes('DIM'));
  assert.ok(dxfH.includes(uEx.spec.vesselTag), 'Expected vessel tag in title block');
  assert.ok(dxfH.includes(uEx.spec.drawingNo), 'Expected drawing number in DXF');
  assert.ok(dxfH.includes('NOZZLE ORIENTATION'), 'Expected nozzle orientation diagram');
  assert.ok(dxfH.trim().endsWith('EOF'), 'Expected clean DXF EOF terminator');

  const tower = VESSEL_PRESETS.find((p) => p.id === 'tower')!;
  const dxfV = generateAssemblyDrawingDxf(tower.assemblies[0], tower.spec, tower.assemblies);
  assert.ok(dxfV.includes(tower.spec.vesselTag));
  assert.ok(dxfV.includes('H='), 'Expected vertical total height dimension');
  assert.ok(dxfV.trim().endsWith('EOF'));
});

test('parseNozzleTableText parses CSV, Excel TSV paste, parent matching, and roundtrips via exportNozzleTableCsv', () => {
  const tower = VESSEL_PRESETS.find((p) => p.id === 'tower')!;
  const mains = tower.assemblies[0].components.filter((c) => c.category === 'main');
  const defaultParent = mains.find((m) => m.type === 'shell')?.id || mains[0].id;

  const res = parseNozzleTableText(TOWER_NOZZLE_SAMPLE_CSV, mains, defaultParent);
  assert.equal(res.rows.length, 8);
  assert.equal(res.skippedCount, 0);
  assert.equal(res.rows[0].tag, 'N1');
  assert.equal(res.rows[0].dn, 250);
  assert.equal(res.rows[0].hasPad, true);
  assert.equal(res.rows[6].tag, 'M1');
  assert.equal(res.rows[6].isManhole, true);

  // Tab-separated Excel paste without header + invalid row skipped
  const tsv = [
    `K1\t温度计口\t50\t300\t1200\t90\t220\t否\t否\t${mains[0].name}`,
    `INVALID\t空口径\t0\t150\t500\t0\t200\t否\t否\t`,
  ].join('\n');
  const resTsv = parseNozzleTableText(tsv, mains, defaultParent);
  assert.equal(resTsv.rows.length, 1);
  assert.equal(resTsv.skippedCount, 1);
  assert.equal(resTsv.rows[0].tag, 'K1');
  assert.equal(resTsv.rows[0].parentId, mains[0].id);

  // Roundtrip export -> parse
  const csvOut = exportNozzleTableCsv(res.rows, mains);
  assert.ok(csvOut.includes('塔顶气相出口'));
  const roundtrip = parseNozzleTableText(csvOut, mains, defaultParent);
  assert.equal(roundtrip.rows.length, 8);
  assert.equal(roundtrip.rows[0].dn, 250);
});

test('computeLifecycleAssessment evaluates corrosion rate, remaining life, alerts, and exports CSV dossier', () => {
  const sep = VESSEL_PRESETS.find((p) => p.id === 'large_separator')!;
  const state = buildDefaultLifecycleData(sep.spec, sep.assemblies);
  const summary = computeLifecycleAssessment(sep.spec, sep.assemblies, state);

  assert.ok(summary.totalPressureComponents >= 3);
  assert.equal(summary.alertCount, 0);
  assert.ok(summary.completionPercent > 50 && summary.completionPercent <= 100);
  assert.match(summary.nextInspectionDate, /^\d{4}-\d{2}-\d{2}$/);

  // Simulate severe wall thinning on first pressure component -> triggers alert
  const firstComp = summary.components[0];
  const thinnedState = {
    ...state,
    serviceYears: 4,
    measuredThicknessByCompId: {
      ...state.measuredThicknessByCompId,
      [firstComp.componentId]: firstComp.minRequiredThicknessMm - 0.5,
    },
  };
  const thinnedSummary = computeLifecycleAssessment(sep.spec, sep.assemblies, thinnedState);
  assert.ok(thinnedSummary.alertCount >= 1);
  assert.equal(thinnedSummary.minRemainingLifeYears, 0);

  const csv = exportLifecycleDossierCsv(sep.spec, thinnedState, thinnedSummary);
  assert.ok(csv.includes(sep.spec.vesselTag));
  assert.ok(csv.includes('预警'));
});
