import * as THREE from 'three';
import type {
  EquipmentFlangeParams,
  NozzleManholeParams,
  RenderMode,
  RgbaColor,
} from '../types/vessel';

const MM_TO_M = 0.001;

export type MaterialFactory = (
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  roughness?: number,
  metalness?: number
) => THREE.Material;

export type NormalizedFlangeStyle = 'WN' | 'LWN' | 'SO' | 'PL' | 'BL';
export type NormalizedFacing = 'RF' | 'MF' | 'TG';

export interface FlangeDimensionInput {
  style: NormalizedFlangeStyle;
  facing: NormalizedFacing;
  boreDiameterMm: number;
  pipeODMm: number;
  flangeODMm: number;
  flangeThicknessMm: number;
  totalHeightMm?: number;
  boltCircleMm?: number;
  boltCount: number;
  boltSpec?: string;
}

export interface ComputedFlangeDimensions {
  style: NormalizedFlangeStyle;
  facing: NormalizedFacing;
  isBlind: boolean;
  rInMm: number;
  rPipeMm: number;
  rHubTopMm: number;
  rHubBaseMm: number;
  rOutMm: number;
  bcdRMm: number;
  boltCount: number;
  boltDiaMm: number;
  boltHoleRMm: number;
  nutAcrossFlatsMm: number;
  nutHeightMm: number;
  washerODMm: number;
  washerThicknessMm: number;
  flangeThicknessMm: number;
  hubHeightMm: number;
  rfHeightMm: number;
  totalHeightMm: number;
  rRfInnerMm: number;
  rRfOuterMm: number;
  filletRMm: number;
  bevelMm: number;
}

const METRIC_BOLT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 42, 45, 48];

/**
 * Parse a metric bolt spec string (e.g. 'M27', 'M20x120', 'M30') into nominal bolt diameter in mm.
 */
export function parseBoltDiameterMm(boltSpec?: string, fallbackMm = 20): number {
  if (boltSpec) {
    const m = boltSpec.match(/M\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (Number.isFinite(val) && val >= 8 && val <= 64) {
        return val;
      }
    }
  }
  return fallbackMm;
}

export function normalizeFlangeStyle(rawType?: string): NormalizedFlangeStyle {
  if (!rawType) return 'WN';
  const t = rawType.toUpperCase();
  if (t.includes('BL') || rawType.includes('法兰盖') || rawType.includes('盲')) return 'BL';
  if (t.includes('LWN')) return 'LWN';
  if (t.includes('WN') || rawType.includes('长颈') || rawType.includes('对焊')) return 'WN';
  if (t.includes('SO') || rawType.includes('乙型') || rawType.includes('带颈平焊')) return 'SO';
  if (t.includes('PL') || rawType.includes('甲型') || rawType.includes('平焊')) return 'PL';
  return 'WN';
}

export function normalizeFacing(rawFacing?: string, rawType?: string): NormalizedFacing {
  const combined = `${rawFacing ?? ''} ${rawType ?? ''}`.toUpperCase();
  if (combined.includes('TG') || combined.includes('榫')) return 'TG';
  if (combined.includes('MF') || combined.includes('FM') || combined.includes('凹凸')) return 'MF';
  return 'RF';
}

function pickNearestMetricBolt(targetMm: number): number {
  let best = METRIC_BOLT_SIZES[0];
  let bestDiff = Math.abs(targetMm - best);
  for (const s of METRIC_BOLT_SIZES) {
    const d = Math.abs(targetMm - s);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

/**
 * Compute 1:1 collision-free ASME B16.5 / HG/T 20592 / NB/T 47021~47023 flange geometry dimensions.
 * Guarantees:
 * - Welding-neck hub root (rHubBaseMm) ALWAYS stays strictly inside the bolt nut clearance circle.
 * - Raised face outer radius (rRfOuterMm) stays strictly inside bolt holes so bolt holes remain crisp & unobstructed.
 * - Bolt holes stay cleanly inside the flange ring plate with realistic edge margin.
 */
export function computeFlangeDimensions(input: FlangeDimensionInput): ComputedFlangeDimensions {
  const style = input.style;
  const facing = input.facing;
  const isBlind = style === 'BL';

  const rInMm = isBlind ? 0 : Math.max(5, input.boreDiameterMm * 0.5);
  const rOutMm = Math.max((isBlind ? 40 : rInMm) + 22, input.flangeODMm * 0.5);
  const rPipeMm = isBlind
    ? Math.max(15, Math.min(rOutMm - 24, input.pipeODMm * 0.5))
    : Math.max(rInMm + 3, Math.min(rOutMm - 18, input.pipeODMm * 0.5));

  const boltCount = Math.max(4, Math.min(64, Math.round(input.boltCount || 8)));
  const radialRimMm = Math.max(18, rOutMm - rPipeMm);

  // Estimate bolt diameter from boltSpec or from flange ring radial width & bolt spacing
  let boltDiaMm: number;
  if (input.boltSpec) {
    boltDiaMm = parseBoltDiameterMm(input.boltSpec, 20);
  } else {
    const estFromRim = radialRimMm * 0.28;
    const approxBcd = rPipeMm + radialRimMm * 0.58;
    const estFromPitch = ((2 * Math.PI * approxBcd) / boltCount) * 0.34;
    boltDiaMm = pickNearestMetricBolt(Math.max(10, Math.min(36, Math.min(estFromRim, estFromPitch))));
  }

  // Clamp bolt size so holes never collide radially or circumferentially
  const maxBoltByRim = Math.max(8, radialRimMm * 0.44);
  boltDiaMm = Math.min(boltDiaMm, maxBoltByRim);

  const boltHoleRMm = Math.max(4.5, boltDiaMm * 0.56);

  // Determine Bolt Circle Radius (BCD / 2)
  let bcdRMm: number;
  const minBcd = rPipeMm + boltHoleRMm + Math.max(4.5, boltDiaMm * 0.32);
  const maxBcdExplicit = rOutMm - boltHoleRMm - 4.0;
  const maxBcdDefault = rOutMm - boltHoleRMm - Math.max(4.5, boltDiaMm * 0.42);
  if (input.boltCircleMm && input.boltCircleMm > 0) {
    const requested = input.boltCircleMm * 0.5;
    bcdRMm = Math.max(minBcd, Math.min(maxBcdExplicit, requested));
  } else {
    const ideal = rPipeMm + radialRimMm * 0.62;
    bcdRMm = Math.max(minBcd, Math.min(maxBcdDefault, ideal));
  }

  // Re-check circumferential bolt pitch clearance so adjacent hex nuts never overlap
  const arcPitchMm = (2 * Math.PI * bcdRMm) / boltCount;
  if (boltDiaMm * 1.9 > arcPitchMm) {
    boltDiaMm = Math.max(8, arcPitchMm / 1.95);
  }
  const finalBoltHoleRMm = Math.max(4.5, boltDiaMm * 0.55);
  const nutAcrossFlatsMm = boltDiaMm * 1.56;
  const nutHeightMm = boltDiaMm * 0.86;
  const washerODMm = boltDiaMm * 1.92;
  const washerThicknessMm = Math.max(2, Math.min(5, boltDiaMm * 0.14));

  // Sealing face height (RF = 2..3.5mm, MF/TG = 4.5..5mm)
  const rfHeightMm =
    facing === 'TG'
      ? 5.0
      : facing === 'MF'
        ? 4.5
        : input.flangeODMm >= 400
          ? 3.5
          : 2.5;

  const flangeThicknessMm = Math.max(10, input.flangeThicknessMm || 24);

  // Hub height according to flange type
  let hubHeightMm = 0;
  if (isBlind || style === 'PL') {
    hubHeightMm = 0;
  } else if (input.totalHeightMm && input.totalHeightMm > flangeThicknessMm + rfHeightMm + 4) {
    hubHeightMm = input.totalHeightMm - flangeThicknessMm - rfHeightMm;
  } else if (style === 'LWN') {
    hubHeightMm = Math.max(48, Math.min(160, flangeThicknessMm * 2.1));
  } else if (style === 'WN') {
    hubHeightMm = Math.max(22, Math.min(96, flangeThicknessMm * 1.32));
  } else if (style === 'SO') {
    hubHeightMm = Math.max(14, Math.min(44, flangeThicknessMm * 0.62));
  }

  // CRITICAL: Hub root radius MUST remain strictly inside bolt nut/washer clearance!
  const washerClearanceR = bcdRMm - washerODMm * 0.5 - 2.5;
  const maxHubBaseMm = Math.max(rPipeMm + 2, washerClearanceR);

  let rHubTopMm = rPipeMm;
  let rHubBaseMm = rPipeMm;
  if (style === 'WN' || style === 'LWN') {
    rHubTopMm = rPipeMm;
    const idealTaper = Math.min(28, Math.max(5, hubHeightMm * 0.28));
    rHubBaseMm = Math.min(maxHubBaseMm, rPipeMm + idealTaper);
    rHubBaseMm = Math.max(rHubTopMm + 1.5, Math.min(rHubBaseMm, maxHubBaseMm));
  } else if (style === 'SO') {
    const collarWall = Math.min(18, Math.max(5, (maxHubBaseMm - rPipeMm) * 0.65));
    rHubBaseMm = Math.min(maxHubBaseMm, rPipeMm + collarWall);
    rHubTopMm = Math.max(rPipeMm + 2.5, rHubBaseMm - 2.5);
  }

  // Concave root fillet radius between hub base and flat flange back face
  const radialClearanceToWasher = Math.max(0, washerClearanceR - rHubBaseMm);
  const filletRMm =
    hubHeightMm > 8
      ? Math.max(2.5, Math.min(12, hubHeightMm * 0.24, radialClearanceToWasher + 3.5))
      : 0;

  // Raised face outer radius: strictly inside bolt holes (standard HG/T 20592 d_RF)
  const rRfOuterMm = Math.max(
    rPipeMm + 6,
    Math.min(bcdRMm - finalBoltHoleRMm - 3.5, bcdRMm - boltDiaMm * 0.82)
  );
  const rRfInnerMm = isBlind ? 0 : facing === 'TG' ? Math.max(rInMm + 8, rRfOuterMm - Math.max(14, (rRfOuterMm - rInMm) * 0.42)) : rInMm;

  const bevelMm = Math.max(1.2, Math.min(3.0, flangeThicknessMm * 0.065));
  const totalHeightMm = hubHeightMm + flangeThicknessMm + rfHeightMm;

  return {
    style,
    facing,
    isBlind,
    rInMm,
    rPipeMm,
    rHubTopMm,
    rHubBaseMm,
    rOutMm,
    bcdRMm,
    boltCount,
    boltDiaMm,
    boltHoleRMm: finalBoltHoleRMm,
    nutAcrossFlatsMm,
    nutHeightMm,
    washerODMm,
    washerThicknessMm,
    flangeThicknessMm,
    hubHeightMm,
    rfHeightMm,
    totalHeightMm,
    rRfInnerMm,
    rRfOuterMm,
    filletRMm,
    bevelMm,
  };
}

/**
 * Create a sharp-normal revolved profile with crisp flat/cylindrical transitions.
 * Duplicates corner vertices slightly inset along flat faces so Three.js LatheGeometry
 * never bleeds dark normals across 90-degree edges.
 */
export function createCrispHollowCylinder(
  rIn: number,
  rOut: number,
  length: number,
  segments = 72,
  chamfer = 0.0015
): THREE.LatheGeometry {
  const c = Math.min(chamfer, Math.max(0.0004, (rOut - rIn) * 0.22), Math.max(0.0004, length * 0.12));
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rIn, c),
    new THREE.Vector2(rIn + c, 0),
    new THREE.Vector2(rOut - c, 0),
    new THREE.Vector2(rOut, c),
    new THREE.Vector2(rOut, Math.max(c * 1.1, length - c)),
    new THREE.Vector2(rOut - c, length),
    new THREE.Vector2(rIn + c, length),
    new THREE.Vector2(rIn, Math.max(c * 1.1, length - c)),
    new THREE.Vector2(rIn, c),
  ];
  return new THREE.LatheGeometry(pts, segments);
}

/**
 * Build the drilled circular flange plate (with real through bolt holes around BCD and chamfered bevel).
 * Local axis: thickness runs along +Y from y = 0 to y = flangeThicknessM.
 * Bolt hole centers land at (cos(a)*bcdR, y, sin(a)*bcdR) — matching buildPrecisionBoltRing identically.
 */
export function createDrilledFlangePlateGeometry(
  dims: ComputedFlangeDimensions,
  curveSegments = 64
): { geometry: THREE.ExtrudeGeometry; holeCount: number } {
  const rOut = dims.rOutMm * MM_TO_M;
  const rIn = dims.rInMm * MM_TO_M;
  const bcdR = dims.bcdRMm * MM_TO_M;
  const holeR = dims.boltHoleRMm * MM_TO_M;
  const plateT = dims.flangeThicknessMm * MM_TO_M;
  const bevel = Math.min(dims.bevelMm * MM_TO_M, plateT * 0.14, holeR * 0.2);

  // ExtrudeGeometry bevel expands outer silhouette by +bevel and shrinks holes by -bevel,
  // so compensate radii by bevel so final CAD dimensions stay 1:1 exact!
  const shape = new THREE.Shape();
  shape.absarc(0, 0, Math.max(0.01, rOut - bevel), 0, Math.PI * 2, false);

  if (!dims.isBlind && rIn > 0.002) {
    const bore = new THREE.Path();
    bore.absarc(0, 0, rIn + bevel, 0, Math.PI * 2, true);
    shape.holes.push(bore);
  }

  // Punch actual through bolt holes around BCD.
  // Because rotateX(-PI/2) maps (x, y, z) -> (x, z, -y), use y = -sin(a)*bcdR so 3D lands at +sin(a)*bcdR.
  const count = dims.boltCount;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const cx = Math.cos(a) * bcdR;
    const cy = -Math.sin(a) * bcdR;
    const hole = new THREE.Path();
    hole.absarc(cx, cy, Math.max(0.002, holeR + bevel * 0.5), 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const extrudeDepth = Math.max(0.002, plateT - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });

  // Shift so Z spans [0, plateT], then rotate -90 deg around X so thickness spans Y in [0, plateT]
  geo.translate(0, 0, bevel);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();

  return { geometry: geo, holeCount: count };
}

/**
 * Build the Welding Neck / Slip-On tapered hub with smooth concave root fillet onto flat flange back.
 * Runs along +Y from y = 0 (weld bevel end) to y = hubHeightM (flush with flange plate back face).
 */
export function createFlangeHubGeometry(
  dims: ComputedFlangeDimensions,
  segments = 64
): THREE.LatheGeometry | null {
  if (dims.isBlind || dims.hubHeightMm <= 1.5) return null;

  const rIn = dims.rInMm * MM_TO_M;
  const rTop = dims.rHubTopMm * MM_TO_M;
  const rBase = dims.rHubBaseMm * MM_TO_M;
  const hubH = dims.hubHeightMm * MM_TO_M;
  const filletR = Math.min(dims.filletRMm * MM_TO_M, hubH * 0.36);
  const weldBevel = Math.min(0.0025, (rTop - rIn) * 0.25, hubH * 0.12);

  // Max radial spread of fillet must never enter the bolt hole / washer zone
  const maxFilletOuter = (dims.bcdRMm - dims.boltHoleRMm - 2.2) * MM_TO_M;
  const filletEndR = Math.min(maxFilletOuter, rBase + filletR);
  const effectiveFilletR = Math.max(0, filletEndR - rBase);

  const pts: THREE.Vector2[] = [];

  // Bottom weld-prep bevel at y = 0
  pts.push(new THREE.Vector2(rIn, weldBevel));
  pts.push(new THREE.Vector2(rIn + weldBevel, 0));
  pts.push(new THREE.Vector2(Math.max(rIn + weldBevel + 0.0005, rTop - weldBevel), 0));
  pts.push(new THREE.Vector2(rTop, weldBevel));

  if (dims.style === 'SO') {
    // Slip-on hub: straight cylindrical collar with small top chamfer & root fillet
    const collarEndY = Math.max(weldBevel + 0.002, hubH - effectiveFilletR);
    pts.push(new THREE.Vector2(rBase, Math.min(collarEndY, weldBevel + 0.004)));
    pts.push(new THREE.Vector2(rBase, collarEndY));
  } else {
    // Welding-neck hub: authentic butt-weld straight landing (~12% height) then smooth conical taper
    const landY = Math.min(hubH * 0.16, 0.012);
    if (landY > weldBevel + 0.001) {
      pts.push(new THREE.Vector2(rTop, landY));
    }
    const taperEndY = Math.max(landY + 0.002, hubH - effectiveFilletR);
    pts.push(new THREE.Vector2(rBase, taperEndY));
  }

  // Smooth concave circular fillet transitioning hub root into flat flange back face (y = hubH)
  if (effectiveFilletR > 0.0015) {
    const filletSteps = 6;
    const fcX = rBase + effectiveFilletR;
    const fcY = hubH - effectiveFilletR;
    for (let i = 1; i <= filletSteps; i++) {
      // Sweep angle from PI (leftmost at rBase, hubH - R) to PI/2 (top at rBase + R, hubH)
      const ang = Math.PI - (i / filletSteps) * (Math.PI / 2);
      const rx = fcX + Math.cos(ang) * effectiveFilletR;
      const ry = fcY + Math.sin(ang) * effectiveFilletR;
      pts.push(new THREE.Vector2(rx, ry));
    }
  } else {
    pts.push(new THREE.Vector2(rBase, hubH));
  }

  // Close along flange back face back to bore and down bore wall
  pts.push(new THREE.Vector2(rIn, hubH));
  pts.push(new THREE.Vector2(rIn, weldBevel));

  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build machined sealing face (RF / MF / TG) with crisp 45-deg edge chamfer and concentric phonographic ring accent.
 * Runs along +Y from y = 0 to y = rfHeightM.
 */
function createSealingFaceMesh(
  dims: ComputedFlangeDimensions,
  faceMat: THREE.Material,
  grooveMat: THREE.Material,
  segments = 64
): THREE.Group {
  const g = new THREE.Group();
  const rfH = dims.rfHeightMm * MM_TO_M;
  const rOut = dims.rRfOuterMm * MM_TO_M;
  const rIn = dims.rRfInnerMm * MM_TO_M;
  const c = Math.min(0.0012, rfH * 0.35);

  if (dims.isBlind && dims.facing !== 'TG') {
    const pts = [
      new THREE.Vector2(0.0005, 0),
      new THREE.Vector2(rOut, 0),
      new THREE.Vector2(rOut, Math.max(0.0005, rfH - c)),
      new THREE.Vector2(rOut - c, rfH),
      new THREE.Vector2(0.0005, rfH),
    ];
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, faceMat));
  } else {
    const inner = Math.max(0.003, rIn);
    const pts = [
      new THREE.Vector2(inner, 0),
      new THREE.Vector2(rOut, 0),
      new THREE.Vector2(rOut, Math.max(0.0005, rfH - c)),
      new THREE.Vector2(rOut - c, rfH),
      new THREE.Vector2(inner + c * 0.6, rfH),
      new THREE.Vector2(inner, Math.max(0.0005, rfH - c * 0.6)),
      new THREE.Vector2(inner, 0),
    ];
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, faceMat));
  }

  // Subtle concentric machined sealing-face indicator ring on outer RF face
  const rMidIn = dims.isBlind ? Math.max(0.02, rOut * 0.72) : rIn + (rOut - rIn) * 0.25;
  const rMidOut = rOut - Math.max(0.002, (rOut - rMidIn) * 0.14);
  if (rMidOut > rMidIn + 0.003) {
    const ringGeo = new THREE.RingGeometry(rMidIn, rMidOut, segments, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, grooveMat);
    ring.position.y = rfH + 0.00035;
    ring.userData.skipEdgeOverlay = true;
    g.add(ring);
  }

  return g;
}

/**
 * Create a precision 1:1 CAD Bolt + Washer + Hex-Nut ring using InstancedMesh.
 * Clamp faces sit cleanly at `yBotFaceM` and `yTopFaceM` (washers & nuts seat directly on flange back faces!).
 */
export function buildPrecisionBoltRing(options: {
  bcdRMm: number;
  boltCount: number;
  boltDiaMm: number;
  yBotFaceM: number;
  yTopFaceM: number;
  studMat: THREE.Material;
  nutMat: THREE.Material;
  explodeFactor?: number;
  axialPushDir?: number;
}): THREE.Group {
  const {
    bcdRMm,
    boltCount,
    boltDiaMm,
    yBotFaceM,
    yTopFaceM,
    studMat,
    nutMat,
    explodeFactor = 0,
    axialPushDir = 0,
  } = options;

  const g = new THREE.Group();
  const count = Math.max(4, Math.min(64, Math.round(boltCount)));
  const baseR = bcdRMm * MM_TO_M;
  const r = baseR * (1 + explodeFactor * 1.15);

  const boltR = Math.max(0.004, (boltDiaMm * 0.5) * MM_TO_M);
  const washerR = boltR * 1.92;
  const washerT = Math.max(0.002, Math.min(0.005, boltR * 0.28));
  const nutR = boltR * 1.78; // circumradius of hex nut (across-flats = sqrt(3)*nutR ~= 1.54*d)
  const nutH = Math.max(0.006, boltR * 1.65);
  const studOverhang = Math.max(0.006, boltR * 1.05);

  const clampSpan = Math.max(0.012, Math.abs(yTopFaceM - yBotFaceM));
  const midY = (yBotFaceM + yTopFaceM) * 0.5 + axialPushDir * explodeFactor * 0.22;
  const halfSpan = clampSpan * 0.5;
  const studLen = clampSpan + 2 * (washerT + nutH + studOverhang);

  // Smooth chamfered double-ended threaded stud
  const studChamfer = Math.min(0.002, boltR * 0.3);
  const studPts = [
    new THREE.Vector2(0.0005, -studLen * 0.5),
    new THREE.Vector2(boltR - studChamfer, -studLen * 0.5),
    new THREE.Vector2(boltR, -studLen * 0.5 + studChamfer),
    new THREE.Vector2(boltR, studLen * 0.5 - studChamfer),
    new THREE.Vector2(boltR - studChamfer, studLen * 0.5),
    new THREE.Vector2(0.0005, studLen * 0.5),
  ];
  const studGeo = new THREE.LatheGeometry(studPts, 12);

  // Flat steel washer seated directly on flange back face
  const washerGeo = new THREE.CylinderGeometry(washerR, washerR, washerT, 16);

  // Hexagonal nut with realistic 6-sided prism
  const nutGeo = new THREE.CylinderGeometry(nutR, nutR, nutH, 6);
  // Subtle machined crown cap on hex nut
  const nutCrownGeo = new THREE.CylinderGeometry(nutR * 0.78, nutR * 0.94, nutH * 0.16, 12);

  const studs = new THREE.InstancedMesh(studGeo, studMat, count);
  const washersTop = new THREE.InstancedMesh(washerGeo, nutMat, count);
  const washersBot = new THREE.InstancedMesh(washerGeo, nutMat, count);
  const nutsTop = new THREE.InstancedMesh(nutGeo, nutMat, count);
  const nutsBot = new THREE.InstancedMesh(nutGeo, nutMat, count);
  const crownsTop = new THREE.InstancedMesh(nutCrownGeo, nutMat, count);
  const crownsBot = new THREE.InstancedMesh(nutCrownGeo, nutMat, count);

  const explodeNutSep = explodeFactor * Math.max(0.06, clampSpan * 0.55);
  const topWasherY = midY + halfSpan + washerT * 0.5 + explodeNutSep * 0.45;
  const botWasherY = midY - halfSpan - washerT * 0.5 - explodeNutSep * 0.45;
  const topNutY = midY + halfSpan + washerT + nutH * 0.5 + explodeNutSep;
  const botNutY = midY - halfSpan - washerT - nutH * 0.5 - explodeNutSep;
  const topCrownY = topNutY + nutH * 0.5 + nutH * 0.07;
  const botCrownY = botNutY - nutH * 0.5 - nutH * 0.07;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;

    dummy.position.set(x, midY, z);
    dummy.rotation.set(0, a, 0);
    dummy.updateMatrix();
    studs.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, topWasherY, z);
    dummy.updateMatrix();
    washersTop.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, botWasherY, z);
    dummy.updateMatrix();
    washersBot.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, topNutY, z);
    dummy.rotation.set(0, a + Math.PI / 6, 0);
    dummy.updateMatrix();
    nutsTop.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, botNutY, z);
    dummy.updateMatrix();
    nutsBot.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, topCrownY, z);
    dummy.rotation.set(0, a, 0);
    dummy.updateMatrix();
    crownsTop.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, botCrownY, z);
    dummy.rotation.set(Math.PI, a, 0);
    dummy.updateMatrix();
    crownsBot.setMatrixAt(i, dummy.matrix);
  }

  for (const inst of [studs, washersTop, washersBot, nutsTop, nutsBot, crownsTop, crownsBot]) {
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    g.add(inst);
  }

  return g;
}

/**
 * Build a complete 1:1 Precision Equipment Flange (NB/T 47021~47023) aligned along +Y from y=0 to y=p.height*MM_TO_M.
 * Supports WN (长颈对焊), SO (乙型), PL (甲型), BL (法兰盖) and RF/MF/TG sealing faces.
 */
export function buildPrecisionEquipmentFlange(options: {
  params: EquipmentFlangeParams;
  color: RgbaColor;
  renderMode: RenderMode;
  isSelected: boolean;
  clippingPlanes: THREE.Plane[];
  explodeFactor: number;
  createMat: MaterialFactory;
  /** Optional bolt span override (meters, in this flange's local Y) when bolted to an adjacent partner flange/tubesheet */
  boltClampOverride?: { yBotFaceM: number; yTopFaceM: number } | null;
  /** Suppress duplicate bolts on the second flange of a paired flange joint */
  suppressBolts?: boolean;
}): { group: THREE.Group; dims: ComputedFlangeDimensions; holeCount: number } {
  const {
    params: p,
    color,
    renderMode,
    isSelected,
    clippingPlanes,
    explodeFactor,
    createMat,
    boltClampOverride,
    suppressBolts = false,
  } = options;

  const style = normalizeFlangeStyle(p.flangeType);
  const facing = normalizeFacing(p.facing, p.flangeType);
  const shellWallMm = Math.max(10, Math.min(24, p.dn * 0.016));

  const dims = computeFlangeDimensions({
    style,
    facing,
    boreDiameterMm: p.dn,
    pipeODMm: p.dn + shellWallMm * 2,
    flangeODMm: p.outerDiameter,
    flangeThicknessMm: p.thickness,
    totalHeightMm: p.height,
    boltCircleMm: p.boltCircle,
    boltCount: p.boltCount,
    boltSpec: p.boltSpec,
  });

  const bodyMat = createMat(color, renderMode, isSelected, clippingPlanes, 0.34, 0.56);
  const machinedFaceMat = createMat(
    {
      r: Math.min(255, Math.round(color.r * 0.55 + 110)),
      g: Math.min(255, Math.round(color.g * 0.55 + 115)),
      b: Math.min(255, Math.round(color.b * 0.55 + 122)),
      a: color.a,
    },
    renderMode,
    isSelected,
    clippingPlanes,
    0.18,
    0.82
  );
  const grooveMat = createMat(
    { r: 138, g: 148, b: 162, a: color.a },
    renderMode,
    isSelected,
    clippingPlanes,
    0.26,
    0.76
  );
  // Authentic forged alloy-steel stud & zinc-cadmium hex nut finish (never cartoonish neon blue)
  const studMat = createMat(
    { r: 108, g: 120, b: 136, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.34,
    0.74
  );
  const nutMat = createMat(
    { r: 196, g: 204, b: 214, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.22,
    0.82
  );

  const g = new THREE.Group();
  const totalH = Math.max(dims.flangeThicknessMm + dims.rfHeightMm, p.height) * MM_TO_M;
  const flgT = dims.flangeThicknessMm * MM_TO_M;
  const rfH = dims.rfHeightMm * MM_TO_M;
  const hubH = Math.max(0, totalH - flgT - rfH);

  // Sync actual hubH so flange aligns flush to layoutAssemblyMainComponents startPos..endPos
  const alignedDims: ComputedFlangeDimensions = {
    ...dims,
    hubHeightMm: dims.isBlind || dims.style === 'PL' ? 0 : hubH / MM_TO_M,
  };

  // 1. Drilled Flange Plate with real circular bolt holes
  const { geometry: plateGeo, holeCount } = createDrilledFlangePlateGeometry(alignedDims, 72);
  const plateMesh = new THREE.Mesh(plateGeo, bodyMat);
  const plateY = p.flipped
    ? rfH
    : dims.isBlind || dims.style === 'PL'
      ? Math.max(0, totalH - flgT - rfH)
      : hubH;
  plateMesh.position.y = plateY;
  g.add(plateMesh);

  // 2. Tapered Welding Neck / Slip-On Hub + Root Fillet
  if (!alignedDims.isBlind && alignedDims.hubHeightMm > 1.5) {
    const hubGeo = createFlangeHubGeometry(alignedDims, 72);
    if (hubGeo) {
      const hubMesh = new THREE.Mesh(hubGeo, bodyMat);
      if (p.flipped) {
        // Flip axially so weld bevel is at y = totalH and fillet meets plate top at y = rfH + flgT
        hubMesh.scale.y = -1;
        hubMesh.position.y = totalH;
      } else {
        hubMesh.position.y = 0;
      }
      g.add(hubMesh);
    }
  } else if (alignedDims.style === 'PL' && !alignedDims.isBlind && plateY > 0.002) {
    // Flat-plate flange weld collar back to shell
    const collar = new THREE.Mesh(
      createCrispHollowCylinder(
        alignedDims.rInMm * MM_TO_M,
        alignedDims.rPipeMm * MM_TO_M,
        plateY + 0.001,
        72
      ),
      bodyMat
    );
    collar.position.y = p.flipped ? rfH + flgT : 0;
    g.add(collar);
  }

  // 3. Machined Raised Face / MF / TG Sealing Surface
  const faceGroup = createSealingFaceMesh(alignedDims, machinedFaceMat, grooveMat, 72);
  if (p.flipped) {
    faceGroup.scale.y = -1;
    faceGroup.position.y = rfH;
  } else {
    faceGroup.position.y = plateY + flgT;
  }
  g.add(faceGroup);

  // 4. Precision Stud + Washer + Hex-Nut Ring
  if (!suppressBolts) {
    const yBotFaceM = boltClampOverride ? boltClampOverride.yBotFaceM : plateY;
    const yTopFaceM = boltClampOverride ? boltClampOverride.yTopFaceM : plateY + flgT;
    const boltRing = buildPrecisionBoltRing({
      bcdRMm: alignedDims.bcdRMm,
      boltCount: alignedDims.boltCount,
      boltDiaMm: alignedDims.boltDiaMm,
      yBotFaceM,
      yTopFaceM,
      studMat,
      nutMat,
      explodeFactor,
      axialPushDir: p.flipped ? -1 : 1,
    });
    g.add(boltRing);
  }

  return { group: g, dims: alignedDims, holeCount };
}

/**
 * Build a complete 1:1 Precision Pipe / Nozzle Flange (HG/T 20592 / HG/T 20615 / ASME B16.5)
 * aligned along local +Y, with:
 * - y = 0 at weld-bevel hub end (bottom of flange hub)
 * - y = totalHeightM at the Raised Face (RF) sealing face!
 */
export function buildPrecisionPipeFlange(options: {
  params: Pick<
    NozzleManholeParams,
    'flangeType' | 'dn' | 'pipeOD' | 'pipeThickness' | 'flangeOD' | 'flangeThickness' | 'boltCount'
  >;
  color: RgbaColor;
  renderMode: RenderMode;
  isSelected: boolean;
  clippingPlanes: THREE.Plane[];
  createMat: MaterialFactory;
  maxHubHeightMm?: number;
  overrideStyle?: NormalizedFlangeStyle;
  segments?: number;
}): { group: THREE.Group; dims: ComputedFlangeDimensions; totalHeightM: number; holeCount: number } {
  const {
    params: p,
    color,
    renderMode,
    isSelected,
    clippingPlanes,
    createMat,
    maxHubHeightMm,
    overrideStyle,
    segments = 64,
  } = options;

  const style = overrideStyle ?? normalizeFlangeStyle(p.flangeType);
  const facing = normalizeFacing(undefined, p.flangeType);
  const boreMm = Math.max(10, p.pipeOD - 2 * Math.max(2, p.pipeThickness || 6));

  let dims = computeFlangeDimensions({
    style,
    facing,
    boreDiameterMm: boreMm,
    pipeODMm: p.pipeOD,
    flangeODMm: p.flangeOD,
    flangeThicknessMm: p.flangeThickness,
    boltCount: p.boltCount,
  });

  if (maxHubHeightMm !== undefined && dims.hubHeightMm > maxHubHeightMm) {
    dims = {
      ...dims,
      hubHeightMm: Math.max(0, maxHubHeightMm),
      filletRMm: Math.min(dims.filletRMm, Math.max(0, maxHubHeightMm) * 0.35),
      totalHeightMm: Math.max(0, maxHubHeightMm) + dims.flangeThicknessMm + dims.rfHeightMm,
    };
  }

  const bodyMat = createMat(color, renderMode, isSelected, clippingPlanes, 0.32, 0.58);
  const machinedFaceMat = createMat(
    {
      r: Math.min(255, Math.round(color.r * 0.5 + 122)),
      g: Math.min(255, Math.round(color.g * 0.5 + 126)),
      b: Math.min(255, Math.round(color.b * 0.5 + 132)),
      a: color.a,
    },
    renderMode,
    isSelected,
    clippingPlanes,
    0.18,
    0.82
  );
  const grooveMat = createMat(
    { r: 142, g: 152, b: 165, a: color.a },
    renderMode,
    isSelected,
    clippingPlanes,
    0.26,
    0.76
  );

  const g = new THREE.Group();
  const hubH = dims.hubHeightMm * MM_TO_M;
  const flgT = dims.flangeThicknessMm * MM_TO_M;

  // 1. Tapered WN/SO Hub + Root Fillet (strictly inside bolt circle!)
  const hubGeo = createFlangeHubGeometry(dims, segments);
  if (hubGeo) {
    g.add(new THREE.Mesh(hubGeo, bodyMat));
  }

  // 2. Drilled Flange Plate with real circular bolt holes + bevel
  const { geometry: plateGeo, holeCount } = createDrilledFlangePlateGeometry(dims, segments);
  const plateMesh = new THREE.Mesh(plateGeo, bodyMat);
  plateMesh.position.y = hubH;
  g.add(plateMesh);

  // 3. Machined Raised Face (RF / MF / TG) on sealing face
  const faceGroup = createSealingFaceMesh(dims, machinedFaceMat, grooveMat, segments);
  faceGroup.position.y = hubH + flgT;
  g.add(faceGroup);

  return {
    group: g,
    dims,
    totalHeightM: dims.totalHeightMm * MM_TO_M,
    holeCount,
  };
}

/**
 * Build a realistic 3-ring Metallic Spiral-Wound Gasket (NB/T 47025 / HG/T 20610):
 * Inner stainless retaining ring + dark graphite/metal spiral winding + outer centering ring.
 */
export function buildSpiralWoundGasketGroup(options: {
  rInM: number;
  rOutM: number;
  thicknessM: number;
  baseColor: RgbaColor;
  renderMode: RenderMode;
  isSelected: boolean;
  clippingPlanes: THREE.Plane[];
  createMat: MaterialFactory;
  segments?: number;
}): THREE.Group {
  const {
    rInM,
    rOutM,
    thicknessM,
    baseColor,
    renderMode,
    isSelected,
    clippingPlanes,
    createMat,
    segments = 72,
  } = options;

  const g = new THREE.Group();
  const span = Math.max(0.006, rOutM - rInM);
  const innerRingW = span * 0.16;
  const outerRingW = span * 0.24;

  const metalRingMat = createMat(
    { r: 182, g: 192, b: 204, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.26,
    0.78
  );
  const windingMat = createMat(
    {
      r: Math.max(38, Math.round(baseColor.r * 0.55)),
      g: Math.max(46, Math.round(baseColor.g * 0.62)),
      b: Math.max(54, Math.round(baseColor.b * 0.65)),
      a: 255,
    },
    renderMode,
    isSelected,
    clippingPlanes,
    0.48,
    0.34
  );

  // Inner stainless steel retaining ring (slightly thinner than compressed winding)
  const ringT = Math.max(0.0025, thicknessM * 0.72);
  const ringY = (thicknessM - ringT) * 0.5;
  const innerRing = new THREE.Mesh(
    createCrispHollowCylinder(rInM, rInM + innerRingW, ringT, segments, 0.0006),
    metalRingMat
  );
  innerRing.position.y = ringY;
  g.add(innerRing);

  // Spiral graphite-metallic sealing element (full thickness)
  const winding = new THREE.Mesh(
    createCrispHollowCylinder(rInM + innerRingW, rOutM - outerRingW, thicknessM, segments, 0.0008),
    windingMat
  );
  g.add(winding);

  // Outer centering ring
  const outerRing = new THREE.Mesh(
    createCrispHollowCylinder(rOutM - outerRingW, rOutM, ringT, segments, 0.0006),
    metalRingMat
  );
  outerRing.position.y = ringY;
  g.add(outerRing);

  return g;
}

/**
 * Build a precision drilled Forged Tubesheet (固定管板 / U形管管板) with:
 * - Outer bolt-hole circle matching BCD & boltCount
 * - Subtle stepped gasket seating shoulders on both faces
 * - Recessed brushed-dark tube-bundle hole pattern disc on both faces
 */
export function buildPrecisionTubesheetGroup(options: {
  diameterMm: number;
  outerDiameterMm: number;
  thicknessMm: number;
  bcdMm: number;
  boltCount: number;
  boltSpec?: string;
  color: RgbaColor;
  renderMode: RenderMode;
  isSelected: boolean;
  clippingPlanes: THREE.Plane[];
  createMat: MaterialFactory;
}): THREE.Group {
  const {
    diameterMm,
    outerDiameterMm,
    thicknessMm,
    bcdMm,
    boltCount,
    boltSpec,
    color,
    renderMode,
    isSelected,
    clippingPlanes,
    createMat,
  } = options;

  const g = new THREE.Group();
  const dims = computeFlangeDimensions({
    style: 'BL',
    facing: 'RF',
    boreDiameterMm: 0,
    pipeODMm: diameterMm,
    flangeODMm: outerDiameterMm,
    flangeThicknessMm: thicknessMm,
    boltCircleMm: bcdMm,
    boltCount: Math.max(8, boltCount || 24),
    boltSpec,
  });

  const bodyMat = createMat(color, renderMode, isSelected, clippingPlanes, 0.30, 0.62);
  const faceMat = createMat(
    {
      r: Math.min(255, Math.round(color.r * 0.58 + 95)),
      g: Math.min(255, Math.round(color.g * 0.58 + 100)),
      b: Math.min(255, Math.round(color.b * 0.58 + 108)),
      a: color.a,
    },
    renderMode,
    isSelected,
    clippingPlanes,
    0.20,
    0.80
  );
  const tubeFaceMat = createMat(
    { r: 72, g: 82, b: 96, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.38,
    0.66
  );

  const { geometry: plateGeo } = createDrilledFlangePlateGeometry(dims, 72);
  const plateMesh = new THREE.Mesh(plateGeo, bodyMat);
  g.add(plateMesh);

  const tM = dims.flangeThicknessMm * MM_TO_M;
  const shellRM = (diameterMm * 0.5) * MM_TO_M;
  const rfRM = dims.rRfOuterMm * MM_TO_M;

  // Machined gasket-seating annular rings & dark tube-sheet perforated zones on both faces
  for (const side of [0, 1]) {
    const yFace = side === 0 ? -0.0005 : tM + 0.0005;
    const rotX = side === 0 ? Math.PI / 2 : -Math.PI / 2;

    if (rfRM > shellRM + 0.008) {
      const seatGeo = new THREE.RingGeometry(shellRM, rfRM, 72);
      seatGeo.rotateX(rotX);
      const seat = new THREE.Mesh(seatGeo, faceMat);
      seat.position.y = yFace;
      seat.userData.skipEdgeOverlay = true;
      g.add(seat);
    }

    const tubeZoneGeo = new THREE.CircleGeometry(Math.max(0.05, shellRM * 0.94), 64);
    tubeZoneGeo.rotateX(rotX);
    const tubeZone = new THREE.Mesh(tubeZoneGeo, tubeFaceMat);
    tubeZone.position.y = side === 0 ? -0.0008 : tM + 0.0008;
    tubeZone.userData.skipEdgeOverlay = true;
    g.add(tubeZone);
  }

  return g;
}
