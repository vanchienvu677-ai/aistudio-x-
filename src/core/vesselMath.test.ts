import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEllipticalHeadMetrics,
  calculateShellMetrics,
  calculateConeMetrics,
  calculateSphericalTankMetrics,
  calculateCostEstimate,
  generatePdmsMacro,
  computeTubeLayout,
  layoutAssemblyMainComponents,
  generateBOM,
  bomToCsv,
  checkInterferences,
  autoFixInterferences,
  computeComponentMetrics,
  getComponentTypeLabel,
  buildVesselFromAiSpec,
} from './vesselMath';
import * as THREE from 'three';
import type { AssemblyPoint, ComponentType, TechnicalSpec } from '../types/vessel';
import { VESSEL_PRESETS, createDefaultComponent } from '../data/presets';
import { buildAssembliesScene } from '../scene/vesselGeometry';
import { extractTextFromCadDatasheetFile, parseGhpvFileBuffer } from './ghpvImporter';
import {
  computeSceneMeshStats,
  exportSceneToBinaryStl,
  exportSceneToIges,
  exportSceneToObjAndMtl,
  exportSceneToStepAp214,
} from '../scene/cadExporters';

test('elliptical head GB/T 25198-2023 calculations match GHPV page 9 reference', () => {
  const res = calculateEllipticalHeadMetrics({
    headType: 'EHA',
    standard: 'GB/T 25198-2023',
    diameter: 1000,
    straightHeight: 25,
    nominalThickness: 12,
    minThickness: 10.2,
    blankThickness: 12,
    formingMethod: '冷冲压法',
    thinningRate: 15,
    flipped: false,
    material: 'Q345R',
    density: 7.85,
  });

  assert.equal(res.crownHeightMm, 250);
  assert.equal(res.totalDepthMm, 275);
  assert.equal(res.minFormedThicknessMm, 10.2);
  // Reference Page 9: 封头容积 ~0.1505 m3, 内表面积 ~1.1625 m2, 封头重量 ~109-113 kg
  assert.ok(Math.abs(res.internalVolumeM3 - 0.1505) < 0.002);
  assert.ok(Math.abs(res.innerAreaM2 - 1.1625) < 0.01);
  assert.ok(res.weightKg > 105 && res.weightKg < 118);
});

test('cylindrical shell calculations match GHPV page 10 reference', () => {
  const res = calculateShellMetrics({
    shellKind: '筒体',
    diameter: 1000,
    thickness: 12,
    length: 4000,
    material: 'Q345R',
    density: 7.85,
  });

  // Page 10: DN1000x12 L=4000 -> weight ~1197.9kg, vol ~3.1416 m3, innerArea ~12.5664 m2, unrolled ~3179.3/3141.6
  assert.ok(Math.abs(res.internalVolumeM3 - 3.1416) < 0.001);
  assert.ok(Math.abs(res.innerAreaM2 - 12.5664) < 0.001);
  assert.ok(Math.abs(res.weightKg - 1197.9) < 3.0);
  assert.equal(res.cogMm, 2000);
});

test('conical reducer calculates half-apex angle and positive mass', () => {
  const res = calculateConeMetrics({
    coneType: '正锥',
    edgeStyle: '双折边',
    smallDiameter: 500,
    largeDiameter: 1000,
    thickness: 10,
    totalLength: 500,
    r1: 50,
    r2: 80,
    h1: 25,
    h2: 25,
    flipped: false,
    material: 'Q345R',
    density: 7.85,
  });

  assert.ok(res.halfApexAngleDeg > 28 && res.halfApexAngleDeg < 33);
  assert.ok(res.weightKg > 95 && res.weightKg < 125);
  assert.ok(res.internalVolumeM3 > 0.2 && res.internalVolumeM3 < 0.28);
});

test('heat exchanger tube layout generates dense triangular bundle with pass partitions', () => {
  const onePass = computeTubeLayout({
    tubeType: '直管',
    shellDiameter: 1000,
    tubeOD: 25,
    tubeThickness: 2,
    tubePitch: 32,
    outerLimitDiameter: 966,
    pattern: '正三角形',
    passes: 1,
    tubeLength: 4000,
    baffleCount: 6,
    material: '20',
    density: 7.85,
  });

  const twoPass = computeTubeLayout({
    tubeType: '直管',
    shellDiameter: 1000,
    tubeOD: 25,
    tubeThickness: 2,
    tubePitch: 32,
    outerLimitDiameter: 966,
    pattern: '正三角形',
    passes: 2,
    tubeLength: 4000,
    baffleCount: 6,
    material: '20',
    density: 7.85,
  });

  assert.ok(onePass.totalCount > 600, `Expected >600 tubes, got ${onePass.totalCount}`);
  assert.ok(twoPass.totalCount < onePass.totalCount, '2-pass partition must remove center lane tubes');
});

test('assembly layout chains main components head-to-tail and generates valid BOM', () => {
  const ap: AssemblyPoint = {
    id: 'ap-1',
    name: '装配点1',
    x: 0,
    z: 0,
    orientation: 'horizontal',
    components: [
      {
        id: 'head-1',
        name: '椭圆封头1',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { r: 195, g: 132, b: 28, a: 255 },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: 1000,
          straightHeight: 25,
          nominalThickness: 12,
          minThickness: 10.2,
          blankThickness: 12,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: false,
          material: 'Q345R',
          density: 7.85,
        },
      },
      {
        id: 'shell-1',
        name: '筒体1',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { r: 195, g: 132, b: 28, a: 255 },
        params: {
          shellKind: '筒体',
          diameter: 1000,
          thickness: 12,
          length: 3000,
          material: 'Q345R',
          density: 7.85,
        },
      },
      {
        id: 'head-2',
        name: '椭圆封头2',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { r: 195, g: 132, b: 28, a: 255 },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: 1000,
          straightHeight: 25,
          nominalThickness: 12,
          minThickness: 10.2,
          blankThickness: 12,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: true,
          material: 'Q345R',
          density: 7.85,
        },
      },
    ],
  };

  const placed = layoutAssemblyMainComponents(ap);
  assert.equal(placed.length, 3);
  assert.equal(placed[0].startPosMm, 0);
  assert.equal(placed[0].endPosMm, 275);
  assert.equal(placed[1].startPosMm, 275);
  assert.equal(placed[1].endPosMm, 3275);
  assert.equal(placed[2].startPosMm, 3275);
  assert.equal(placed[2].endPosMm, 3550);

  const bom = generateBOM([ap]);
  assert.equal(bom.rows.length, 3);
  assert.ok(bom.totalWeightKg > 1000);
  assert.ok(bom.totalInternalVolumeM3 > 2.5);

  const csv = bomToCsv(bom.rows, bom);
  assert.ok(csv.includes('椭圆封头1'));
  assert.ok(csv.includes('DN1000X12 L=3000'));
});

test('spherical tank GB/T 12337 1000m3 sphere calculates volume, mass, and weld seam length', () => {
  const res = calculateSphericalTankMetrics({
    diameter: 12300,
    thickness: 34,
    zoneStyle: '混合式五带',
    equatorPetals: 16,
    temperatePetals: 12,
    standard: 'GB/T 12337-2014',
    material: 'Q370R',
    density: 7.85,
  });

  // 4/3 * pi * (6.15)^3 ≈ 974.3 m3
  assert.ok(res.internalVolumeM3 > 960 && res.internalVolumeM3 < 1000);
  assert.ok(res.weightKg > 120000 && res.weightKg < 135000);
  assert.ok(res.totalWeldLengthM > 300);
});

test('cost estimate computes material, fabrication, and VAT totals accurately', () => {
  const est = calculateCostEstimate(
    [
      {
        index: 1,
        tag: '1',
        standard: 'GB/T 150.3',
        partName: '筒体1',
        material: 'Q345R',
        spec: 'DN1200X12 L=3600',
        cuttingSize: '',
        unitQty: 1,
        spareQty: 0,
        unitWeightKg: 2000,
        totalWeightKg: 2000,
        innerAreaM2: 14,
        outerAreaM2: 15,
        internalVolumeM3: 4,
      },
    ],
    { totalWeightKg: 2000, totalOuterAreaM2: 15 }
  );

  assert.equal(est.materialRows.length, 1);
  assert.ok(est.materialTotalRmb > 10000);
  assert.ok(est.grandTotalRmb > est.materialTotalRmb + est.manufacturingTotalRmb);
  assert.ok(est.unitPricePerKg > 10);
});

test('PDMS macro generator outputs valid EQUI, CYLI, and NOZZ commands', () => {
  const ap: AssemblyPoint = {
    id: 'ap-p',
    name: '装配点1',
    x: 0,
    z: 0,
    orientation: 'vertical',
    components: [
      {
        id: 's1',
        name: '筒体1',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { r: 198, g: 136, b: 32, a: 255 },
        params: { shellKind: '筒体', diameter: 1600, thickness: 14, length: 3600, material: 'Q345R', density: 7.85 },
      },
      {
        id: 'n1',
        name: 'N1',
        type: 'nozzle_manhole',
        category: 'attachment',
        parentId: 's1',
        visible: true,
        color: { r: 184, g: 118, b: 24, a: 255 },
        params: {
          tag: 'N1',
          purpose: '进料口',
          isManhole: false,
          manholeType: '水平吊盖带颈对焊法兰人孔',
          flangeStandard: 'HG美标法兰',
          flangeSpec: 'HG/T 20615-2009',
          flangeType: 'WN-RF',
          pn: '150',
          dn: 150,
          pipeOD: 168.3,
          pipeThickness: 8,
          axialOffset: 1200,
          angleDeg: 0,
          protrusion: 240,
          innerProtrusion: 0,
          hasBlindCover: false,
          hasPad: false,
          hasElbow: false,
          elbowDirDeg: 0,
          boltCount: 8,
          flangeOD: 280,
          flangeThickness: 26,
          material: '16MnIII',
          pipeMaterial: '20',
          density: 7.85,
        },
      },
    ],
  };
  const spec: TechnicalSpec = {
    vesselTag: 'T-301',
    vesselName: '精馏塔',
    designCode: 'GB/T 150-2024',
    vesselClass: 'D',
    designPressure: 2.2,
    workPressure: 1.8,
    testPressure: 2.75,
    designTemp: 210,
    workTemp: 180,
    medium: '烃类',
    corrosionAllowance: 2,
    weldEfficiency: 0.85,
    ndtMethod: '20% RT',
    heatTreatment: '无',
    companyName: '上海高惠科技有限公司',
    projectName: '测试项目',
    drawingNo: 'GHPV-T301',
  };
  const mac = generatePdmsMacro([ap], spec);
  assert.ok(mac.includes('NEW EQUI /T-301'));
  assert.ok(mac.includes('NEW CYLI /T-301-s1'));
  assert.ok(mac.includes('NEW NOZZ /T-301/N1'));
});

test('eccentric cone (偏心锥) propagates upward radial offset to downstream BKU kettle shell', () => {
  const ap: AssemblyPoint = {
    id: 'ap-bku-test',
    name: '装配点1',
    x: 0,
    z: 0,
    orientation: 'horizontal',
    components: [
      {
        id: 'ch',
        name: '管箱筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { r: 198, g: 136, b: 32, a: 255 },
        params: { shellKind: '筒体', diameter: 800, thickness: 14, length: 600, material: 'Q345R', density: 7.85 },
      },
      {
        id: 'cone',
        name: '偏心锥',
        type: 'cone',
        category: 'main',
        visible: true,
        color: { r: 198, g: 136, b: 32, a: 120 },
        params: {
          coneType: '偏心锥',
          edgeStyle: '双折边',
          smallDiameter: 800,
          largeDiameter: 1400,
          thickness: 14,
          totalLength: 600,
          r1: 60,
          r2: 80,
          h1: 30,
          h2: 30,
          flipped: true,
          material: 'Q345R',
          density: 7.85,
        },
      },
      {
        id: 'kettle',
        name: '釜体扩大筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { r: 198, g: 136, b: 32, a: 120 },
        params: { shellKind: '筒体', diameter: 1400, thickness: 14, length: 2800, material: 'Q345R', density: 7.85 },
      },
    ],
  };

  const placed = layoutAssemblyMainComponents(ap);
  assert.equal(placed[0].eccentricOffsetMm, 0);
  assert.equal(placed[1].eccentricOffsetMm, 0);
  assert.equal(placed[2].eccentricOffsetMm, 300); // (1400 - 800) / 2
});

test('interference check detects tight U-tube bundle clash and autoFix resolves it to zero errors', () => {
  const ap: AssemblyPoint = {
    id: 'ap-clash',
    name: '装配点1',
    x: 0,
    z: 0,
    orientation: 'horizontal',
    components: [
      {
        id: 'sh',
        name: '筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { r: 198, g: 136, b: 32, a: 120 },
        params: { shellKind: '筒体', diameter: 800, thickness: 14, length: 2600, material: 'Q345R', density: 7.85 },
      },
      {
        id: 'tb',
        name: 'U形管束',
        type: 'tube_layout',
        category: 'attachment',
        parentId: 'sh',
        visible: true,
        color: { r: 158, g: 168, b: 86, a: 255 },
        params: {
          tubeType: 'U形管',
          shellDiameter: 800,
          tubeOD: 25,
          tubeThickness: 2.5,
          tubePitch: 29,
          outerLimitDiameter: 785,
          pattern: '正三角形',
          passes: 2,
          tubeLength: 2200,
          baffleCount: 5,
          material: 'S30408',
          density: 7.93,
        },
      },
    ],
  };

  const before = checkInterferences([ap]);
  assert.equal(before.errorCount, 2);

  const fixed = autoFixInterferences([ap]);
  assert.equal(fixed.fixedCount, 2);

  const after = checkInterferences(fixed.assemblies);
  assert.equal(after.errorCount, 0);
});

test('buildVesselFromAiSpec constructs valid BKU reboiler assemblies and BOM from AI datasheet JSON', () => {
  const built = buildVesselFromAiSpec({
    vesselTag: 'E-408',
    vesselName: '轻烃釜式重沸器',
    equipmentType: 'bku_reboiler',
    orientation: 'horizontal',
    designCode: 'GB/T 151-2014',
    designPressureMpa: 2.4,
    workPressureMpa: 1.9,
    designTempC: 230,
    workTempC: 195,
    medium: 'C4 烃类',
    material: 'Q345R',
    shellDiameterMm: 800,
    kettleDiameterMm: 1400,
    shellLengthMm: 3000,
    shellThicknessMm: 14,
    supportType: 'saddle',
    tubeODMm: 25,
    tubePitchMm: 32,
    baffleCount: 6,
    nozzles: [
      { tag: 'N1', purpose: '壳程进料', dn: 150, pn: '300', angleDeg: 180, axialRatio: 0.25, isManhole: false },
      { tag: 'N2', purpose: '气相出口', dn: 350, pn: '300', angleDeg: 0, axialRatio: 0.5, isManhole: false },
    ],
    engineeringNotes: 'BKU 釜式重沸器',
  });

  assert.equal(built.spec.vesselTag, 'E-408');
  assert.equal(built.assemblies.length, 1);
  const hasEccentricCone = built.assemblies[0].components.some(
    (c) => c.type === 'cone' && (c.params as { coneType?: string }).coneType === '偏心锥'
  );
  assert.ok(hasEccentricCone, 'BKU AI build must include eccentric cone');
  const bom = generateBOM(built.assemblies);
  assert.ok(bom.totalWeightKg > 3000);
});

test('all VESSEL_PRESETS (including stacked_exchanger & tower) produce finite BOM weights and valid layouts', () => {
  for (const preset of VESSEL_PRESETS) {
    const bom = generateBOM(preset.assemblies);
    assert.ok(
      Number.isFinite(bom.totalWeightKg) && bom.totalWeightKg > 500,
      `Preset ${preset.id} must have finite positive weight, got ${bom.totalWeightKg}`
    );
    assert.ok(
      Number.isFinite(bom.totalInternalVolumeM3) && bom.totalInternalVolumeM3 > 0,
      `Preset ${preset.id} must have finite positive volume`
    );
  }

  const stacked = VESSEL_PRESETS.find((p) => p.id === 'stacked_exchanger');
  assert.ok(stacked, 'stacked_exchanger preset must exist');
  assert.equal(stacked.assemblies.length, 2);
  assert.equal(stacked.assemblies[0].z, 0);
  assert.equal(stacked.assemblies[1].z, 2200);

  const tower = VESSEL_PRESETS.find((p) => p.id === 'tower');
  assert.ok(tower, 'tower preset must exist');
  const towerLayout = layoutAssemblyMainComponents(tower.assemblies[0]);
  const skirt = towerLayout.find((m) => m.component.type === 'skirt')!;
  const botHead = towerLayout.find((m) => m.component.id === 't-head-1')!;
  assert.ok(botHead.startPosMm < skirt.endPosMm, 'Bottom head should nest inside top of skirt up to T.L.');
});

test('parseGhpvFileBuffer imports both native GHPV JSON and legacy desktop binary/text .ghpv files', () => {
  const sep = VESSEL_PRESETS.find((p) => p.id === 'large_separator')!;
  const jsonPayload = JSON.stringify({ version: 'GHPV-V2.1', spec: sep.spec, assemblies: sep.assemblies });
  const jsonBuf = new TextEncoder().encode(jsonPayload).buffer;
  const nativeRes = parseGhpvFileBuffer('1083-V-001.ghpv', jsonBuf);

  assert.equal(nativeRes.sourceFormat, 'ghpv_json');
  assert.equal(nativeRes.spec.vesselTag, sep.spec.vesselTag);
  assert.equal(nativeRes.assemblies.length, sep.assemblies.length);
  assert.ok(nativeRes.componentCount >= 8);

  // Simulate desktop Qt binary .ghpv with embedded UTF-16LE Chinese vessel metadata
  const metaStr = 'GHPV_BIN 卧式重沸器 BKU E-509 Di=1200 L=3800 δn=16 Q345R N1 进料 DN200 M1 人孔 DN500';
  const legacyBytes = new Uint8Array(16 + metaStr.length * 2);
  legacyBytes.set([0x47, 0x48, 0x50, 0x56, 0x00, 0x01, 0x06, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const dv = new DataView(legacyBytes.buffer);
  for (let i = 0; i < metaStr.length; i++) {
    dv.setUint16(16 + i * 2, metaStr.charCodeAt(i), true);
  }
  const legacyRes = parseGhpvFileBuffer('E-509釜式重沸器.ghpv', legacyBytes.buffer);
  assert.equal(legacyRes.sourceFormat, 'ghpv_legacy_binary');
  assert.equal(legacyRes.spec.vesselTag, 'E-509');
  assert.ok(legacyRes.assemblies[0].components.some((c) => c.type === 'cone'));
  assert.ok(legacyRes.componentCount >= 5);
});

test('extractTextFromCadDatasheetFile extracts clean TEXT/MTEXT engineering specs from DXF', () => {
  const sampleDxf = [
    '0', 'SECTION',
    '2', 'ENTITIES',
    '0', 'TEXT',
    '1', '设备位号: V-808 %%c2000x16 L=6000',
    '0', 'MTEXT',
    '1', '{\\fSimSun;设计压力 2.4MPa\\P材质 Q345R\\PN1 DN250 进料口}',
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');

  const out = extractTextFromCadDatasheetFile('V-808_总图.dxf', sampleDxf);
  assert.ok(out.includes('V-808 Ø2000x16 L=6000'));
  assert.ok(out.includes('设计压力 2.4MPa'));
  assert.ok(out.includes('材质 Q345R'));
});

test('3D CAD exporters produce valid STEP AP214, 80-col IGES 5.3, Binary STL, and OBJ+MTL', () => {
  const root = new THREE.Group();
  root.name = 'GHPV_ModelRoot';
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xc68820 })
  );
  shell.name = '筒体1';
  root.add(shell);

  const stats = computeSceneMeshStats(root);
  assert.ok(stats.triangleCount >= 24);
  assert.ok(Math.abs(stats.sizeMm[1] - 2400) < 10);

  const step = exportSceneToStepAp214(root, 'V-101', 'mm');
  assert.ok(step.startsWith('ISO-10303-21;'));
  assert.ok(step.includes('FACETED_BREP'));
  assert.ok(step.includes('CLOSED_SHELL'));
  assert.ok(step.includes('=PLANE('), 'STEP AP214 must emit genuine PLANE entities');
  assert.ok(!step.includes(',#17,.T.);'), 'FACE_SURFACE must reference a PLANE, never WorldAxis #17');
  assert.ok(step.endsWith('END-ISO-10303-21;'));

  const iges = exportSceneToIges(root, 'V-101', 'mm');
  const igesLines = iges.split('\n');
  assert.ok(igesLines.length > 20);
  for (const line of igesLines) {
    assert.equal(line.length, 80, `IGES line must be strictly 80 chars, got ${line.length}`);
  }
  assert.ok(iges.includes('9HV-101.igs'), 'IGES Global section must encode exact Hollerith length for filename');
  assert.ok(igesLines[igesLines.length - 1].includes('T      1'));

  const binStl = exportSceneToBinaryStl(root, 'V-101', 'mm');
  const dv = new DataView(binStl);
  const triCount = dv.getUint32(80, true);
  assert.equal(triCount, stats.triangleCount);
  assert.equal(binStl.byteLength, 84 + triCount * 50);

  const { obj, mtl } = exportSceneToObjAndMtl(root, 'V-101', 'mm');
  assert.ok(obj.includes('mtllib V-101.mtl'));
  assert.ok(obj.includes('g 筒体1_1'));
  assert.ok(mtl.includes('newmtl mat_c68820'));
});

test('all 46 GHPV ComponentTypes create valid defaults, Chinese labels, positive BOM mass, and real 3D meshes', () => {
  const allMainTypes: ComponentType[] = [
    'shell',
    'elliptical_head',
    'spherical_head',
    'spherical_tank',
    'cone',
    'equipment_flange',
    'gasket',
    'boot_shell',
    'skirt',
    'fixed_tubesheet',
    'u_tube_head',
    'expansion_joint',
  ];

  const allAttachmentTypes: ComponentType[] = [
    'nozzle_manhole',
    'saddle',
    'lug_support',
    'leg_support',
    'support_stand',
    'wind_guide',
    'horizontal_lug',
    'ring_lug',
    'lifting_ring',
    'stiffening_ring',
    'trunnion',
    'tray',
    'side_lug',
    'packing',
    'top_davit',
    'demister',
    'structural_steel',
    'weld_seam',
    'pad_plate',
    'tube_layout',
    'floating_hook',
    'pass_partition',
    'impingement_baffle',
    'nameplate',
    'spatial_piping',
    'insulation_support',
    'grounding_lug',
    'pipe_boss',
    'vortex_breaker',
    'bottom_orifice',
    'foundation_template',
    'gas_outlet_baffle',
    'sphere_column',
    'ladder_platform',
  ];

  const allTypes = [...allMainTypes, ...allAttachmentTypes];
  assert.equal(allTypes.length, 46, 'Must cover all 46 GHPV ComponentTypes');

  const hostShell = createDefaultComponent('shell', 0, undefined, 1400);
  const hostBuilt = buildAssembliesScene(
    [{ id: 'ap-host', name: '主机', x: 0, z: 0, orientation: 'vertical', components: [hostShell] }],
    null,
    'solid',
    [],
    0
  );
  const hostTris = computeSceneMeshStats(hostBuilt.rootGroup).triangleCount;
  assert.ok(hostTris > 0, 'Host shell must produce triangles');

  for (const t of allTypes) {
    const label = getComponentTypeLabel(t);
    assert.notEqual(label, t, `Missing Chinese label for ${t}`);

    const comp = createDefaultComponent(t, 0, hostShell.id, 1400);
    const m = computeComponentMetrics(comp);
    assert.ok(Number.isFinite(m.weightKg) && m.weightKg > 0, `${t} weightKg must be > 0, got ${m.weightKg}`);
    assert.ok(m.specText.length > 0, `${t} specText must not be empty`);
    assert.ok(m.standardText.length > 0, `${t} standardText must not be empty`);

    const comps = comp.category === 'main' ? [comp] : [hostShell, comp];
    const built = buildAssembliesScene(
      [{ id: `ap-${t}`, name: t, x: 0, z: 0, orientation: 'vertical', components: comps }],
      null,
      'solid',
      [],
      0
    );
    const tris = computeSceneMeshStats(built.rootGroup).triangleCount;
    if (comp.category === 'main') {
      assert.ok(tris > 12, `Main component ${t} must render real 3D triangles, got ${tris}`);
    } else {
      assert.ok(
        tris > hostTris + 12,
        `Attachment ${t} must add detailed 3D triangles beyond host shell (${hostTris}), got ${tris}`
      );
    }
  }
});

test('fixed secondary attachments maintain accurate 1:1 engineering proportions in 3D bounding boxes', () => {
  const getCompSize = (root: THREE.Object3D, compId: string): THREE.Vector3 => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.userData?.componentId === compId) {
        box.expandByObject(obj);
      }
    });
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  };

  const hostShell = createDefaultComponent('shell', 0, undefined, 1400);

  // 1. insulation_support: ring width = sizeB (80mm), so outer diameter = 1400 + 2*80 = 1560mm (NOT 1400 + 2*560!)
  const ins = createDefaultComponent('insulation_support', 0, hostShell.id, 1400);
  const insScene = buildAssembliesScene(
    [{ id: 'ap-ins', name: 'ins', x: 0, z: 0, orientation: 'vertical', components: [hostShell, ins] }],
    null,
    'solid',
    [],
    0
  );
  const insSize = getCompSize(insScene.rootGroup, ins.id);
  assert.ok(
    insSize.x > 1.5 && insSize.x < 1.66,
    `Insulation support OD should be ~1.56m (1:1), got ${insSize.x.toFixed(3)}m`
  );

  // 2. foundation_template: outer diameter = sizeA (1740mm), sleeves height ~0.096m (NOT 0.78m!)
  const tpl = createDefaultComponent('foundation_template', 0, hostShell.id, 1400);
  const tplScene = buildAssembliesScene(
    [{ id: 'ap-tpl', name: 'tpl', x: 0, z: 0, orientation: 'vertical', components: [hostShell, tpl] }],
    null,
    'solid',
    [],
    0
  );
  const tplSize = getCompSize(tplScene.rootGroup, tpl.id);
  assert.ok(
    Math.abs(tplSize.x - 1.74) < 0.05,
    `Foundation template OD should match sizeA=1.74m, got ${tplSize.x.toFixed(3)}m`
  );
  assert.ok(
    tplSize.y < 0.2,
    `Foundation template sleeve height should be compact (<0.2m), got ${tplSize.y.toFixed(3)}m`
  );

  // 3. support_stand: sizeB = height (520mm) must drive vertical height, sizeA = pipe OD (168mm)
  const stand = createDefaultComponent('support_stand', 0, hostShell.id, 1400);
  const standScene = buildAssembliesScene(
    [{ id: 'ap-stand', name: 'stand', x: 0, z: 0, orientation: 'vertical', components: [hostShell, stand] }],
    null,
    'solid',
    [],
    0
  );
  const standSize = getCompSize(standScene.rootGroup, stand.id);
  assert.ok(
    standSize.y > 0.48 && standSize.y < 0.65,
    `Support stand height should reflect sizeB=520mm (~0.53m), got ${standSize.y.toFixed(3)}m`
  );
});

test('all standard VESSEL_PRESETS pass interference check cleanly and BKU isolates Ep 11 U-tube clash', () => {
  for (const preset of VESSEL_PRESETS) {
    const report = checkInterferences(preset.assemblies);
    if (preset.id === 'bku_reboiler') {
      assert.equal(
        report.errorCount,
        1,
        `BKU preset should isolate the single Ep 11 U-tube clash, got ${report.issues.map((i) => i.title).join(', ')}`
      );
      assert.ok(report.issues[0]?.title.includes('U形管'), 'BKU clash should be the U-tube bundle ligament clash');
      const fixed = autoFixInterferences(preset.assemblies);
      const after = checkInterferences(fixed.assemblies);
      assert.equal(after.errorCount, 0, 'BKU autoFix should clear all conflicts');
    } else {
      assert.equal(
        report.errorCount,
        0,
        `Preset ${preset.id} should have 0 interference errors, got: ${report.issues.map((i) => i.title).join(', ')}`
      );
    }
  }
});





