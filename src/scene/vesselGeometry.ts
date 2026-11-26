import * as THREE from 'three';
import type {
  AssemblyPoint,
  ConeParams,
  DemisterParams,
  EllipticalHeadParams,
  EquipmentFlangeParams,
  ExpansionJointParams,
  FixedTubeSheetParams,
  GasketParams,
  GenericAttachmentParams,
  LadderPlatformParams,
  LegSupportParams,
  LugSupportParams,
  NozzleManholeParams,
  PackingParams,
  PadPlateParams,
  PlacedMainComponent,
  RenderMode,
  RgbaColor,
  SaddleParams,
  ShellParams,
  SkirtParams,
  SphereColumnParams,
  SphericalHeadParams,
  SphericalTankParams,
  StiffeningRingParams,
  TopDavitParams,
  TrayParams,
  TrunnionParams,
  TubeLayoutParams,
  VesselComponent,
  WeldSeamParams,
} from '../types/vessel';
import { computeTubeLayout, layoutAssemblyMainComponents } from '../core/vesselMath';
import { buildExtraAttachmentGeometry } from './extraAttachmentsGeometry';

// Scale: 1 Three.js unit = 1000 mm (1 meter)
export const MM_TO_M = 0.001;

export interface BuiltSceneInfo {
  rootGroup: THREE.Group;
  selectableMeshes: THREE.Object3D[];
  nozzleAnchors: Array<{ id: string; tag: string; worldPos: THREE.Vector3 }>;
  boundingBox: THREE.Box3;
}

function createComponentMaterial(
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  roughness = 0.34,
  metalness = 0.44
): THREE.Material {
  const baseColor = new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
  const opacity = Math.max(0.08, Math.min(1, color.a / 255));
  const transparent = opacity < 0.99;

  if (renderMode === 'wireframe') {
    return new THREE.MeshBasicMaterial({
      color: isSelected ? new THREE.Color(0x0066ff) : baseColor.clone().multiplyScalar(0.75),
      wireframe: true,
      clippingPlanes,
    });
  }

  if (renderMode === 'hiddenline') {
    return new THREE.MeshBasicMaterial({
      color: isSelected ? new THREE.Color(0xdbeafe) : new THREE.Color(0xf8fafc),
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
      clippingPlanes,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    transparent,
    opacity,
    depthWrite: !transparent,
    side: THREE.DoubleSide,
    emissive: isSelected ? new THREE.Color(0x2563eb) : new THREE.Color(0x000000),
    emissiveIntensity: isSelected ? 0.14 : 0,
    clippingPlanes,
    clipShadows: true,
  });
}

function tagMeshHierarchy(
  obj: THREE.Object3D,
  componentId: string,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  selectables: THREE.Object3D[]
) {
  const edgeColor = isSelected ? 0x1d4ed8 : renderMode === 'hiddenline' ? 0x1e293b : 0x5c3a0a;
  const edgeOpacity = renderMode === 'hiddenline' ? 0.95 : isSelected ? 0.65 : 0.22;

  const meshes: THREE.Mesh[] = [];
  obj.traverse((child) => {
    child.userData.componentId = componentId;
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
      selectables.push(child);
    }
  });

  if (renderMode === 'hiddenline' || isSelected) {
    const lineMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: edgeOpacity < 1,
      opacity: edgeOpacity,
      clippingPlanes,
    });
    for (const m of meshes) {
      if ((m as THREE.InstancedMesh).isInstancedMesh) continue;
      if (m.userData.skipEdgeOverlay && renderMode !== 'hiddenline') continue;
      const edges = new THREE.EdgesGeometry(m.geometry, 24);
      const segs = new THREE.LineSegments(edges, lineMat);
      segs.userData.isEdgeOverlay = true;
      m.add(segs);
    }
  }
}

/**
 * Helper to create a hollow cylindrical shell along +Y from y=0 to y=length.
 */
function createHollowCylinder(rIn: number, rOut: number, length: number, segments = 48): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(rIn, 0),
    new THREE.Vector2(rOut, 0),
    new THREE.Vector2(rOut, length),
    new THREE.Vector2(rIn, length),
    new THREE.Vector2(rIn, 0),
  ];
  return new THREE.LatheGeometry(pts, segments);
}

/**
 * Create a 2:1 elliptical head (EHA) along +Y.
 * If flipped === false: dome starts at y=0 (apex), straight flange ends at y=hi+h.
 * If flipped === true: straight flange starts at y=0, dome apex ends at y=hi+h.
 */
function createEllipticalHeadGeometry(p: EllipticalHeadParams): THREE.LatheGeometry {
  const rIn = (p.diameter / 2) * MM_TO_M;
  const t = Math.max(4, p.nominalThickness) * MM_TO_M;
  const rOut = rIn + t;
  const hi = (p.diameter / 4) * MM_TO_M;
  const h = Math.max(5, p.straightHeight) * MM_TO_M;
  const total = hi + h;
  const steps = 20;

  const pts: THREE.Vector2[] = [];
  if (!p.flipped) {
    // Outer profile from apex y=0 to rim y=total
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * (Math.PI / 2);
      const x = rOut * Math.sin(ang);
      const y = hi * (1 - Math.cos(ang));
      pts.push(new THREE.Vector2(Math.max(0.001, x), y));
    }
    pts.push(new THREE.Vector2(rOut, total));
    pts.push(new THREE.Vector2(rIn, total));
    pts.push(new THREE.Vector2(rIn, hi));
    // Inner profile back to apex
    for (let i = steps; i >= 0; i--) {
      const ang = (i / steps) * (Math.PI / 2);
      const x = rIn * Math.sin(ang);
      const y = hi * (1 - Math.cos(ang)) + t;
      pts.push(new THREE.Vector2(Math.max(0.001, x), y));
    }
  } else {
    // Starts with straight flange at y=0, dome apex at y=total
    pts.push(new THREE.Vector2(rIn, 0));
    pts.push(new THREE.Vector2(rOut, 0));
    pts.push(new THREE.Vector2(rOut, h));
    for (let i = 1; i <= steps; i++) {
      const ang = (i / steps) * (Math.PI / 2);
      const x = rOut * Math.cos(ang);
      const y = h + hi * Math.sin(ang);
      pts.push(new THREE.Vector2(Math.max(0.001, x), y));
    }
    for (let i = steps; i >= 0; i--) {
      const ang = (i / steps) * (Math.PI / 2);
      const x = rIn * Math.cos(ang);
      const y = h + (hi - t) * Math.sin(ang);
      pts.push(new THREE.Vector2(Math.max(0.001, x), y));
    }
    pts.push(new THREE.Vector2(rIn, 0));
  }

  return new THREE.LatheGeometry(pts, 48);
}

/**
 * Create a bolt & nut ring via InstancedMesh around Y axis at yPos.
 */
function createBoltRing(
  bcdMm: number,
  boltCount: number,
  yPosM: number,
  boltLengthM: number,
  boltRadiusM: number,
  mat: THREE.Material,
  explodeFactor = 0,
  axialPushDir = 1
): THREE.Group {
  const g = new THREE.Group();
  const baseR = (bcdMm / 2) * MM_TO_M;
  // In GHPV exploded view, flange bolts fan radially outward into a crisp circular halo
  const r = baseR * (1 + explodeFactor * 1.42);
  const boltY = yPosM + axialPushDir * explodeFactor * 0.24;
  const count = Math.max(4, Math.min(64, boltCount));

  const studGeo = new THREE.CylinderGeometry(boltRadiusM, boltRadiusM, boltLengthM, 8);
  const nutGeo = new THREE.CylinderGeometry(boltRadiusM * 1.75, boltRadiusM * 1.75, boltRadiusM * 1.6, 6);

  const studs = new THREE.InstancedMesh(studGeo, mat, count);
  const nutsTop = new THREE.InstancedMesh(nutGeo, mat, count);
  const nutsBot = new THREE.InstancedMesh(nutGeo, mat, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;

    dummy.position.set(x, boltY, z);
    dummy.rotation.set(0, a, 0);
    dummy.updateMatrix();
    studs.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, boltY + boltLengthM * (0.36 + explodeFactor * 0.45), z);
    dummy.updateMatrix();
    nutsTop.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, boltY - boltLengthM * (0.36 + explodeFactor * 0.45), z);
    dummy.updateMatrix();
    nutsBot.setMatrixAt(i, dummy.matrix);
  }

  studs.computeBoundingSphere();
  nutsTop.computeBoundingSphere();
  nutsBot.computeBoundingSphere();

  g.add(studs, nutsTop, nutsBot);
  return g;
}

/**
 * Build a main component aligned along local +Y from y=0 to y=axialLength.
 */
function buildMainComponentGroup(
  comp: VesselComponent,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  explodeFactor = 0
): THREE.Group {
  const group = new THREE.Group();
  group.name = comp.name;
  const mat = createComponentMaterial(comp.color, renderMode, isSelected, clippingPlanes);
  const boltMat = createComponentMaterial(
    comp.type === 'equipment_flange'
      ? { r: 52, g: 118, b: 228, a: 255 }
      : { r: 165, g: 120, b: 36, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.25,
    0.72
  );

  switch (comp.type) {
    case 'shell':
    case 'boot_shell': {
      const p = comp.params as ShellParams;
      const rIn = (p.diameter / 2) * MM_TO_M;
      const rOut = rIn + Math.max(4, p.thickness) * MM_TO_M;
      if (p.returnBendRadiusMm && p.returnBendRadiusMm > 0) {
        // 180° return shell bend (弯头筒体) linking lower & upper stacked exchanger shells
        const bendR = p.returnBendRadiusMm * MM_TO_M;
        const bendGeo = new THREE.TorusGeometry(bendR, rOut, 24, 36, Math.PI);
        const bendMesh = new THREE.Mesh(bendGeo, mat);
        // Position so t=0 starts at (0,0,0) heading +Y (world +X) and t=PI ends at (-2*bendR,0,0) (world +2*bendR UP)
        bendMesh.position.set(-bendR, explodeFactor * 0.45, 0);
        group.add(bendMesh);
      } else {
        const len = p.length * MM_TO_M;
        const mesh = new THREE.Mesh(createHollowCylinder(rIn, rOut, len, 48), mat);
        group.add(mesh);
      }
      break;
    }

    case 'elliptical_head': {
      const p = comp.params as EllipticalHeadParams;
      const mesh = new THREE.Mesh(createEllipticalHeadGeometry(p), mat);
      group.add(mesh);
      break;
    }

    case 'spherical_head': {
      const p = comp.params as SphericalHeadParams;
      const r = (p.diameter / 2 + p.thickness) * MM_TO_M;
      const geo = new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      if (!p.flipped) {
        mesh.rotation.x = Math.PI;
        mesh.position.y = r;
      }
      group.add(mesh);
      break;
    }

    case 'spherical_tank': {
      const p = comp.params as SphericalTankParams;
      const R = (p.diameter / 2 + p.thickness) * MM_TO_M;
      const sphereGroup = new THREE.Group();
      sphereGroup.position.y = R;

      // Olive-green weld seams matching GHPV V1.6 video (highlights red when selected)
      const weldMat = createComponentMaterial(
        isSelected
          ? { r: 239, g: 68, b: 68, a: 255 }
          : { r: 102, g: 126, b: 62, a: 255 },
        renderMode,
        isSelected,
        clippingPlanes,
        0.42,
        0.35
      );

      // Five-zone mixed orange-peel layout (上极带 / 上温带 / 赤道带 / 下温带 / 下极带)
      const zones =
        p.zoneStyle === '橘瓣式三带'
          ? [
              { phiStart: 0.01, phiEnd: 0.85, petals: Math.max(6, p.temperatePetals) },
              { phiStart: 0.85, phiEnd: Math.PI - 0.85, petals: Math.max(8, p.equatorPetals) },
              { phiStart: Math.PI - 0.85, phiEnd: Math.PI - 0.01, petals: Math.max(6, p.temperatePetals) },
            ]
          : [
              { phiStart: 0.01, phiEnd: 0.36, petals: 4 },
              { phiStart: 0.36, phiEnd: 1.02, petals: Math.max(8, p.temperatePetals) },
              { phiStart: 1.02, phiEnd: Math.PI - 1.02, petals: Math.max(10, p.equatorPetals) },
              { phiStart: Math.PI - 1.02, phiEnd: Math.PI - 0.36, petals: Math.max(8, p.temperatePetals) },
              { phiStart: Math.PI - 0.36, phiEnd: Math.PI - 0.01, petals: 4 },
            ];

      const gap = 0.008;
      for (const z of zones) {
        const phiLen = Math.max(0.05, z.phiEnd - z.phiStart - gap);
        const midPhi = (z.phiStart + z.phiEnd) * 0.5;
        const dTheta = (Math.PI * 2) / z.petals;

        for (let k = 0; k < z.petals; k++) {
          const thetaStart = k * dTheta + gap * 0.5;
          const thetaLen = Math.max(0.05, dTheta - gap);
          const midTheta = thetaStart + thetaLen * 0.5;
          const segW = Math.max(4, Math.ceil(36 / z.petals));
          const segH = Math.max(4, Math.ceil(phiLen * 8));

          const petalGeo = new THREE.SphereGeometry(
            R,
            segW,
            segH,
            thetaStart,
            thetaLen,
            z.phiStart + gap * 0.5,
            phiLen
          );
          const petalMesh = new THREE.Mesh(petalGeo, mat);
          petalMesh.userData.skipEdgeOverlay = true;

          if (explodeFactor > 0.001) {
            // Three.js SphereGeometry: x = -R*cos(theta)*sin(phi), y = R*cos(phi), z = R*sin(theta)*sin(phi)
            const nx = -Math.cos(midTheta) * Math.sin(midPhi);
            const ny = Math.cos(midPhi);
            const nz = Math.sin(midTheta) * Math.sin(midPhi);
            const push = explodeFactor * R * 0.24;
            petalMesh.position.set(nx * push, ny * push, nz * push);
          }

          sphereGroup.add(petalMesh);
        }

        // Circumferential weld seam ring at zone boundary
        if (z.phiEnd < Math.PI - 0.08) {
          const ringR = R * Math.sin(z.phiEnd);
          const ringY = R * Math.cos(z.phiEnd);
          const seamR = Math.max(0.028, R * 0.0055);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, seamR, 8, 64), weldMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = ringY;
          ring.userData.skipEdgeOverlay = true;
          sphereGroup.add(ring);
        }

        // Meridian weld seam arcs along equatorial & temperate petals
        if (z.petals >= 8) {
          const seamTubeR = Math.max(0.022, R * 0.0044);
          const arcSteps = 8;
          for (let k = 0; k < z.petals; k++) {
            const theta = k * dTheta;
            const pts: THREE.Vector3[] = [];
            for (let s = 0; s <= arcSteps; s++) {
              const phi = z.phiStart + (s / arcSteps) * (z.phiEnd - z.phiStart);
              pts.push(
                new THREE.Vector3(
                  -Math.cos(theta) * Math.sin(phi) * (R + seamTubeR * 0.4),
                  Math.cos(phi) * (R + seamTubeR * 0.4),
                  Math.sin(theta) * Math.sin(phi) * (R + seamTubeR * 0.4)
                )
              );
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const seamMesh = new THREE.Mesh(
              new THREE.TubeGeometry(curve, 8, seamTubeR, 6, false),
              weldMat
            );
            seamMesh.userData.skipEdgeOverlay = true;
            sphereGroup.add(seamMesh);
          }
        }
      }

      group.add(sphereGroup);
      break;
    }

    case 'cone': {
      const p = comp.params as ConeParams;
      const rBot = ((p.flipped ? p.smallDiameter : p.largeDiameter) / 2) * MM_TO_M;
      const rTop = ((p.flipped ? p.largeDiameter : p.smallDiameter) / 2) * MM_TO_M;
      const t = Math.max(4, p.thickness) * MM_TO_M;
      const H = p.totalLength * MM_TO_M;
      const h1 = Math.min(H * 0.15, (p.h1 || 25) * MM_TO_M);
      const h2 = Math.min(H * 0.15, (p.h2 || 25) * MM_TO_M);

      if (p.coneType === '偏心锥') {
        // Bottom-tangent skewed eccentric frustum: in horizontal axisGroup (rotZ = -PI/2),
        // local +X is world DOWN, so shifting the large end by -(rTop - rBot) along local X
        // keeps the bottom generatrix flat while expanding the kettle vapor space UPWARD.
        const segs = 48;
        const dxEnd = -(rTop - rBot);
        const rings: Array<{ y: number; r: number; cx: number }> = [
          { y: 0, r: rBot + t, cx: 0 },
          { y: h2, r: rBot + t, cx: 0 },
          { y: H - h1, r: rTop + t, cx: dxEnd },
          { y: H, r: rTop + t, cx: dxEnd },
          { y: H, r: rTop, cx: dxEnd },
          { y: H - h1, r: rTop, cx: dxEnd },
          { y: h2, r: rBot, cx: 0 },
          { y: 0, r: rBot, cx: 0 },
        ];
        const positions: number[] = [];
        const indices: number[] = [];
        const cols = segs + 1;
        for (const ring of rings) {
          for (let j = 0; j <= segs; j++) {
            const ang = (j / segs) * Math.PI * 2;
            positions.push(ring.cx + Math.cos(ang) * ring.r, ring.y, Math.sin(ang) * ring.r);
          }
        }
        for (let i = 0; i < rings.length - 1; i++) {
          for (let j = 0; j < segs; j++) {
            const a = i * cols + j;
            const b = a + 1;
            const c = (i + 1) * cols + j;
            const d = c + 1;
            indices.push(a, b, d, a, d, c);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        group.add(new THREE.Mesh(geo, mat));
      } else {
        const pts = [
          new THREE.Vector2(rBot, 0),
          new THREE.Vector2(rBot + t, 0),
          new THREE.Vector2(rBot + t, h2),
          new THREE.Vector2(rTop + t, H - h1),
          new THREE.Vector2(rTop + t, H),
          new THREE.Vector2(rTop, H),
          new THREE.Vector2(rTop, H - h1),
          new THREE.Vector2(rBot, h2),
          new THREE.Vector2(rBot, 0),
        ];
        group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat));
      }
      break;
    }

    case 'equipment_flange': {
      const p = comp.params as EquipmentFlangeParams;
      const rIn = (p.dn / 2) * MM_TO_M;
      const rOut = (p.outerDiameter / 2) * MM_TO_M;
      const hubOuter = rIn + 0.028;
      const flgT = p.thickness * MM_TO_M;
      const totalH = p.height * MM_TO_M;

      const pts: THREE.Vector2[] = p.flipped
        ? [
            new THREE.Vector2(p.flangeType === '法兰盖(BL)' ? 0.001 : rIn, 0),
            new THREE.Vector2(rOut, 0),
            new THREE.Vector2(rOut, flgT),
            new THREE.Vector2(hubOuter + 0.015, flgT),
            new THREE.Vector2(rIn + 0.014, totalH),
            new THREE.Vector2(rIn, totalH),
            new THREE.Vector2(p.flangeType === '法兰盖(BL)' ? 0.001 : rIn, 0),
          ]
        : [
            new THREE.Vector2(rIn, 0),
            new THREE.Vector2(rIn + 0.014, 0),
            new THREE.Vector2(hubOuter + 0.015, totalH - flgT),
            new THREE.Vector2(rOut, totalH - flgT),
            new THREE.Vector2(rOut, totalH),
            new THREE.Vector2(p.flangeType === '法兰盖(BL)' ? 0.001 : rIn, totalH),
            new THREE.Vector2(rIn, 0),
          ];

      group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat));

      // Add bolt & nut ring on flange face (explodes radially into a floating bolt halo)
      const boltY = p.flipped ? flgT * 0.5 : totalH - flgT * 0.5;
      const boltR = Math.max(0.008, (rOut - rIn) * 0.14);
      group.add(
        createBoltRing(
          p.boltCircle,
          p.boltCount,
          boltY,
          flgT * 2.4,
          boltR,
          boltMat,
          explodeFactor,
          p.flipped ? -1 : 1
        )
      );
      break;
    }

    case 'gasket': {
      const p = comp.params as GasketParams;
      const rIn = (p.innerDiameter / 2) * MM_TO_M;
      const rOut = (p.outerDiameter / 2) * MM_TO_M;
      const t = Math.max(5, p.thickness) * MM_TO_M;
      group.add(new THREE.Mesh(createHollowCylinder(rIn, rOut, t, 48), mat));
      break;
    }

    case 'skirt': {
      const p = comp.params as SkirtParams;
      const rTop = (p.topDiameter / 2) * MM_TO_M;
      const rBot = (p.bottomDiameter / 2) * MM_TO_M;
      const t = Math.max(8, p.thickness) * MM_TO_M;
      const H = p.height * MM_TO_M;
      const ringOD = (p.baseRingOD / 2) * MM_TO_M;
      const ringID = (p.baseRingID / 2) * MM_TO_M;
      const ringT = Math.max(18, p.baseRingThickness) * MM_TO_M;
      const gussetH = p.gussetHeight * MM_TO_M;

      // Skirt cylinder/cone
      const pts = [
        new THREE.Vector2(rBot, 0),
        new THREE.Vector2(rBot + t, 0),
        new THREE.Vector2(rTop + t, H),
        new THREE.Vector2(rTop, H),
        new THREE.Vector2(rBot, 0),
      ];
      group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat));

      // Bottom base ring plate
      group.add(new THREE.Mesh(createHollowCylinder(ringID, ringOD, ringT, 48), mat));

      // Upper chair cover ring
      const coverRing = new THREE.Mesh(createHollowCylinder(rBot + t, ringOD, ringT * 0.8, 48), mat);
      coverRing.position.y = gussetH;
      group.add(coverRing);

      // Anchor bolt chair gussets (radial vertical plates)
      const gCount = Math.max(8, Math.min(24, p.boltCount));
      const gussetDepth = Math.max(0.08, ringOD - (rBot + t));
      const gussetGeo = new THREE.BoxGeometry(gussetDepth, gussetH, 0.016);
      const gussets = new THREE.InstancedMesh(gussetGeo, mat, gCount * 2);
      const dummy = new THREE.Object3D();
      let gi = 0;
      for (let i = 0; i < gCount; i++) {
        const baseA = (i / gCount) * Math.PI * 2;
        for (const offset of [-0.07, 0.07]) {
          const a = baseA + offset;
          const rMid = rBot + t + gussetDepth * 0.48;
          dummy.position.set(Math.cos(a) * rMid, ringT + gussetH * 0.5, Math.sin(a) * rMid);
          dummy.rotation.set(0, -a, 0);
          dummy.updateMatrix();
          gussets.setMatrixAt(gi++, dummy.matrix);
        }
      }
      gussets.computeBoundingSphere();
      group.add(gussets);

      // Inspection hole frame on skirt wall
      if (p.hasInspectionHole) {
        const holeFrame = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.14, 24, 1, true),
          boltMat
        );
        holeFrame.rotation.z = Math.PI / 2;
        holeFrame.position.set(rBot + 0.03, H * 0.52, 0);
        group.add(holeFrame);
      }
      break;
    }

    case 'fixed_tubesheet':
    case 'u_tube_head': {
      const p = comp.params as FixedTubeSheetParams;
      const rOut = (p.outerDiameter / 2) * MM_TO_M;
      const t = p.thickness * MM_TO_M;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rOut, rOut, t, 48), mat);
      disc.position.y = t / 2;
      group.add(disc);
      break;
    }

    case 'expansion_joint': {
      const p = comp.params as ExpansionJointParams;
      const rIn = (p.dn / 2) * MM_TO_M;
      const waveH = p.waveHeight * MM_TO_M;
      const L = p.totalLength * MM_TO_M;
      const waves = Math.max(1, Math.min(6, p.waveCount));
      const pts: THREE.Vector2[] = [];
      const steps = waves * 16;
      const margin = L * 0.14;
      const activeL = L - margin * 2;

      pts.push(new THREE.Vector2(rIn, 0));
      pts.push(new THREE.Vector2(rIn, margin));
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const y = margin + u * activeL;
        const wave = 0.5 * (1 - Math.cos(u * waves * Math.PI * 2));
        pts.push(new THREE.Vector2(rIn + wave * waveH, y));
      }
      pts.push(new THREE.Vector2(rIn, L));

      group.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat));
      break;
    }
  }

  return group;
}

/**
 * Build a Nozzle or Hinged Manhole oriented along local +Y (radial outward from vessel centerline).
 */
function buildNozzleOrManhole(
  p: NozzleManholeParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentRadiusM: number,
  explodeFactor = 0
): { group: THREE.Group; tipPosLocal: THREE.Vector3 } {
  const g = new THREE.Group();
  const mat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.32, 0.56);
  const boltMat = createComponentMaterial(
    { r: 170, g: 130, b: 42, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.26,
    0.72
  );
  const gasketMat = createComponentMaterial(
    { r: 58, g: 168, b: 96, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.55,
    0.18
  );

  // Authentic GHPV bottom vertical liquid boot / collector pot (集液包):
  // Cylinder + bottom elliptical cap + bottom drain nozzle/flange + side instrument stubs.
  // Explodes cleanly along local +Y (downward in world space when angleDeg = 180).
  if (p.isLiquidBoot) {
    const bootD = Math.max(240, p.bootDiameter || p.dn || 740);
    const bootL = Math.max(360, p.bootLength || p.protrusion || 1100);
    const rOut = (bootD / 2 + Math.max(8, p.pipeThickness || 14)) * MM_TO_M;
    const rIn = Math.max(0.06, (bootD / 2) * MM_TO_M);
    const lenM = bootL * MM_TO_M;

    const headMat = createComponentMaterial(
      { r: 214, g: 76, b: 146, a: 255 },
      renderMode,
      isSelected,
      clippingPlanes,
      0.32,
      0.52
    );
    const drainMat = createComponentMaterial(
      { r: 86, g: 174, b: 214, a: 255 },
      renderMode,
      isSelected,
      clippingPlanes,
      0.3,
      0.58
    );

    const cylY = parentRadiusM - 0.14 + explodeFactor * 0.28;
    const cyl = new THREE.Mesh(createHollowCylinder(rIn, rOut, lenM + 0.14, 36), mat);
    cyl.position.y = cylY;
    g.add(cyl);

    // Side level-gauge stubs on liquid boot
    for (const side of [-1, 1]) {
      const stub = new THREE.Mesh(createHollowCylinder(0.028, 0.042, 0.24, 16), drainMat);
      stub.rotation.z = side * (Math.PI / 2);
      stub.position.set(side * (rOut - 0.02), cylY + lenM * (side > 0 ? 0.42 : 0.72), 0);
      g.add(stub);

      const stubFlg = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.024, 18), headMat);
      stubFlg.rotation.z = side * (Math.PI / 2);
      stubFlg.position.set(side * (rOut + 0.21), cylY + lenM * (side > 0 ? 0.42 : 0.72), 0);
      g.add(stubFlg);
    }

    // Bottom 2:1 elliptical cap on liquid boot
    const capGeo = createEllipticalHeadGeometry({
      headType: 'EHA',
      standard: 'GB/T 25198-2023',
      diameter: bootD,
      straightHeight: 25,
      nominalThickness: Math.max(8, p.pipeThickness || 14),
      minThickness: 10,
      blankThickness: 14,
      formingMethod: '冷冲压法',
      thinningRate: 15,
      flipped: true,
      material: p.material,
      density: p.density,
    });
    const capY = cylY + lenM + 0.14 + explodeFactor * 0.58;
    const capMesh = new THREE.Mesh(capGeo, headMat);
    capMesh.position.y = capY;
    g.add(capMesh);

    // Bottom drain pipe + flange + bolt ring
    const headDepth = (bootD / 4 + 25) * MM_TO_M;
    const drainY = capY + headDepth - 0.04 + explodeFactor * 0.52;
    const drainPipe = new THREE.Mesh(createHollowCylinder(0.055, 0.072, 0.26, 20), drainMat);
    drainPipe.position.y = drainY;
    g.add(drainPipe);

    const drainFlg = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.032, 24), headMat);
    drainFlg.position.y = drainY + 0.26 + explodeFactor * 0.18;
    g.add(drainFlg);

    const drainBolts = createBoltRing(
      220,
      8,
      drainY + 0.26 + explodeFactor * 0.18,
      0.065,
      0.011,
      boltMat,
      explodeFactor * 0.5,
      1
    );
    g.add(drainBolts);

    const tipPosLocal = new THREE.Vector3(0, drainY + 0.34, 0);
    return { group: g, tipPosLocal };
  }

  const rPipeOut = (p.pipeOD / 2) * MM_TO_M;
  const rPipeIn = Math.max(0.01, rPipeOut - p.pipeThickness * MM_TO_M);
  const rFlg = (p.flangeOD / 2) * MM_TO_M;
  const flgT = p.flangeThickness * MM_TO_M;
  const lOut = p.protrusion * MM_TO_M;
  const lIn = p.innerProtrusion * MM_TO_M;
  const pipeStartY = parentRadiusM - lIn - 0.04;
  const pipeEndY = parentRadiusM + lOut;

  // Reinforcing pad around shell intersection
  if (p.hasPad) {
    const padOuterR = p.padOD ? (p.padOD / 2) * MM_TO_M : rPipeOut * 1.48;
    const padThickM = p.padThickness ? Math.max(0.008, p.padThickness * MM_TO_M) : 0.018;
    const pad = new THREE.Mesh(
      createHollowCylinder(rPipeOut, Math.max(rPipeOut + 0.02, padOuterR), padThickM, 32),
      mat
    );
    pad.position.y = parentRadiusM - padThickM * 0.45;
    g.add(pad);
  }

  let tipPosLocal = new THREE.Vector3(0, pipeEndY + flgT, 0);

  if (p.hasElbow) {
    // Authentic GHPV 90° elbow draw-off pipe (引出管):
    const defaultBendR = (p.elbowType === '短半径' ? 1.0 : 1.5) * Math.max(40, p.dn);
    const bendR = Math.max(rPipeOut * 1.15, (p.elbowRadius || defaultBendR) * MM_TO_M);
    const runTotalM = Math.max(bendR + 0.08, (p.elbowRunLength || Math.max(320, p.dn * 2.6)) * MM_TO_M);
    const stemDropM = Math.max(bendR + 0.04, lOut);
    const straightStemM = Math.max(0.04, stemDropM - bendR);
    const horizRunM = Math.max(0.05, runTotalM - bendR);

    const elbowGroup = new THREE.Group();
    elbowGroup.rotation.y = ((p.elbowDirDeg || 0) * Math.PI) / 180;

    // Straight stem (includes inner protrusion L2)
    const pipe1 = new THREE.Mesh(
      createHollowCylinder(rPipeIn, rPipeOut, straightStemM + lIn + 0.05, 28),
      mat
    );
    pipe1.position.y = parentRadiusM - lIn - 0.05;
    elbowGroup.add(pipe1);

    // Smooth circular 90° bend + straight horizontal exit pipe to L3
    const yBendStart = parentRadiusM + straightStemM;
    const yHoriz = yBendStart + bendR;
    const arcPts: THREE.Vector3[] = [];
    const arcSteps = 12;
    for (let i = 0; i <= arcSteps; i++) {
      const a = (i / arcSteps) * (Math.PI / 2);
      const x = bendR * (1 - Math.cos(a));
      const y = yBendStart + bendR * Math.sin(a);
      arcPts.push(new THREE.Vector3(x, y, 0));
    }
    const bendCurve = new THREE.CatmullRomCurve3(arcPts);
    const elbowMesh = new THREE.Mesh(new THREE.TubeGeometry(bendCurve, 20, rPipeOut, 24, false), mat);
    elbowGroup.add(elbowMesh);

    // Straight horizontal pipe run from bend exit (x = bendR) to flange (x = bendR + horizRunM)
    const horizPipe = new THREE.Mesh(createHollowCylinder(rPipeIn, rPipeOut, horizRunM, 28), mat);
    horizPipe.rotation.z = -Math.PI / 2;
    horizPipe.position.set(bendR, yHoriz, 0);
    elbowGroup.add(horizPipe);

    // End welding-neck flange at x = runTotalM
    const flgPts = [
      new THREE.Vector2(rPipeIn, 0),
      new THREE.Vector2(rPipeOut + 0.012, 0),
      new THREE.Vector2(rFlg, 0.028),
      new THREE.Vector2(rFlg, 0.028 + flgT),
      new THREE.Vector2(rPipeIn, 0.028 + flgT),
      new THREE.Vector2(rPipeIn, 0),
    ];
    const endFlange = new THREE.Mesh(new THREE.LatheGeometry(flgPts, 32), mat);
    endFlange.rotation.z = -Math.PI / 2;
    endFlange.position.set(runTotalM - flgT - 0.028 + explodeFactor * 0.22, yHoriz, 0);
    elbowGroup.add(endFlange);

    const hasCover = p.hasBlindCover || p.isManhole;
    if (hasCover) {
      const gask = new THREE.Mesh(createHollowCylinder(rPipeIn, rFlg * 0.86, 0.008, 28), gasketMat);
      gask.rotation.z = -Math.PI / 2;
      gask.position.set(runTotalM + explodeFactor * 0.36, yHoriz, 0);
      elbowGroup.add(gask);

      const cover = new THREE.Mesh(new THREE.CylinderGeometry(rFlg, rFlg, flgT, 32), mat);
      cover.rotation.z = -Math.PI / 2;
      cover.position.set(runTotalM + 0.008 + flgT * 0.5 + explodeFactor * 0.52, yHoriz, 0);
      elbowGroup.add(cover);
    }

    const bolts = createBoltRing(
      p.flangeOD * 0.82,
      p.boltCount,
      0,
      flgT * (hasCover ? 2.8 : 2.1),
      Math.max(0.007, rFlg * 0.055),
      boltMat,
      explodeFactor * 0.65,
      1
    );
    bolts.rotation.z = -Math.PI / 2;
    bolts.position.set(runTotalM - flgT * 0.4 + explodeFactor * 0.32, yHoriz, 0);
    elbowGroup.add(bolts);

    g.add(elbowGroup);

    const beta = ((p.elbowDirDeg || 0) * Math.PI) / 180;
    tipPosLocal = new THREE.Vector3(
      Math.cos(beta) * (runTotalM + 0.08),
      yHoriz + 0.05,
      -Math.sin(beta) * (runTotalM + 0.08)
    );
  } else {
    // Large dome nozzles (e.g. DN1800/DN2000 on V-001 separator) get multi-tier GHPV flange & cap styling + dramatic vertical sub-part explosion!
    const isLargeDome = p.dn >= 1000;
    const neckExplode = explodeFactor * (isLargeDome ? 0.25 : 0.06);
    const flgExplode = explodeFactor * (isLargeDome ? 1.05 : 0.24);
    const gaskExplode = explodeFactor * (isLargeDome ? 1.52 : 0.38);
    const coverExplode = explodeFactor * (isLargeDome ? 1.98 : 0.54);

    const lowerFlgMat = isLargeDome
      ? createComponentMaterial(
          { r: 108, g: 64, b: 172, a: 255 },
          renderMode,
          isSelected,
          clippingPlanes,
          0.3,
          0.56
        )
      : mat;
    const upperFlgMat = isLargeDome
      ? createComponentMaterial(
          { r: 222, g: 82, b: 104, a: 255 },
          renderMode,
          isSelected,
          clippingPlanes,
          0.3,
          0.52
        )
      : mat;
    const topCapMat = isLargeDome
      ? createComponentMaterial(
          { r: 234, g: 122, b: 168, a: 195 },
          renderMode,
          isSelected,
          clippingPlanes,
          0.28,
          0.42
        )
      : mat;
    const domeBoltMat = isLargeDome
      ? createComponentMaterial(
          { r: 78, g: 108, b: 156, a: 255 },
          renderMode,
          isSelected,
          clippingPlanes,
          0.26,
          0.74
        )
      : boltMat;

    // Straight nozzle pipe (接管筒节)
    const neckMesh = new THREE.Mesh(
      createHollowCylinder(rPipeIn, rPipeOut, pipeEndY - pipeStartY, isLargeDome ? 48 : 32),
      mat
    );
    neckMesh.position.y = pipeStartY + neckExplode;
    g.add(neckMesh);

    // Lower welding neck taper + flange ring (下法兰)
    const flgPts = [
      new THREE.Vector2(rPipeIn, 0),
      new THREE.Vector2(rPipeOut + 0.012, 0),
      new THREE.Vector2(rFlg, 0.03),
      new THREE.Vector2(rFlg, 0.03 + flgT),
      new THREE.Vector2(rPipeIn, 0.03 + flgT),
      new THREE.Vector2(rPipeIn, 0),
    ];
    const flgMesh = new THREE.Mesh(new THREE.LatheGeometry(flgPts, isLargeDome ? 48 : 36), lowerFlgMat);
    flgMesh.position.y = pipeEndY - flgT - 0.03 + flgExplode;
    g.add(flgMesh);

    const hasCover = p.hasBlindCover || p.isManhole;
    if (hasCover) {
      // Gasket (垫片)
      const gask = new THREE.Mesh(
        createHollowCylinder(rPipeIn, rFlg * 0.88, isLargeDome ? 0.016 : 0.008, isLargeDome ? 44 : 32),
        gasketMat
      );
      gask.position.y = pipeEndY + gaskExplode;
      g.add(gask);

      // Upper mating flange / blind cover (上法兰 / 盲板)
      const cover = new THREE.Mesh(
        new THREE.CylinderGeometry(rFlg, rFlg, flgT * 1.08, isLargeDome ? 48 : 36),
        upperFlgMat
      );
      cover.position.y = pipeEndY + (isLargeDome ? 0.016 : 0.008) + flgT * 0.54 + coverExplode;
      g.add(cover);

      // Translucent top dome extension collar on giant DN1800+ domes (matches Ep 14 N1/N2)
      if (isLargeDome) {
        const capCollarH = rPipeOut * 0.42;
        const capCollar = new THREE.Mesh(
          createHollowCylinder(rPipeIn, rPipeOut * 0.96, capCollarH, 48),
          topCapMat
        );
        capCollar.position.y = pipeEndY + 0.016 + flgT * 1.08 + coverExplode + explodeFactor * 0.42;
        g.add(capCollar);

        const capPlate = new THREE.Mesh(
          new THREE.CylinderGeometry(rPipeOut * 0.96, rPipeOut * 0.96, 0.025, 48),
          topCapMat
        );
        capPlate.position.y =
          pipeEndY + 0.016 + flgT * 1.08 + capCollarH + coverExplode + explodeFactor * 0.42;
        g.add(capPlate);

        tipPosLocal = new THREE.Vector3(
          0,
          pipeEndY + flgT * 1.15 + capCollarH + coverExplode + explodeFactor * 0.42 + 0.14,
          0
        );
      }

      // Bolts across both flanges — explode radially outward into a floating circular halo ring!
      const bolts = createBoltRing(
        p.flangeOD * 0.88,
        p.boltCount,
        pipeEndY + 0.008 + (flgExplode + coverExplode) * 0.45,
        flgT * (isLargeDome ? 3.2 : 2.9),
        Math.max(0.008, rFlg * (isLargeDome ? 0.022 : 0.045)),
        domeBoltMat,
        explodeFactor * (isLargeDome ? 0.44 : 0.72),
        0
      );
      g.add(bolts);

      // Manhole lifting davit arm + handle loop (matches GHPV Page 12!)
      if (p.isManhole) {
        const postX = rFlg + 0.045;
        const postH = 0.28;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, postH, 12), boltMat);
        post.position.set(postX, pipeEndY - 0.04 + postH * 0.5 + flgExplode, 0);
        g.add(post);

        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.04), boltMat);
        bracket.position.set(rPipeOut + (postX - rPipeOut) * 0.5, pipeEndY - 0.08 + flgExplode, 0);
        g.add(bracket);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(postX + 0.02, 0.022, 0.028), boltMat);
        arm.position.set(postX * 0.5, pipeEndY + flgT + 0.09 + coverExplode, 0);
        g.add(arm);

        const eyeBolt = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 10, 18), boltMat);
        eyeBolt.position.set(0, pipeEndY + flgT + 0.05 + coverExplode, 0);
        g.add(eyeBolt);

        tipPosLocal = new THREE.Vector3(0, pipeEndY + flgT + 0.16 + coverExplode, 0);
      }
    } else {
      const bolts = createBoltRing(
        p.flangeOD * 0.84,
        p.boltCount,
        pipeEndY - flgT * 0.5 + flgExplode,
        flgT * 1.8,
        Math.max(0.007, rFlg * 0.05),
        boltMat,
        explodeFactor * 0.65,
        1
      );
      g.add(bolts);
      tipPosLocal = new THREE.Vector3(0, pipeEndY + flgT + flgExplode, 0);
    }
  }

  return { group: g, tipPosLocal };
}

/**
 * Build a detailed NB/T 47065.1 Saddle Support (web, base plate, ribs, curved wear pad).
 * Local space: vessel centerline at (0, 0, 0) running along Y, saddle projects downward along -Z (or -Y after rotation).
 * We build it with vessel axis along local Y, projecting toward local -X so it aligns cleanly with horizontal orientation!
 */
function buildSaddle(
  p: SaddleParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentRadiusM: number,
  explodeFactor = 0
): THREE.Group {
  const g = new THREE.Group();
  const mat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.35, 0.52);
  const padMat = createComponentMaterial(
    { r: 58, g: 132, b: 148, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.34,
    0.55
  );
  const baseMat = createComponentMaterial(
    { r: 122, g: 102, b: 178, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.36,
    0.5
  );

  const R = parentRadiusM;
  const H = Math.max(R + 0.18, p.centerHeight * MM_TO_M);
  const halfBase = (p.baseLength / 2) * MM_TO_M;
  const baseW = p.baseWidth * MM_TO_M;
  const webT = Math.max(0.014, p.webThickness * MM_TO_M);
  const wrapHalf = ((p.wrapAngleDeg / 2) * Math.PI) / 180;

  // Sub-part vertical explosion offsets matching GHPV exploded view (垫板 -> 腹板 -> 筋板 -> 底板)
  const padDrop = -explodeFactor * 0.16;
  const webDrop = -explodeFactor * 0.68;
  const ribDrop = -explodeFactor * 1.18;
  const baseDrop = -explodeFactor * 1.68;

  const shape = new THREE.Shape();
  const xEdge = Math.min(halfBase, R * Math.sin(wrapHalf));
  const yEdge = -R * Math.cos(wrapHalf);

  shape.moveTo(-halfBase, -H);
  shape.lineTo(halfBase, -H);
  shape.lineTo(xEdge, yEdge);
  const arcSteps = 20;
  for (let i = 1; i <= arcSteps; i++) {
    const t = i / arcSteps;
    const ang = -Math.PI / 2 + wrapHalf * (1 - 2 * t);
    shape.lineTo(R * Math.cos(ang), R * Math.sin(ang));
  }
  shape.lineTo(-halfBase, -H);

  // Main web plate (腹板)
  const webGeo = new THREE.ExtrudeGeometry(shape, { depth: webT, bevelEnabled: false });
  webGeo.translate(0, 0, -webT / 2);
  const webMesh = new THREE.Mesh(webGeo, mat);
  webMesh.position.y = webDrop;
  g.add(webMesh);

  // Base plate (底板)
  const basePlateT = 0.022;
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(halfBase * 2 + 0.04, basePlateT, baseW),
    explodeFactor > 0.01 ? baseMat : mat
  );
  basePlate.position.set(0, -H + basePlateT * 0.5 + baseDrop, 0);
  g.add(basePlate);

  // Vertical stiffening ribs (内侧筋板1/2, 最外侧筋板1/2)
  const ribCount = Math.max(3, Math.min(7, p.ribCount));
  for (let i = 0; i < ribCount; i++) {
    const frac = ribCount === 1 ? 0 : -1 + (2 * i) / (ribCount - 1);
    const rx = frac * (xEdge * 0.95);
    const topY = -Math.sqrt(Math.max(0.01, R * R - rx * rx));
    const ribH = Math.max(0.08, H + topY);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.014, ribH, baseW * 0.94), mat);
    const stagger = (i % 2 === 0 ? 0 : -0.12) * explodeFactor;
    rib.position.set(rx * (1 + explodeFactor * 0.25), -H + ribH * 0.5 + ribDrop + stagger, 0);
    g.add(rib);
  }

  // Curved wear pad (垫板) hugging underside (-Y) of shell
  const padWidth = baseW * 1.18;
  const padGeo = new THREE.CylinderGeometry(
    R + 0.014,
    R + 0.014,
    padWidth,
    24,
    1,
    true,
    -wrapHalf,
    wrapHalf * 2
  );
  padGeo.rotateX(Math.PI / 2);
  const padMesh = new THREE.Mesh(padGeo, explodeFactor > 0.01 ? padMat : mat);
  padMesh.position.y = padDrop;
  g.add(padMesh);

  return g;
}

/**
 * Build Leg Supports (A/B/C angle/pipe legs) around vertical vessel axis Y.
 */
function buildLegSupports(
  p: LegSupportParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentRadiusM: number
): THREE.Group {
  const g = new THREE.Group();
  const mat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.36, 0.55);

  const count = Math.max(3, Math.min(8, p.count));
  const H = p.height * MM_TO_M;
  const legW = Math.max(0.06, p.legSectionWidth * MM_TO_M);
  const baseS = Math.max(0.12, p.basePlateSize * MM_TO_M);
  const baseT = Math.max(0.016, p.basePlateThickness * MM_TO_M);
  const startRad = (p.startAngleDeg * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const a = startRad + (i / count) * Math.PI * 2;
    const legGroup = new THREE.Group();
    legGroup.rotation.y = a;

    // Reinforcing pad on shell
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.32, legW * 2.1), mat);
    pad.position.set(parentRadiusM + 0.005, 0.05, 0);
    legGroup.add(pad);

    // L-section / angle steel leg column
    const legCol1 = new THREE.Mesh(new THREE.BoxGeometry(legW, H, 0.016), mat);
    legCol1.position.set(parentRadiusM + legW * 0.42, 0.12 - H * 0.5, legW * 0.42);
    legGroup.add(legCol1);

    const legCol2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, H, legW), mat);
    legCol2.position.set(parentRadiusM + legW * 0.84, 0.12 - H * 0.5, 0);
    legGroup.add(legCol2);

    // Base plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(baseS, baseT, baseS), mat);
    plate.position.set(parentRadiusM + legW * 0.55, 0.12 - H + baseT * 0.5, 0);
    legGroup.add(plate);

    g.add(legGroup);
  }

  return g;
}

/**
 * Build Lug Supports (耳座 / 刚性环耳座) around vertical vessel axis Y.
 */
function buildLugSupports(
  p: LugSupportParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentRadiusM: number
): THREE.Group {
  const g = new THREE.Group();
  const mat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.35, 0.55);

  const count = Math.max(2, Math.min(8, p.count));
  const bw = p.baseWidth * MM_TO_M;
  const bl = p.baseLength * MM_TO_M;
  const h = p.height * MM_TO_M;
  const startRad = (p.startAngleDeg * Math.PI) / 180;

  if (p.isRingLug) {
    const ring1 = new THREE.Mesh(createHollowCylinder(parentRadiusM, parentRadiusM + bw * 0.9, 0.022, 48), mat);
    ring1.position.y = -h * 0.45;
    const ring2 = new THREE.Mesh(createHollowCylinder(parentRadiusM, parentRadiusM + bw * 0.9, 0.022, 48), mat);
    ring2.position.y = h * 0.45;
    g.add(ring1, ring2);
  }

  for (let i = 0; i < count; i++) {
    const a = startRad + (i / count) * Math.PI * 2;
    const lg = new THREE.Group();
    lg.rotation.y = a;

    // Base plate
    const base = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.02, bl), mat);
    base.position.set(parentRadiusM + bw * 0.5, -h * 0.45, 0);
    lg.add(base);

    // Two triangular side ribs
    const ribShape = new THREE.Shape();
    ribShape.moveTo(0, 0);
    ribShape.lineTo(bw * 0.95, 0);
    ribShape.lineTo(bw * 0.25, h);
    ribShape.lineTo(0, h);
    ribShape.closePath();
    const ribGeo = new THREE.ExtrudeGeometry(ribShape, { depth: 0.014, bevelEnabled: false });

    const r1 = new THREE.Mesh(ribGeo, mat);
    r1.position.set(parentRadiusM, -h * 0.45, bl * 0.35);
    const r2 = new THREE.Mesh(ribGeo, mat);
    r2.position.set(parentRadiusM, -h * 0.45, -bl * 0.35 - 0.014);
    lg.add(r1, r2);

    g.add(lg);
  }

  return g;
}

/**
 * Build Heat Exchanger Tube Bundle + Purple Segmental Baffles + U-Tube Bends via InstancedMesh.
 */
function buildTubeBundle(
  p: TubeLayoutParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  explodeFactor = 0,
  selectedSubNode: string | null = null,
  bundleRadialExplodeDir = 0
): THREE.Group {
  const g = new THREE.Group();
  const tubeMat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.32, 0.48);
  // Signature GHPV V1.6 violet-purple segmental baffles [170, 85, 255]
  const baffleMat = createComponentMaterial(
    { r: 170, g: 85, b: 255, a: 255 },
    renderMode,
    isSelected && !selectedSubNode,
    clippingPlanes,
    0.34,
    0.45
  );
  // Dark charcoal highlight when an individual baffle (e.g. 折流板8) is selected in Structure Tree
  const selectedBaffleMat = createComponentMaterial(
    { r: 22, g: 24, b: 36, a: 255 },
    renderMode,
    false,
    clippingPlanes,
    0.25,
    0.6
  );
  const rodMat = createComponentMaterial(
    { r: 148, g: 163, b: 184, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.28,
    0.65
  );

  const layout = computeTubeLayout(p);
  const step = Math.max(1, Math.ceil(layout.tubes.length / 320));
  const sampled = layout.tubes.filter((_, idx) => idx % step === 0);

  const tubeR = Math.max(0.008, (p.tubeOD / 2) * MM_TO_M);
  const tubeL = p.tubeLength * MM_TO_M;
  const baffleR = (p.shellDiameter / 2 - 6) * MM_TO_M;

  const tubeSubGroup = new THREE.Group();
  if (sampled.length > 0) {
    const tubeGeo = new THREE.CylinderGeometry(tubeR, tubeR, tubeL, 8);
    const inst = new THREE.InstancedMesh(tubeGeo, tubeMat, sampled.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < sampled.length; i++) {
      const t = sampled[i];
      dummy.position.set(t.x * MM_TO_M, tubeL / 2, t.y * MM_TO_M);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.computeBoundingSphere();
    tubeSubGroup.add(inst);
  }

  // Semicircular 180-degree U-bends for U形管换热器 / 发卡U形换热管
  if (p.tubeType === 'U形管' && sampled.length > 0) {
    const positiveTubes = sampled.filter((t) => t.y > p.tubePitch * 0.35);
    const bendStep = Math.max(1, Math.ceil(positiveTubes.length / 72));
    for (let i = 0; i < positiveTubes.length; i += bendStep) {
      const t = positiveTubes[i];
      const bendR = Math.max(tubeR * 2.1, t.y * MM_TO_M);
      const bendGeo = new THREE.TorusGeometry(bendR, tubeR, 7, 14, Math.PI);
      const bendMesh = new THREE.Mesh(bendGeo, tubeMat);
      bendMesh.rotation.y = Math.PI / 2;
      bendMesh.position.set(t.x * MM_TO_M, tubeL, 0);
      tubeSubGroup.add(bendMesh);
    }
  }

  // Explode hairpin U-tube harp cleanly into the center gap between stacked shells (matches GHPV 重叠式换热器爆炸图)
  if (explodeFactor > 0.001) {
    tubeSubGroup.position.y = explodeFactor * tubeL * 0.36;
    if (bundleRadialExplodeDir < 0) {
      // Lower shell hairpin U-tube harp rises straight into the open center band between shells
      tubeSubGroup.position.x = -explodeFactor * 2.55;
    } else if (bundleRadialExplodeDir > 0) {
      // Upper shell straight leg drops cleanly slightly below upper baffle row or blends into center harp
      tubeSubGroup.position.x = explodeFactor * 2.55;
    } else {
      tubeSubGroup.position.x = explodeFactor * baffleR * 1.15;
    }
  }
  g.add(tubeSubGroup);

  // 4 Tie Rods (拉杆组) separate radially outward when exploded
  const tieR = baffleR * (0.86 + explodeFactor * 0.85);
  const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, tubeL * 0.94, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(Math.cos(a) * tieR, tubeL * 0.48 + explodeFactor * tubeL * 0.08, Math.sin(a) * tieR);
    g.add(rod);
  }

  // Perforated Segmental Baffles (折流板1..24) with authentic circular tube-pass holes
  const baffleCount = Math.max(2, Math.min(24, p.baffleCount));
  const baffleShape = new THREE.Shape();
  const cutAngle = Math.acos(0.45);
  baffleShape.absarc(0, 0, baffleR, cutAngle, Math.PI * 2 - cutAngle, false);
  baffleShape.closePath();

  // Punch crisp tube-pass perforation holes onto the shared baffle ExtrudeGeometry
  const holeR = Math.max(0.014, baffleR * 0.048);
  const holePitch = baffleR * 0.24;
  const cutX = baffleR * 0.45;
  for (let gx = -baffleR * 0.78; gx <= cutX - holeR * 2.1; gx += holePitch) {
    for (let gy = -baffleR * 0.78; gy <= baffleR * 0.78; gy += holePitch) {
      if (Math.hypot(gx, gy) + holeR * 1.8 < baffleR) {
        const hole = new THREE.Path();
        hole.absarc(gx, gy, holeR, 0, Math.PI * 2, true);
        baffleShape.holes.push(hole);
      }
    }
  }

  const baffleGeo = new THREE.ExtrudeGeometry(baffleShape, { depth: 0.014, bevelEnabled: false });
  baffleGeo.rotateX(Math.PI / 2);

  for (let i = 0; i < baffleCount; i++) {
    const baffleLabel = `折流板${i + 1}`;
    const isThisBaffleSelected = isSelected && selectedSubNode === baffleLabel;
    const baseY = ((i + 1) / (baffleCount + 1)) * tubeL;
    const spreadY = (baseY - tubeL * 0.5) * explodeFactor * 1.05;
    const bm = new THREE.Mesh(baffleGeo, isThisBaffleSelected ? selectedBaffleMat : baffleMat);
    bm.position.y = baseY + spreadY;
    // Fan alternate baffles sharply up/down into a rhythmic GHPV zigzag stream when exploded
    if (explodeFactor > 0.001) {
      bm.position.x = (i % 2 === 0 ? 1 : -1) * explodeFactor * baffleR * 0.68;
    }
    bm.rotation.y = i % 2 === 0 ? 0 : Math.PI;
    g.add(bm);
  }

  return g;
}

/**
 * Build Spherical Tank Tubular Columns + U-Brackets + Cross-Bracing Tie Rods (GB/T 12337).
 */
function buildSphereColumns(
  p: SphereColumnParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  sphereRadiusM: number
): THREE.Group {
  const g = new THREE.Group();
  const colMat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.36, 0.52);
  const rodMat = createComponentMaterial(
    { r: 162, g: 175, b: 188, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.32,
    0.64
  );

  const count = Math.max(4, Math.min(20, p.count));
  const pipeR = Math.max(0.12, (p.pipeOD / 2) * MM_TO_M);
  const clearanceM = Math.max(0.8, p.clearanceMm * MM_TO_M);
  const colOrbitR = sphereRadiusM + pipeR * 0.72;
  const colTopY = sphereRadiusM + pipeR * 1.4;
  const colBotY = -clearanceM;
  const colH = colTopY - colBotY;

  const colPositions: Array<{ x: number; z: number; a: number }> = [];

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const cx = Math.cos(a) * colOrbitR;
    const cz = Math.sin(a) * colOrbitR;
    colPositions.push({ x: cx, z: cz, a });

    const col = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, colH, 16), colMat);
    col.position.set(cx, (colTopY + colBotY) * 0.5, cz);
    g.add(col);

    // Base plate & anchor gusset skirt at ground level
    const baseSize = pipeR * 3.1;
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(baseSize, 0.08, baseSize), colMat);
    basePlate.position.set(cx, colBotY + 0.04, cz);
    basePlate.rotation.y = -a;
    g.add(basePlate);

    // Equatorial U-bracket weld collar connecting column to sphere
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(pipeR * 1.28, pipeR * 1.15, pipeR * 2.4, 14),
      colMat
    );
    collar.position.set(Math.cos(a) * (sphereRadiusM + pipeR * 0.35), sphereRadiusM, Math.sin(a) * (sphereRadiusM + pipeR * 0.35));
    g.add(collar);
  }

  // Criss-cross diagonal tie rods (拉杆) between adjacent columns
  if (p.hasTieRods && count >= 4) {
    const rodR = Math.max(0.025, (p.tieRodOD / 2) * MM_TO_M * 1.2);
    const upperY = sphereRadiusM - sphereRadiusM * 0.32;
    const lowerY = colBotY + colH * 0.14;
    const upVec = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const p1 = colPositions[i];
      const p2 = colPositions[(i + 1) % count];
      const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [
        [new THREE.Vector3(p1.x, upperY, p1.z), new THREE.Vector3(p2.x, lowerY, p2.z)],
        [new THREE.Vector3(p1.x, lowerY, p1.z), new THREE.Vector3(p2.x, upperY, p2.z)],
      ];
      for (const [start, end] of pairs) {
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(rodR, rodR, len, 8), rodMat);
        rod.position.copy(start).addScaledVector(dir, 0.5);
        rod.quaternion.setFromUnitVectors(upVec, dir.normalize());
        g.add(rod);
      }
    }
  }

  return g;
}

/**
 * Build Industrial Steel Platform + Handrail + Caged Ladder (HG/T 21542).
 */
function buildLadderPlatform(
  p: LadderPlatformParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentRadiusM: number,
  parentIsSphere: boolean
): THREE.Group {
  const g = new THREE.Group();
  const mat = createComponentMaterial(color, renderMode, isSelected, clippingPlanes, 0.42, 0.55);

  const elevM = p.elevationMm * MM_TO_M;
  const platW = Math.max(0.65, p.widthMm * MM_TO_M);
  const innerR = parentIsSphere ? Math.max(0.65, parentRadiusM * 0.24) : parentRadiusM + 0.04;
  const outerR = innerR + platW;
  const spanRad = Math.min(Math.PI * 2, Math.max(Math.PI * 0.35, (p.angleSpanDeg * Math.PI) / 180));
  const startRad = (p.startAngleDeg * Math.PI) / 180;
  const railH = 1.05;
  const railR = Math.max(0.022, outerR * 0.014);

  // Platform deck grating ring/arc
  const deckPts = 28;
  const deckShape = new THREE.Shape();
  for (let i = 0; i <= deckPts; i++) {
    const a = startRad + (i / deckPts) * spanRad;
    const x = Math.cos(a) * outerR;
    const y = Math.sin(a) * outerR;
    if (i === 0) deckShape.moveTo(x, y);
    else deckShape.lineTo(x, y);
  }
  for (let i = deckPts; i >= 0; i--) {
    const a = startRad + (i / deckPts) * spanRad;
    deckShape.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
  }
  deckShape.closePath();

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.045, bevelEnabled: false });
  deckGeo.rotateX(Math.PI / 2);
  const deckMesh = new THREE.Mesh(deckGeo, mat);
  deckMesh.position.y = elevM;
  g.add(deckMesh);

  // Outer handrail top & mid rings
  for (const hOff of [railH * 0.52, railH]) {
    const railPts: THREE.Vector3[] = [];
    for (let i = 0; i <= deckPts; i++) {
      const a = startRad + (i / deckPts) * spanRad;
      railPts.push(new THREE.Vector3(Math.cos(a) * outerR, elevM + hOff, -Math.sin(a) * outerR));
    }
    const curve = new THREE.CatmullRomCurve3(railPts);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, deckPts, railR, 6, false), mat);
    g.add(rail);
  }

  // Handrail vertical stanchion posts
  const postCount = Math.max(6, Math.min(20, Math.round((spanRad * outerR) / 0.95)));
  const postGeo = new THREE.CylinderGeometry(railR, railR, railH, 6);
  for (let i = 0; i <= postCount; i++) {
    const a = startRad + (i / postCount) * spanRad;
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(Math.cos(a) * outerR, elevM + railH * 0.5, -Math.sin(a) * outerR);
    g.add(post);
  }

  // Vertical Caged Ladder descending from platform edge
  const ladH = Math.max(1.5, p.ladderHeightMm * MM_TO_M);
  const ladX = parentIsSphere ? parentRadiusM + 0.52 : outerR + 0.12;
  const ladHalfW = 0.24;
  const ladGroup = new THREE.Group();
  ladGroup.rotation.y = startRad;

  const sideGeo = new THREE.CylinderGeometry(railR * 1.1, railR * 1.1, ladH, 6);
  const leftRail = new THREE.Mesh(sideGeo, mat);
  leftRail.position.set(ladX, elevM - ladH * 0.5, -ladHalfW);
  const rightRail = new THREE.Mesh(sideGeo, mat);
  rightRail.position.set(ladX, elevM - ladH * 0.5, ladHalfW);
  ladGroup.add(leftRail, rightRail);

  // Bridge walkway from sphere top platform to ladder
  if (parentIsSphere) {
    const bridgeLen = ladX - outerR + 0.2;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.05, 0.72), mat);
    bridge.position.set(outerR + bridgeLen * 0.5 - 0.1, elevM, 0);
    ladGroup.add(bridge);
  }

  // Rungs via InstancedMesh
  const rungCount = Math.max(4, Math.min(48, Math.floor(ladH / 0.34)));
  const rungGeo = new THREE.CylinderGeometry(railR * 0.75, railR * 0.75, ladHalfW * 2, 6);
  rungGeo.rotateX(Math.PI / 2);
  const rungs = new THREE.InstancedMesh(rungGeo, mat, rungCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rungCount; i++) {
    dummy.position.set(ladX, elevM - 0.25 - i * (ladH / rungCount), 0);
    dummy.updateMatrix();
    rungs.setMatrixAt(i, dummy.matrix);
  }
  rungs.computeBoundingSphere();
  ladGroup.add(rungs);

  // Protective safety cage hoops
  if (p.hasCage) {
    const hoopCount = Math.max(2, Math.min(12, Math.floor((ladH - 2.0) / 1.2)));
    const hoopR = 0.38;
    const hoopGeo = new THREE.TorusGeometry(hoopR, railR * 0.75, 6, 16, Math.PI * 1.35);
    hoopGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < hoopCount; i++) {
      const hoop = new THREE.Mesh(hoopGeo, mat);
      hoop.position.set(ladX + hoopR * 0.78, elevM - 0.4 - i * 1.2, 0);
      hoop.rotation.z = -Math.PI * 0.18;
      ladGroup.add(hoop);
    }
  }

  g.add(ladGroup);
  return g;
}

/**
 * Build complete 3D scene hierarchy for all assembly points in the GHPV workspace.
 */
export function buildAssembliesScene(
  assemblies: AssemblyPoint[],
  selectedId: string | null,
  renderMode: RenderMode,
  clippingPlanes: THREE.Plane[],
  explodeFactor = 0,
  selectedSubNode: string | null = null
): BuiltSceneInfo {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'GHPV_ModelRoot';
  const selectableMeshes: THREE.Object3D[] = [];
  const nozzleAnchors: Array<{ id: string; tag: string; worldPos: THREE.Vector3 }> = [];

  const avgZMm =
    assemblies.length > 0
      ? assemblies.reduce((sum, item) => sum + item.z, 0) / assemblies.length
      : 0;

  for (const ap of assemblies) {
    const apGroup = new THREE.Group();
    apGroup.name = ap.name;
    const placedMains = layoutAssemblyMainComponents(ap);
    const totalLengthM =
      placedMains.length > 0 ? placedMains[placedMains.length - 1].endPosMm * MM_TO_M : 2.0;

    // GHPV CAD uses Z as vertical elevation (e.g. X:0 Z:2200 for upper stacked shell).
    // Map ap.z to Three.js world Y and expand vertical stack spacing smoothly during exploded view!
    const baseElevationY = ap.z * MM_TO_M;
    const stackExplodeY =
      assemblies.length > 1 ? (ap.z - avgZMm) * MM_TO_M * explodeFactor * 0.92 : 0;

    // Assembly local frame: axis runs along +Y from 0 to totalLengthM.
    // For horizontal orientation: rotate -90 deg around Z so local +Y -> world +X (left to right),
    // local -X -> world +Y (upward!), local +Z -> world +Z (toward viewer).
    const axisGroup = new THREE.Group();
    if (ap.orientation === 'horizontal') {
      axisGroup.rotation.z = -Math.PI / 2;
      axisGroup.position.set(
        -totalLengthM / 2 + ap.x * MM_TO_M,
        baseElevationY + stackExplodeY,
        0
      );
    } else {
      axisGroup.position.set(ap.x * MM_TO_M, -totalLengthM / 2 + baseElevationY + stackExplodeY, 0);
    }

    const placedById = new Map<string, PlacedMainComponent>();
    const explodeOffsetById = new Map<string, number>();

    for (const pm of placedMains) {
      placedById.set(pm.component.id, pm);
      const midY = ((pm.startPosMm + pm.endPosMm) * 0.5) * MM_TO_M;
      const axialExplode =
        placedMains.length > 1 ? (midY - totalLengthM * 0.5) * explodeFactor * 1.45 : 0;
      explodeOffsetById.set(pm.component.id, axialExplode);

      if (!pm.component.visible) continue;

      const isSelected = pm.component.id === selectedId;
      const compGroup = buildMainComponentGroup(
        pm.component,
        renderMode,
        isSelected,
        clippingPlanes,
        explodeFactor
      );
      compGroup.position.x = -(pm.eccentricOffsetMm || 0) * MM_TO_M;
      compGroup.position.y = pm.startPosMm * MM_TO_M + axialExplode;
      tagMeshHierarchy(compGroup, pm.component.id, renderMode, isSelected, clippingPlanes, selectableMeshes);
      axisGroup.add(compGroup);
    }

    // Attachments
    const attachments = ap.components.filter((c) => c.category === 'attachment');
    for (const att of attachments) {
      if (!att.visible) continue;
      const parent =
        (att.parentId ? placedById.get(att.parentId) : undefined) || placedMains[0];
      if (!parent) continue;

      const isSelected = att.id === selectedId;
      const parentR = parent.outerRadiusMm * MM_TO_M;
      const parentExplodeY = explodeOffsetById.get(parent.component.id) ?? 0;
      const parentStartM = parent.startPosMm * MM_TO_M + parentExplodeY;
      const parentEccentricX = -(parent.eccentricOffsetMm || 0) * MM_TO_M;

      let attObj: THREE.Group | null = null;

      switch (att.type) {
        case 'nozzle_manhole': {
          const p = att.params as NozzleManholeParams;
          const isOnHead = parent.component.type === 'elliptical_head' || parent.component.type === 'spherical_head';
          const isOnSphere = parent.component.type === 'spherical_tank';
          const { group, tipPosLocal } = buildNozzleOrManhole(
            p,
            att.color,
            renderMode,
            isSelected,
            clippingPlanes,
            isOnHead ? 0.08 : parentR,
            explodeFactor
          );

          const holder = new THREE.Group();
          const radExplode = explodeFactor * Math.max(0.32, parentR * (p.dn >= 1000 ? 0.76 : p.isLiquidBoot ? 0.62 : 0.35));

          if (isOnSphere) {
            const sphereD = (parent.component.params as SphericalTankParams).diameter;
            if (p.axialOffset >= sphereD * 0.8) {
              // Top pole nozzle
              holder.position.set(0, parentStartM + parentR + radExplode, 0);
            } else if (p.axialOffset <= sphereD * 0.2) {
              // Bottom pole nozzle
              holder.position.set(0, parentStartM + parentR - radExplode, 0);
              holder.rotation.z = Math.PI;
            } else {
              // Equatorial radial nozzle
              holder.position.set(0, parentStartM + parentR, 0);
              holder.rotation.y = -(p.angleDeg * Math.PI) / 180;
              group.rotation.z = -Math.PI / 2;
              group.position.x = radExplode;
            }
          } else if (isOnHead) {
            // Axial or eccentrically-offset nozzle on head (supports tower bottom draw-off pipe N4)
            const headP = parent.component.params as EllipticalHeadParams;
            const eccM = (p.eccentricOffset || 0) * MM_TO_M;
            const headAngleRad = ((p.angleDeg || 0) * Math.PI) / 180;
            const yPos = headP.flipped
              ? parent.endPosMm * MM_TO_M + parentExplodeY - 0.08 + radExplode
              : parentStartM + 0.08 - radExplode;
            holder.position.set(
              Math.cos(headAngleRad) * eccM,
              yPos,
              -Math.sin(headAngleRad) * eccM
            );
            if (!headP.flipped) {
              holder.rotation.z = Math.PI;
              group.rotation.y = (((90 + (p.angleDeg || 0)) * Math.PI) / 180);
            } else {
              group.rotation.y = (((90 - (p.angleDeg || 0)) * Math.PI) / 180);
            }
          } else {
            // Radial / eccentric / tilted nozzle on shell
            const yPos = parentStartM + p.axialOffset * MM_TO_M;
            holder.position.set(parentEccentricX, yPos, 0);
            const angleRad = (p.angleDeg * Math.PI) / 180;
            holder.rotation.y = -angleRad;
            const tiltRad = (((p.tiltAngleDeg ?? 90) - 90) * Math.PI) / 180;
            group.rotation.z =
              (ap.orientation === 'horizontal' ? Math.PI / 2 : -Math.PI / 2) + tiltRad;
            if (p.eccentricOffset) {
              group.position.z = p.eccentricOffset * MM_TO_M;
            }
            if (explodeFactor > 0.001) {
              group.position.x = ap.orientation === 'horizontal' ? -radExplode : radExplode;
            }
          }
          holder.add(group);
          attObj = holder;

          holder.userData.nozzleTipLocal = tipPosLocal;
          holder.userData.nozzleTag = p.tag;
          holder.userData.nozzleId = att.id;
          holder.userData.nozzleInnerGroup = group;
          break;
        }

        case 'saddle': {
          const p = att.params as SaddleParams;
          const saddle = buildSaddle(
            p,
            att.color,
            renderMode,
            isSelected,
            clippingPlanes,
            parentR,
            explodeFactor
          );
          const wrapper = new THREE.Group();
          saddle.rotation.order = 'YXZ';
          saddle.rotation.x = -Math.PI / 2;
          saddle.rotation.y = Math.PI / 2;
          wrapper.add(saddle);
          // In horizontal axisGroup (rotated -PI/2 around Z), local +X is world -Y (downward)
          wrapper.position.set(parentEccentricX + explodeFactor * 0.28, parentStartM + p.axialOffset * MM_TO_M, 0);
          attObj = wrapper;
          break;
        }

        case 'leg_support': {
          const p = att.params as LegSupportParams;
          const legs = buildLegSupports(p, att.color, renderMode, isSelected, clippingPlanes, parentR);
          legs.position.y = parentStartM + p.axialOffset * MM_TO_M - explodeFactor * 0.45;
          attObj = legs;
          break;
        }

        case 'lug_support':
        case 'ring_lug': {
          const p = att.params as LugSupportParams;
          const lugs = buildLugSupports(p, att.color, renderMode, isSelected, clippingPlanes, parentR);
          lugs.position.y = parentStartM + p.axialOffset * MM_TO_M;
          attObj = lugs;
          break;
        }

        case 'stiffening_ring': {
          const p = att.params as StiffeningRingParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes);
          const w = p.width * MM_TO_M;
          const t = Math.max(0.016, p.thickness * MM_TO_M);
          const rIn = p.position === '筒体外侧' ? parentR : parentR - w;
          const rOut = p.position === '筒体外侧' ? parentR + w : parentR;
          const parentLenM = Math.max(0.5, parent.axialLengthMm * MM_TO_M);
          for (let i = 0; i < Math.max(1, p.count); i++) {
            const localOffM = (p.axialOffset + i * p.spacing) * MM_TO_M;
            const ringExplodeY = (localOffM - parentLenM * 0.5) * explodeFactor * 0.65;
            const ring = new THREE.Mesh(createHollowCylinder(rIn, rOut, t, 56), mat);
            ring.position.y = parentStartM + localOffM + ringExplodeY;
            g.add(ring);
          }
          attObj = g;
          break;
        }

        case 'trunnion': {
          const p = att.params as TrunnionParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes);
          const r = (p.trunnionOD / 2) * MM_TO_M;
          const len = p.length * MM_TO_M;
          for (const side of [0, Math.PI]) {
            const sg = new THREE.Group();
            sg.rotation.y = (p.angleDeg * Math.PI) / 180 + side;
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), mat);
            pipe.rotation.z = -Math.PI / 2;
            pipe.position.x = parentR + len * 0.45;
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.02, 24), mat);
            cap.rotation.z = -Math.PI / 2;
            cap.position.x = parentR + len * 0.92;
            sg.add(pipe, cap);
            g.add(sg);
          }
          g.position.y = parentStartM + p.axialOffset * MM_TO_M;
          attObj = g;
          break;
        }

        case 'tray': {
          const p = att.params as TrayParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes, 0.3, 0.7);
          const trayR = Math.max(0.1, parentR - 0.02);
          for (let i = 0; i < Math.max(1, p.count); i++) {
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(trayR, trayR, 0.018, 36), mat);
            disc.position.y = parentStartM + (p.startOffset + i * p.spacing) * MM_TO_M;
            g.add(disc);
          }
          attObj = g;
          break;
        }

        case 'packing': {
          const p = att.params as PackingParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes, 0.55, 0.35);
          const r = Math.max(0.1, parentR - 0.025);
          const h = p.height * MM_TO_M;
          const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
          cyl.position.y = parentStartM + p.startOffset * MM_TO_M + h * 0.5;
          g.add(cyl);
          attObj = g;
          break;
        }

        case 'demister': {
          const p = att.params as DemisterParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes, 0.65, 0.45);
          const r = Math.max(0.1, parentR - 0.025);
          const h = p.thickness * MM_TO_M;
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
          disc.position.y = parentStartM + p.startOffset * MM_TO_M;
          g.add(disc);
          attObj = g;
          break;
        }

        case 'top_davit': {
          const p = att.params as TopDavitParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes);
          const poleR = (p.pipeOD / 2) * MM_TO_M;
          const poleH = p.poleHeight * MM_TO_M;
          const armL = p.armLength * MM_TO_M;
          const yTop = parent.endPosMm * MM_TO_M;

          const holder = new THREE.Group();
          holder.rotation.y = (p.angleDeg * Math.PI) / 180;

          const pole = new THREE.Mesh(new THREE.CylinderGeometry(poleR, poleR, poleH, 16), mat);
          pole.position.set(parentR + poleR + 0.035, yTop - 0.35 + poleH * 0.5, 0);
          holder.add(pole);

          const arm = new THREE.Mesh(new THREE.BoxGeometry(armL, poleR * 1.35, poleR * 1.15), mat);
          arm.position.set(parentR + poleR + 0.035 - armL * 0.46, yTop - 0.35 + poleH - 0.06, 0);
          holder.add(arm);

          const brace = new THREE.Mesh(new THREE.BoxGeometry(armL * 0.65, 0.04, 0.04), mat);
          brace.position.set(parentR + poleR + 0.035 - armL * 0.26, yTop - 0.35 + poleH - 0.34, 0);
          brace.rotation.z = -Math.PI / 4;
          holder.add(brace);

          g.add(holder);
          attObj = g;
          break;
        }

        case 'weld_seam': {
          const p = att.params as WeldSeamParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes, 0.4, 0.3);
          const torus = new THREE.Mesh(new THREE.TorusGeometry(parentR + 0.004, 0.009, 10, 48), mat);
          torus.rotation.x = Math.PI / 2;
          torus.position.y = parentStartM + p.axialOffset * MM_TO_M;
          g.add(torus);
          attObj = g;
          break;
        }

        case 'pad_plate': {
          const p = att.params as PadPlateParams;
          const g = new THREE.Group();
          const mat = createComponentMaterial(att.color, renderMode, isSelected, clippingPlanes);
          const arcSpan = Math.min(Math.PI * 0.6, (p.width * MM_TO_M) / Math.max(0.2, parentR));
          const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(
              parentR + 0.012,
              parentR + 0.012,
              p.height * MM_TO_M,
              16,
              1,
              true,
              -arcSpan / 2,
              arcSpan
            ),
            mat
          );
          pad.rotation.y = (p.angleDeg * Math.PI) / 180;
          pad.position.y = parentStartM + p.axialOffset * MM_TO_M;
          g.add(pad);
          attObj = g;
          break;
        }

        case 'tube_layout': {
          const p = att.params as TubeLayoutParams;
          // In stacked multi-assembly heat exchangers, float the lower bundle UP (-X) and upper bundle DOWN (+X) toward the center
          const radialDir =
            assemblies.length > 1
              ? ap.z < avgZMm
                ? -1
                : ap.z > avgZMm
                  ? 1
                  : 0
              : 0;
          const bundle = buildTubeBundle(
            p,
            att.color,
            renderMode,
            isSelected,
            clippingPlanes,
            explodeFactor,
            selectedSubNode,
            radialDir
          );
          bundle.position.x = parentEccentricX + (p.verticalOffsetMm || 0) * MM_TO_M;
          bundle.position.y = parentStartM;
          attObj = bundle;
          break;
        }

        case 'sphere_column': {
          const p = att.params as SphereColumnParams;
          const cols = buildSphereColumns(p, att.color, renderMode, isSelected, clippingPlanes, parentR);
          cols.position.y = parentStartM - explodeFactor * 1.4;
          attObj = cols;
          break;
        }

        case 'ladder_platform': {
          const p = att.params as LadderPlatformParams;
          const isSphere = parent.component.type === 'spherical_tank';
          const plat = buildLadderPlatform(
            p,
            att.color,
            renderMode,
            isSelected,
            clippingPlanes,
            parentR,
            isSphere
          );
          plat.position.y = parentStartM + explodeFactor * 1.1;
          attObj = plat;
          break;
        }

        default: {
          const p = att.params as GenericAttachmentParams;
          const parentEndM = parent.endPosMm * MM_TO_M + parentExplodeY;
          const builtExtra = buildExtraAttachmentGeometry(
            att.type,
            p,
            att.color,
            renderMode,
            isSelected,
            clippingPlanes,
            parentR,
            parentStartM,
            parentEndM,
            parentEccentricX,
            explodeFactor,
            createComponentMaterial
          );
          if (builtExtra) {
            attObj = builtExtra;
          }
          break;
        }
      }

      if (attObj) {
        attObj.name = att.name;
        const highlightWholeAtt =
          isSelected && !(att.type === 'tube_layout' && selectedSubNode && /^折流板\d+$/.test(selectedSubNode));
        tagMeshHierarchy(attObj, att.id, renderMode, highlightWholeAtt, clippingPlanes, selectableMeshes);
        axisGroup.add(attObj);
      }
    }

    apGroup.add(axisGroup);
    rootGroup.add(apGroup);
  }

  rootGroup.updateMatrixWorld(true);

  // Extract world-space positions of nozzle callout anchors
  rootGroup.traverse((obj) => {
    if (obj.userData.nozzleTag && obj.userData.nozzleTipLocal && obj.userData.nozzleInnerGroup) {
      const tip: THREE.Vector3 = (obj.userData.nozzleTipLocal as THREE.Vector3).clone();
      (obj.userData.nozzleInnerGroup as THREE.Object3D).localToWorld(tip);
      nozzleAnchors.push({
        id: obj.userData.nozzleId as string,
        tag: obj.userData.nozzleTag as string,
        worldPos: tip,
      });
    }
  });

  const boundingBox = new THREE.Box3().setFromObject(rootGroup);
  if (boundingBox.isEmpty()) {
    boundingBox.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  }

  return { rootGroup, selectableMeshes, nozzleAnchors, boundingBox };
}

/**
 * Dispose all geometries and materials inside a Three.js Object3D tree cleanly.
 */
export function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments) {
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach((mat) => mat.dispose());
      } else {
        m.material?.dispose();
      }
    }
  });
}

/**
 * Export the current Three.js vessel scene to an ASCII STL file string (SolidWorks / FreeCAD compatible).
 */
export function exportSceneToAsciiStl(root: THREE.Object3D, solidName = 'GHPV_Vessel'): string {
  root.updateMatrixWorld(true);
  const lines: string[] = [`solid ${solidName}`];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const instMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();

  const emitTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    cb.cross(ab).normalize();
    lines.push(`  facet normal ${cb.x.toFixed(5)} ${cb.y.toFixed(5)} ${cb.z.toFixed(5)}`);
    lines.push('    outer loop');
    // Convert meters back to mm for CAD export
    lines.push(`      vertex ${(a.x * 1000).toFixed(2)} ${(a.y * 1000).toFixed(2)} ${(a.z * 1000).toFixed(2)}`);
    lines.push(`      vertex ${(b.x * 1000).toFixed(2)} ${(b.y * 1000).toFixed(2)} ${(b.z * 1000).toFixed(2)}`);
    lines.push(`      vertex ${(c.x * 1000).toFixed(2)} ${(c.y * 1000).toFixed(2)} ${(c.z * 1000).toFixed(2)}`);
    lines.push('    endloop');
    lines.push('  endfacet');
  };

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;

    const index = geo.index;
    const isInst = (mesh as THREE.InstancedMesh).isInstancedMesh;
    const count = isInst ? (mesh as THREE.InstancedMesh).count : 1;

    for (let k = 0; k < count; k++) {
      if (isInst) {
        (mesh as THREE.InstancedMesh).getMatrixAt(k, instMat);
        worldMat.multiplyMatrices(mesh.matrixWorld, instMat);
      } else {
        worldMat.copy(mesh.matrixWorld);
      }

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          vA.fromBufferAttribute(pos, index.getX(i)).applyMatrix4(worldMat);
          vB.fromBufferAttribute(pos, index.getX(i + 1)).applyMatrix4(worldMat);
          vC.fromBufferAttribute(pos, index.getX(i + 2)).applyMatrix4(worldMat);
          emitTriangle(vA, vB, vC);
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          vA.fromBufferAttribute(pos, i).applyMatrix4(worldMat);
          vB.fromBufferAttribute(pos, i + 1).applyMatrix4(worldMat);
          vC.fromBufferAttribute(pos, i + 2).applyMatrix4(worldMat);
          emitTriangle(vA, vB, vC);
        }
      }
    }
  });

  lines.push(`endsolid ${solidName}`);
  return lines.join('\n');
}
