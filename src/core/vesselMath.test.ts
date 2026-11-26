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
  autoArrangeAssemblies,
  computeShellUnrollData,
  generateShellUnrollDxf,
} from './vesselMath';
import * as THREE from 'three';
import type { AssemblyPoint, ComponentType, TechnicalSpec } from '../types/vessel';
import { VESSEL_PRESETS, createDefaultComponent } from '../data/presets';
import { buildAssembliesScene } from '../scene/vesselGeometry';
import {
  decodeTextBufferSmart,
  extractTextFromCadDatasheetFile,
  parseGhpvFileBuffer,
} from './ghpvImporter';
import {
  computeSceneMeshStats,
  exportSceneToBinaryStl,
  exportSceneToIges,
  exportSceneToObjAndMtl,
  exportSceneToStepAp214,
  loadEmbeddedMeshesToGroup,
  loadExternal3DModelBuffer,
  parseOpenCascadeBrepToGeometry,
} from '../scene/cadExporters';
import {
  computeFlangeDimensions,
  createDrilledFlangePlateGeometry,
  parseBoltDiameterMm,
} from '../scene/flangeGeometry';
import { gzipSync, strToU8, zipSync } from 'fflate';

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

test('autoArrangeAssemblies optimizes multi-assembly spatial layout, internal ordering, spacing, and preserves immutability', () => {
  // 1. Out-of-order components + overlapping nozzles + cramped saddles + overlapping horizontal assemblies
  const smallShell = createDefaultComponent('shell', 0, undefined, 1000);
  const largeShell = createDefaultComponent('shell', 0, undefined, 1600);
  const startHead = createDefaultComponent('elliptical_head', 0, undefined, 1600);
  const endHead = createDefaultComponent('elliptical_head', 1, undefined, 1600);
  (endHead.params as { flipped: boolean }).flipped = true;

  const nozA = createDefaultComponent('nozzle_manhole', 0, largeShell.id, 1600);
  const nozB = createDefaultComponent('nozzle_manhole', 1, largeShell.id, 1600);
  (nozA.params as { axialOffset: number; angleDeg: number }).axialOffset = 1000;
  (nozA.params as { axialOffset: number; angleDeg: number }).angleDeg = 0;
  (nozB.params as { axialOffset: number; angleDeg: number }).axialOffset = 1050;
  (nozB.params as { axialOffset: number; angleDeg: number }).angleDeg = 0;

  const sad1 = createDefaultComponent('saddle', 0, largeShell.id, 1600);
  const sad2 = createDefaultComponent('saddle', 1, largeShell.id, 1600);
  (sad1.params as { axialOffset: number }).axialOffset = 1400;
  (sad2.params as { axialOffset: number }).axialOffset = 1500;

  const messyHorizontal: AssemblyPoint[] = [
    {
      id: 'ap-small',
      name: '小换热器',
      x: 400,
      z: 0,
      orientation: 'horizontal',
      components: [smallShell],
    },
    {
      id: 'ap-large',
      name: '大主壳体',
      x: -350,
      z: 100,
      orientation: 'horizontal',
      // Deliberately scrambled order: endHead -> shell -> startHead, nozzles colliding, saddles cramped
      components: [endHead, largeShell, startHead, nozB, nozA, sad2, sad1],
    },
  ];

  const snapshotBefore = JSON.stringify(messyHorizontal);
  const res = autoArrangeAssemblies(messyHorizontal);

  // Must not mutate input (essential for undo reliability)
  assert.equal(JSON.stringify(messyHorizontal), snapshotBefore);
  assert.equal(res.changed, true);
  assert.ok(res.movedAssemblyCount >= 2);
  assert.ok(res.reorderedComponentCount > 0);
  assert.ok(res.spacingAdjustedCount > 0);

  // Larger horizontal vessel placed at bottom (Z=0, X=0), smaller vessel stacked cleanly above with non-overlapping Z
  assert.equal(res.assemblies[0].id, 'ap-large');
  assert.equal(res.assemblies[0].x, 0);
  assert.equal(res.assemblies[0].z, 0);
  assert.equal(res.assemblies[1].id, 'ap-small');
  assert.equal(res.assemblies[1].x, 0);
  assert.ok(res.assemblies[1].z >= 2000, `Expected non-overlapping stacked Z >= 2000mm, got ${res.assemblies[1].z}`);

  // Main components inside ap-large reordered to: startHead -> largeShell -> endHead
  const arrangedMains = res.assemblies[0].components.filter((c) => c.category === 'main');
  assert.deepEqual(
    arrangedMains.map((c) => c.id),
    [startHead.id, largeShell.id, endHead.id]
  );

  // Colliding nozzles spread apart cleanly
  const arrangedNozzles = res.assemblies[0].components
    .filter((c) => c.type === 'nozzle_manhole')
    .map((c) => (c.params as { axialOffset: number }).axialOffset);
  assert.ok(
    Math.abs(arrangedNozzles[1] - arrangedNozzles[0]) >= 300,
    `Nozzles should be separated after arrange, got offsets ${arrangedNozzles.join(', ')}`
  );

  // Cramped saddles spread to exact 0.2L (400mm) and 0.8L (1600mm) on 2000mm shell
  const arrangedSaddles = res.assemblies[0].components
    .filter((c) => c.type === 'saddle')
    .map((c) => (c.params as { axialOffset: number }).axialOffset);
  assert.deepEqual(arrangedSaddles, [400, 1600]);

  // Running autoArrangeAssemblies a second time should be idempotent (changed === false)
  const secondPass = autoArrangeAssemblies(res.assemblies);
  assert.equal(secondPass.changed, false);

  // 2. Vertical / mixed plant row layout: side-by-side along +X with safe walkway clearance
  const vertTowerShell = createDefaultComponent('shell', 0, undefined, 1800);
  const vertSmallShell = createDefaultComponent('shell', 0, undefined, 1000);
  const mixedRow: AssemblyPoint[] = [
    { id: 'ap-v-small', name: '小立罐', x: 0, z: 300, orientation: 'vertical', components: [vertSmallShell] },
    { id: 'ap-v-big', name: '大塔', x: 100, z: 0, orientation: 'vertical', components: [vertTowerShell] },
  ];
  const rowRes = autoArrangeAssemblies(mixedRow);
  assert.equal(rowRes.changed, true);
  assert.equal(rowRes.assemblies[0].id, 'ap-v-big');
  assert.equal(rowRes.assemblies[0].x, 0);
  assert.equal(rowRes.assemblies[0].z, 0);
  assert.equal(rowRes.assemblies[1].id, 'ap-v-small');
  assert.ok(rowRes.assemblies[1].x >= 2500, `Expected wide walkway X spacing >= 2500mm, got ${rowRes.assemblies[1].x}`);
});

test('precision CAD flanges obey ASME/HG/NB/T hub clearance, drilled bolt holes, and paired joint invariants', () => {
  // 1. Metric bolt spec parsing
  assert.equal(parseBoltDiameterMm('M27'), 27);
  assert.equal(parseBoltDiameterMm('M20x110'), 20);
  assert.equal(parseBoltDiameterMm(undefined, 18), 18);

  // 2. WN-RF DN150 PN300 pipe flange: hub base must stay strictly inside BCD & nut clearance (never a giant cone to flangeOD!)
  const wnPipe = computeFlangeDimensions({
    style: 'WN',
    facing: 'RF',
    boreDiameterMm: 152.3,
    pipeODMm: 168.3,
    flangeODMm: 318,
    flangeThicknessMm: 36.5,
    boltCount: 12,
  });
  assert.ok(wnPipe.hubHeightMm > 20, `WN flange must have real tapered hub, got ${wnPipe.hubHeightMm}mm`);
  assert.ok(
    wnPipe.rHubBaseMm < wnPipe.bcdRMm - wnPipe.boltHoleRMm,
    `WN hub root (${wnPipe.rHubBaseMm.toFixed(1)}mm) must stay strictly inside bolt holes (${(wnPipe.bcdRMm - wnPipe.boltHoleRMm).toFixed(1)}mm)`
  );
  assert.ok(
    wnPipe.rHubBaseMm < wnPipe.rOutMm - 25,
    `WN hub root (${wnPipe.rHubBaseMm.toFixed(1)}mm) must leave flat back face well inside flange OD (${wnPipe.rOutMm}mm)`
  );
  assert.ok(
    wnPipe.rRfOuterMm < wnPipe.bcdRMm - wnPipe.boltHoleRMm,
    `Raised face outer radius (${wnPipe.rRfOuterMm.toFixed(1)}mm) must sit inside bolt holes`
  );

  // 3. Drilled flange plate punches exact boltCount circular holes + center bore
  const drilled = createDrilledFlangePlateGeometry(wnPipe, 48);
  assert.equal(drilled.holeCount, 12);
  assert.ok(drilled.geometry.attributes.position.count > 400, 'Drilled beveled plate must be high precision');

  // 4. Equipment flange DN1000 PN2.5 (NB/T 47023) + Blind Cover (BL) + Flat Plate (PL)
  const eqWn = computeFlangeDimensions({
    style: 'WN',
    facing: 'RF',
    boreDiameterMm: 1000,
    pipeODMm: 1028,
    flangeODMm: 1160,
    flangeThicknessMm: 52,
    totalHeightMm: 120,
    boltCircleMm: 1110,
    boltCount: 36,
    boltSpec: 'M27',
  });
  assert.equal(eqWn.boltCount, 36);
  assert.equal(eqWn.bcdRMm, 555);
  assert.ok(eqWn.rHubBaseMm < eqWn.bcdRMm - eqWn.boltHoleRMm);

  const blind = computeFlangeDimensions({
    style: 'BL',
    facing: 'RF',
    boreDiameterMm: 1000,
    pipeODMm: 1028,
    flangeODMm: 1160,
    flangeThicknessMm: 68,
    boltCircleMm: 1100,
    boltCount: 36,
    boltSpec: 'M30',
  });
  assert.equal(blind.isBlind, true);
  assert.equal(blind.rInMm, 0);
  assert.equal(blind.hubHeightMm, 0);

  const plateFlg = computeFlangeDimensions({
    style: 'PL',
    facing: 'RF',
    boreDiameterMm: 150,
    pipeODMm: 168.3,
    flangeODMm: 280,
    flangeThicknessMm: 24,
    boltCount: 8,
  });
  assert.equal(plateFlg.hubHeightMm, 0);

  // 5. Paired equipment flanges in U-tube exchanger preset produce ONE unified bolt set (no duplicate overlapping rings)
  const uExchanger = VESSEL_PRESETS.find((pr) =>
    pr.assemblies.some((ap) => ap.components.some((c) => c.id === 'ue-flg-1'))
  );
  assert.ok(uExchanger, 'U-tube exchanger preset containing ue-flg-1 must exist');
  const built = buildAssembliesScene(uExchanger.assemblies, null, 'solid', [], 0);
  const flg1Insts: THREE.InstancedMesh[] = [];
  const flg2Insts: THREE.InstancedMesh[] = [];
  built.rootGroup.traverse((obj) => {
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      if (obj.userData.componentId === 'ue-flg-1') flg1Insts.push(obj as THREE.InstancedMesh);
      if (obj.userData.componentId === 'ue-flg-2') flg2Insts.push(obj as THREE.InstancedMesh);
    }
  });
  assert.ok(flg1Insts.length >= 5, 'Primary flange in paired joint should host unified stud/washer/nut InstancedMeshes');
  assert.equal(flg2Insts.length, 0, 'Secondary flange in paired joint must suppress duplicate overlapping bolts');
});

test('open-file importer rejects empty, corrupt JSON, and opaque ZIP binary files instead of fabricating fake models', () => {
  // 1. Empty buffer
  assert.throws(
    () => parseGhpvFileBuffer('empty.ghpv', new ArrayBuffer(0)),
    /为空（0 字节）/
  );

  // 2. Corrupt JSON syntax
  const badJsonBuf = new TextEncoder().encode('{"spec": { broken json').buffer;
  assert.throws(
    () => parseGhpvFileBuffer('broken.json', badJsonBuf),
    /JSON 格式损坏/
  );

  // 3. Valid JSON without GHPV schema
  const unrelatedJsonBuf = new TextEncoder().encode(JSON.stringify({ hello: 'world' })).buffer;
  assert.throws(
    () => parseGhpvFileBuffer('unrelated.json', unrelatedJsonBuf),
    /缺少 GHPV 工程结构/
  );

  // 4. Opaque ZIP container renamed to .ghpv (PK\x03\x04 with no readable vessel fields)
  const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00, 0x08, 0x00, 0xab, 0xcd, 0xef, 0x99]);
  assert.throws(
    () => parseGhpvFileBuffer('encrypted_archive.ghpv', zipBytes.buffer),
    /ZIP 压缩包容器/
  );

  // 5. Native GHPV JSON sanitization: repairs missing color/visible and skips invalid components cleanly
  const dirtyNative = JSON.stringify({
    version: 'GHPV-V2.1',
    spec: { vesselTag: 'V-999' },
    assemblies: [
      {
        id: 'ap-1',
        name: '装配点1',
        orientation: 'horizontal',
        components: [
          {
            id: 's1',
            name: '筒体1',
            type: 'shell',
            params: { shellKind: '筒体', diameter: 1200, thickness: 12, length: 3000, material: 'Q345R', density: 7.85 },
          },
          {
            id: 'bad-1',
            name: '未知损坏元件',
            type: 'unknown_corrupt_type',
            params: {},
          },
        ],
      },
    ],
  });
  const sanitized = parseGhpvFileBuffer('dirty.ghpv', new TextEncoder().encode(dirtyNative).buffer);
  assert.equal(sanitized.sourceFormat, 'ghpv_json');
  assert.equal(sanitized.componentCount, 1);
  assert.equal(sanitized.assemblies[0].components[0].visible, true);
  assert.equal(sanitized.assemblies[0].components[0].color.a, 255);
  assert.ok(sanitized.warnings && sanitized.warnings.some((w) => w.includes('已跳过 1 个')));

  // 6. Smart decoder handles GB18030 Chinese bytes without mojibake
  // GBK bytes for "筒体" (CD B2 CC E5) + ASCII "=1200"
  const gbkBytes = new Uint8Array([0xcd, 0xb2, 0xcc, 0xe5, 0x3d, 0x31, 0x32, 0x30, 0x30]);
  const decodedGbk = decodeTextBufferSmart(gbkBytes.buffer);
  assert.equal(decodedGbk, '筒体=1200');
});

test('external 3D model loader round-trips exported STEP AP214, IGES 5.3, Binary STL, and OBJ cleanly', async () => {
  const root = new THREE.Group();
  root.name = 'GHPV_ModelRoot';
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xc68820 })
  );
  shell.name = '筒体1';
  root.add(shell);

  // STEP AP214 round-trip
  const stepText = exportSceneToStepAp214(root, 'V-101', 'mm');
  const stepLoaded = await loadExternal3DModelBuffer('V-101.stp', new TextEncoder().encode(stepText).buffer);
  assert.ok(stepLoaded.stats.triangleCount >= 24, `STEP loader should parse triangles, got ${stepLoaded.stats.triangleCount}`);
  assert.ok(Math.abs(stepLoaded.stats.sizeMm[1] - 2400) < 20, `STEP loader should preserve mm->m scale, got ${stepLoaded.stats.sizeMm[1]}mm`);

  // IGES 5.3 round-trip
  const igesText = exportSceneToIges(root, 'V-101', 'mm');
  const igesLoaded = await loadExternal3DModelBuffer('V-101.igs', new TextEncoder().encode(igesText).buffer);
  assert.ok(igesLoaded.stats.triangleCount >= 24, `IGES loader should parse triangles, got ${igesLoaded.stats.triangleCount}`);
  assert.ok(Math.abs(igesLoaded.stats.sizeMm[1] - 2400) < 20);

  // Binary STL round-trip
  const binStl = exportSceneToBinaryStl(root, 'V-101', 'mm');
  const stlLoaded = await loadExternal3DModelBuffer('V-101.stl', binStl);
  assert.ok(stlLoaded.stats.triangleCount >= 24);
  assert.ok(Math.abs(stlLoaded.stats.sizeMm[1] - 2400) < 20);

  // OBJ round-trip
  const { obj } = exportSceneToObjAndMtl(root, 'V-101', 'mm');
  const objLoaded = await loadExternal3DModelBuffer('V-101.obj', new TextEncoder().encode(obj).buffer);
  assert.ok(objLoaded.stats.triangleCount >= 24);

  // Empty & NURBS-only STEP rejection
  await assert.rejects(
    () => loadExternal3DModelBuffer('empty.stl', new ArrayBuffer(0)),
    /为空（0 字节）/
  );
  await assert.rejects(
    () => loadExternal3DModelBuffer('nurbs.stp', new TextEncoder().encode('ISO-10303-21;\nDATA;\nENDSEC;').buffer),
    /面片化 STEP/
  );
});

test('computeShellUnrollData and generateShellUnrollDxf produce 1:1 neutral-axis unroll, weld checks, and valid DXF', () => {
  const tower = VESSEL_PRESETS.find((p) => p.id === 'tower');
  assert.ok(tower, 'tower preset must exist');
  const sheets = computeShellUnrollData(tower.assemblies);
  assert.ok(sheets.length >= 1, 'Tower must produce at least one unroll shell sheet');

  // Verify exact neutral-axis developed width W = π × (Di + δ)
  for (const s of sheets) {
    const expectedW = Math.round(Math.PI * (s.innerDiameterMm + s.thicknessMm) * 10) / 10;
    assert.equal(s.developedWidthMm, expectedW);
    assert.ok(s.plateWeightKg > 0);
  }

  // Test synthetic shell with one safe nozzle (180°) and one weld-seam colliding nozzle (0°)
  const testShell = createDefaultComponent('shell', 0, undefined, 1000);
  (testShell.params as { diameter: number; thickness: number; length: number }).diameter = 1000;
  (testShell.params as { diameter: number; thickness: number; length: number }).thickness = 10;
  (testShell.params as { diameter: number; thickness: number; length: number }).length = 2000;

  const nozSafe = createDefaultComponent('nozzle_manhole', 0, testShell.id, 1000);
  Object.assign(nozSafe.params, {
    tag: 'N1',
    dn: 150,
    pipeOD: 168,
    axialOffset: 800,
    angleDeg: 180,
    hasPad: true,
    padOD: 290,
  });

  const nozWeldHit = createDefaultComponent('nozzle_manhole', 1, testShell.id, 1000);
  Object.assign(nozWeldHit.params, {
    tag: 'N2',
    dn: 100,
    pipeOD: 114,
    axialOffset: 1200,
    angleDeg: 0,
    hasPad: false,
  });

  const synthSheets = computeShellUnrollData([
    {
      id: 'ap-u',
      name: '装配点1',
      x: 0,
      z: 0,
      orientation: 'vertical',
      components: [testShell, nozSafe, nozWeldHit],
    },
  ]);
  assert.equal(synthSheets.length, 1);
  const sheet = synthSheets[0];
  const expectedW = Math.round(Math.PI * 1010 * 10) / 10; // 3173.0 mm
  assert.equal(sheet.developedWidthMm, expectedW);
  assert.equal(sheet.openings.length, 2);
  assert.equal(sheet.weldWarningCount, 1);

  const opN1 = sheet.openings.find((o) => o.tag === 'N1')!;
  assert.equal(opN1.cutoutDiaMm, 170);
  assert.equal(opN1.padOuterDiaMm, 290);
  assert.ok(Math.abs(opN1.arcXMm - expectedW / 2) <= 0.2);
  assert.equal(opN1.axialYMm, 800);
  assert.equal(opN1.weldSeamWarning, false);

  const opN2 = sheet.openings.find((o) => o.tag === 'N2')!;
  assert.equal(opN2.weldSeamWarning, true);
  assert.ok(opN2.weldSeamClearanceMm < 0, 'Nozzle at 0° sits directly on longitudinal weld seam');

  // Verify DXF generation
  const dxf = generateShellUnrollDxf(sheet, tower.spec);
  assert.ok(dxf.includes('SECTION') && dxf.includes('ENTITIES'));
  assert.ok(dxf.includes('PLATE_OUTLINE') && dxf.includes('NOZZLE_CUTOUT') && dxf.includes('PAD_RING'));
  assert.ok(dxf.includes('CIRCLE'));
  assert.ok(dxf.includes('N1 DN150 D=170'));
  assert.ok(dxf.trimEnd().endsWith('EOF'));

  // Spherical-only vessel returns zero cylindrical unroll sheets
  const sphere = VESSEL_PRESETS.find((p) => p.id === 'spherical_tank')!;
  assert.equal(computeShellUnrollData(sphere.assemblies).length, 0);
});

test('conical_vertical preset and 1:1 tube-aligned perforated baffles build valid 3D meshes', () => {
  // 1. Conical vertical vessel (平底锥壳立式容器)
  const cv = VESSEL_PRESETS.find((p) => p.id === 'conical_vertical');
  assert.ok(cv, 'conical_vertical preset must exist');
  assert.equal(cv.assemblies[0].orientation, 'vertical');
  assert.ok(cv.assemblies[0].components.some((c) => c.type === 'cone'));
  assert.ok(cv.assemblies[0].components.some((c) => c.type === 'leg_support'));
  assert.ok(
    cv.assemblies[0].components.some(
      (c) => c.type === 'equipment_flange' && (c.params as { flangeType?: string }).flangeType === '法兰盖(BL)'
    ),
    'conical_vertical must include bolted flat blind cover (平底/平盖)'
  );
  const cvScene = buildAssembliesScene(cv.assemblies, null, 'solid', [], 0);
  const cvStats = computeSceneMeshStats(cvScene.rootGroup);
  assert.ok(cvStats.triangleCount > 2000, `conical_vertical should render detailed 3D mesh, got ${cvStats.triangleCount}`);

  // 2. Fixed tubesheet & U-tube exchanger baffles build cleanly with real tube-aligned perforation holes
  for (const presetId of ['exchanger', 'u_exchanger']) {
    const preset = VESSEL_PRESETS.find((p) => p.id === presetId)!;
    const built = buildAssembliesScene(preset.assemblies, null, 'solid', [], 0.35);
    const stats = computeSceneMeshStats(built.rootGroup);
    assert.ok(stats.triangleCount > 5000, `${presetId} should render tubes + perforated baffles, got ${stats.triangleCount}`);
    // Verify no NaN vertices in any baffle ExtrudeGeometry
    built.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const pos = (obj as THREE.Mesh).geometry.attributes.position;
        if (pos) {
          for (let i = 0; i < Math.min(pos.count, 30); i++) {
            assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
          }
        }
      }
    });
  }
});

test('GHPV native JSON import preserves extra metadata and auto-rebinds orphan attachments', () => {
  const payload = {
    version: 'GHPV-V2.1',
    author: '张工',
    clientOrder: 'PO-2026-088',
    spec: {
      vesselTag: 'V-901',
      vesselName: '原料缓冲罐',
      designCode: 'GB/T 150.1~150.4-2024',
      vesselClass: '三类 (第III类)',
      designPressure: 3.2,
      workPressure: 2.6,
      testPressure: 4.0,
      designTemp: 180,
      workTemp: 145,
      medium: '富氢循环气',
      corrosionAllowance: 3,
      weldEfficiency: 1.0,
      ndtMethod: '100% RT+UT',
      heatTreatment: '焊后热处理 (PWHT)',
      companyName: '高惠工程设计院',
      projectName: '200万吨/年加氢装置',
      drawingNo: 'GH-V901-01',
      customPlantArea: '装置二区',
    },
    assemblies: [
      {
        id: 'ap-1',
        name: '装配点1',
        x: 0,
        z: 0,
        orientation: 'horizontal',
        components: [
          {
            id: 'sh-main',
            name: '筒体1',
            type: 'shell',
            category: 'main',
            visible: true,
            color: { r: 198, g: 136, b: 32, a: 255 },
            params: {
              shellKind: '筒体',
              diameter: 1800,
              thickness: 22,
              length: 4800,
              material: 'Q345R',
              density: 7.85,
            },
          },
          {
            id: 'nz-orphan',
            name: 'N1',
            type: 'nozzle_manhole',
            category: 'attachment',
            parentId: 'non-existent-shell-id',
            visible: true,
            color: { r: 72, g: 134, b: 198, a: 255 },
            params: {
              tag: 'N1',
              purpose: '高压进料口',
              dn: 200,
              pn: '600',
              isManhole: false,
              flangeSpec: 'HG/T 20592-2009',
              flangeType: 'WN(带颈对焊)',
              flangeOD: 380,
              flangeThickness: 44,
              boltCount: 12,
              pipeOD: 219.1,
              pipeThickness: 12,
              pipeMaterial: '20#',
              protrusion: 280,
              innerProtrusion: 30,
              axialOffset: 900,
              angleDeg: 45,
              hasPad: true,
              padOD: 360,
              padThickness: 18,
              hasBlindCover: true,
              material: '16MnIII',
              density: 7.85,
            },
          },
        ],
      },
    ],
  };

  const buf = new TextEncoder().encode(JSON.stringify(payload)).buffer;
  const res = parseGhpvFileBuffer('V-901_原料缓冲罐.ghpv', buf);

  assert.equal(res.sourceFormat, 'ghpv_json');
  assert.equal(res.spec.vesselTag, 'V-901');
  assert.equal(res.spec.vesselClass, '三类 (第III类)');
  assert.equal(res.spec.medium, '富氢循环气');
  assert.equal(res.spec.heatTreatment, '焊后热处理 (PWHT)');
  assert.equal(res.spec.projectName, '200万吨/年加氢装置');

  // Orphan attachment must be automatically rebound to sh-main
  assert.equal(res.reboundAttachmentCount, 1);
  const reboundNozzle = res.assemblies[0].components.find((c) => c.id === 'nz-orphan')!;
  assert.equal(reboundNozzle.parentId, 'sh-main');
  assert.ok(
    res.warnings?.some((w) => w.includes('挂载到主构件')),
    'Expected a warning describing orphan attachment rebinding'
  );

  // Extra metadata must retain author, clientOrder, and customPlantArea
  const metaMap = new Map((res.extraMetadata || []).map((m) => [m.key, m.value]));
  assert.equal(metaMap.get('author'), '张工');
  assert.equal(metaMap.get('clientOrder'), 'PO-2026-088');
  assert.equal(metaMap.get('customPlantArea'), '装置二区');

  // Enriched nozzle metrics must expose flange, bolt, offset, extension, pad, and blind info
  const nzMetrics = computeComponentMetrics(reboundNozzle);
  const labels = new Set(nzMetrics.extraProperties.map((p) => p.label));
  assert.ok(labels.has('法兰型式'));
  assert.ok(labels.has('法兰外径×厚(mm)'));
  assert.ok(labels.has('螺栓数量'));
  assert.ok(labels.has('接管外径×壁厚'));
  assert.ok(labels.has('轴向距离(mm)'));
  assert.ok(labels.has('外伸长度L1(mm)'));
  assert.ok(labels.has('内伸长度L2(mm)'));
  assert.ok(labels.has('方位角(°)'));
  assert.ok(labels.has('补强圈'));
  assert.ok(labels.has('法兰盲盖'));
});

test('GHPV desktop XML/text import extracts all 17 TechnicalSpec fields, rich nozzles, and extra metadata', () => {
  const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
<GHPVProject>
  <VesselTag>E-606</VesselTag>
  <VesselName>加氢原料预热换热器</VesselName>
  <VesselClass>三类</VesselClass>
  <DesignCode>GB/T 151-2014</DesignCode>
  <DesignPressure>4.2</DesignPressure>
  <WorkPressure>3.6</WorkPressure>
  <TestPressure>5.25</TestPressure>
  <DesignTemp>280</DesignTemp>
  <WorkTemp>245</WorkTemp>
  <Medium>加氢精制柴油</Medium>
  <CorrosionAllowance>3.0</CorrosionAllowance>
  <WeldEfficiency>1.0</WeldEfficiency>
  <NDT>100% RT (NB/T 47013.2-II级)</NDT>
  <HeatTreatment>焊后消除应力热处理</HeatTreatment>
  <DrawingNo>GH-E606-2026</DrawingNo>
  <ProjectName>镇海炼化改造工程</ProjectName>
  <CompanyName>高惠石化装备有限公司</CompanyName>
  <Designer>李工</Designer>
  <Revision>Rev.B</Revision>
  <EquipmentType>固定管板换热器</EquipmentType>
  <Material>15CrMoR</Material>
  <Diameter>1000</Diameter>
  <Length>4200</Length>
  <Thickness>18</Thickness>
  <TubeOD>25</TubeOD>
  <TubePitch>32</TubePitch>
  <BaffleCount>9</BaffleCount>
  <Nozzles>
    N1 壳程进口 DN200 PN600 0° 0.16
    N2 壳程出口 DN200 PN600 180° 0.84
    N3 排净口 DN50 PN600 180° 0.50
  </Nozzles>
</GHPVProject>`;

  const buf = new TextEncoder().encode(xmlText).buffer;
  const res = parseGhpvFileBuffer('E-606_换热器.xml', buf);

  assert.equal(res.sourceFormat, 'ghpv_xml_text');
  assert.equal(res.spec.vesselTag, 'E-606');
  assert.equal(res.spec.vesselName, '加氢原料预热换热器');
  assert.equal(res.spec.vesselClass, '三类');
  assert.equal(res.spec.designCode, 'GB/T 151-2014');
  assert.equal(res.spec.designPressure, 4.2);
  assert.equal(res.spec.workPressure, 3.6);
  assert.equal(res.spec.testPressure, 5.25);
  assert.equal(res.spec.designTemp, 280);
  assert.equal(res.spec.workTemp, 245);
  assert.equal(res.spec.medium, '加氢精制柴油');
  assert.equal(res.spec.corrosionAllowance, 3);
  assert.equal(res.spec.weldEfficiency, 1.0);
  assert.ok(res.spec.ndtMethod.includes('100% RT'));
  assert.equal(res.spec.heatTreatment, '焊后消除应力热处理');
  assert.equal(res.spec.drawingNo, 'GH-E606-2026');
  assert.equal(res.spec.projectName, '镇海炼化改造工程');
  assert.equal(res.spec.companyName, '高惠石化装备有限公司');

  const nozzles = res.assemblies[0].components.filter((c) => c.type === 'nozzle_manhole');
  assert.equal(nozzles.length, 3);
  const n1 = nozzles.find((c) => (c.params as { tag: string }).tag === 'N1')!;
  const n1p = n1.params as { dn: number; pn: string; angleDeg: number; purpose: string };
  assert.equal(n1p.dn, 200);
  assert.equal(n1p.pn, '600');
  assert.equal(n1p.angleDeg, 0);
  assert.ok(n1p.purpose.includes('壳程进口'));

  // Extra metadata must include non-standard XML tags like Designer & Revision
  const xmlMeta = new Map((res.extraMetadata || []).map((m) => [m.key, m.value]));
  assert.equal(xmlMeta.get('Designer'), '李工');
  assert.equal(xmlMeta.get('Revision'), 'Rev.B');
});

test('ZIP-packaged desktop .ghpv with FreeCAD/OCC Document.xml and .brp mesh unpacks cleanly', async () => {
  const documentXml = `<?xml version="1.0" encoding="utf-8"?>
<Document SchemaVersion="4" ProgramVersion="GHPV-Desktop 4.2">
  <Objects Count="2">
    <Object type="Part::Feature" name="ShellBody"/>
    <Object type="GHPV::Nozzle" name="N1"/>
  </Objects>
  <ObjectData Count="2">
    <Object name="ShellBody">
      <Properties Count="11">
        <Property name="VesselTag" type="App::PropertyString"><String value="V-707"/></Property>
        <Property name="VesselName" type="App::PropertyString"><String value="加氢脱硫反应器"/></Property>
        <Property name="DesignCode" type="App::PropertyString"><String value="GB/T 150-2024"/></Property>
        <Property name="Diameter" type="App::PropertyLength"><Float value="1600"/></Property>
        <Property name="Length" type="App::PropertyLength"><Float value="4500"/></Property>
        <Property name="Thickness" type="App::PropertyLength"><Float value="24"/></Property>
        <Property name="DesignPressure" type="App::PropertyFloat"><Float value="3.8"/></Property>
        <Property name="DesignTemp" type="App::PropertyFloat"><Float value="260"/></Property>
        <Property name="Material" type="App::PropertyString"><String value="Q345R"/></Property>
        <Property name="Medium" type="App::PropertyString"><String value="循环氢"/></Property>
        <Property name="VendorCode" type="App::PropertyString"><String value="GH-2026-07"/></Property>
      </Properties>
    </Object>
  </ObjectData>
</Document>`;

  // Minimal valid OpenCASCADE ASCII BRep Poly_Triangulation (a 4-vertex tetrahedron in mm)
  const sampleBrep = `DBRep_DrawableShape
CASCADE Topology V1, (c) Matra-Datavision
Triangulations 1
4 4 0
0.15
0 0 0
1600 0 0
800 1600 0
800 800 4500
1 2 3
1 2 4
2 3 4
3 1 4
`;

  const zipped = zipSync({
    'Document.xml': strToU8(documentXml),
    'PartShape.brp': strToU8(sampleBrep),
  });
  const zipArrayBuf = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);

  const res = parseGhpvFileBuffer('7.ghpv', zipArrayBuf);
  assert.equal(res.sourceFormat, 'ghpv_zip_archive');
  assert.equal(res.spec.vesselTag, 'V-707');
  assert.equal(res.spec.vesselName, '加氢脱硫反应器');
  assert.equal(res.spec.designPressure, 3.8);
  assert.equal(res.spec.designTemp, 260);
  assert.equal(res.spec.medium, '循环氢');
  assert.ok(res.archiveEntries && res.archiveEntries.length === 2);
  assert.ok(res.embeddedMeshes && res.embeddedMeshes.length === 1);
  assert.equal(res.embeddedMeshes[0].name, 'PartShape.brp');
  assert.equal(res.embeddedMeshes[0].ext, 'brp');

  // Verify OpenCASCADE .brp Poly_Triangulation parser directly and via loadEmbeddedMeshesToGroup
  const brepGeom = parseOpenCascadeBrepToGeometry(sampleBrep);
  assert.equal(brepGeom.attributes.position.count, 12, '4 triangles * 3 vertices = 12 positions');

  const loaded = await loadEmbeddedMeshesToGroup('7.ghpv', res.embeddedMeshes);
  assert.ok(loaded, 'Expected loadEmbeddedMeshesToGroup to return a non-null 3D mesh group');
  assert.equal(loaded.stats.triangleCount, 4);
  assert.ok(Math.abs(loaded.stats.sizeMm[2] - 4500) < 20, `Expected Z length ~4500mm, got ${loaded.stats.sizeMm[2]}`);
});

test('ZIP-packaged native GHPV JSON, GZIP-wrapped .ghpv, and encrypted/opaque ZIP error handling', () => {
  // 1. Native GHPV JSON packed inside a PKZIP .ghpv
  const sep = VESSEL_PRESETS.find((p) => p.id === 'large_separator')!;
  const nativeJson = JSON.stringify({ version: 'GHPV-V2.1', spec: sep.spec, assemblies: sep.assemblies });
  const zipNative = zipSync({ 'project.json': strToU8(nativeJson) });
  const zipNativeBuf = zipNative.buffer.slice(zipNative.byteOffset, zipNative.byteOffset + zipNative.byteLength);
  const resNative = parseGhpvFileBuffer('packed_sep.ghpv', zipNativeBuf);
  assert.equal(resNative.sourceFormat, 'ghpv_zip_archive');
  assert.equal(resNative.spec.vesselTag, sep.spec.vesselTag);
  assert.equal(resNative.assemblies.length, sep.assemblies.length);
  assert.equal(resNative.archiveEntries?.[0].name, 'project.json');

  // 2. GZIP-compressed .ghpv unpacks transparently
  const gzNative = gzipSync(strToU8(nativeJson));
  const gzBuf = gzNative.buffer.slice(gzNative.byteOffset, gzNative.byteOffset + gzNative.byteLength);
  const resGz = parseGhpvFileBuffer('gz_sep.ghpv', gzBuf);
  assert.equal(resGz.spec.vesselTag, sep.spec.vesselTag);
  assert.equal(resGz.assemblies.length, sep.assemblies.length);

  // 3. Opaque binary-only ZIP archive throws honest error listing internal filenames
  const opaqueZip = zipSync({
    'model_data.bin': new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0x7a, 0x8b]),
  });
  const opaqueBuf = opaqueZip.buffer.slice(opaqueZip.byteOffset, opaqueZip.byteOffset + opaqueZip.byteLength);
  assert.throws(
    () => parseGhpvFileBuffer('opaque.ghpv', opaqueBuf),
    /model_data\.bin/
  );

  // 4. Password-encrypted ZIP flag (general purpose bit 0) throws explicit encryption message
  const encZip = new Uint8Array(opaqueZip);
  encZip[6] = encZip[6] | 0x01;
  const encBuf = encZip.buffer.slice(encZip.byteOffset, encZip.byteOffset + encZip.byteLength);
  assert.throws(
    () => parseGhpvFileBuffer('locked.ghpv', encBuf),
    /受密码保护.*model_data\.bin/
  );
});






