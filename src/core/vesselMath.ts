import type {
  AiParsedVesselSpec,
  AssemblyPoint,
  BomRow,
  ComputedComponentMetrics,
  ConeParams,
  CostEstimateSummary,
  DemisterParams,
  EllipticalHeadParams,
  EquipmentFlangeParams,
  ExpansionJointParams,
  FixedTubeSheetParams,
  GasketParams,
  GenericAttachmentParams,
  InterferenceIssue,
  InterferenceReport,
  LadderPlatformParams,
  LegSupportParams,
  LugSupportParams,
  MaterialCatalogItem,
  NozzleManholeParams,
  PackingParams,
  PadPlateParams,
  PlacedMainComponent,
  SaddleParams,
  ShellParams,
  SkirtParams,
  SphereColumnParams,
  SphericalHeadParams,
  SphericalTankParams,
  StiffeningRingParams,
  TechnicalSpec,
  TopDavitParams,
  TrayParams,
  TrunnionParams,
  TubeLayoutParams,
  VesselComponent,
  WeldSeamParams,
} from '../types/vessel';

const PI = Math.PI;

/**
 * Standard Chinese Pressure Vessel Steel & Gasket Catalog (GB/T 713 / NB/T 47008 / GB/T 24511).
 */
export const MATERIAL_CATALOG: MaterialCatalogItem[] = [
  { grade: 'Q345R', category: '碳素钢/低合金钢', standard: 'GB/T 713.2-2023', density: 7.85, yieldStrengthMpa: 345, allowableStress20: 189, allowableStress150: 183, allowableStress250: 165, refPricePerTon: 5200 },
  { grade: 'Q245R', category: '碳素钢/低合金钢', standard: 'GB/T 713.2-2023', density: 7.85, yieldStrengthMpa: 245, allowableStress20: 148, allowableStress150: 140, allowableStress250: 126, refPricePerTon: 4950 },
  { grade: 'Q370R', category: '碳素钢/低合金钢', standard: 'GB/T 713.2-2023', density: 7.85, yieldStrengthMpa: 370, allowableStress20: 196, allowableStress150: 189, allowableStress250: 171, refPricePerTon: 5850 },
  { grade: '15CrMoR', category: '碳素钢/低合金钢', standard: 'GB/T 713.2-2023', density: 7.85, yieldStrengthMpa: 295, allowableStress20: 167, allowableStress150: 162, allowableStress250: 154, refPricePerTon: 8600 },
  { grade: 'S30408', category: '不锈钢', standard: 'GB/T 713.7-2023', density: 7.93, yieldStrengthMpa: 220, allowableStress20: 137, allowableStress150: 118, allowableStress250: 109, refPricePerTon: 16800 },
  { grade: 'S31603', category: '不锈钢', standard: 'GB/T 713.7-2023', density: 7.98, yieldStrengthMpa: 205, allowableStress20: 130, allowableStress150: 112, allowableStress250: 102, refPricePerTon: 24500 },
  { grade: 'S22053', category: '不锈钢', standard: 'GB/T 713.7-2023', density: 7.82, yieldStrengthMpa: 450, allowableStress20: 214, allowableStress150: 198, allowableStress250: 185, refPricePerTon: 28800 },
  { grade: '16MnII', category: '锻件', standard: 'NB/T 47008-2017', density: 7.85, yieldStrengthMpa: 315, allowableStress20: 175, allowableStress150: 168, allowableStress250: 152, refPricePerTon: 9800 },
  { grade: '16MnIII', category: '锻件', standard: 'NB/T 47008-2017', density: 7.85, yieldStrengthMpa: 325, allowableStress20: 180, allowableStress150: 173, allowableStress250: 156, refPricePerTon: 10600 },
  { grade: '20', category: '碳素钢/低合金钢', standard: 'GB/T 9948-2013', density: 7.85, yieldStrengthMpa: 245, allowableStress20: 137, allowableStress150: 130, allowableStress250: 116, refPricePerTon: 6400 },
  { grade: 'Q235B', category: '碳素钢/低合金钢', standard: 'GB/T 700-2006', density: 7.85, yieldStrengthMpa: 235, allowableStress20: 130, allowableStress150: 122, allowableStress250: 110, refPricePerTon: 4400 },
  { grade: 'PTFE', category: '非金属垫片', standard: 'NB/T 47024-2012', density: 2.2, yieldStrengthMpa: 25, allowableStress20: 12, allowableStress150: 6, allowableStress250: 0, refPricePerTon: 48000 },
];

/**
 * GB/T 12337-2014 Steel Spherical Tank (球形储罐) shell calculations.
 */
export function calculateSphericalTankMetrics(p: SphericalTankParams): {
  internalVolumeM3: number;
  innerAreaM2: number;
  outerAreaM2: number;
  volumeM3: number;
  weightKg: number;
  totalWeldLengthM: number;
  equatorPetalArcMm: number;
} {
  const di = Math.max(1000, p.diameter);
  const t = Math.max(8, p.thickness);
  const rho = p.density || 7.85;
  const rIn = di / 2;
  const rOut = rIn + t;
  const rMid = rIn + t / 2;

  const internalVolumeM3 = ((4 / 3) * PI * rIn * rIn * rIn) / 1e9;
  const innerAreaM2 = (4 * PI * rIn * rIn) / 1e6;
  const outerAreaM2 = (4 * PI * rOut * rOut) / 1e6;
  const volumeM3 = (4 * PI * rMid * rMid * t) / 1e9;
  const weightKg = volumeM3 * rho * 1000;

  // Approximate total weld seam length across polar/temperate/equatorial zones (m)
  const eqPetals = Math.max(6, p.equatorPetals || 16);
  const tempPetals = Math.max(6, p.temperatePetals || 12);
  const latSeams = (2 * PI * rMid * (Math.cos(0.42) * 2 + Math.cos(1.05) * 2)) / 1000;
  const eqMeridian = (eqPetals * rMid * 0.84) / 1000;
  const tempMeridian = (2 * tempPetals * rMid * 0.63) / 1000;
  const polarSeams = (2 * 6 * rMid * 0.52) / 1000;
  const totalWeldLengthM = Number((latSeams + eqMeridian + tempMeridian + polarSeams).toFixed(2));
  const equatorPetalArcMm = Math.round((PI * di) / eqPetals);

  return {
    internalVolumeM3,
    innerAreaM2,
    outerAreaM2,
    volumeM3,
    weightKg,
    totalWeldLengthM,
    equatorPetalArcMm,
  };
}

/**
 * GB/T 25198-2023 Elliptical Head (2:1 EHA/EHB) geometric calculations.
 * Matches GHPV-2024 Page 9 reference formulas.
 */
export function calculateEllipticalHeadMetrics(p: EllipticalHeadParams): {
  crownHeightMm: number;
  totalDepthMm: number;
  minFormedThicknessMm: number;
  internalVolumeM3: number;
  innerAreaM2: number;
  outerAreaM2: number;
  blankDiameterMm: number;
  volumeM3: number;
  weightKg: number;
  cogMm: number;
} {
  const di = Math.max(100, p.diameter);
  const h = Math.max(0, p.straightHeight);
  const t = Math.max(1, p.nominalThickness);
  const rho = p.density || 7.85; // g/cm3 -> 1000 kg/m3

  // Standard 2:1 elliptical head: hi = Di / 4
  const hi = di / 4;
  const totalDepthMm = hi + h;

  const thinningFactor = Math.max(0, Math.min(30, p.thinningRate)) / 100;
  const minFormedThicknessMm = Number((p.blankThickness * (1 - thinningFactor)).toFixed(2));

  // Internal volume (mm^3 -> m^3): cylinder (pi/4 * Di^2 * h) + half-ellipsoid (pi/24 * Di^3)
  const volInnerMm3 = (PI / 4) * di * di * h + (PI / 24) * di * di * di;
  const internalVolumeM3 = volInnerMm3 / 1e9;

  // Surface area of 2:1 elliptical crown ≈ 1.084 * Di^2, plus straight flange pi * Di * h
  const innerAreaM2 = (1.084 * di * di + PI * di * h) / 1e6;
  const doVal = di + 2 * t;
  const outerAreaM2 = (1.084 * doVal * doVal + PI * doVal * h) / 1e6;

  // Approximate blank diameter per GB/T 25198: ~ 1.19 * Di + 1.8 * h (approx 1270mm for Di=1000, h=25)
  const blankDiameterMm = Math.round(1.22 * di + 2.0 * h);

  // Metal volume via mid-surface area * thickness
  const dMid = di + t;
  const midAreaMm2 = 1.084 * dMid * dMid + PI * dMid * h;
  const volumeM3 = (midAreaMm2 * t) / 1e9;
  const weightKg = volumeM3 * rho * 1000;

  // Center of gravity from weld seam (end of straight flange)
  const cogMm = Number((h + hi * 0.535).toFixed(2));

  return {
    crownHeightMm: hi,
    totalDepthMm,
    minFormedThicknessMm,
    internalVolumeM3,
    innerAreaM2,
    outerAreaM2,
    blankDiameterMm,
    volumeM3,
    weightKg,
    cogMm,
  };
}

/**
 * Cylindrical shell calculations matching GHPV-2024 Page 7 & Page 10.
 */
export function calculateShellMetrics(p: ShellParams): {
  volumeM3: number;
  weightKg: number;
  internalVolumeM3: number;
  innerAreaM2: number;
  outerAreaM2: number;
  unrolledLengthMm: number;
  cogMm: number;
} {
  const di = Math.max(50, p.diameter);
  const t = Math.max(1, p.thickness);
  const L = Math.max(50, p.length);
  const rho = p.density || 7.85;

  const rIn = di / 2;
  const rOut = rIn + t;

  const volumeM3 = (PI * (rOut * rOut - rIn * rIn) * L) / 1e9;
  const weightKg = volumeM3 * rho * 1000;
  const internalVolumeM3 = (PI * rIn * rIn * L) / 1e9;
  const innerAreaM2 = (PI * di * L) / 1e6;
  const outerAreaM2 = (PI * (di + 2 * t) * L) / 1e6;
  const unrolledLengthMm = Number((PI * (di + t)).toFixed(1));
  const cogMm = Number((L / 2).toFixed(2));

  return {
    volumeM3,
    weightKg,
    internalVolumeM3,
    innerAreaM2,
    outerAreaM2,
    unrolledLengthMm,
    cogMm,
  };
}

/**
 * Conical reducer calculations matching GHPV-2024 Page 15.
 */
export function calculateConeMetrics(p: ConeParams): {
  halfApexAngleDeg: number;
  volumeM3: number;
  weightKg: number;
  internalVolumeM3: number;
  innerAreaM2: number;
  outerAreaM2: number;
  cogMm: number;
} {
  const d1 = Math.max(50, p.smallDiameter);
  const d2 = Math.max(d1 + 10, p.largeDiameter);
  const t = Math.max(1, p.thickness);
  const H = Math.max(50, p.totalLength);
  const h1 = p.edgeStyle === '无折边' ? 0 : p.h1 || 25;
  const h2 = p.edgeStyle === '双折边' ? p.h2 || 25 : 0;
  const hc = Math.max(20, H - h1 - h2);
  const rho = p.density || 7.85;

  const dr = (d2 - d1) / 2;
  const halfApexAngleDeg = Number(((Math.atan2(dr, hc) * 180) / PI).toFixed(4));
  const slant = Math.sqrt(dr * dr + hc * hc);

  const innerAreaMm2 = PI * ((d1 + d2) / 2) * slant + PI * d1 * h1 + PI * d2 * h2;
  const outerAreaMm2 =
    PI * ((d1 + d2 + 4 * t) / 2) * slant + PI * (d1 + 2 * t) * h1 + PI * (d2 + 2 * t) * h2;

  const r1 = d1 / 2;
  const r2 = d2 / 2;
  const internalVolumeMm3 =
    (PI * hc * (r1 * r1 + r1 * r2 + r2 * r2)) / 3 + PI * r1 * r1 * h1 + PI * r2 * r2 * h2;

  const volumeM3 = (((innerAreaMm2 + outerAreaMm2) / 2) * t) / 1e9;
  const weightKg = volumeM3 * rho * 1000;
  const cogMm = Number((H * 0.44).toFixed(2));

  return {
    halfApexAngleDeg,
    volumeM3,
    weightKg,
    internalVolumeM3: internalVolumeMm3 / 1e9,
    innerAreaM2: innerAreaMm2 / 1e6,
    outerAreaM2: outerAreaMm2 / 1e6,
    cogMm,
  };
}

/**
 * Compute tube sheet 2D coordinates for Heat Exchanger Tube Layout Dialog (Page 25).
 */
export function computeTubeLayout(p: TubeLayoutParams): {
  tubes: Array<{ id: number; x: number; y: number; r: number }>;
  totalCount: number;
} {
  const rLimit = Math.max(50, p.outerLimitDiameter / 2 - p.tubeOD / 2);
  const pitch = Math.max(p.tubeOD + 2, p.tubePitch);
  const rTube = p.tubeOD / 2;
  const tubes: Array<{ id: number; x: number; y: number; r: number }> = [];

  const passGap = p.passes >= 2 ? pitch * 0.75 : 0;
  const passGapX = p.passes >= 4 ? pitch * 0.75 : 0;

  let dx = pitch;
  let dy = pitch;
  let stagger = false;

  if (p.pattern === '正三角形') {
    dx = pitch;
    dy = pitch * (Math.sqrt(3) / 2);
    stagger = true;
  } else if (p.pattern === '转角正三角形') {
    dx = pitch * (Math.sqrt(3) / 2);
    dy = pitch;
    stagger = true;
  } else if (p.pattern === '转角正方形') {
    dx = pitch * Math.SQRT2;
    dy = pitch * (Math.SQRT2 / 2);
    stagger = true;
  }

  const maxRow = Math.ceil(rLimit / dy) + 1;
  const maxCol = Math.ceil(rLimit / dx) + 1;

  let id = 1;
  for (let row = -maxRow; row <= maxRow; row++) {
    const y = row * dy;
    if (passGap > 0 && Math.abs(y) < passGap) continue;
    const xShift = stagger && Math.abs(row) % 2 === 1 ? dx / 2 : 0;
    for (let col = -maxCol; col <= maxCol; col++) {
      const x = col * dx + xShift;
      if (passGapX > 0 && Math.abs(x) < passGapX) continue;
      if (Math.hypot(x, y) <= rLimit) {
        tubes.push({
          id: id++,
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          r: rTube,
        });
      }
    }
  }

  return { tubes, totalCount: tubes.length };
}

/**
 * Compute full engineering metrics for any GHPV component so the Property Panel and BOM stay 100% consistent.
 */
export function computeComponentMetrics(component: VesselComponent): ComputedComponentMetrics {
  switch (component.type) {
    case 'shell':
    case 'boot_shell': {
      const p = component.params as ShellParams;
      const m = calculateShellMetrics(p);
      return {
        weightKg: Number(m.weightKg.toFixed(1)),
        volumeM3: Number(m.volumeM3.toFixed(4)),
        internalVolumeM3: Number(m.internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(m.outerAreaM2.toFixed(4)),
        innerAreaM2: Number(m.innerAreaM2.toFixed(4)),
        cogMm: m.cogMm,
        specText: `DN${p.diameter}X${p.thickness} L=${p.length}`,
        standardText: 'GB/T 150.3',
        cuttingSize: `${Math.round(m.unrolledLengthMm)} X ${p.length} X ${p.thickness}`,
        extraProperties: [
          { label: '筒体直径(mm)', value: String(p.diameter) },
          { label: '筒体厚度(mm)', value: String(p.thickness) },
          { label: '筒体长度(mm)', value: String(p.length) },
          { label: '展开长度(mm)', value: String(m.unrolledLengthMm) },
        ],
      };
    }

    case 'elliptical_head': {
      const p = component.params as EllipticalHeadParams;
      const m = calculateEllipticalHeadMetrics(p);
      return {
        weightKg: Number(m.weightKg.toFixed(1)),
        volumeM3: Number(m.volumeM3.toFixed(4)),
        internalVolumeM3: Number(m.internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(m.outerAreaM2.toFixed(4)),
        innerAreaM2: Number(m.innerAreaM2.toFixed(4)),
        cogMm: m.cogMm,
        specText: `${p.headType}${p.diameter}X${p.nominalThickness}(${m.minFormedThicknessMm})`,
        standardText: p.standard || 'GB/T 25198-2023',
        extraProperties: [
          { label: '椭圆封头直径', value: String(p.diameter) },
          { label: '椭圆名义厚度', value: String(p.nominalThickness) },
          { label: '最小成型厚度', value: String(m.minFormedThicknessMm) },
          { label: '投料厚度', value: String(p.blankThickness) },
          { label: '直边高度', value: String(p.straightHeight) },
          { label: '封头标准', value: p.standard || 'GB/T 25198-2023' },
          { label: '曲面高度', value: String(m.crownHeightMm) },
        ],
      };
    }

    case 'spherical_head': {
      const p = component.params as SphericalHeadParams;
      const r = p.diameter / 2;
      const innerAreaM2 = (2 * PI * r * r) / 1e6;
      const outerAreaM2 = (2 * PI * (r + p.thickness) * (r + p.thickness)) / 1e6;
      const internalVolumeM3 = ((2 / 3) * PI * r * r * r) / 1e9;
      const volumeM3 = (((innerAreaM2 + outerAreaM2) / 2) * (p.thickness / 1000));
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(1)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: Number(internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(outerAreaM2.toFixed(4)),
        innerAreaM2: Number(innerAreaM2.toFixed(4)),
        cogMm: Number((r * 0.5).toFixed(2)),
        specText: `HHA${p.diameter}X${p.thickness}`,
        standardText: 'GB/T 25198-2023',
        extraProperties: [
          { label: '球冠内径(mm)', value: String(p.diameter) },
          { label: '球封头厚度(mm)', value: String(p.thickness) },
        ],
      };
    }

    case 'spherical_tank': {
      const p = component.params as SphericalTankParams;
      const m = calculateSphericalTankMetrics(p);
      return {
        weightKg: Number(m.weightKg.toFixed(1)),
        volumeM3: Number(m.volumeM3.toFixed(4)),
        internalVolumeM3: Number(m.internalVolumeM3.toFixed(2)),
        outerAreaM2: Number(m.outerAreaM2.toFixed(2)),
        innerAreaM2: Number(m.innerAreaM2.toFixed(2)),
        cogMm: Number((p.diameter / 2).toFixed(1)),
        specText: `Ø${p.diameter}X${p.thickness} ${p.zoneStyle}`,
        standardText: p.standard || 'GB/T 12337-2014',
        cuttingSize: `赤道瓣弧长 ${m.equatorPetalArcMm} X ${p.thickness}`,
        extraProperties: [
          { label: '球罐内径(mm)', value: String(p.diameter) },
          { label: '球壳壁厚(mm)', value: String(p.thickness) },
          { label: '结构分带', value: p.zoneStyle },
          { label: '赤道带瓣数', value: String(p.equatorPetals) },
          { label: '温带瓣数', value: String(p.temperatePetals) },
          { label: '焊缝总长(m)', value: String(m.totalWeldLengthM) },
        ],
      };
    }

    case 'cone': {
      const p = component.params as ConeParams;
      const m = calculateConeMetrics(p);
      return {
        weightKg: Number(m.weightKg.toFixed(1)),
        volumeM3: Number(m.volumeM3.toFixed(4)),
        internalVolumeM3: Number(m.internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(m.outerAreaM2.toFixed(4)),
        innerAreaM2: Number(m.innerAreaM2.toFixed(4)),
        cogMm: m.cogMm,
        specText: `DN${p.largeDiameter}/${p.smallDiameter}X${p.thickness} H=${p.totalLength}`,
        standardText: 'GB/T 25198-2023',
        extraProperties: [
          { label: '小端内径', value: String(p.smallDiameter) },
          { label: '大端内径', value: String(p.largeDiameter) },
          { label: '厚度', value: String(p.thickness) },
          { label: '锥体总长', value: String(p.totalLength) },
          { label: '半顶角(°)', value: String(m.halfApexAngleDeg) },
          { label: '小端折边半径', value: String(p.r1) },
          { label: '大端折边半径', value: String(p.r2) },
        ],
      };
    }

    case 'equipment_flange': {
      const p = component.params as EquipmentFlangeParams;
      const rOut = p.outerDiameter / 2;
      const rIn = p.flangeType === '法兰盖(BL)' ? 0 : p.dn / 2;
      const ringVolMm3 = PI * (rOut * rOut - rIn * rIn) * p.thickness;
      const hubVolMm3 =
        p.flangeType === '长颈对焊(WN)'
          ? PI * ((rIn + 22) * (rIn + 22) - rIn * rIn) * Math.max(0, p.height - p.thickness)
          : 0;
      const volumeM3 = (ringVolMm3 + hubVolMm3) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = (PI * p.outerDiameter * p.height + 2 * PI * (rOut * rOut - rIn * rIn)) / 1e6;
      const innerAreaM2 = (PI * p.dn * p.height) / 1e6;
      const internalVolumeM3 = (PI * rIn * rIn * p.height) / 1e9;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: Number(internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(outerAreaM2.toFixed(4)),
        innerAreaM2: Number(innerAreaM2.toFixed(4)),
        cogMm: Number((p.height * 0.68).toFixed(2)),
        specText: `${p.facing} ${p.dn}-${p.pn}`,
        standardText: p.standard || 'NB/T 47023-2012',
        extraProperties: [
          { label: '标准', value: p.standard || 'NB/T 47023-2012' },
          { label: '公称压力', value: String(p.pn) },
          { label: '公称直径', value: String(p.dn) },
          { label: '法兰类型', value: p.flangeType },
          { label: '法兰密封面', value: p.facing },
          { label: '法兰盘厚度', value: String(p.thickness) },
          { label: '法兰外径', value: String(p.outerDiameter) },
          { label: '螺栓中心圆', value: String(p.boltCircle) },
          { label: '法兰总高', value: String(p.height) },
        ],
      };
    }

    case 'gasket': {
      const p = component.params as GasketParams;
      const areaMm2 = (PI / 4) * (p.outerDiameter * p.outerDiameter - p.innerDiameter * p.innerDiameter);
      const volumeM3 = (areaMm2 * p.thickness) / 1e9;
      const weightKg = volumeM3 * (p.density || 2.2) * 1000;
      return {
        weightKg: Number(Math.max(0.15, weightKg).toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(5)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((PI * p.outerDiameter * p.thickness) / 1e6).toFixed(4)),
        innerAreaM2: 0,
        cogMm: Number((p.thickness / 2).toFixed(2)),
        specText: `D ${p.dn}-${p.pn}`,
        standardText: p.standard || 'NB/T 47024-2012',
        extraProperties: [
          { label: '标准号', value: p.standard || 'NB/T 47024-2012' },
          { label: '垫片厚度(mm)', value: String(p.thickness) },
          { label: '垫片直径D1', value: String(p.innerDiameter) },
          { label: '垫片直径D2', value: String(p.outerDiameter) },
        ],
      };
    }

    case 'skirt': {
      const p = component.params as SkirtParams;
      const rMid = (p.topDiameter + p.bottomDiameter) / 4;
      const shellVol = PI * 2 * rMid * p.thickness * p.height;
      const ringVol =
        (PI / 4) * (p.baseRingOD * p.baseRingOD - p.baseRingID * p.baseRingID) * p.baseRingThickness;
      const gussetVol = p.boltCount * 160 * p.gussetHeight * 14;
      const volumeM3 = (shellVol + ringVol + gussetVol) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = (PI * (p.topDiameter + p.bottomDiameter) * 0.5 * p.height) / 1e6;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(outerAreaM2.toFixed(4)),
        innerAreaM2: Number((outerAreaM2 * 0.98).toFixed(4)),
        cogMm: Number((p.height * 0.48).toFixed(2)),
        specText: `DN${p.topDiameter}X${p.thickness} H=${p.height}`,
        standardText: 'NB/T 47041',
        extraProperties: [
          { label: '裙座类型', value: p.skirtType },
          { label: '裙座内径(mm)', value: String(p.topDiameter) },
          { label: '裙座厚度(mm)', value: String(p.thickness) },
          { label: '裙座高度(mm)', value: String(p.height) },
          { label: '地脚螺栓规格', value: p.boltSpec },
          { label: '地脚螺栓数量', value: String(p.boltCount) },
        ],
      };
    }

    case 'fixed_tubesheet':
    case 'u_tube_head': {
      const p = component.params as FixedTubeSheetParams;
      const grossArea = (PI / 4) * p.outerDiameter * p.outerDiameter;
      const holeArea = p.tubeCount * (PI / 4) * p.tubeOD * p.tubeOD;
      const netArea = Math.max(grossArea * 0.35, grossArea - holeArea);
      const volumeM3 = (netArea * p.thickness) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((PI * p.outerDiameter * p.thickness) / 1e6).toFixed(4)),
        innerAreaM2: 0,
        cogMm: Number((p.thickness / 2).toFixed(2)),
        specText: `Ø${p.outerDiameter}X${p.thickness}`,
        standardText: 'GB/T 151-2014',
        extraProperties: [
          { label: '管板外径(mm)', value: String(p.outerDiameter) },
          { label: '管板厚度(mm)', value: String(p.thickness) },
          { label: '螺栓中心圆', value: String(p.bcd) },
          { label: '螺栓数量', value: String(p.boltCount) },
        ],
      };
    }

    case 'expansion_joint': {
      const p = component.params as ExpansionJointParams;
      const dMid = p.dn + p.waveHeight;
      const developedL = p.totalLength + p.waveCount * p.waveHeight * 1.65;
      const volumeM3 = (PI * dMid * developedL * p.thickness) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = (PI * (p.dn + 2 * p.waveHeight) * developedL) / 1e6;
      const internalVolumeM3 = ((PI / 4) * p.dn * p.dn * p.totalLength) / 1e9;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: Number(internalVolumeM3.toFixed(4)),
        outerAreaM2: Number(outerAreaM2.toFixed(4)),
        innerAreaM2: Number((outerAreaM2 * 0.96).toFixed(4)),
        cogMm: Number((p.totalLength / 2).toFixed(2)),
        specText: `EB L(II)W ${p.dn}-${p.pn}X${p.waveCount}`,
        standardText: p.standard || 'GB/T 16749-2018',
        extraProperties: [
          { label: '公称直径(mm)', value: String(p.dn) },
          { label: '波数', value: String(p.waveCount) },
          { label: '波高(mm)', value: String(p.waveHeight) },
          { label: '总长(mm)', value: String(p.totalLength) },
        ],
      };
    }

    case 'nozzle_manhole': {
      const p = component.params as NozzleManholeParams;
      if (p.isLiquidBoot) {
        const bootD = Math.max(200, p.bootDiameter || p.dn || 700);
        const bootL = Math.max(300, p.bootLength || p.protrusion || 1100);
        const t = Math.max(8, p.pipeThickness || 14);
        const rIn = bootD / 2;
        const rOut = rIn + t;
        const cylVol = PI * (rOut * rOut - rIn * rIn) * bootL;
        const headVol = 1.084 * (bootD + t) * (bootD + t) * t;
        const drainVol = PI * (120 * 120 - 80 * 80) * 260;
        const volumeM3 = (cylVol + headVol + drainVol) / 1e9;
        const weightKg = volumeM3 * (p.density || 7.85) * 1000;
        const internalVolumeM3 =
          ((PI / 4) * bootD * bootD * bootL + (PI / 24) * bootD * bootD * bootD) / 1e9;
        const outerAreaM2 =
          (PI * (bootD + 2 * t) * bootL + 1.084 * (bootD + 2 * t) * (bootD + 2 * t)) / 1e6;
        return {
          weightKg: Number(weightKg.toFixed(1)),
          volumeM3: Number(volumeM3.toFixed(4)),
          internalVolumeM3: Number(internalVolumeM3.toFixed(4)),
          outerAreaM2: Number(outerAreaM2.toFixed(3)),
          innerAreaM2: Number(((PI * bootD * bootL) / 1e6).toFixed(3)),
          cogMm: Number((bootL * 0.55).toFixed(1)),
          specText: `集液包 DN${bootD}X${t} L=${bootL}`,
          standardText: 'GB/T 150.3',
          extraProperties: [
            { label: '管口符号', value: p.tag },
            { label: '用途', value: p.purpose },
            { label: '集液包内径(mm)', value: String(bootD) },
            { label: '集液包长度(mm)', value: String(bootL) },
            { label: '筒体壁厚(mm)', value: String(t) },
            { label: '方位角(°)', value: String(p.angleDeg) },
          ],
        };
      }
      const rOut = p.pipeOD / 2;
      const rIn = Math.max(5, rOut - p.pipeThickness);
      const pipeLen = p.protrusion + p.innerProtrusion;
      const pipeVol = PI * (rOut * rOut - rIn * rIn) * pipeLen;
      const flgVol =
        (PI / 4) * (p.flangeOD * p.flangeOD - p.dn * p.dn) * p.flangeThickness;
      const coverVol = p.hasBlindCover || p.isManhole
        ? (PI / 4) * p.flangeOD * p.flangeOD * p.flangeThickness * 1.1
        : 0;
      const volumeM3 = (pipeVol + flgVol + coverVol) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 =
        (PI * p.pipeOD * p.protrusion + PI * p.flangeOD * p.flangeThickness) / 1e6;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: Number(((PI * rIn * rIn * p.protrusion) / 1e9).toFixed(4)),
        outerAreaM2: Number(outerAreaM2.toFixed(4)),
        innerAreaM2: Number(((PI * 2 * rIn * pipeLen) / 1e6).toFixed(4)),
        cogMm: Number((p.protrusion * 0.6).toFixed(2)),
        specText: p.isManhole
          ? `RF III b(304+柔性石墨) ${p.dn}-${p.pn}`
          : `${p.flangeType} ${p.dn}-${p.pn} S=${p.pipeThickness}`,
        standardText: p.isManhole ? 'HG/T 21524-2014' : p.flangeSpec,
        extraProperties: [
          { label: '管口符号', value: p.tag },
          { label: '管口用途', value: p.purpose },
          { label: '法兰标准号', value: p.isManhole ? 'HG/T 21524-2014' : p.flangeSpec },
          { label: '法兰公称直径', value: String(p.dn) },
          { label: '法兰压力等级', value: String(p.pn) },
          { label: '接管外径', value: String(p.pipeOD) },
          { label: '接管壁厚', value: String(p.pipeThickness) },
          { label: '外伸长度L1', value: String(p.protrusion) },
          { label: '方位角(°)', value: String(p.angleDeg) },
        ],
      };
    }

    case 'saddle': {
      const p = component.params as SaddleParams;
      const baseVol = p.baseLength * p.baseWidth * 18;
      const webVol = p.baseLength * (p.centerHeight * 0.55) * p.webThickness;
      const ribsVol = p.ribCount * p.baseWidth * (p.centerHeight * 0.5) * 10;
      const padVol = ((p.wrapAngleDeg / 360) * PI * p.vesselDiameter) * (p.width + 80) * p.padThickness;
      const volumeM3 = (baseVol + webVol + ribsVol + padVol) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = ((p.baseLength * p.centerHeight * 1.4 + p.baseLength * p.baseWidth * 2) / 1e6);
      const suffix = p.fixType === '固定(F)' ? 'F' : 'S';
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(outerAreaM2.toFixed(3)),
        innerAreaM2: 0,
        cogMm: Number(p.axialOffset.toFixed(1)),
        specText: `${p.saddleType.replace('型', '')} ${p.vesselDiameter}-${suffix}`,
        standardText: p.standard || 'NB/T 47065.1-2018',
        extraProperties: [
          { label: '标准', value: p.standard || 'NB/T 47065.1-2018' },
          { label: '底板长度', value: String(p.baseLength) },
          { label: '底板宽度', value: String(p.baseWidth) },
          { label: '腹板厚度', value: String(p.webThickness) },
          { label: '鞍座高度H', value: String(p.centerHeight) },
          { label: '包角(°)', value: String(p.wrapAngleDeg) },
          { label: '定位尺寸', value: String(p.axialOffset) },
        ],
      };
    }

    case 'leg_support': {
      const p = component.params as LegSupportParams;
      const singleLegVol =
        (p.legSectionWidth * 2 * 10 * p.height + p.basePlateSize * p.basePlateSize * p.basePlateThickness);
      const volumeM3 = (singleLegVol * p.count) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = (p.count * (p.legSectionWidth * 4 * p.height + p.basePlateSize * p.basePlateSize * 2)) / 1e6;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(outerAreaM2.toFixed(3)),
        innerAreaM2: 0,
        cogMm: Number((p.height * 0.5).toFixed(1)),
        specText: `${p.legType.replace('型', '')}5-${p.height}-10`,
        standardText: p.standard || 'NB/T 47065.2-2018',
        extraProperties: [
          { label: '支腿标准', value: p.standard || 'NB/T 47065.2-2018' },
          { label: '支腿高度', value: String(p.height) },
          { label: '支腿数量', value: String(p.count) },
          { label: '起始角度', value: String(p.startAngleDeg) },
          { label: '支腿底板厚度', value: String(p.basePlateThickness) },
        ],
      };
    }

    case 'lug_support':
    case 'ring_lug': {
      const p = component.params as LugSupportParams;
      const oneVol = (p.baseWidth * p.baseLength * 16 + p.baseWidth * p.height * 12 * 2);
      const volumeM3 = (oneVol * p.count) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((p.count * p.baseWidth * p.height * 3.5) / 1e6).toFixed(3)),
        innerAreaM2: 0,
        cogMm: Number(p.axialOffset.toFixed(1)),
        specText: `${p.lugType.replace('型', '')}3-${p.count}`,
        standardText: p.standard || 'NB/T 47065.3-2018',
        extraProperties: [
          { label: '耳座标准', value: p.standard || 'NB/T 47065.3-2018' },
          { label: '耳座数量', value: String(p.count) },
          { label: '耳座高度', value: String(p.height) },
          { label: '起始角度', value: String(p.startAngleDeg) },
        ],
      };
    }

    case 'stiffening_ring': {
      const p = component.params as StiffeningRingParams;
      const ringVol = PI * 1200 * p.width * p.thickness * p.count;
      const volumeM3 = ringVol / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((PI * 1200 * 2 * p.width * p.count) / 1e6).toFixed(3)),
        innerAreaM2: 0,
        cogMm: p.axialOffset,
        specText: `${p.profileType} ${p.spec}`,
        standardText: 'GB/T 150.3',
        extraProperties: [
          { label: '型钢类型', value: p.profileType },
          { label: '加强圈位置', value: p.position },
          { label: '型号', value: p.spec },
          { label: '加强圈数量', value: String(p.count) },
        ],
      };
    }

    case 'trunnion': {
      const p = component.params as TrunnionParams;
      const vol = 2 * PI * ((p.trunnionOD / 2) ** 2 - (p.trunnionOD / 2 - 14) ** 2) * p.length;
      const volumeM3 = vol / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((2 * PI * p.trunnionOD * p.length) / 1e6).toFixed(3)),
        innerAreaM2: 0,
        cogMm: p.axialOffset,
        specText: p.spec,
        standardText: p.standard || 'HG/T 21574-2018',
        extraProperties: [
          { label: '标准号', value: p.standard || 'HG/T 21574-2018' },
          { label: '轴耳外径', value: String(p.trunnionOD) },
          { label: '轴耳长度', value: String(p.length) },
        ],
      };
    }

    case 'tray': {
      const p = component.params as TrayParams;
      const oneArea = (PI / 4) * 1500 * 1500;
      const volumeM3 = (oneArea * p.thickness * p.count) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.93) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((oneArea * 2 * p.count) / 1e6).toFixed(3)),
        innerAreaM2: 0,
        cogMm: p.startOffset + (p.count * p.spacing) / 2,
        specText: `${p.trayType} ${p.count}层`,
        standardText: 'JB/T 1205',
        extraProperties: [
          { label: '塔盘类型', value: p.trayType },
          { label: '塔盘数量', value: String(p.count) },
          { label: '塔盘间距(mm)', value: String(p.spacing) },
        ],
      };
    }

    case 'packing': {
      const p = component.params as PackingParams;
      const volumeM3 = ((PI / 4) * 1500 * 1500 * p.height) / 1e9;
      const weightKg = volumeM3 * 220; // bulk packing density ~220 kg/m3
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: 0,
        innerAreaM2: 0,
        cogMm: p.startOffset + p.height / 2,
        specText: `${p.packingType} H=${p.height}`,
        standardText: 'HG/T 21559',
        extraProperties: [
          { label: '填料类型', value: p.packingType },
          { label: '填料层高(mm)', value: String(p.height) },
        ],
      };
    }

    case 'top_davit': {
      const p = component.params as TopDavitParams;
      const vol = PI * p.pipeOD * 12 * (p.poleHeight + p.armLength);
      const volumeM3 = vol / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((PI * p.pipeOD * (p.poleHeight + p.armLength)) / 1e6).toFixed(3)),
        innerAreaM2: 0,
        cogMm: p.poleHeight * 0.5,
        specText: `W=${p.capacityKg} S=${p.armLength}`,
        standardText: p.standard || 'HG/T 21639-2005',
        extraProperties: [
          { label: '标准号', value: p.standard || 'HG/T 21639-2005' },
          { label: '吊重(kg)', value: String(p.capacityKg) },
          { label: '吊臂长S(mm)', value: String(p.armLength) },
          { label: '吊柱高L(mm)', value: String(p.poleHeight) },
        ],
      };
    }

    case 'demister': {
      const p = component.params as DemisterParams;
      const vol = ((PI / 4) * 1500 * 1500 * p.thickness) / 1e9;
      const weightKg = vol * 320;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(vol.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: 0,
        innerAreaM2: 0,
        cogMm: p.startOffset,
        specText: `DN1500-${p.thickness} ${p.installType}`,
        standardText: p.standard || 'HG/T 21618-1998',
        extraProperties: [
          { label: '安装方式', value: p.installType },
          { label: '标准号', value: p.standard || 'HG/T 21618-1998' },
          { label: '网块厚度(mm)', value: String(p.thickness) },
        ],
      };
    }

    case 'weld_seam': {
      const p = component.params as WeldSeamParams;
      return {
        weightKg: 4.6,
        volumeM3: 0.0006,
        internalVolumeM3: 0,
        outerAreaM2: 0.08,
        innerAreaM2: 0,
        cogMm: p.axialOffset,
        specText: p.grooveType,
        standardText: 'NB/T 47015',
        extraProperties: [
          { label: '坡口形式', value: p.grooveType },
          { label: '定位距离(mm)', value: String(p.axialOffset) },
        ],
      };
    }

    case 'pad_plate': {
      const p = component.params as PadPlateParams;
      const volumeM3 = (p.width * p.height * p.thickness) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      return {
        weightKg: Number(weightKg.toFixed(2)),
        volumeM3: Number(volumeM3.toFixed(5)),
        internalVolumeM3: 0,
        outerAreaM2: Number(((p.width * p.height) / 1e6).toFixed(4)),
        innerAreaM2: 0,
        cogMm: p.axialOffset,
        specText: `${p.width}X${p.height}X${p.thickness}`,
        standardText: 'JB/T 4736',
        extraProperties: [
          { label: '宽度(mm)', value: String(p.width) },
          { label: '高度(mm)', value: String(p.height) },
          { label: '厚度(mm)', value: String(p.thickness) },
        ],
      };
    }

    case 'tube_layout': {
      const p = component.params as TubeLayoutParams;
      const layout = computeTubeLayout(p);
      const rOut = p.tubeOD / 2;
      const rIn = rOut - p.tubeThickness;
      const tubeVol = layout.totalCount * PI * (rOut * rOut - rIn * rIn) * p.tubeLength;
      const baffleVol = p.baffleCount * 0.75 * (PI / 4) * p.shellDiameter * p.shellDiameter * 8;
      const volumeM3 = (tubeVol + baffleVol) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const heatAreaM2 = (layout.totalCount * PI * p.tubeOD * p.tubeLength) / 1e6;
      return {
        weightKg: Number(weightKg.toFixed(1)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(heatAreaM2.toFixed(2)),
        innerAreaM2: 0,
        cogMm: Number((p.tubeLength / 2).toFixed(1)),
        specText: `Ø${p.tubeOD}X${p.tubeThickness} L=${p.tubeLength} (${layout.totalCount}根)`,
        standardText: 'GB/T 151-2014',
        extraProperties: [
          { label: '布管根数', value: String(layout.totalCount) },
          { label: '换热管规格', value: `Ø${p.tubeOD}×${p.tubeThickness}` },
          { label: '管间距S(mm)', value: String(p.tubePitch) },
          { label: '排列方式', value: p.pattern },
          { label: '折流板数量', value: String(p.baffleCount) },
          { label: '换热面积(m²)', value: String(heatAreaM2.toFixed(2)) },
        ],
      };
    }

    case 'sphere_column': {
      const p = component.params as SphereColumnParams;
      const rOut = p.pipeOD / 2;
      const rIn = Math.max(10, rOut - p.pipeThickness);
      const colHeight = p.clearanceMm + 5200; // approx equator height
      const pipeVol = p.count * PI * (rOut * rOut - rIn * rIn) * colHeight;
      const tieVol = p.hasTieRods ? p.count * 2 * (PI / 4) * p.tieRodOD * p.tieRodOD * 4800 : 0;
      const volumeM3 = (pipeVol + tieVol) / 1e9;
      const weightKg = volumeM3 * (p.density || 7.85) * 1000;
      const outerAreaM2 = (p.count * PI * p.pipeOD * colHeight) / 1e6;
      return {
        weightKg: Number(weightKg.toFixed(1)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(outerAreaM2.toFixed(2)),
        innerAreaM2: 0,
        cogMm: Number((colHeight * 0.45).toFixed(1)),
        specText: `Ø${p.pipeOD}X${p.pipeThickness} × ${p.count}根`,
        standardText: 'GB/T 12337-2014',
        extraProperties: [
          { label: '支柱根数', value: String(p.count) },
          { label: '支柱规格', value: `Ø${p.pipeOD}×${p.pipeThickness}` },
          { label: '底部净空(mm)', value: String(p.clearanceMm) },
          { label: '交叉拉杆', value: p.hasTieRods ? `Ø${p.tieRodOD} 带拉杆` : '无' },
        ],
      };
    }

    case 'ladder_platform': {
      const p = component.params as LadderPlatformParams;
      const areaM2 = ((p.angleSpanDeg / 360) * PI * 2400 * p.widthMm) / 1e6;
      const weightKg = Math.max(85, areaM2 * 62 + (p.ladderHeightMm / 1000) * (p.hasCage ? 34 : 22));
      const volumeM3 = weightKg / ((p.density || 7.85) * 1000);
      return {
        weightKg: Number(weightKg.toFixed(1)),
        volumeM3: Number(volumeM3.toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number((areaM2 * 2.4).toFixed(2)),
        innerAreaM2: 0,
        cogMm: p.elevationMm,
        specText: `${p.platformType} W=${p.widthMm} H=${p.ladderHeightMm}`,
        standardText: 'HG/T 21542-2018',
        extraProperties: [
          { label: '平台类型', value: p.platformType },
          { label: '平台标高(mm)', value: String(p.elevationMm) },
          { label: '平台宽度(mm)', value: String(p.widthMm) },
          { label: '包角(°)', value: String(p.angleSpanDeg) },
          { label: '直梯高度(mm)', value: String(p.ladderHeightMm) },
        ],
      };
    }

    default: {
      const p = component.params as GenericAttachmentParams;
      const rho = p.density || 7.85;
      const a = Math.max(20, p.sizeA || 240);
      const b = Math.max(20, p.sizeB || 180);
      const t = Math.max(2, p.thickness || 16);

      // Dedicated 1:1 engineering volume, surface area, spec & standard per attachment type
      let volumeM3 = (a * b * t) / 1e9;
      let outerAreaM2 = (2 * a * b) / 1e6;
      let specText = p.label || component.name;
      let standardText = p.standard || 'HG/T 21574-2018';
      let extraProperties: Array<{ label: string; value: string }> = [
        { label: '定位距离(mm)', value: String(p.axialOffset || 0) },
        { label: '方位角(°)', value: String(p.angleDeg || 0) },
      ];

      switch (component.type) {
        case 'horizontal_lug': {
          // Tapered ear + curved pad + twin stiffeners + pin boss
          volumeM3 = ((a * b * 0.85 * t + a * 1.4 * a * 1.3 * t * 0.75 + 2 * a * b * 0.35 * t * 0.7) / 1e9);
          outerAreaM2 = (a * b * 2.8 + a * a * 1.8) / 1e6;
          specText = `AP型卧式吊耳 B${a}×H${b}×δ${t}`;
          standardText = p.standard || 'HG/T 21574-2018';
          extraProperties = [
            { label: '耳板底宽 B(mm)', value: String(a) },
            { label: '耳板高度 H(mm)', value: String(b) },
            { label: '耳板厚度 δ(mm)', value: String(t) },
            { label: '轴向定位(mm)', value: String(p.axialOffset || 0) },
            { label: '方位角(°)', value: String(p.angleDeg || 0) },
          ];
          break;
        }
        case 'side_lug': {
          // Paired 180 deg side lifting lugs with curved pads and gussets
          volumeM3 = (2 * (a * b * 0.9 * t + a * 1.45 * b * 1.15 * t * 0.75 + 2 * a * b * 0.3 * t * 0.7)) / 1e9;
          outerAreaM2 = (2 * (a * b * 3.1)) / 1e6;
          specText = `SP型侧壁吊耳(2件) B${a}×H${b}×δ${t}`;
          standardText = p.standard || 'HG/T 21574-2018';
          extraProperties = [
            { label: '数量', value: '2 件 (对称180°)' },
            { label: '耳板宽 B(mm)', value: String(a) },
            { label: '耳板高 H(mm)', value: String(b) },
            { label: '板厚 δ(mm)', value: String(t) },
            { label: '定位标高(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'lifting_ring': {
          // Curved pad + stem + forged torus shackle ring
          const rRing = b * 0.42;
          const rWire = Math.max(10, t * 0.6);
          const ringVol = 2 * PI * PI * rRing * rWire * rWire;
          volumeM3 = (ringVol + a * a * 1.4 * t * 0.8 + b * t * t * 2) / 1e9;
          outerAreaM2 = (4 * PI * PI * rRing * rWire + a * a * 1.8) / 1e6;
          specText = `吊耳环 Ø${Math.round(b * 0.84)}×d${Math.round(rWire * 2)}`;
          standardText = p.standard || 'JB/T 4735-2009';
          extraProperties = [
            { label: '垫板边长(mm)', value: String(a) },
            { label: '吊环外径(mm)', value: String(b) },
            { label: '圆钢直径/板厚(mm)', value: String(t) },
            { label: '轴向定位(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'support_stand': {
          // 4 cylindrical/angle stands NB/T 47065.4 + top saddle pads + anchor baseplates + gussets
          const pipeR = a * 0.5;
          const pipeWall = Math.min(pipeR * 0.45, Math.max(6, t * 0.65));
          const oneStandVol =
            PI * (pipeR * pipeR - (pipeR - pipeWall) * (pipeR - pipeWall)) * b +
            (a * 1.8) * (a * 1.8) * t +
            (a * 1.6) * (a * 1.6) * t * 0.8;
          volumeM3 = (4 * oneStandVol) / 1e9;
          outerAreaM2 = (4 * (PI * a * b + a * a * 4.2)) / 1e6;
          specText = `A型支承式支座(4件) Ø${a}×H${b}`;
          standardText = p.standard || 'NB/T 47065.4-2018';
          extraProperties = [
            { label: '支座数量', value: '4 件 (均布90°)' },
            { label: '支座管径/宽度(mm)', value: String(a) },
            { label: '支座高度 H(mm)', value: String(b) },
            { label: '底板厚度 δ(mm)', value: String(t) },
            { label: '安装标高(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'wind_guide': {
          // 4 radial wind-guide brackets + twin webs + slide stop plates
          volumeM3 = (4 * (a * b * t * 1.55 + b * b * 0.45 * t)) / 1e9;
          outerAreaM2 = (4 * (a * b * 3.4)) / 1e6;
          specText = `防风定位板(4组) L${a}×H${b}×δ${t}`;
          standardText = p.standard || 'HG/T 20583-2020';
          extraProperties = [
            { label: '定位板组数', value: '4 组 (均布90°)' },
            { label: '伸出长度 L(mm)', value: String(a) },
            { label: '导向高度 H(mm)', value: String(b) },
            { label: '筋板厚度 δ(mm)', value: String(t) },
          ];
          break;
        }
        case 'structural_steel': {
          // H-beam / I-beam profile cross-section area * length
          const hSec = b;
          const bSec = b * 0.72;
          const crossArea = 2 * bSec * t + Math.max(10, hSec - 2 * t) * t * 0.72;
          volumeM3 = (crossArea * a + bSec * hSec * 1.4 * t) / 1e9;
          outerAreaM2 = ((4 * bSec + 2 * hSec) * a) / 1e6;
          specText = `热轧H型钢 H${Math.round(hSec)}×${Math.round(bSec)}×${t} L=${a}`;
          standardText = p.standard || 'GB/T 11263-2017';
          extraProperties = [
            { label: '型钢长度 L(mm)', value: String(a) },
            { label: '截面高度 H(mm)', value: String(b) },
            { label: '翼缘厚度 t(mm)', value: String(t) },
            { label: '定位距离(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'floating_hook': {
          // Split C-ring floating head hook flange + 16 stud bolts
          const rOut = a * 0.5;
          const rIn = Math.max(a * 0.34, rOut - Math.max(45, t * 2.4));
          const ringVol = PI * (rOut * rOut - rIn * rIn) * b * 0.92;
          const boltsVol = 16 * PI * 11 * 11 * (b * 1.55);
          volumeM3 = (ringVol + boltsVol) / 1e9;
          outerAreaM2 = (PI * a * b + 2 * PI * (rOut * rOut - rIn * rIn)) / 1e6;
          specText = `对开式浮头勾圈 Ø${a}×H${b}`;
          standardText = p.standard || 'GB/T 151-2014';
          extraProperties = [
            { label: '勾圈外径 OD(mm)', value: String(a) },
            { label: '勾圈高度 H(mm)', value: String(b) },
            { label: '环壁厚 δ(mm)', value: String(t) },
            { label: '紧固螺栓', value: '16-M22 双头螺柱' },
          ];
          break;
        }
        case 'pass_partition': {
          // Internal multi-pass partition plates (T-shaped)
          volumeM3 = (a * b * t * 1.48) / 1e9;
          outerAreaM2 = (2 * a * b * 1.48) / 1e6;
          specText = `分程隔板 DN${a}×L${b}×δ${t}`;
          standardText = p.standard || 'GB/T 151-2014';
          extraProperties = [
            { label: '隔板跨度(mm)', value: String(a) },
            { label: '隔板轴向长(mm)', value: String(b) },
            { label: '隔板厚度(mm)', value: String(t) },
            { label: '分程布置', value: '主隔板 + 垂直分程板' },
          ];
          break;
        }
        case 'impingement_baffle': {
          // Curved impingement deflector plate + 4 standoff legs
          volumeM3 = (a * b * t * 1.15 + 4 * 28 * 28 * 90) / 1e9;
          outerAreaM2 = (2.15 * a * b) / 1e6;
          specText = `弧形防冲挡板 ${a}×${b}×δ${t}`;
          standardText = p.standard || 'GB/T 151-2014';
          extraProperties = [
            { label: '挡板弧宽(mm)', value: String(a) },
            { label: '挡板轴向长(mm)', value: String(b) },
            { label: '挡板厚度(mm)', value: String(t) },
            { label: '支脚形式', value: '4×圆钢/扁钢焊脚' },
          ];
          break;
        }
        case 'nameplate': {
          // Standoff bracket + stainless steel plate + rivets
          volumeM3 = (a * b * Math.max(2, t * 0.25) + 2 * b * 110 * 6) / 1e9;
          outerAreaM2 = (a * b * 2.2 + b * 220) / 1e6;
          specText = `压力容器铭牌及支架 ${a}×${b}`;
          standardText = p.standard || 'TSG 21-2016';
          extraProperties = [
            { label: '铭牌宽度(mm)', value: String(a) },
            { label: '铭牌高度(mm)', value: String(b) },
            { label: '支架伸出(mm)', value: '110 (适配保温层)' },
          ];
          break;
        }
        case 'spatial_piping': {
          // 3D bent piping run + 2 flanges
          const od = Math.max(32, b);
          const wall = Math.min(od * 0.35, Math.max(3, t));
          const pipeLen = a * 1.55;
          const cross = PI * (od * od - (od - 2 * wall) * (od - 2 * wall)) * 0.25;
          volumeM3 = (cross * pipeLen + 2 * PI * (od * od * 0.55) * 22) / 1e9;
          outerAreaM2 = (PI * od * pipeLen) / 1e6;
          specText = `空间工艺管线 Ø${od}×${wall} L≈${Math.round(pipeLen)}`;
          standardText = p.standard || 'GB/T 20801-2020';
          extraProperties = [
            { label: '管段跨距 L(mm)', value: String(a) },
            { label: '管子外径 OD(mm)', value: String(od) },
            { label: '管子壁厚(mm)', value: String(wall) },
            { label: '端面连接', value: '两端带焊法兰' },
          ];
          break;
        }
        case 'insulation_support': {
          // 3 segmented annular insulation support rings
          const ringCount = 3;
          const rMean = Math.max(400, a * 0.5 + b * 0.5);
          volumeM3 = (ringCount * 2 * PI * rMean * b * t * 0.82) / 1e9;
          outerAreaM2 = (ringCount * 4 * PI * rMean * b * 0.82) / 1e6;
          specText = `保温支承圈(${ringCount}层) W=${b}×δ${t}`;
          standardText = p.standard || 'HG/T 21584-2018';
          extraProperties = [
            { label: '支承圈层数', value: `${ringCount} 层 (分段缺口)` },
            { label: '支承圈宽度(mm)', value: String(b) },
            { label: '钢板厚度(mm)', value: String(t) },
            { label: '起始标高(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'grounding_lug': {
          volumeM3 = (a * b * t * 1.1) / 1e9;
          outerAreaM2 = (2 * a * b) / 1e6;
          specText = `静电接地极板 ${a}×${b}×δ${t} (M12)`;
          standardText = p.standard || 'SH/T 3097-2017';
          extraProperties = [
            { label: '接地耳长度(mm)', value: String(a) },
            { label: '接地耳宽度(mm)', value: String(b) },
            { label: '板厚(mm)', value: String(t) },
            { label: '接地螺栓', value: 'M12 不锈钢/紫铜垫片' },
          ];
          break;
        }
        case 'pipe_boss': {
          const od = Math.max(38, a);
          const id = od * 0.52;
          volumeM3 = (PI * 0.25 * (od * od - id * id) * b * 1.25) / 1e9;
          outerAreaM2 = (PI * od * b * 1.2) / 1e6;
          specText = `锻制承插/螺纹管座 Ø${od}×L${b}`;
          standardText = p.standard || 'HG/T 21634-2016';
          extraProperties = [
            { label: '管座外径(mm)', value: String(od) },
            { label: '伸出长度(mm)', value: String(b) },
            { label: '壁厚(mm)', value: String(t) },
            { label: '轴向定位(mm)', value: String(p.axialOffset || 0) },
          ];
          break;
        }
        case 'vortex_breaker': {
          // Cross blades + circular anti-vortex cap disc
          volumeM3 = ((2 * a * b * t + PI * (a * 0.45) * (a * 0.45) * t) / 1e9);
          outerAreaM2 = (4 * a * b + 2 * PI * (a * 0.45) * (a * 0.45)) / 1e6;
          specText = `十字防涡流板 Ø${a}×H${b}×δ${t}`;
          standardText = p.standard || 'HG/T 20583-2020';
          extraProperties = [
            { label: '防涡板跨径(mm)', value: String(a) },
            { label: '叶片高度(mm)', value: String(b) },
            { label: '板厚(mm)', value: String(t) },
          ];
          break;
        }
        case 'bottom_orifice': {
          const r = a * 0.5;
          // 70% solid factor after perforated flow holes
          volumeM3 = (PI * r * r * t * 0.72) / 1e9;
          outerAreaM2 = (2 * PI * r * r * 0.72) / 1e6;
          specText = `底部多孔分布板 Ø${a}×δ${t}`;
          standardText = p.standard || 'HG/T 20583-2020';
          extraProperties = [
            { label: '孔板外径(mm)', value: String(a) },
            { label: '孔板厚度(mm)', value: String(t) },
            { label: '开孔布置', value: '中心孔 + 双圈均布节流孔' },
          ];
          break;
        }
        case 'foundation_template': {
          const rOut = a * 0.5;
          const rIn = Math.max(a * 0.36, rOut - Math.max(70, b * 0.4));
          volumeM3 = (PI * (rOut * rOut - rIn * rIn) * t + 12 * PI * 18 * 18 * 70) / 1e9;
          outerAreaM2 = (2 * PI * (rOut * rOut - rIn * rIn)) / 1e6;
          specText = `地脚螺栓基础模板 Ø${a}×δ${t}`;
          standardText = p.standard || 'NB/T 47041-2014';
          extraProperties = [
            { label: '模板外径(mm)', value: String(a) },
            { label: '环板宽度(mm)', value: String(b) },
            { label: '钢板厚度(mm)', value: String(t) },
            { label: '定位孔数', value: '12 组地脚螺栓定位套' },
          ];
          break;
        }
        case 'gas_outlet_baffle': {
          volumeM3 = ((a * b * t * 1.4 + 2 * (a * 0.25) * b * t) / 1e9);
          outerAreaM2 = (2.8 * a * b) / 1e6;
          specText = `气体出口弧形挡板 ${a}×${b}×δ${t}`;
          standardText = p.standard || 'HG/T 20583-2020';
          extraProperties = [
            { label: '挡板弧宽(mm)', value: String(a) },
            { label: '挡板长度(mm)', value: String(b) },
            { label: '板厚(mm)', value: String(t) },
          ];
          break;
        }
      }

      const weightKg = volumeM3 * rho * 1000;
      return {
        weightKg: Number(Math.max(0.8, weightKg).toFixed(2)),
        volumeM3: Number(Math.max(0.0001, volumeM3).toFixed(4)),
        internalVolumeM3: 0,
        outerAreaM2: Number(Math.max(0.01, outerAreaM2).toFixed(4)),
        innerAreaM2: 0,
        cogMm: p.axialOffset || 0,
        specText,
        standardText,
        extraProperties,
      };
    }
  }
}

/**
 * Compute sequential head-to-tail axial positions for all main components in an assembly point.
 * Matches GHPV 1.2: "主构件按照从下到上，从左到右自由组合。"
 */
export function layoutAssemblyMainComponents(
  assembly: AssemblyPoint
): PlacedMainComponent[] {
  const mains = assembly.components.filter((c) => c.category === 'main');
  const placed: PlacedMainComponent[] = [];
  let cursor = 0;
  let eccentricOffsetMm = 0;

  for (const comp of mains) {
    let axialLengthMm = 0;
    let outerRadiusMm = 500;
    let nextEccentricDeltaMm = 0;

    switch (comp.type) {
      case 'shell':
      case 'boot_shell': {
        const p = comp.params as ShellParams;
        axialLengthMm = p.length;
        outerRadiusMm = p.diameter / 2 + p.thickness;
        break;
      }
      case 'elliptical_head': {
        const p = comp.params as EllipticalHeadParams;
        axialLengthMm = p.diameter / 4 + p.straightHeight;
        outerRadiusMm = p.diameter / 2 + p.nominalThickness;
        break;
      }
      case 'spherical_head': {
        const p = comp.params as SphericalHeadParams;
        axialLengthMm = p.diameter / 2;
        outerRadiusMm = p.diameter / 2 + p.thickness;
        break;
      }
      case 'spherical_tank': {
        const p = comp.params as SphericalTankParams;
        axialLengthMm = p.diameter;
        outerRadiusMm = p.diameter / 2 + p.thickness;
        break;
      }
      case 'cone': {
        const p = comp.params as ConeParams;
        axialLengthMm = p.totalLength;
        outerRadiusMm = Math.max(p.largeDiameter, p.smallDiameter) / 2 + p.thickness;
        if (p.coneType === '偏心锥') {
          const halfDiff = Math.abs(p.largeDiameter - p.smallDiameter) / 2;
          // flipped === true means small -> large along +axis (bottom-tangent upward expansion)
          nextEccentricDeltaMm = p.flipped ? halfDiff : -halfDiff;
        }
        break;
      }
      case 'equipment_flange': {
        const p = comp.params as EquipmentFlangeParams;
        axialLengthMm = p.height;
        outerRadiusMm = p.outerDiameter / 2;
        break;
      }
      case 'gasket': {
        const p = comp.params as GasketParams;
        axialLengthMm = p.thickness;
        outerRadiusMm = p.outerDiameter / 2;
        break;
      }
      case 'skirt': {
        const p = comp.params as SkirtParams;
        axialLengthMm = p.height;
        outerRadiusMm = Math.max(p.topDiameter, p.bottomDiameter) / 2 + p.thickness;
        break;
      }
      case 'fixed_tubesheet':
      case 'u_tube_head': {
        const p = comp.params as FixedTubeSheetParams;
        axialLengthMm = p.thickness;
        outerRadiusMm = p.outerDiameter / 2;
        break;
      }
      case 'expansion_joint': {
        const p = comp.params as ExpansionJointParams;
        axialLengthMm = p.totalLength;
        outerRadiusMm = p.dn / 2 + p.waveHeight;
        break;
      }
    }

    // In real vertical towers, the bottom elliptical head hangs inside the top of the skirt
    // so the skirt cylinder welds tangentially onto the head's tangent line (T.L.).
    const prevPlaced = placed[placed.length - 1];
    if (
      prevPlaced &&
      prevPlaced.component.type === 'skirt' &&
      comp.type === 'elliptical_head' &&
      !(comp.params as EllipticalHeadParams).flipped
    ) {
      const crownH = (comp.params as EllipticalHeadParams).diameter / 4;
      cursor = Math.max(0, cursor - crownH);
    }

    placed.push({
      component: comp,
      startPosMm: cursor,
      endPosMm: cursor + axialLengthMm,
      axialLengthMm,
      outerRadiusMm,
      eccentricOffsetMm,
    });
    cursor += axialLengthMm;
    eccentricOffsetMm += nextEccentricDeltaMm;
  }

  return placed;
}

/**
 * Generate full Bill of Material (材料表) across all assembly points.
 */
export function generateBOM(assemblies: AssemblyPoint[]): {
  rows: BomRow[];
  totalWeightKg: number;
  totalInnerAreaM2: number;
  totalOuterAreaM2: number;
  totalInternalVolumeM3: number;
} {
  const rows: BomRow[] = [];
  let idx = 1;
  let totalWeightKg = 0;
  let totalInnerAreaM2 = 0;
  let totalOuterAreaM2 = 0;
  let totalInternalVolumeM3 = 0;

  for (const ap of assemblies) {
    for (const comp of ap.components) {
      const m = computeComponentMetrics(comp);
      const mat = (comp.params as { material?: string }).material || 'Q345R';
      const tag =
        comp.type === 'nozzle_manhole'
          ? (comp.params as NozzleManholeParams).tag
          : String(idx);

      rows.push({
        index: idx,
        tag,
        standard: m.standardText,
        partName: comp.name,
        material: mat,
        spec: m.specText,
        cuttingSize: m.cuttingSize || '',
        unitQty: 1,
        spareQty: 0,
        unitWeightKg: m.weightKg,
        totalWeightKg: m.weightKg,
        innerAreaM2: m.innerAreaM2,
        outerAreaM2: m.outerAreaM2,
        internalVolumeM3: m.internalVolumeM3,
      });

      totalWeightKg += m.weightKg;
      totalInnerAreaM2 += m.innerAreaM2;
      totalOuterAreaM2 += m.outerAreaM2;
      totalInternalVolumeM3 += m.internalVolumeM3;
      idx++;
    }
  }

  return {
    rows,
    totalWeightKg: Number(totalWeightKg.toFixed(2)),
    totalInnerAreaM2: Number(totalInnerAreaM2.toFixed(4)),
    totalOuterAreaM2: Number(totalOuterAreaM2.toFixed(4)),
    totalInternalVolumeM3: Number(totalInternalVolumeM3.toFixed(4)),
  };
}

export function getComponentTypeLabel(type: VesselComponent['type']): string {
  const map: Record<VesselComponent['type'], string> = {
    shell: '筒体',
    elliptical_head: '椭圆封头',
    spherical_head: '球形封头',
    spherical_tank: '球壳板',
    cone: '锥壳',
    equipment_flange: '设备法兰',
    gasket: '垫片',
    boot_shell: '气(液)包筒体',
    skirt: '裙座',
    fixed_tubesheet: '固定管板',
    u_tube_head: 'U型/浮头管板',
    expansion_joint: '膨胀节',
    nozzle_manhole: '法兰/人孔',
    saddle: '鞍座',
    lug_support: '耳座',
    leg_support: '支腿',
    support_stand: '支承式支座',
    wind_guide: '防风定位板',
    horizontal_lug: '卧式吊耳',
    ring_lug: '刚性环耳座',
    lifting_ring: '吊耳环',
    stiffening_ring: '外压加强圈',
    trunnion: '轴耳',
    tray: '塔盘',
    side_lug: '侧壁式吊耳',
    packing: '填料',
    top_davit: '塔顶吊柱',
    demister: '丝网除沫器',
    structural_steel: '型钢',
    weld_seam: '焊缝',
    pad_plate: '垫板',
    tube_layout: '管排',
    floating_hook: '浮头勾圈',
    pass_partition: '分程隔板',
    impingement_baffle: '防冲挡板',
    nameplate: '铭牌',
    spatial_piping: '空间管线',
    insulation_support: '保温支承',
    grounding_lug: '接地垫片',
    pipe_boss: '管座',
    vortex_breaker: '防涡流板',
    bottom_orifice: '底部孔板',
    foundation_template: '基础模板',
    gas_outlet_baffle: '气体出口挡板',
    sphere_column: '球罐支柱与拉杆',
    ladder_platform: '梯子平台',
  };
  return map[type] || type;
}

export function bomToCsv(rows: BomRow[], totals: {
  totalWeightKg: number;
  totalInnerAreaM2: number;
  totalOuterAreaM2: number;
  totalInternalVolumeM3: number;
}): string {
  const header = [
    '序号',
    '位号',
    '标准号',
    '零件名称',
    '材质',
    '规格',
    '工艺下料尺寸',
    '单台数量',
    '备件数量',
    '单重(kg)',
    '总重(kg)',
    '内表面积(m2)',
    '外表面积(m2)',
    '容积(m3)',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.index,
        `"${r.tag}"`,
        `"${r.standard}"`,
        `"${r.partName}"`,
        `"${r.material}"`,
        `"${r.spec}"`,
        `"${r.cuttingSize}"`,
        r.unitQty,
        r.spareQty,
        r.unitWeightKg,
        r.totalWeightKg,
        r.innerAreaM2,
        r.outerAreaM2,
        r.internalVolumeM3,
      ].join(',')
    );
  }
  lines.push(
    [
      '合计',
      '',
      '',
      '设备总计',
      '',
      '',
      '',
      '',
      '',
      '',
      totals.totalWeightKg,
      totals.totalInnerAreaM2,
      totals.totalOuterAreaM2,
      totals.totalInternalVolumeM3,
    ].join(',')
  );
  return '\uFEFF' + lines.join('\n');
}

/**
 * Calculate detailed manufacturing cost estimate (造价估算) from BOM rows & unit prices.
 */
export function calculateCostEstimate(
  rows: BomRow[],
  totals: { totalWeightKg: number; totalOuterAreaM2: number },
  customUnitPrices?: Record<string, number>
): CostEstimateSummary {
  const byMat = new Map<string, number>();
  for (const r of rows) {
    byMat.set(r.material, (byMat.get(r.material) || 0) + r.totalWeightKg);
  }

  const getPricePerTon = (mat: string): number => {
    if (customUnitPrices && Number.isFinite(customUnitPrices[mat])) {
      return customUnitPrices[mat];
    }
    const found = MATERIAL_CATALOG.find((m) => m.grade === mat);
    return found ? found.refPricePerTon : 6500;
  };

  const materialRows = Array.from(byMat.entries()).map(([material, weightKg]) => {
    const unitPricePerTon = getPricePerTon(material);
    // Include 10% plate nesting/cutting allowance
    const costRmb = Number(((weightKg / 1000) * 1.1 * unitPricePerTon).toFixed(0));
    return {
      material,
      weightKg: Number(weightKg.toFixed(1)),
      unitPricePerTon,
      costRmb,
    };
  });

  const materialTotalRmb = materialRows.reduce((s, r) => s + r.costRmb, 0);
  const weightTons = Math.max(0.1, totals.totalWeightKg / 1000);
  const fabCost = Math.round(weightTons * 4600);
  const ndtWeldCost = Math.round(weightTons * 1850);
  const paintCost = Math.round(Math.max(10, totals.totalOuterAreaM2) * 145);
  const hydroTestCost = Math.round(2800 + weightTons * 420);
  const overheadCost = Math.round((materialTotalRmb + fabCost + ndtWeldCost) * 0.08);
  const manufacturingTotalRmb = fabCost + ndtWeldCost + paintCost + hydroTestCost + overheadCost;
  const preTax = materialTotalRmb + manufacturingTotalRmb;
  const taxRmb = Math.round(preTax * 0.13);
  const grandTotalRmb = preTax + taxRmb;
  const unitPricePerKg =
    totals.totalWeightKg > 0 ? Number((grandTotalRmb / totals.totalWeightKg).toFixed(2)) : 0;

  return {
    materialRows,
    breakdownRows: [
      {
        category: '主体及零部件材料费 (含10%下料余量)',
        basis: `${totals.totalWeightKg.toFixed(1)} kg`,
        unitPriceLabel: '按材质单价汇总',
        amountRmb: materialTotalRmb,
      },
      {
        category: '卷板成型与机加工制造费',
        basis: `${weightTons.toFixed(2)} 吨`,
        unitPriceLabel: '4,600 元/吨',
        amountRmb: fabCost,
      },
      {
        category: '焊接耗材及无损检测 (RT/UT/MT)',
        basis: `${weightTons.toFixed(2)} 吨`,
        unitPriceLabel: '1,850 元/吨',
        amountRmb: ndtWeldCost,
      },
      {
        category: '喷砂除锈及内外表面涂装防腐',
        basis: `${totals.totalOuterAreaM2.toFixed(2)} m²`,
        unitPriceLabel: '145 元/m²',
        amountRmb: paintCost,
      },
      {
        category: '水压试验、热处理及监检费',
        basis: '1 台套',
        unitPriceLabel: '定额 + 吨位系数',
        amountRmb: hydroTestCost,
      },
      {
        category: '设计、数字化交付及企业管理费 (8%)',
        basis: '直接费 × 8%',
        unitPriceLabel: '8%',
        amountRmb: overheadCost,
      },
      {
        category: '增值税 (13%)',
        basis: '税前总价 × 13%',
        unitPriceLabel: '13%',
        amountRmb: taxRmb,
      },
    ],
    materialTotalRmb,
    manufacturingTotalRmb,
    taxRmb,
    grandTotalRmb,
    unitPricePerKg,
  };
}

/**
 * Generate real AVEVA PDMS / E3D PML equipment macro (.mac) for piping integration (导入配管).
 */
export function generatePdmsMacro(assemblies: AssemblyPoint[], spec: TechnicalSpec): string {
  const tag = (spec.vesselTag || 'V-101').replace(/[^A-Za-z0-9_-]/g, '');
  const lines: string[] = [
    `$* ===============================================================`,
    `$* AVEVA PDMS / E3D Equipment Macro exported by GHPV V1.6`,
    `$* Equipment Tag : /${tag} (${spec.vesselName})`,
    `$* Design Code   : ${spec.designCode}  P=${spec.designPressure}MPa  T=${spec.designTemp}C`,
    `$* ===============================================================`,
    `NEW EQUI /${tag}`,
    `  DESC '${spec.vesselName} - ${spec.drawingNo}'`,
    `  POS E 0 N 0 U 0`,
  ];

  for (const ap of assemblies) {
    const placedMains = layoutAssemblyMainComponents(ap);
    const isHoriz = ap.orientation === 'horizontal';
    const totalLen = placedMains.length > 0 ? placedMains[placedMains.length - 1].endPosMm : 0;

    lines.push(`  $* --- ${ap.name} (${isHoriz ? 'Horizontal' : 'Vertical'}, Total=${Math.round(totalLen)}mm) ---`);
    const placedMap = new Map<string, PlacedMainComponent>();
    for (const pm of placedMains) {
      placedMap.set(pm.component.id, pm);
      const midPos = Math.round((pm.startPosMm + pm.endPosMm) / 2);
      const posStr = isHoriz
        ? `POS E ${midPos} N ${ap.z} U 0`
        : `POS E ${ap.x} N ${ap.z} U ${midPos}`;
      const oriStr = isHoriz ? `ORI Y IS E AND Z IS U` : `ORI Y IS N AND Z IS U`;

      switch (pm.component.type) {
        case 'shell':
        case 'boot_shell': {
          const p = pm.component.params as ShellParams;
          lines.push(`  NEW CYLI /${tag}-${pm.component.id}`);
          lines.push(`    DIAM ${p.diameter + 2 * p.thickness} HEIG ${p.length}`);
          lines.push(`    ${posStr}`);
          lines.push(`    ${oriStr}`);
          lines.push(`  END`);
          break;
        }
        case 'elliptical_head': {
          const p = pm.component.params as EllipticalHeadParams;
          lines.push(`  NEW DISH /${tag}-${pm.component.id}`);
          lines.push(`    DIAM ${p.diameter + 2 * p.nominalThickness} HEIG ${Math.round(p.diameter / 4)} RADI ${Math.round(p.diameter * 0.17)}`);
          lines.push(`    ${posStr}`);
          lines.push(`    ${oriStr}`);
          lines.push(`  END`);
          break;
        }
        case 'spherical_tank': {
          const p = pm.component.params as SphericalTankParams;
          lines.push(`  NEW SPHE /${tag}-${pm.component.id}`);
          lines.push(`    DIAM ${p.diameter + 2 * p.thickness}`);
          lines.push(`    POS E ${ap.x} N ${ap.z} U ${Math.round(p.diameter / 2)}`);
          lines.push(`  END`);
          break;
        }
        case 'cone': {
          const p = pm.component.params as ConeParams;
          lines.push(`  NEW CONE /${tag}-${pm.component.id}`);
          lines.push(`    DTOP ${p.smallDiameter} DBOT ${p.largeDiameter} HEIG ${p.totalLength}`);
          lines.push(`    ${posStr}`);
          lines.push(`  END`);
          break;
        }
        case 'skirt': {
          const p = pm.component.params as SkirtParams;
          lines.push(`  NEW CYLI /${tag}-${pm.component.id}`);
          lines.push(`    DIAM ${p.bottomDiameter + 2 * p.thickness} HEIG ${p.height}`);
          lines.push(`    ${posStr}`);
          lines.push(`  END`);
          break;
        }
        default: {
          lines.push(`  NEW CYLI /${tag}-${pm.component.id}`);
          lines.push(`    DIAM ${Math.round(pm.outerRadiusMm * 2)} HEIG ${Math.max(10, Math.round(pm.axialLengthMm))}`);
          lines.push(`    ${posStr}`);
          lines.push(`  END`);
          break;
        }
      }
    }

    // Export Nozzle Connection Points for PDMS Piping Routing
    const nozzles = ap.components.filter((c) => c.type === 'nozzle_manhole');
    for (const noz of nozzles) {
      const p = noz.params as NozzleManholeParams;
      const parent = noz.parentId ? placedMap.get(noz.parentId) : placedMains[0];
      const axialMm = Math.round((parent?.startPosMm || 0) + p.axialOffset);
      const radDistMm = Math.round((parent?.outerRadiusMm || 600) + p.protrusion);
      const angRad = (p.angleDeg * PI) / 180;
      const eCoord = isHoriz ? axialMm : Math.round(ap.x + radDistMm * Math.cos(angRad));
      const nCoord = isHoriz ? Math.round(ap.z + radDistMm * Math.sin(angRad)) : Math.round(ap.z + radDistMm * Math.sin(angRad));
      const uCoord = isHoriz ? Math.round(radDistMm * Math.cos(angRad)) : axialMm;

      lines.push(`  NEW NOZZ /${tag}/${p.tag}`);
      lines.push(`    DESC '${p.purpose} DN${p.dn} PN${p.pn} ${p.flangeType}'`);
      lines.push(`    CATREF /ANSI-FLG/DN${p.dn}-CL${p.pn}`);
      lines.push(`    POS E ${eCoord} N ${nCoord} U ${uCoord}`);
      lines.push(`    HEIG ${p.protrusion}`);
      lines.push(`  END`);
    }
  }

  lines.push(`END`);
  return lines.join('\n');
}

/**
 * 3D Spatial & Mechanical Interference Checker (GHPV Ep 11: 管束交错干涉 / 管口与鞍座碰撞检查).
 */
export function checkInterferences(assemblies: AssemblyPoint[]): InterferenceReport {
  const issues: InterferenceIssue[] = [];
  let checkedCount = 0;

  for (const ap of assemblies) {
    const placedMains = layoutAssemblyMainComponents(ap);
    const placedMap = new Map<string, PlacedMainComponent>(
      placedMains.map((pm) => [pm.component.id, pm])
    );

    // 1. Heat exchanger tube bundle ligament, U-bend clearance & shell clearance checks
    const tubeBundles = ap.components.filter((c) => c.visible && c.type === 'tube_layout');
    for (const tb of tubeBundles) {
      checkedCount++;
      const p = tb.params as TubeLayoutParams;
      const minPitch = Math.round(p.tubeOD * 1.25); // GB/T 151 minimum pitch >= 1.25 * d
      const ligament = p.tubePitch - p.tubeOD;
      if (p.tubePitch < minPitch || ligament < 6) {
        issues.push({
          id: `clash-pitch-${tb.id}`,
          severity: 'error',
          category: 'tube_bundle',
          componentIds: [tb.id],
          componentNames: tb.name,
          title: p.tubeType === 'U形管' ? 'U形管弯管段与管桥交错干涉' : '换热管排布管桥间距过小',
          detail: `当前管外径 Ø${p.tubeOD}mm，管中心距 S=${p.tubePitch}mm（净管桥仅 ${ligament.toFixed(1)}mm），小于 GB/T 151 规定最小中心距 ${minPitch}mm，存在胀管/弯头交错干涉风险。`,
          suggestion: `建议将管间距修正为 S=${Math.max(minPitch, p.tubeOD + 7)}mm 并重算布管。`,
          clearanceMm: Number((p.tubePitch - minPitch).toFixed(1)),
        });
      }

      const shellClearance = (p.shellDiameter - p.outerLimitDiameter) / 2;
      if (shellClearance < 14) {
        issues.push({
          id: `clash-dl-${tb.id}`,
          severity: 'error',
          category: 'tube_bundle',
          componentIds: [tb.id],
          componentNames: tb.name,
          title: '布管限定圆 DL 与壳体内壁干涉',
          detail: `布管限定圆 DL=${p.outerLimitDiameter}mm 与壳体内径 Di=${p.shellDiameter}mm 单边间隙仅 ${shellClearance.toFixed(1)}mm（标准应 ≥16mm）。`,
          suggestion: `建议将布管限定圆缩小至 DL=${Math.max(200, p.shellDiameter - 48)}mm。`,
          clearanceMm: Number((shellClearance - 16).toFixed(1)),
        });
      }
    }

    // 2. Nozzle-to-nozzle spatial collision check on same shell
    const nozzles = ap.components.filter((c) => c.visible && c.type === 'nozzle_manhole');
    for (let i = 0; i < nozzles.length; i++) {
      for (let j = i + 1; j < nozzles.length; j++) {
        const a = nozzles[i];
        const b = nozzles[j];
        if (a.parentId !== b.parentId) continue;
        checkedCount++;
        const pa = a.params as NozzleManholeParams;
        const pb = b.params as NozzleManholeParams;
        const parent = a.parentId ? placedMap.get(a.parentId) : placedMains[0];
        const shellR = parent ? parent.outerRadiusMm : 600;

        let angDiff = Math.abs(pa.angleDeg - pb.angleDeg) % 360;
        if (angDiff > 180) angDiff = 360 - angDiff;
        const arcDist = shellR * ((angDiff * PI) / 180);
        const axialDist = Math.abs(pa.axialOffset - pb.axialOffset);
        const surfaceDist = Math.hypot(arcDist, axialDist);
        const minSafe = (pa.flangeOD + pb.flangeOD) / 2 + 25;

        if (surfaceDist < minSafe) {
          const clearance = surfaceDist - minSafe;
          issues.push({
            id: `clash-noz-${a.id}-${b.id}`,
            severity: clearance < -30 ? 'error' : 'warning',
            category: 'nozzle_nozzle',
            componentIds: [a.id, b.id],
            componentNames: `${pa.tag} ↔ ${pb.tag}`,
            title: `管口法兰 ${pa.tag} 与 ${pb.tag} 空间干涉`,
            detail: `两管口中心距 ${Math.round(surfaceDist)}mm，小于最小安全包络 ${Math.round(minSafe)}mm（法兰外径 Ø${pa.flangeOD}/Ø${pb.flangeOD}）。`,
            suggestion: `建议将 ${pb.tag} 轴向或周向错开 ${Math.ceil(Math.abs(clearance) + 60)}mm。`,
            clearanceMm: Number(clearance.toFixed(1)),
          });
        }
      }
    }

    // 3. Bottom nozzle vs Saddle support overlap check
    const saddles = ap.components.filter((c) => c.visible && c.type === 'saddle');
    for (const noz of nozzles) {
      const np = noz.params as NozzleManholeParams;
      let angFromBottom = Math.abs(((np.angleDeg % 360) + 360) % 360 - 180);
      if (angFromBottom > 180) angFromBottom = 360 - angFromBottom;
      if (angFromBottom > 60) continue;

      for (const sad of saddles) {
        if (noz.parentId !== sad.parentId) continue;
        checkedCount++;
        const sp = sad.params as SaddleParams;
        const axialDist = Math.abs(np.axialOffset - sp.axialOffset);
        const minSafe = sp.baseWidth / 2 + np.flangeOD / 2 + 30;
        if (axialDist < minSafe) {
          issues.push({
            id: `clash-sad-${noz.id}-${sad.id}`,
            severity: 'error',
            category: 'nozzle_saddle',
            componentIds: [noz.id, sad.id],
            componentNames: `${np.tag} ↔ ${sad.name}`,
            title: `底部管口 ${np.tag} 与 ${sad.name} 垫板冲突`,
            detail: `管口轴向位置 ${np.axialOffset}mm 与鞍座中心 ${sp.axialOffset}mm 间距仅 ${Math.round(axialDist)}mm（需 ≥${Math.round(minSafe)}mm）。`,
            suggestion: `建议沿轴向平移 ${np.tag} 避开鞍座垫板区。`,
            clearanceMm: Number((axialDist - minSafe).toFixed(1)),
          });
        }
      }
    }
  }

  return {
    checkedCount: Math.max(1, checkedCount),
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    issues,
  };
}

/**
 * One-click Engineering Interference Auto-Correction (GHPV Ep 11: 修正管束并自动避让).
 */
export function autoFixInterferences(assemblies: AssemblyPoint[]): {
  assemblies: AssemblyPoint[];
  fixedCount: number;
  summary: string;
} {
  const cloned = JSON.parse(JSON.stringify(assemblies)) as AssemblyPoint[];
  const initialReport = checkInterferences(cloned);
  if (initialReport.issues.length === 0) {
    return { assemblies: cloned, fixedCount: 0, summary: '当前模型无干涉冲突，无需修正。' };
  }

  let fixedCount = 0;

  for (const ap of cloned) {
    // Fix tube bundle pitch & outer limit diameter
    for (const comp of ap.components) {
      if (comp.type === 'tube_layout') {
        const p = comp.params as TubeLayoutParams;
        const minPitch = Math.max(Math.round(p.tubeOD * 1.25), p.tubeOD + 7);
        if (p.tubePitch < minPitch) {
          p.tubePitch = minPitch;
          fixedCount++;
        }
        const safeDl = Math.max(200, p.shellDiameter - 48);
        if (p.outerLimitDiameter > p.shellDiameter - 32) {
          p.outerLimitDiameter = safeDl;
          fixedCount++;
        }
      }
    }

    // Fix bottom nozzle vs saddle collisions
    const saddles = ap.components.filter((c) => c.type === 'saddle');
    const nozzles = ap.components.filter((c) => c.type === 'nozzle_manhole');
    for (const noz of nozzles) {
      const np = noz.params as NozzleManholeParams;
      let angFromBottom = Math.abs(((np.angleDeg % 360) + 360) % 360 - 180);
      if (angFromBottom > 180) angFromBottom = 360 - angFromBottom;
      if (angFromBottom <= 60) {
        for (const sad of saddles) {
          if (sad.parentId !== noz.parentId) continue;
          const sp = sad.params as SaddleParams;
          const minSafe = sp.baseWidth / 2 + np.flangeOD / 2 + 65;
          if (Math.abs(np.axialOffset - sp.axialOffset) < minSafe) {
            np.axialOffset =
              np.axialOffset >= sp.axialOffset
                ? Math.round(sp.axialOffset + minSafe + 40)
                : Math.max(180, Math.round(sp.axialOffset - minSafe - 40));
            fixedCount++;
          }
        }
      }
    }

    // Fix nozzle-to-nozzle collisions on same parent
    for (let i = 0; i < nozzles.length; i++) {
      for (let j = i + 1; j < nozzles.length; j++) {
        const a = nozzles[i];
        const b = nozzles[j];
        if (a.parentId !== b.parentId) continue;
        const pa = a.params as NozzleManholeParams;
        const pb = b.params as NozzleManholeParams;
        let angDiff = Math.abs(pa.angleDeg - pb.angleDeg) % 360;
        if (angDiff > 180) angDiff = 360 - angDiff;
        if (angDiff < 35 && Math.abs(pa.axialOffset - pb.axialOffset) < (pa.flangeOD + pb.flangeOD) / 2 + 30) {
          pb.axialOffset = Math.round(pa.axialOffset + (pa.flangeOD + pb.flangeOD) / 2 + 95);
          fixedCount++;
        }
      }
    }
  }

  return {
    assemblies: cloned,
    fixedCount,
    summary: `已完成 ${fixedCount} 处干涉修正（管束间距/限定圆/管口避让），三维模型与图纸已同步更新。`,
  };
}

/**
 * Deterministically convert an AI-parsed pressure vessel specification into full GHPV V2.1 3D assemblies.
 */
export function buildVesselFromAiSpec(parsed: AiParsedVesselSpec): {
  presetId: string;
  spec: TechnicalSpec;
  assemblies: AssemblyPoint[];
} {
  const matInfo = MATERIAL_CATALOG.find((m) => m.grade === parsed.material);
  const material = matInfo ? matInfo.grade : 'Q345R';
  const density = matInfo ? matInfo.density : 7.85;

  const isSphere = parsed.equipmentType === 'spherical_tank';
  const isBku = parsed.equipmentType === 'bku_reboiler';
  const isUEx = parsed.equipmentType === 'u_exchanger';
  const isFixEx = parsed.equipmentType === 'exchanger';
  const isTower = parsed.equipmentType === 'tower';
  const isVert =
    isSphere || isTower || parsed.equipmentType === 'vertical' || parsed.orientation === 'vertical';

  const safeD = Math.max(400, Math.min(20000, Math.round(parsed.shellDiameterMm || (isSphere ? 10500 : 1200))));
  const safeT = Math.max(6, Math.min(80, Math.round(parsed.shellThicknessMm || (isSphere ? 32 : 12))));
  const safeL = Math.max(800, Math.min(18000, Math.round(parsed.shellLengthMm || (isTower ? 5600 : 3400))));
  const kettleD = isBku ? Math.max(safeD + 350, Math.round(parsed.kettleDiameterMm || safeD * 1.65)) : safeD;

  const gold = { r: 198, g: 136, b: 32, a: 255 };
  const goldTranslucent = { r: 198, g: 136, b: 32, a: 120 };
  const saddleGold = { r: 186, g: 124, b: 22, a: 255 };
  const flangeAccent = { r: 184, g: 118, b: 24, a: 255 };
  const tubeOlive = { r: 158, g: 168, b: 86, a: 255 };
  const sphereGold = { r: 210, g: 164, b: 64, a: 255 };

  const spec: TechnicalSpec = {
    vesselTag: parsed.vesselTag?.trim() || 'V-AI01',
    vesselName: parsed.vesselName?.trim() || 'AI 参数化压力容器',
    designCode: parsed.designCode?.trim() || (isSphere ? 'GB/T 12337-2014' : isBku || isUEx || isFixEx ? 'GB/T 151-2014' : 'GB/T 150.1~150.4-2024'),
    vesselClass: parsed.designPressureMpa >= 1.6 ? '第二类压力容器 (D)' : '第一类压力容器 (D)',
    designPressure: Number((parsed.designPressureMpa || 1.6).toFixed(2)),
    workPressure: Number((parsed.workPressureMpa || (parsed.designPressureMpa || 1.6) * 0.8).toFixed(2)),
    testPressure: Number(((parsed.designPressureMpa || 1.6) * 1.25).toFixed(2)),
    designTemp: Math.round(parsed.designTempC || 150),
    workTemp: Math.round(parsed.workTempC || 120),
    medium: parsed.medium?.trim() || '工艺介质',
    corrosionAllowance: 2.0,
    weldEfficiency: isSphere ? 1.0 : 0.85,
    ndtMethod: isSphere ? '100% RT + 100% MT' : '20% RT (NB/T 47013.2 II级)',
    heatTreatment: safeT >= 32 ? '焊后消除应力热处理 (PWHT)' : '无',
    companyName: '上海高惠科技有限公司',
    projectName: 'GHPV V2.1 AI 智能建模项目',
    drawingNo: `GHPV-AI-${(parsed.vesselTag || 'V01').replace(/[^A-Za-z0-9]/g, '')}-01`,
  };

  const components: VesselComponent[] = [];
  let primaryShellId = 'ai-shell-main';
  let primaryShellLength = safeL;

  if (isSphere) {
    primaryShellId = 'ai-sphere-1';
    primaryShellLength = safeD;
    components.push(
      {
        id: primaryShellId,
        name: '球壳1',
        type: 'spherical_tank',
        category: 'main',
        visible: true,
        color: { ...sphereGold },
        subNodes: ['上极带', '上温带', '赤道带', '下温带', '下极带'],
        params: {
          diameter: safeD,
          thickness: safeT,
          zoneStyle: '混合式五带',
          equatorPetals: 16,
          temperatePetals: 12,
          standard: 'GB/T 12337-2014',
          material,
          density,
        },
      },
      {
        id: 'ai-sphere-col',
        name: '球罐支柱组',
        type: 'sphere_column',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...saddleGold },
        subNodes: ['赤道支柱', '交叉拉杆'],
        params: {
          count: 10,
          pipeOD: Math.round(Math.max(325, safeD * 0.045)),
          pipeThickness: 14,
          clearanceMm: 2200,
          hasTieRods: true,
          tieRodOD: 48,
          material: 'Q345R',
          density: 7.85,
        },
      }
    );
  } else if (isBku) {
    const chLen = 620;
    const coneLen = Math.max(480, Math.round((kettleD - safeD) * 0.95));
    const offsetMm = (kettleD - safeD) / 2;
    const baseH = Math.round(safeD * 0.92);
    primaryShellId = 'ai-bku-kettle';
    primaryShellLength = safeL;

    components.push(
      {
        id: 'ai-bku-h1',
        name: '管箱封头',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: safeD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: false,
          material,
          density,
        },
      },
      {
        id: 'ai-bku-ch',
        name: '管箱筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: { shellKind: '筒体', diameter: safeD, thickness: safeT, length: chLen, material, density },
      },
      {
        id: 'ai-bku-flg',
        name: '管箱法兰',
        type: 'equipment_flange',
        category: 'main',
        visible: true,
        color: { ...flangeAccent },
        params: {
          flangeType: '长颈对焊(WN)',
          facing: 'RF',
          standard: 'NB/T 47023-2012',
          pn: spec.designPressure,
          dn: safeD,
          thickness: 44,
          outerDiameter: safeD + 150,
          boltCircle: safeD + 105,
          boltCount: 32,
          boltSpec: 'M24',
          height: 110,
          flipped: false,
          material: '16MnIII',
          density: 7.85,
        },
      },
      {
        id: 'ai-bku-ts',
        name: 'U形管管板',
        type: 'u_tube_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          diameter: safeD,
          outerDiameter: safeD + 150,
          thickness: 70,
          bcd: safeD + 105,
          boltCount: 32,
          boltSpec: 'M24',
          tubeCount: 240,
          tubeOD: parsed.tubeODMm || 25,
          material: '16MnIII',
          density: 7.85,
        },
      },
      {
        id: 'ai-bku-cone',
        name: '偏心锥壳',
        type: 'cone',
        category: 'main',
        visible: true,
        color: { ...goldTranslucent },
        params: {
          coneType: '偏心锥',
          edgeStyle: '双折边',
          smallDiameter: safeD,
          largeDiameter: kettleD,
          thickness: safeT,
          totalLength: coneLen,
          r1: 60,
          r2: 80,
          h1: 30,
          h2: 30,
          flipped: true,
          material,
          density,
        },
      },
      {
        id: primaryShellId,
        name: '釜体扩大筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { ...goldTranslucent },
        params: { shellKind: '筒体', diameter: kettleD, thickness: safeT, length: safeL, material, density },
      },
      {
        id: 'ai-bku-h2',
        name: '釜体椭圆封头',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: kettleD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: true,
          material,
          density,
        },
      },
      {
        id: 'ai-bku-tubes',
        name: 'U形换热管束',
        type: 'tube_layout',
        category: 'attachment',
        parentId: 'ai-bku-cone',
        visible: true,
        color: { ...tubeOlive },
        subNodes: ['U形换热管束', '弓形折流板'],
        params: {
          tubeType: 'U形管',
          shellDiameter: safeD,
          tubeOD: parsed.tubeODMm || 25,
          tubeThickness: 2.5,
          tubePitch: Math.max((parsed.tubeODMm || 25) + 7, parsed.tubePitchMm || 32),
          outerLimitDiameter: Math.max(250, safeD - 56),
          pattern: '正三角形',
          passes: 2,
          tubeLength: Math.max(1200, coneLen + Math.round(safeL * 0.72)),
          baffleCount: Math.max(3, parsed.baffleCount || 6),
          material: 'S30408',
          density: 7.93,
        },
      },
      {
        id: 'ai-bku-sad1',
        name: '鞍座1 (管箱侧)',
        type: 'saddle',
        category: 'attachment',
        parentId: 'ai-bku-ch',
        visible: true,
        color: { ...saddleGold },
        params: {
          standard: 'NB/T 47065.1-2018',
          saddleType: 'BI型',
          fixType: '固定(F)',
          vesselDiameter: safeD,
          centerHeight: baseH,
          axialOffset: Math.round(chLen * 0.5),
          wrapAngleDeg: 120,
          width: 200,
          baseLength: Math.round(safeD * 0.78),
          baseWidth: 180,
          webThickness: 12,
          ribCount: 5,
          padThickness: 10,
          material: 'Q345R',
          density: 7.85,
        },
      },
      {
        id: 'ai-bku-sad2',
        name: '鞍座2 (釜体侧)',
        type: 'saddle',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...saddleGold },
        params: {
          standard: 'NB/T 47065.1-2018',
          saddleType: 'BI型',
          fixType: '滑动(S)',
          vesselDiameter: kettleD,
          centerHeight: Math.round(baseH + offsetMm),
          axialOffset: Math.round(safeL * 0.72),
          wrapAngleDeg: 120,
          width: 240,
          baseLength: Math.round(kettleD * 0.76),
          baseWidth: 220,
          webThickness: 14,
          ribCount: 5,
          padThickness: 12,
          material: 'Q345R',
          density: 7.85,
        },
      }
    );
  } else if (isUEx || isFixEx) {
    primaryShellId = 'ai-ex-shell';
    primaryShellLength = safeL;
    components.push(
      {
        id: 'ai-ex-h1',
        name: '管箱封头',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: safeD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: false,
          material,
          density,
        },
      },
      {
        id: 'ai-ex-ch',
        name: '管箱筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: { shellKind: '筒体', diameter: safeD, thickness: safeT, length: 620, material, density },
      },
      {
        id: 'ai-ex-ts',
        name: isUEx ? 'U形管板' : '固定管板1',
        type: isUEx ? 'u_tube_head' : 'fixed_tubesheet',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          diameter: safeD,
          outerDiameter: safeD + 140,
          thickness: 68,
          bcd: safeD + 100,
          boltCount: 32,
          boltSpec: 'M24',
          tubeCount: 320,
          tubeOD: parsed.tubeODMm || 25,
          material: '16MnIII',
          density: 7.85,
        },
      },
      {
        id: primaryShellId,
        name: '壳程主筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: { ...goldTranslucent },
        params: { shellKind: '筒体', diameter: safeD, thickness: safeT, length: safeL, material, density },
      },
      {
        id: 'ai-ex-h2',
        name: '壳程封头',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: safeD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: true,
          material,
          density,
        },
      },
      {
        id: 'ai-ex-tubes',
        name: isUEx ? 'U形管束' : '直管换热管束',
        type: 'tube_layout',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...tubeOlive },
        params: {
          tubeType: isUEx ? 'U形管' : '直管',
          shellDiameter: safeD,
          tubeOD: parsed.tubeODMm || 25,
          tubeThickness: 2.5,
          tubePitch: Math.max((parsed.tubeODMm || 25) + 7, parsed.tubePitchMm || 34),
          outerLimitDiameter: Math.max(250, safeD - 56),
          pattern: '正三角形',
          passes: 2,
          tubeLength: Math.max(1000, safeL - 360),
          baffleCount: Math.max(3, parsed.baffleCount || 6),
          material: 'S30408',
          density: 7.93,
        },
      },
      {
        id: 'ai-ex-sad1',
        name: '鞍座1',
        type: 'saddle',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...saddleGold },
        params: {
          standard: 'NB/T 47065.1-2018',
          saddleType: 'BI型',
          fixType: '固定(F)',
          vesselDiameter: safeD,
          centerHeight: Math.round(safeD * 0.82),
          axialOffset: Math.round(safeL * 0.22),
          wrapAngleDeg: 120,
          width: 220,
          baseLength: Math.round(safeD * 0.78),
          baseWidth: 200,
          webThickness: 12,
          ribCount: 5,
          padThickness: 10,
          material: 'Q345R',
          density: 7.85,
        },
      },
      {
        id: 'ai-ex-sad2',
        name: '鞍座2',
        type: 'saddle',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...saddleGold },
        params: {
          standard: 'NB/T 47065.1-2018',
          saddleType: 'BI型',
          fixType: '滑动(S)',
          vesselDiameter: safeD,
          centerHeight: Math.round(safeD * 0.82),
          axialOffset: Math.round(safeL * 0.78),
          wrapAngleDeg: 120,
          width: 220,
          baseLength: Math.round(safeD * 0.78),
          baseWidth: 200,
          webThickness: 12,
          ribCount: 5,
          padThickness: 10,
          material: 'Q345R',
          density: 7.85,
        },
      }
    );
  } else {
    // Horizontal vessel, vertical vessel, or tower
    if (isTower || parsed.supportType === 'skirt') {
      components.push({
        id: 'ai-skirt-1',
        name: '裙座1',
        type: 'skirt',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          skirtType: '圆筒形裙座',
          topDiameter: safeD,
          bottomDiameter: safeD,
          thickness: safeT,
          height: Math.round(Math.max(1600, safeD * 1.3)),
          boltCount: 16,
          boltSpec: 'M36',
          baseRingOD: safeD + 320,
          baseRingID: safeD - 120,
          baseRingThickness: 26,
          gussetHeight: 280,
          hasInspectionHole: true,
          material,
          density,
        },
      });
    } else {
      components.push({
        id: 'ai-head-1',
        name: '椭圆封头1',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: safeD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: false,
          material,
          density,
        },
      });
    }

    components.push(
      {
        id: primaryShellId,
        name: '主筒体',
        type: 'shell',
        category: 'main',
        visible: true,
        color: isTower ? { ...goldTranslucent } : { ...gold },
        params: { shellKind: '筒体', diameter: safeD, thickness: safeT, length: safeL, material, density },
      },
      {
        id: 'ai-head-2',
        name: '椭圆封头2',
        type: 'elliptical_head',
        category: 'main',
        visible: true,
        color: { ...gold },
        params: {
          headType: 'EHA',
          standard: 'GB/T 25198-2023',
          diameter: safeD,
          straightHeight: 25,
          nominalThickness: safeT,
          minThickness: Number((safeT * 0.85).toFixed(1)),
          blankThickness: safeT,
          formingMethod: '冷冲压法',
          thinningRate: 15,
          flipped: true,
          material,
          density,
        },
      }
    );

    if (isTower) {
      components.push({
        id: 'ai-trays',
        name: '浮阀塔盘组',
        type: 'tray',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { r: 170, g: 185, b: 198, a: 255 },
        params: {
          trayType: '浮阀塔盘',
          count: Math.max(4, Math.min(12, Math.floor(safeL / 550))),
          spacing: 450,
          startOffset: 650,
          thickness: 4,
          material: 'S30408',
          density: 7.93,
        },
      });
    } else if (!isVert) {
      components.push(
        {
          id: 'ai-sad-1',
          name: '鞍座1',
          type: 'saddle',
          category: 'attachment',
          parentId: primaryShellId,
          visible: true,
          color: { ...saddleGold },
          params: {
            standard: 'NB/T 47065.1-2018',
            saddleType: 'BI型',
            fixType: '固定(F)',
            vesselDiameter: safeD,
            centerHeight: Math.round(safeD * 0.78),
            axialOffset: Math.round(safeL * 0.2),
            wrapAngleDeg: 120,
            width: 240,
            baseLength: Math.round(safeD * 0.78),
            baseWidth: 220,
            webThickness: 12,
            ribCount: 5,
            padThickness: 10,
            material: 'Q345R',
            density: 7.85,
          },
        },
        {
          id: 'ai-sad-2',
          name: '鞍座2',
          type: 'saddle',
          category: 'attachment',
          parentId: primaryShellId,
          visible: true,
          color: { ...saddleGold },
          params: {
            standard: 'NB/T 47065.1-2018',
            saddleType: 'BI型',
            fixType: '滑动(S)',
            vesselDiameter: safeD,
            centerHeight: Math.round(safeD * 0.78),
            axialOffset: Math.round(safeL * 0.8),
            wrapAngleDeg: 120,
            width: 240,
            baseLength: Math.round(safeD * 0.78),
            baseWidth: 220,
            webThickness: 12,
            ribCount: 5,
            padThickness: 10,
            material: 'Q345R',
            density: 7.85,
          },
        }
      );
    } else {
      components.push({
        id: 'ai-legs-1',
        name: 'A型支腿',
        type: 'leg_support',
        category: 'attachment',
        parentId: primaryShellId,
        visible: true,
        color: { ...saddleGold },
        params: {
          standard: 'NB/T 47065.2-2018',
          legType: 'A型',
          count: 4,
          height: 1000,
          startAngleDeg: 45,
          legSectionWidth: 100,
          basePlateSize: 160,
          basePlateThickness: 22,
          axialOffset: 240,
          material: 'Q235B',
          density: 7.85,
        },
      });
    }
  }

  // Mount all parsed nozzles safely
  const nozzleList = Array.isArray(parsed.nozzles) && parsed.nozzles.length > 0 ? parsed.nozzles : [];
  nozzleList.forEach((nz, i) => {
    const dn = Math.max(25, Math.min(800, Math.round(nz.dn || 100)));
    const ratio = Math.max(0.12, Math.min(0.88, Number(nz.axialRatio) || (i + 1) / (nozzleList.length + 1)));
    const isManhole = Boolean(nz.isManhole) || dn >= 450;
    const pipeOD = Math.round(dn * 1.08 * 10) / 10;
    const flangeOD = Math.round(dn * 1.42 + 65);
    components.push({
      id: `ai-noz-${i + 1}`,
      name: nz.tag || `N${i + 1}`,
      type: 'nozzle_manhole',
      category: 'attachment',
      parentId: primaryShellId,
      visible: true,
      color: { ...flangeAccent },
      subNodes: isManhole ? ['接管', '法兰', '人孔盖', '补强圈'] : ['接管', '法兰'],
      params: {
        tag: nz.tag || `N${i + 1}`,
        purpose: nz.purpose || '工艺接管',
        isManhole,
        manholeType: '水平吊盖带颈对焊法兰人孔',
        flangeStandard: 'HG美标法兰',
        flangeSpec: isManhole ? 'HG/T 21524-2014' : 'HG/T 20615-2009',
        flangeType: 'WN-RF',
        pn: String(nz.pn || '150'),
        dn,
        pipeOD,
        pipeThickness: dn >= 200 ? 10 : 6,
        axialOffset: Math.round(primaryShellLength * ratio),
        angleDeg: Number.isFinite(nz.angleDeg) ? Math.round(nz.angleDeg) : 0,
        protrusion: isManhole ? 270 : 230,
        innerProtrusion: 0,
        hasBlindCover: isManhole,
        hasPad: dn >= 150 || isManhole,
        hasElbow: false,
        elbowDirDeg: 0,
        boltCount: dn >= 400 ? 20 : dn >= 200 ? 12 : 8,
        flangeOD,
        flangeThickness: dn >= 400 ? 38 : 26,
        material: '16MnIII',
        pipeMaterial: '20',
        density: 7.85,
      },
    });
  });

  const assemblies: AssemblyPoint[] = [
    {
      id: 'ap-ai-1',
      name: '装配点1 (AI建模)',
      x: 0,
      z: 0,
      orientation: isVert ? 'vertical' : 'horizontal',
      components,
    },
  ];

  return {
    presetId: parsed.equipmentType || 'horizontal',
    spec,
    assemblies,
  };
}

