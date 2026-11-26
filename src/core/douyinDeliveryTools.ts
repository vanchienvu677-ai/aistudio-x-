import type {
  AssemblyPoint,
  ConeParams,
  EllipticalHeadParams,
  NozzleManholeParams,
  ShellParams,
  SkirtParams,
  SphericalHeadParams,
  SphericalTankParams,
  TechnicalSpec,
  VesselComponent,
} from '../types/vessel';
import { generateBOM, layoutAssemblyMainComponents } from './vesselMath';

/* ============================================================================
 * 1. GH2V2D Full 2D Assembly Drawing DXF Exporter (AutoCAD / 中望CAD / 浩辰CAD)
 * ============================================================================ */

/**
 * Generate a layered AutoCAD R12 ASCII DXF (units: mm) for the complete 2D
 * pressure vessel assembly drawing (elevation, nozzle orientation diagram,
 * design spec table, nozzle schedule, BOM summary, and title block).
 */
export function generateAssemblyDrawingDxf(
  assembly: AssemblyPoint,
  spec: TechnicalSpec,
  allAssemblies: AssemblyPoint[]
): string {
  const lines: string[] = [];
  const push = (...items: Array<string | number>) => {
    for (const item of items) lines.push(String(item));
  };

  const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    push(
      '0', 'LINE',
      '8', layer,
      '10', x1.toFixed(2),
      '20', y1.toFixed(2),
      '30', '0.0',
      '11', x2.toFixed(2),
      '21', y2.toFixed(2),
      '31', '0.0'
    );
  };

  const addRect = (layer: string, x: number, y: number, w: number, h: number) => {
    addLine(layer, x, y, x + w, y);
    addLine(layer, x + w, y, x + w, y + h);
    addLine(layer, x + w, y + h, x, y + h);
    addLine(layer, x, y + h, x, y);
  };

  const addCircle = (layer: string, cx: number, cy: number, r: number) => {
    if (!(r > 0)) return;
    push(
      '0', 'CIRCLE',
      '8', layer,
      '10', cx.toFixed(2),
      '20', cy.toFixed(2),
      '30', '0.0',
      '40', r.toFixed(2)
    );
  };

  const addArcPolyline = (
    layer: string,
    pts: Array<[number, number]>
  ) => {
    for (let i = 0; i < pts.length - 1; i++) {
      addLine(layer, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  };

  const addText = (layer: string, x: number, y: number, height: number, text: string) => {
    const safe = text.replace(/[\r\n]+/g, ' ').trim();
    if (!safe) return;
    push(
      '0', 'TEXT',
      '8', layer,
      '10', x.toFixed(2),
      '20', y.toFixed(2),
      '30', '0.0',
      '40', height.toFixed(2),
      '1', safe
    );
  };

  // Standard A1 landscape sheet (841 x 594 mm)
  const W = 841;
  const H = 594;

  push(
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER',
    '1', 'AC1009',
    '9', '$INSUNITS',
    '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '7'
  );

  const layers: Array<[string, number]> = [
    ['FRAME', 4],     // Cyan
    ['OUTLINE', 7],   // White/Black
    ['CENTER', 1],    // Red
    ['DIM', 3],       // Green
    ['NOZZLE', 2],    // Yellow
    ['TABLE', 5],     // Blue
    ['TEXT', 7],      // White/Black
  ];
  for (const [name, color] of layers) {
    push('0', 'LAYER', '2', name, '70', '0', '62', color, '6', 'CONTINUOUS');
  }

  push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  // Outer & inner A1 borders (binding margin 25mm on left, 10mm on other edges)
  addRect('FRAME', 0, 0, W, H);
  addRect('FRAME', 25, 10, W - 35, H - 20);

  const placedMains = layoutAssemblyMainComponents(assembly);
  const bom = generateBOM(allAssemblies);
  const nozzles = assembly.components.filter((c) => c.type === 'nozzle_manhole');
  const isHorizontal = assembly.orientation !== 'vertical';

  const totalLenMm =
    placedMains.length > 0 ? placedMains[placedMains.length - 1].endPosMm : 3600;
  const maxRadMm =
    placedMains.length > 0
      ? Math.max(...placedMains.map((p) => p.outerRadiusMm))
      : 600;

  // Elevation view box in DXF coords (Y up): X in [50..390], Y in [245..555]
  const scale = isHorizontal
    ? Math.min(310 / Math.max(1000, totalLenMm), 105 / Math.max(300, maxRadMm * 2))
    : Math.min(240 / Math.max(1000, totalLenMm), 110 / Math.max(300, maxRadMm * 2));

  const viewCx = 215;
  const viewCy = 415;
  const startX = viewCx - (totalLenMm * scale) / 2;
  const startY = viewCy - (totalLenMm * scale) / 2;

  addText(
    'TEXT',
    40,
    562,
    6,
    `FRONT ELEVATION (1:${Math.max(1, Math.round(1 / Math.max(0.001, scale)))}) - ${assembly.name}`
  );

  // Centerline
  if (isHorizontal) {
    addLine('CENTER', startX - 20, viewCy, startX + totalLenMm * scale + 20, viewCy);
  } else {
    addLine('CENTER', viewCx, startY - 20, viewCx, startY + totalLenMm * scale + 20);
  }

  // Draw main components
  for (const pm of placedMains) {
    const comp = pm.component;
    const len = pm.axialLengthMm * scale;
    const rad = pm.outerRadiusMm * scale;
    const ecc = (pm.eccentricOffsetMm ?? 0) * scale;
    const posStart = pm.startPosMm * scale;
    const posEnd = pm.endPosMm * scale;

    if (comp.type === 'spherical_tank') {
      if (isHorizontal) {
        addCircle('OUTLINE', startX + (posStart + posEnd) / 2, viewCy, rad);
      } else {
        addCircle('OUTLINE', viewCx, startY + (posStart + posEnd) / 2, rad);
      }
      continue;
    }

    if (comp.type === 'elliptical_head' || comp.type === 'spherical_head') {
      const flipped = Boolean((comp.params as EllipticalHeadParams | SphericalHeadParams).flipped);
      const pts: Array<[number, number]> = [];
      const steps = 16;
      if (isHorizontal) {
        const seamX = flipped ? startX + posStart : startX + posEnd;
        const dir = flipped ? 1 : -1;
        for (let i = 0; i <= steps; i++) {
          const t = -Math.PI / 2 + (Math.PI * i) / steps;
          pts.push([seamX + dir * Math.cos(t) * len, viewCy + ecc + Math.sin(t) * rad]);
        }
        addArcPolyline('OUTLINE', pts);
        addLine('OUTLINE', seamX, viewCy + ecc - rad, seamX, viewCy + ecc + rad);
      } else {
        const seamY = flipped ? startY + posStart : startY + posEnd;
        const dir = flipped ? 1 : -1;
        for (let i = 0; i <= steps; i++) {
          const t = (Math.PI * i) / steps;
          pts.push([viewCx + ecc + Math.cos(t) * rad, seamY + dir * Math.sin(t) * len]);
        }
        addArcPolyline('OUTLINE', pts);
        addLine('OUTLINE', viewCx + ecc - rad, seamY, viewCx + ecc + rad, seamY);
      }
      continue;
    }

    if (comp.type === 'cone') {
      const cp = comp.params as ConeParams;
      const r1 = (cp.smallDiameter / 2 + cp.thickness) * scale;
      const r2 = (cp.largeDiameter / 2 + cp.thickness) * scale;
      if (isHorizontal) {
        const x1 = startX + posStart;
        const x2 = startX + posEnd;
        addLine('OUTLINE', x1, viewCy + ecc + r1, x2, viewCy + ecc + r2);
        addLine('OUTLINE', x1, viewCy + ecc - r1, x2, viewCy + ecc - r2);
        addLine('OUTLINE', x1, viewCy + ecc - r1, x1, viewCy + ecc + r1);
        addLine('OUTLINE', x2, viewCy + ecc - r2, x2, viewCy + ecc + r2);
      } else {
        const y1 = startY + posStart;
        const y2 = startY + posEnd;
        addLine('OUTLINE', viewCx + ecc - r1, y1, viewCx + ecc - r2, y2);
        addLine('OUTLINE', viewCx + ecc + r1, y1, viewCx + ecc + r2, y2);
        addLine('OUTLINE', viewCx + ecc - r1, y1, viewCx + ecc + r1, y1);
        addLine('OUTLINE', viewCx + ecc - r2, y2, viewCx + ecc + r2, y2);
      }
      continue;
    }

    // Default cylindrical / flange / tubesheet / skirt rectangle
    if (isHorizontal) {
      addRect('OUTLINE', startX + posStart, viewCy + ecc - rad, len, rad * 2);
    } else {
      addRect('OUTLINE', viewCx + ecc - rad, startY + posStart, rad * 2, len);
    }
  }

  // Draw saddles / legs & nozzles
  const placedById = new Map(placedMains.map((m) => [m.component.id, m]));
  for (const att of assembly.components) {
    if (att.category !== 'attachment' || !att.visible) continue;
    const parent = (att.parentId ? placedById.get(att.parentId) : undefined) || placedMains[0];
    if (!parent) continue;
    const parentR = parent.outerRadiusMm * scale;
    const parentEcc = (parent.eccentricOffsetMm ?? 0) * scale;

    if (att.type === 'nozzle_manhole') {
      const np = att.params as NozzleManholeParams;
      const axial = (parent.startPosMm + Math.min(parent.axialLengthMm, Math.max(0, np.axialOffset))) * scale;
      const nR = Math.max(2.5, (np.pipeOD / 2) * scale);
      const ext = Math.max(10, Math.min(34, np.protrusion * scale));
      const fR = nR * 1.45;
      const radAngle = (np.angleDeg * Math.PI) / 180;
      const sideSign = Math.cos(radAngle) >= -0.05 ? 1 : -1;

      if (isHorizontal) {
        const nx = startX + axial;
        const yBase = viewCy + parentEcc + sideSign * parentR;
        const yTip = yBase + sideSign * ext;
        addLine('NOZZLE', nx - nR, yBase, nx - nR, yTip);
        addLine('NOZZLE', nx + nR, yBase, nx + nR, yTip);
        addLine('NOZZLE', nx - fR, yTip, nx + fR, yTip);
        addText('TEXT', nx - 4, yTip + sideSign * 6, 4.5, np.tag || att.name);
      } else {
        const ny = startY + axial;
        const xBase = viewCx + parentEcc + sideSign * parentR;
        const xTip = xBase + sideSign * ext;
        addLine('NOZZLE', xBase, ny - nR, xTip, ny - nR);
        addLine('NOZZLE', xBase, ny + nR, xTip, ny + nR);
        addLine('NOZZLE', xTip, ny - fR, xTip, ny + fR);
        addText('TEXT', xTip + (sideSign > 0 ? 4 : -14), ny - 2, 4.5, np.tag || att.name);
      }
    } else if (att.type === 'saddle' && isHorizontal) {
      const sp = att.params as { axialOffset: number; width: number };
      const sx = startX + (parent.startPosMm + sp.axialOffset) * scale;
      const sw = Math.max(6, (sp.width || 220) * scale);
      const sh = Math.max(12, parentR * 0.42);
      addRect('OUTLINE', sx - sw / 2, viewCy + parentEcc - parentR - sh, sw, sh);
      addLine('OUTLINE', sx - sw * 0.8, viewCy + parentEcc - parentR - sh, sx + sw * 0.8, viewCy + parentEcc - parentR - sh);
    }
  }

  // Overall length dimension line
  if (isHorizontal) {
    const dimY = viewCy - maxRadMm * scale - 38;
    addLine('DIM', startX, viewCy - maxRadMm * scale - 8, startX, dimY - 4);
    addLine('DIM', startX + totalLenMm * scale, viewCy - maxRadMm * scale - 8, startX + totalLenMm * scale, dimY - 4);
    addLine('DIM', startX, dimY, startX + totalLenMm * scale, dimY);
    addText('DIM', viewCx - 28, dimY + 4, 5, `L = ${Math.round(totalLenMm)} mm`);
  } else {
    const dimX = viewCx - maxRadMm * scale - 32;
    addLine('DIM', viewCx - maxRadMm * scale - 6, startY, dimX - 4, startY);
    addLine('DIM', viewCx - maxRadMm * scale - 6, startY + totalLenMm * scale, dimX - 4, startY + totalLenMm * scale);
    addLine('DIM', dimX, startY, dimX, startY + totalLenMm * scale);
    addText('DIM', dimX - 24, viewCy, 5, `H=${Math.round(totalLenMm)}`);
  }

  // Nozzle Orientation Circle (top-middle: cx=495, cy=420, r=55)
  const ncX = 495;
  const ncY = 420;
  const ncR = 52;
  addText('TEXT', 445, 500, 5.5, 'NOZZLE ORIENTATION');
  addCircle('OUTLINE', ncX, ncY, ncR);
  addLine('CENTER', ncX - ncR - 12, ncY, ncX + ncR + 12, ncY);
  addLine('CENTER', ncX, ncY - ncR - 12, ncX, ncY + ncR + 12);
  addText('TEXT', ncX - 4, ncY + ncR + 6, 4, '0DEG');
  addText('TEXT', ncX + ncR + 5, ncY - 2, 4, '90DEG');
  addText('TEXT', ncX - 9, ncY - ncR - 10, 4, '180DEG');
  addText('TEXT', ncX - ncR - 22, ncY - 2, 4, '270DEG');

  for (const n of nozzles) {
    const np = n.params as NozzleManholeParams;
    const rad = ((90 - np.angleDeg) * Math.PI) / 180;
    const x1 = ncX + Math.cos(rad) * ncR;
    const y1 = ncY + Math.sin(rad) * ncR;
    const x2 = ncX + Math.cos(rad) * (ncR + 16);
    const y2 = ncY + Math.sin(rad) * (ncR + 16);
    addLine('NOZZLE', x1, y1, x2, y2);
    addText('TEXT', x2 + 2, y2 + 2, 4, `${np.tag || n.name} (${np.angleDeg}DEG)`);
  }

  // Design Specification Table (top-right: x=595..820, y=385..565)
  const tblX = 595;
  const tblW = 225;
  const specRows: Array<[string, string]> = [
    ['DESIGN CODE', spec.designCode],
    ['VESSEL TAG', spec.vesselTag],
    ['VESSEL NAME', spec.vesselName],
    ['DESIGN PRESS', `${spec.designPressure} MPa`],
    ['TEST PRESS', `${spec.testPressure} MPa`],
    ['DESIGN TEMP', `${spec.designTemp} C`],
    ['CORR ALLOW', `${spec.corrosionAllowance} mm`],
    ['JOINT EFF', String(spec.weldEfficiency)],
    ['NET WEIGHT', `${bom.totalWeightKg.toFixed(1)} kg`],
    ['VOLUME', `${bom.totalInternalVolumeM3.toFixed(3)} m3`],
  ];
  const rowH = 15;
  const specTop = 565;
  addRect('TABLE', tblX, specTop - (specRows.length + 1) * rowH, tblW, (specRows.length + 1) * rowH);
  addText('TEXT', tblX + 55, specTop - 11, 5, 'DESIGN SPECIFICATION');
  addLine('TABLE', tblX, specTop - rowH, tblX + tblW, specTop - rowH);
  addLine('TABLE', tblX + 85, specTop - rowH, tblX + 85, specTop - (specRows.length + 1) * rowH);
  specRows.forEach(([k, v], i) => {
    const ry = specTop - (i + 2) * rowH;
    addLine('TABLE', tblX, ry, tblX + tblW, ry);
    addText('TEXT', tblX + 4, ry + 4, 4, k);
    addText('TEXT', tblX + 90, ry + 4, 4, v);
  });

  // Nozzle Schedule Table (middle-right: x=595..820)
  const nozTop = 375;
  const maxNozRows = Math.min(10, nozzles.length);
  const nozTableH = (Math.max(1, maxNozRows) + 2) * 14;
  addRect('TABLE', tblX, nozTop - nozTableH, tblW, nozTableH);
  addText('TEXT', tblX + 60, nozTop - 10, 5, 'LIST OF NOZZLES');
  addLine('TABLE', tblX, nozTop - 14, tblX + tblW, nozTop - 14);
  addText('TEXT', tblX + 4, nozTop - 24, 3.8, 'TAG   DN     PN      ANGLE  PURPOSE');
  addLine('TABLE', tblX, nozTop - 28, tblX + tblW, nozTop - 28);
  nozzles.slice(0, maxNozRows).forEach((n, i) => {
    const np = n.params as NozzleManholeParams;
    const ry = nozTop - 28 - (i + 1) * 14;
    addLine('TABLE', tblX, ry, tblX + tblW, ry);
    addText(
      'TEXT',
      tblX + 4,
      ry + 3.5,
      3.8,
      `${(np.tag || n.name).padEnd(5)} DN${String(np.dn).padEnd(4)} PN${String(np.pn).padEnd(5)} ${String(np.angleDeg).padEnd(4)}  ${np.purpose}`
    );
  });

  // Bill of Material Table (bottom-left: x=35..575, y=22..215)
  const bomX = 35;
  const bomW = 540;
  const bomTop = 212;
  const maxBomRows = Math.min(11, bom.rows.length);
  const bomH = (maxBomRows + 2) * 14;
  addRect('TABLE', bomX, bomTop - bomH, bomW, bomH);
  addText('TEXT', bomX + 190, bomTop - 10, 5, 'BILL OF MATERIAL (BOM)');
  addLine('TABLE', bomX, bomTop - 14, bomX + bomW, bomTop - 14);
  addText('TEXT', bomX + 4, bomTop - 24, 3.8, 'NO.  PART NAME          MATERIAL     SPEC                          QTY   WT(kg)');
  addLine('TABLE', bomX, bomTop - 28, bomX + bomW, bomTop - 28);
  bom.rows.slice(0, maxBomRows).forEach((r, i) => {
    const ry = bomTop - 28 - (i + 1) * 14;
    addLine('TABLE', bomX, ry, bomX + bomW, ry);
    addText(
      'TEXT',
      bomX + 4,
      ry + 3.5,
      3.8,
      `${String(r.tag).padEnd(4)} ${r.partName.slice(0, 14).padEnd(16)} ${r.material.padEnd(10)} ${r.spec.slice(0, 26).padEnd(28)} ${String(r.unitQty).padEnd(4)} ${r.totalWeightKg.toFixed(1)}`
    );
  });

  // Title Block (bottom-right: x=595..820, y=22..118)
  const tbX = 595;
  const tbY = 22;
  const tbW = 225;
  const tbH = 96;
  addRect('FRAME', tbX, tbY, tbW, tbH);
  addLine('FRAME', tbX, tbY + 68, tbX + tbW, tbY + 68);
  addLine('FRAME', tbX, tbY + 42, tbX + tbW, tbY + 42);
  addLine('FRAME', tbX, tbY + 20, tbX + tbW, tbY + 20);
  addText('TEXT', tbX + 12, tbY + 78, 5.5, spec.companyName || 'SHANGHAI GAOHUI TECH');
  addText('TEXT', tbX + 12, tbY + 51, 5.2, `${spec.vesselTag} ${spec.vesselName}`);
  addText('TEXT', tbX + 12, tbY + 28, 4.2, `DWG NO: ${spec.drawingNo}  REV: ${spec.revision}`);
  addText('TEXT', tbX + 12, tbY + 7, 4.2, `GHPV V2.1  TOTAL WT: ${bom.totalWeightKg.toFixed(1)} kg`);

  push('0', 'ENDSEC', '0', 'EOF', '');
  return lines.join('\n');
}

/* ============================================================================
 * 2. Automatic Nozzle Schedule Importer (CSV / TSV / Excel Clipboard Paste)
 * ============================================================================ */

export interface ImportedNozzleDraftRow {
  id: string;
  parentId: string;
  tag: string;
  purpose: string;
  dn: number;
  pn: string;
  axialOffset: number;
  angleDeg: number;
  protrusion: number;
  hasPad: boolean;
  isManhole: boolean;
}

export interface NozzleTableParseResult {
  rows: ImportedNozzleDraftRow[];
  warnings: string[];
  skippedCount: number;
}

export const TOWER_NOZZLE_SAMPLE_CSV = [
  '符号,用途,DN(mm),PN,定位距离(mm),方位角(°),外伸L1(mm),补强圈,人孔,依附主构件',
  'N1,塔顶气相出口,250,150,200,0,280,是,否,',
  'N2,回流液入口,100,150,950,90,240,否,否,',
  'N3,原料进料口,150,150,2800,180,260,是,否,',
  'N4,塔釜液相出口,150,150,350,270,260,是,否,',
  'N5,液位计上口,50,300,1200,45,200,否,否,',
  'N6,液位计下口,50,300,600,45,200,否,否,',
  'M1,塔体检修人孔1,500,150,1850,0,320,是,是,',
  'M2,塔体检修人孔2,500,150,3900,0,320,是,是,',
].join('\n');

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseBoolCell(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '是' || v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === '有' || v === '√';
}

function parseNumberCell(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^\d.+-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse a CSV / TSV / Excel-pasted nozzle table into structured BatchNozzleDialog rows.
 */
export function parseNozzleTableText(
  rawText: string,
  mainComponents: VesselComponent[],
  defaultParentId: string
): NozzleTableParseResult {
  const warnings: string[] = [];
  const rawLines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (rawLines.length === 0) {
    return { rows: [], warnings: ['未检测到可解析的管口数据行'], skippedCount: 0 };
  }

  const first = rawLines[0];
  const delimiter = first.includes('\t')
    ? '\t'
    : first.includes(',')
    ? ','
    : first.includes(';')
    ? ';'
    : ',';

  const firstCells = splitDelimitedLine(first, delimiter);
  const headerMatchers: Array<[string, RegExp]> = [
    ['tag', /符号|位号|管口号|编号|tag|mark|nozzle/i],
    ['purpose', /用途|名称|功能|介质|purpose|service|desc/i],
    ['dn', /公称|口径|通径|^dn|size|dia/i],
    ['pn', /压力|磅级|^pn|class|rating/i],
    ['axialOffset', /定位|距离|轴向|标高|位置|offset|elev/i],
    ['angleDeg', /方位|角度|angle|orient/i],
    ['protrusion', /外伸|伸出|l1|protrusion|proj/i],
    ['hasPad', /补强|pad|reinf/i],
    ['isManhole', /人孔|手孔|manhole/i],
    ['parent', /主构件|所属|依附|筒体|parent|shell/i],
  ];

  const colMap: Partial<Record<string, number>> = {};
  let headerHits = 0;
  firstCells.forEach((cell, idx) => {
    for (const [key, rx] of headerMatchers) {
      if (colMap[key] === undefined && rx.test(cell)) {
        colMap[key] = idx;
        headerHits++;
        break;
      }
    }
  });

  const hasHeader = headerHits >= 2;
  const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

  // Positional fallback when no header row is provided
  if (!hasHeader) {
    colMap.tag = 0;
    colMap.purpose = 1;
    colMap.dn = 2;
    colMap.pn = 3;
    colMap.axialOffset = 4;
    colMap.angleDeg = 5;
    colMap.protrusion = 6;
    colMap.hasPad = 7;
    colMap.isManhole = 8;
    colMap.parent = 9;
  }

  const rows: ImportedNozzleDraftRow[] = [];
  let skippedCount = 0;
  const stamp = Date.now();

  dataLines.forEach((line, i) => {
    const cells = splitDelimitedLine(line, delimiter);
    const get = (key: string) => {
      const idx = colMap[key];
      return idx !== undefined ? cells[idx] : undefined;
    };

    const rawTag = (get('tag') || '').trim();
    const dnVal = parseNumberCell(get('dn'), 0);
    if (!rawTag || dnVal < 15) {
      skippedCount++;
      warnings.push(`第 ${i + (hasHeader ? 2 : 1)} 行缺少有效管口符号或公称尺寸(DN≥15)，已跳过`);
      return;
    }

    const parentName = (get('parent') || '').trim();
    let matchedParentId = defaultParentId;
    if (parentName && mainComponents.length > 0) {
      const exact = mainComponents.find((m) => m.name === parentName);
      const partial = mainComponents.find(
        (m) => m.name.includes(parentName) || parentName.includes(m.name)
      );
      if (exact) matchedParentId = exact.id;
      else if (partial) matchedParentId = partial.id;
    }

    const purpose = (get('purpose') || '').trim() || '工艺管口';
    const isManhole =
      parseBoolCell(get('isManhole')) || /人孔|手孔|^M\d+/i.test(rawTag) || /人孔/.test(purpose);
    const hasPad = parseBoolCell(get('hasPad')) || dnVal >= 200 || isManhole;
    const rawPn = (get('pn') || '150').replace(/^PN/i, '').trim() || '150';

    rows.push({
      id: `imp-noz-${stamp}-${i}`,
      parentId: matchedParentId,
      tag: rawTag,
      purpose,
      dn: Math.round(dnVal),
      pn: rawPn,
      axialOffset: Math.round(parseNumberCell(get('axialOffset'), 600 + i * 300)),
      angleDeg: ((Math.round(parseNumberCell(get('angleDeg'), (i * 45) % 360)) % 360) + 360) % 360,
      protrusion: Math.max(80, Math.round(parseNumberCell(get('protrusion'), dnVal >= 400 ? 320 : 240))),
      hasPad,
      isManhole,
    });
  });

  return { rows, warnings, skippedCount };
}

export function exportNozzleTableCsv(
  rows: ImportedNozzleDraftRow[],
  mainComponents: VesselComponent[]
): string {
  const nameById = new Map(mainComponents.map((m) => [m.id, m.name]));
  const header = '符号,用途,DN(mm),PN,定位距离(mm),方位角(°),外伸L1(mm),补强圈,人孔,依附主构件';
  const body = rows.map((r) =>
    [
      r.tag,
      r.purpose,
      r.dn,
      r.pn,
      r.axialOffset,
      r.angleDeg,
      r.protrusion,
      r.hasPad ? '是' : '否',
      r.isManhole ? '是' : '否',
      nameById.get(r.parentId) || '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return '\uFEFF' + [header, ...body].join('\n');
}

/* ============================================================================
 * 3. Pressure Vessel Full Lifecycle Management Engine (全生命周期管理)
 * ============================================================================ */

export type LifecycleStageKey =
  | 'design'
  | 'fabrication'
  | 'installation'
  | 'operation'
  | 'maintenance';

export interface LifecycleInspectionRecord {
  id: string;
  date: string;
  stage: LifecycleStageKey;
  recordType: '设计评审' | '无损检测(NDT)' | '水压试验' | '安装验收' | '定期检验(TSG 21)' | '壁厚测厚' | '检维修记录';
  inspector: string;
  conclusion: '合格' | '监控使用' | '待整改';
  notes: string;
}

export interface LifecycleState {
  currentStage: LifecycleStageKey;
  assetCode: string;
  manufacturer: string;
  commissionDate: string;
  serviceYears: number;
  inspectionCycleYears: number;
  safetyGrade: '1级' | '2级' | '3级' | '4级';
  completedMilestones: string[];
  measuredThicknessByCompId: Record<string, number>;
  records: LifecycleInspectionRecord[];
}

export interface ComponentCorrosionAssessment {
  componentId: string;
  componentName: string;
  assemblyName: string;
  material: string;
  nominalThicknessMm: number;
  corrosionAllowanceMm: number;
  minRequiredThicknessMm: number;
  measuredThicknessMm: number;
  thicknessLossMm: number;
  corrosionRateMmPerYr: number;
  remainingAllowanceMm: number;
  remainingLifeYears: number;
  status: 'normal' | 'attention' | 'alert';
}

export interface LifecycleAssessmentSummary {
  assetCode: string;
  nextInspectionDate: string;
  totalPressureComponents: number;
  alertCount: number;
  attentionCount: number;
  minRemainingLifeYears: number;
  maxCorrosionRateMmPerYr: number;
  completionPercent: number;
  components: ComponentCorrosionAssessment[];
}

export const LIFECYCLE_STAGES: Array<{
  key: LifecycleStageKey;
  label: string;
  milestones: Array<{ id: string; label: string }>;
}> = [
  {
    key: 'design',
    label: '设计选型',
    milestones: [
      { id: 'ms-design-spec', label: '工艺条件与技术特性表定版' },
      { id: 'ms-design-3d', label: 'GHPV 三维建模与干涉校核通过' },
      { id: 'ms-design-2d', label: 'GH2V2D 二维施工图及 BOM 签发' },
    ],
  },
  {
    key: 'fabrication',
    label: '制造检验',
    milestones: [
      { id: 'ms-fab-mat', label: '主体受压元件材料复验合格' },
      { id: 'ms-fab-ndt', label: 'A/B 类焊缝无损检测 (RT/UT) 合格' },
      { id: 'ms-fab-hydro', label: '耐压/水压试验验收签字' },
    ],
  },
  {
    key: 'installation',
    label: '安装投运',
    milestones: [
      { id: 'ms-inst-pdms', label: '三维模型导入 PDMS/配管完成碰撞核对' },
      { id: 'ms-inst-reg', label: '特种设备使用登记与铭牌建档' },
    ],
  },
  {
    key: 'operation',
    label: '在役监测',
    milestones: [
      { id: 'ms-ops-ut', label: '年度定点超声波测厚数据录入' },
      { id: 'ms-ops-tsg', label: 'TSG 21 定期检验安全状况等级评定' },
    ],
  },
  {
    key: 'maintenance',
    label: '检维修/延寿',
    milestones: [
      { id: 'ms-mnt-plan', label: '停工大修垫片/紧固件更换台账归档' },
      { id: 'ms-mnt-life', label: '剩余寿命与延寿评估报告完成' },
    ],
  },
];

function extractPressureThickness(comp: VesselComponent): { thicknessMm: number; material: string } | null {
  switch (comp.type) {
    case 'shell': {
      const p = comp.params as ShellParams;
      return { thicknessMm: p.thickness, material: p.material || 'Q345R' };
    }
    case 'elliptical_head': {
      const p = comp.params as EllipticalHeadParams;
      return { thicknessMm: p.nominalThickness, material: p.material || 'Q345R' };
    }
    case 'spherical_head': {
      const p = comp.params as SphericalHeadParams;
      return { thicknessMm: p.thickness, material: p.material || 'Q345R' };
    }
    case 'cone': {
      const p = comp.params as ConeParams;
      return { thicknessMm: p.thickness, material: p.material || 'Q345R' };
    }
    case 'spherical_tank': {
      const p = comp.params as SphericalTankParams;
      return { thicknessMm: p.thickness, material: p.material || 'Q370R' };
    }
    case 'skirt': {
      const p = comp.params as SkirtParams;
      return { thicknessMm: p.thickness, material: p.material || 'Q345R' };
    }
    case 'boot_shell': {
      const p = comp.params as { thickness?: number; material?: string };
      return { thicknessMm: p.thickness || 12, material: p.material || 'Q345R' };
    }
    default:
      return null;
  }
}

export function buildDefaultLifecycleData(
  spec: TechnicalSpec,
  assemblies: AssemblyPoint[]
): LifecycleState {
  const measuredThicknessByCompId: Record<string, number> = {};
  const corr = Math.max(0.5, Number(spec.corrosionAllowance) || 2);
  let idx = 0;
  for (const ap of assemblies) {
    for (const c of ap.components) {
      const info = extractPressureThickness(c);
      if (info) {
        // Default initial UT baseline with slight realistic 0.2~0.4mm wear after 2 years service
        const wear = Math.min(corr * 0.2, 0.2 + (idx % 3) * 0.1);
        measuredThicknessByCompId[c.id] = Math.round((info.thicknessMm - wear) * 100) / 100;
        idx++;
      }
    }
  }

  const safeTag = (spec.vesselTag || 'PV-001').replace(/[^A-Za-z0-9_-]/g, '');
  return {
    currentStage: 'operation',
    assetCode: `GH-${safeTag}-2025`,
    manufacturer: spec.companyName || '上海高惠科技有限公司',
    commissionDate: '2024-06-15',
    serviceYears: 2,
    inspectionCycleYears: 6,
    safetyGrade: '2级',
    completedMilestones: [
      'ms-design-spec',
      'ms-design-3d',
      'ms-design-2d',
      'ms-fab-mat',
      'ms-fab-ndt',
      'ms-fab-hydro',
      'ms-inst-pdms',
      'ms-inst-reg',
    ],
    measuredThicknessByCompId,
    records: [
      {
        id: 'rec-ndt-1',
        date: '2024-04-12',
        stage: 'fabrication',
        recordType: '无损检测(NDT)',
        inspector: '质检中心 · RT-II级',
        conclusion: '合格',
        notes: `按 ${spec.ndtRequirement || 'NB/T 47013.2'} 完成 A/B 类焊缝射线及磁粉复验，一次合格。`,
      },
      {
        id: 'rec-hydro-1',
        date: '2024-05-03',
        stage: 'fabrication',
        recordType: '水压试验',
        inspector: '特检监检工程师',
        conclusion: '合格',
        notes: `试验压力 ${spec.testPressure} MPa，保压 30 min 无压降、无渗漏、无可见变形。`,
      },
      {
        id: 'rec-ut-1',
        date: '2026-05-20',
        stage: 'operation',
        recordType: '壁厚测厚',
        inspector: '设备运维部',
        conclusion: '合格',
        notes: '年度定点超声波测厚完成，主体受压元件壁厚处于腐蚀裕量安全区间内。',
      },
    ],
  };
}

export function computeLifecycleAssessment(
  spec: TechnicalSpec,
  assemblies: AssemblyPoint[],
  state: LifecycleState
): LifecycleAssessmentSummary {
  const corrAllowance = Math.max(0.5, Number(spec.corrosionAllowance) || 2);
  const serviceYears = Math.max(0.1, Number(state.serviceYears) || 1);
  const components: ComponentCorrosionAssessment[] = [];

  for (const ap of assemblies) {
    for (const c of ap.components) {
      const info = extractPressureThickness(c);
      if (!info) continue;
      const nom = Math.max(3, Number(info.thicknessMm) || 10);
      const minReq = Math.max(3, Math.round((nom - corrAllowance) * 100) / 100);
      const measuredRaw = state.measuredThicknessByCompId[c.id];
      const measured =
        typeof measuredRaw === 'number' && Number.isFinite(measuredRaw)
          ? Math.max(0, measuredRaw)
          : nom;
      const loss = Math.max(0, Math.round((nom - measured) * 100) / 100);
      const rate = Math.round((loss / serviceYears) * 1000) / 1000;
      const remAllowance = Math.round((measured - minReq) * 100) / 100;
      const effectiveRate = rate > 0.01 ? rate : 0.08;
      const remLife =
        remAllowance <= 0
          ? 0
          : Math.min(50, Math.round((remAllowance / effectiveRate) * 10) / 10);

      let status: 'normal' | 'attention' | 'alert' = 'normal';
      if (remAllowance <= 0 || remAllowance < corrAllowance * 0.2 || remLife < 3) {
        status = 'alert';
      } else if (remAllowance < corrAllowance * 0.5 || remLife < 6) {
        status = 'attention';
      }

      components.push({
        componentId: c.id,
        componentName: c.name,
        assemblyName: ap.name,
        material: info.material,
        nominalThicknessMm: nom,
        corrosionAllowanceMm: corrAllowance,
        minRequiredThicknessMm: minReq,
        measuredThicknessMm: measured,
        thicknessLossMm: loss,
        corrosionRateMmPerYr: rate,
        remainingAllowanceMm: remAllowance,
        remainingLifeYears: remLife,
        status,
      });
    }
  }

  // Next periodic inspection date (commissionDate + inspectionCycleYears)
  let nextInspectionDate = '2030-06-15';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(state.commissionDate || '');
  if (m) {
    const baseYear = Number(m[1]);
    const cycle = Math.max(1, Math.min(10, Math.round(state.inspectionCycleYears || 6)));
    nextInspectionDate = `${baseYear + cycle}-${m[2]}-${m[3]}`;
  }

  const totalMilestones = LIFECYCLE_STAGES.reduce((s, st) => s + st.milestones.length, 0);
  const doneCount = LIFECYCLE_STAGES.reduce(
    (s, st) => s + st.milestones.filter((ms) => state.completedMilestones.includes(ms.id)).length,
    0
  );

  return {
    assetCode: state.assetCode,
    nextInspectionDate,
    totalPressureComponents: components.length,
    alertCount: components.filter((c) => c.status === 'alert').length,
    attentionCount: components.filter((c) => c.status === 'attention').length,
    minRemainingLifeYears:
      components.length > 0
        ? Math.min(...components.map((c) => c.remainingLifeYears))
        : 20,
    maxCorrosionRateMmPerYr:
      components.length > 0
        ? Math.max(...components.map((c) => c.corrosionRateMmPerYr))
        : 0,
    completionPercent: totalMilestones > 0 ? Math.round((doneCount / totalMilestones) * 100) : 0,
    components,
  };
}

export function exportLifecycleDossierCsv(
  spec: TechnicalSpec,
  state: LifecycleState,
  summary: LifecycleAssessmentSummary
): string {
  const lines: string[] = [
    `设备位号,${spec.vesselTag},资产编码,${state.assetCode},安全状况等级,${state.safetyGrade}`,
    `设备名称,${spec.vesselName},投用日期,${state.commissionDate},下次定检日期,${summary.nextInspectionDate}`,
    '',
    '受压元件壁厚与余寿评估',
    '元件名称,所属装配点,材质,名义壁厚(mm),实测壁厚(mm),最小需用壁厚(mm),年腐蚀速率(mm/a),剩余裕量(mm),预测余寿(年),状态',
    ...summary.components.map((c) =>
      [
        c.componentName,
        c.assemblyName,
        c.material,
        c.nominalThicknessMm,
        c.measuredThicknessMm,
        c.minRequiredThicknessMm,
        c.corrosionRateMmPerYr,
        c.remainingAllowanceMm,
        c.remainingLifeYears,
        c.status === 'alert' ? '预警' : c.status === 'attention' ? '关注' : '正常',
      ].join(',')
    ),
    '',
    '全生命周期检验与检维修台账',
    '日期,阶段,记录类型,责任人/机构,结论,备注',
    ...state.records.map((r) =>
      [r.date, r.stage, r.recordType, r.inspector, r.conclusion, `"${r.notes.replace(/"/g, '""')}"`].join(',')
    ),
  ];
  return '\uFEFF' + lines.join('\n');
}
