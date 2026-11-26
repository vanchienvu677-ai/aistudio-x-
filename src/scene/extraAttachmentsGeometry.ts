import * as THREE from 'three';
import type { GenericAttachmentParams, RenderMode, RgbaColor } from '../types/vessel';
import { buildPrecisionPipeFlange } from './flangeGeometry';

const MM_TO_M = 0.001;

export type CreateMatFn = (
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  roughness?: number,
  metalness?: number
) => THREE.Material;

function makeHollowRing(rIn: number, rOut: number, height: number, segs = 64): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, Math.max(0.01, rOut), 0, Math.PI * 2, false);
  if (rIn > 0.005 && rIn < rOut - 0.002) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.006, height),
    bevelEnabled: false,
    curveSegments: segs,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height / 2, 0);
  return geo;
}

/**
 * Create a realistic tapered lifting lug plate with a rounded top and circular shackle pin bore.
 */
function createLugEarGeometry(baseW: number, topR: number, height: number, thick: number, holeR: number): THREE.ExtrudeGeometry {
  const halfBase = Math.max(topR * 1.15, baseW / 2);
  const centerY = Math.max(topR * 1.1, height - topR);
  const shape = new THREE.Shape();
  shape.moveTo(-halfBase, 0);
  shape.lineTo(halfBase, 0);
  shape.lineTo(topR, centerY);
  shape.absarc(0, centerY, topR, 0, Math.PI, false);
  shape.lineTo(-halfBase, 0);
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, centerY, Math.min(topR * 0.56, Math.max(0.012, holeR)), 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.translate(0, 0, -thick / 2);
  return geo;
}

/**
 * Create a curved rectangular arc plate hugging the cylinder radius `r`.
 */
function createCurvedPadMesh(
  r: number,
  arcWidthM: number,
  axialHeightM: number,
  thickM: number,
  mat: THREE.Material
): THREE.Mesh {
  const arcSpan = Math.min(Math.PI * 0.72, Math.max(0.14, arcWidthM / Math.max(0.15, r)));
  const segs = 16;
  const rIn = r;
  const rOut = r + thickM;
  const shape = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = -arcSpan / 2 + (i / segs) * arcSpan;
    const x = Math.cos(a) * rOut;
    const y = Math.sin(a) * rOut;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = -arcSpan / 2 + (i / segs) * arcSpan;
    shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: axialHeightM, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, axialHeightM / 2, 0);
  return new THREE.Mesh(geo, mat);
}

/**
 * Build dedicated, realistic 1:1 procedural 3D geometry for all 18 GHPV V1.6 secondary & specialized attachments.
 * Returns null if `type` is not handled here.
 */
export function buildExtraAttachmentGeometry(
  type: string,
  p: GenericAttachmentParams,
  color: RgbaColor,
  renderMode: RenderMode,
  isSelected: boolean,
  clippingPlanes: THREE.Plane[],
  parentR: number,
  parentStartM: number,
  parentEndM: number,
  parentEccentricX: number,
  explodeFactor: number,
  createMat: CreateMatFn
): THREE.Group | null {
  const g = new THREE.Group();
  const mat = createMat(color, renderMode, isSelected, clippingPlanes);
  const boltMat = createMat(
    { r: 170, g: 182, b: 196, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.26,
    0.72
  );
  const copperMat = createMat(
    { r: 212, g: 122, b: 52, a: 255 },
    renderMode,
    isSelected,
    clippingPlanes,
    0.28,
    0.75
  );

  const sizeA = Math.max(40, p.sizeA || 240) * MM_TO_M;
  const sizeB = Math.max(40, p.sizeB || 180) * MM_TO_M;
  const thick = Math.max(6, p.thickness || 16) * MM_TO_M;
  const axialY = parentStartM + (p.axialOffset || 600) * MM_TO_M;
  const angRad = ((p.angleDeg || 0) * Math.PI) / 180;
  const radExplode = explodeFactor * Math.max(0.24, parentR * 0.35);

  switch (type) {
    // 1. 卧式/板式吊耳 (HG/T 21574-2018): 垫板 + 双侧加筋带孔吊耳板 + 销孔加强环
    case 'horizontal_lug': {
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const pad = createCurvedPadMesh(parentR, sizeA * 1.4, sizeA * 1.3, thick * 0.75, mat);
      pad.position.x = radExplode * 0.4;
      holder.add(pad);

      const earGeo = createLugEarGeometry(sizeA, sizeB * 0.38, sizeB, thick, sizeB * 0.16);
      earGeo.rotateZ(-Math.PI / 2);
      const ear = new THREE.Mesh(earGeo, mat);
      ear.position.set(parentR + thick * 0.65 + radExplode, 0, 0);
      holder.add(ear);

      // Pin boss reinforcing cheeks on both sides of shackle hole
      const bossR = sizeB * 0.28;
      const bossGeo = makeHollowRing(sizeB * 0.15, bossR, thick * 1.55, 20);
      bossGeo.rotateX(Math.PI / 2);
      const boss = new THREE.Mesh(bossGeo, mat);
      boss.position.set(parentR + thick * 0.65 + (sizeB - sizeB * 0.38) + radExplode, 0, 0);
      holder.add(boss);

      // Twin triangular weld stiffeners
      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(sizeB * 0.48, thick * 0.65, sizeA * 0.22), mat);
        rib.position.set(parentR + thick * 0.65 + sizeB * 0.24 + radExplode, 0, side * (thick * 0.5 + sizeA * 0.11));
        holder.add(rib);
      }
      g.add(holder);
      return g;
    }

    // 2. 侧壁式吊耳 (HG/T 21574-2018 AXC/AXD): 弧形垫板 + 垂直吊耳板 + 双侧三角加劲肋
    case 'side_lug': {
      for (const sideAng of [0, Math.PI]) {
        const holder = new THREE.Group();
        holder.position.set(parentEccentricX, axialY, 0);
        holder.rotation.y = -angRad + sideAng;

        const pad = createCurvedPadMesh(parentR, sizeA * 1.35, sizeB * 1.35, thick * 0.7, mat);
        holder.add(pad);

        const earGeo = createLugEarGeometry(sizeB, sizeA * 0.34, sizeA, thick, sizeA * 0.16);
        earGeo.rotateY(Math.PI / 2);
        earGeo.rotateZ(-Math.PI / 2);
        const ear = new THREE.Mesh(earGeo, mat);
        ear.position.set(parentR + thick * 0.65 + radExplode, 0, 0);
        holder.add(ear);

        for (const s of [-1, 1]) {
          const gusset = new THREE.Mesh(new THREE.BoxGeometry(sizeA * 0.55, sizeB * 0.42, thick * 0.65), mat);
          gusset.position.set(parentR + sizeA * 0.28 + radExplode, s * sizeB * 0.32, 0);
          holder.add(gusset);
        }
        g.add(holder);
      }
      return g;
    }

    // 3. 吊耳环 (顶部/侧部圆环形吊环 HG/T 21574)
    case 'lifting_ring': {
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const pad = createCurvedPadMesh(parentR, sizeA * 1.2, sizeA * 1.2, thick * 0.75, mat);
      holder.add(pad);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(thick * 1.3, thick * 1.6, sizeB * 0.35, 16), mat);
      stem.rotation.z = -Math.PI / 2;
      stem.position.set(parentR + sizeB * 0.18 + radExplode, 0, 0);
      holder.add(stem);

      const tubeR = Math.max(0.011, thick * 0.5);
      const ringR = Math.max(0.032, sizeB * 0.5 - tubeR);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, tubeR, 14, 28), mat);
      ring.position.set(parentR + sizeB * 0.32 + ringR + radExplode, 0, 0);
      holder.add(ring);

      g.add(holder);
      return g;
    }

    // 4. 支承式支座 (NB/T 47065.4-2018): 弧形底板 + 支承圆筒/双腹板 + 环向筋板 + 地脚螺栓孔座
    case 'support_stand': {
      // sizeA = 支座立管外径 (mm), sizeB = 支座高度 H (mm)
      const standW = Math.max(0.08, sizeA);
      const standH = Math.max(0.2, sizeB);
      const count = 4;
      for (let i = 0; i < count; i++) {
        const a = angRad + (i / count) * Math.PI * 2;
        const sg = new THREE.Group();
        sg.rotation.y = a;

        // Cylindrical vertical column welded to bottom head/shell
        const pipeR = standW * 0.5;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR * 1.08, standH, 20), mat);
        col.position.set(parentR * 0.72, parentStartM - standH * 0.42 - radExplode, 0);
        sg.add(col);

        // Top curved saddle pad
        const topPad = new THREE.Mesh(new THREE.BoxGeometry(standW * 1.2, thick * 1.2, standW * 1.2), mat);
        topPad.position.set(parentR * 0.72, parentStartM + standH * 0.08 - radExplode, 0);
        sg.add(topPad);

        // Anchor base plate + 2 gusset webs + anchor bolts
        const base = new THREE.Mesh(new THREE.BoxGeometry(standW * 1.65, thick * 1.4, standW * 1.65), mat);
        base.position.set(parentR * 0.72, parentStartM - standH * 0.92 - radExplode, 0);
        sg.add(base);

        for (const s of [-1, 1]) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(standW * 1.35, standH * 0.45, thick * 0.7), mat);
          rib.position.set(parentR * 0.72, parentStartM - standH * 0.68 - radExplode, s * pipeR * 0.9);
          sg.add(rib);
          const bolt = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.55, thick * 0.55, thick * 3.2, 8), boltMat);
          bolt.position.set(parentR * 0.72 + s * standW * 0.58, parentStartM - standH * 0.85 - radExplode, 0);
          sg.add(bolt);
        }
        g.add(sg);
      }
      return g;
    }

    // 5. 防风定位板 (立式高塔风振导向限位支架)
    case 'wind_guide': {
      for (let i = 0; i < 4; i++) {
        const a = angRad + (i * Math.PI) / 2;
        const holder = new THREE.Group();
        holder.position.set(parentEccentricX, axialY, 0);
        holder.rotation.y = a;

        const pad = createCurvedPadMesh(parentR, sizeB * 1.3, sizeA * 1.25, thick * 0.75, mat);
        holder.add(pad);

        // Twin radial guide plates with slide wear shoe at tip
        for (const s of [-1, 1]) {
          const web = new THREE.Mesh(new THREE.BoxGeometry(sizeA, sizeB * 0.85, thick), mat);
          web.position.set(parentR + sizeA * 0.5 + radExplode, 0, s * sizeB * 0.28);
          holder.add(web);
        }
        const stopPlate = new THREE.Mesh(new THREE.BoxGeometry(thick * 1.3, sizeB * 1.05, sizeB * 0.95), boltMat);
        stopPlate.position.set(parentR + sizeA + radExplode, 0, 0);
        holder.add(stopPlate);

        g.add(holder);
      }
      return g;
    }

    // 6. 型钢 (真实 H型钢/工字钢截面支架结构)
    case 'structural_steel': {
      const h = Math.max(0.1, sizeB); // section height
      const w = Math.max(0.08, sizeB * 0.65); // flange width
      const tf = Math.max(0.01, thick);
      const tw = Math.max(0.008, thick * 0.75);
      const len = Math.max(0.4, sizeA);

      // Build genuine I-beam / H-beam 2D cross section
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2 + tf);
      shape.lineTo(tw / 2, -h / 2 + tf);
      shape.lineTo(tw / 2, h / 2 - tf);
      shape.lineTo(w / 2, h / 2 - tf);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2 - tf);
      shape.lineTo(-tw / 2, h / 2 - tf);
      shape.lineTo(-tw / 2, -h / 2 + tf);
      shape.lineTo(-w / 2, -h / 2 + tf);
      shape.closePath();

      const beamGeo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
      beamGeo.rotateY(Math.PI / 2);
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(parentR + radExplode, 0, 0);
      holder.add(beam);

      // End mounting plate + 4 bolts
      const endPlate = new THREE.Mesh(new THREE.BoxGeometry(tf * 1.4, h * 1.25, w * 1.35), mat);
      endPlate.position.set(parentR + len + radExplode, 0, 0);
      holder.add(endPlate);
      g.add(holder);
      return g;
    }

    // 7. 浮头勾圈 (GB/T 151-2014 对开式勾圈法兰 + 螺栓组 + 浮头盖)
    case 'floating_hook': {
      // sizeA = 勾圈外径 OD (mm), sizeB = 勾圈高度 H (mm)
      const hookR = Math.max(0.15, sizeA > 0 ? sizeA * 0.5 : parentR * 0.86);
      const hookH = Math.max(0.04, sizeB);
      const hookGroup = new THREE.Group();
      hookGroup.position.set(parentEccentricX, axialY, 0);
      hookGroup.rotation.y = -angRad;

      // Split C-ring halves (slightly separated to show authentic split hook ring)
      for (const half of [0, 1]) {
        const startA = half * Math.PI + 0.04;
        const endA = (half + 1) * Math.PI - 0.04;
        const segs = 24;
        const rIn = hookR * 0.72;
        const rOut = hookR;
        const sh = new THREE.Shape();
        for (let i = 0; i <= segs; i++) {
          const a = startA + (i / segs) * (endA - startA);
          const x = Math.cos(a) * rOut;
          const y = Math.sin(a) * rOut;
          if (i === 0) sh.moveTo(x, y);
          else sh.lineTo(x, y);
        }
        for (let i = segs; i >= 0; i--) {
          const a = startA + (i / segs) * (endA - startA);
          sh.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        }
        sh.closePath();
        const geo = new THREE.ExtrudeGeometry(sh, { depth: hookH, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        const halfMesh = new THREE.Mesh(geo, mat);
        halfMesh.position.set(0, hookH / 2, (half === 0 ? 1 : -1) * explodeFactor * 0.14);
        hookGroup.add(halfMesh);
      }

      // Stud bolts around hook ring BCD
      const bcdR = hookR * 0.86;
      const bolts = 16;
      const studGeo = new THREE.CylinderGeometry(Math.max(0.008, thick * 0.5), Math.max(0.008, thick * 0.5), hookH * 1.9, 8);
      for (let i = 0; i < bolts; i++) {
        const a = (i / bolts) * Math.PI * 2;
        const stud = new THREE.Mesh(studGeo, boltMat);
        stud.position.set(Math.cos(a) * bcdR, hookH * 0.25 + explodeFactor * 0.18, Math.sin(a) * bcdR);
        hookGroup.add(stud);
      }
      g.add(hookGroup);
      return g;
    }

    // 8. 分程隔板 (换热器管箱内部 T 型/直板分程隔板)
    case 'pass_partition': {
      // sizeA = 隔板跨径 D (mm), sizeB = 隔板轴向长 L (mm)
      const partR = Math.max(0.12, Math.min(parentR - 0.015, sizeA * 0.5));
      const partLen = Math.max(0.15, sizeB);
      const partGroup = new THREE.Group();
      partGroup.position.set(parentEccentricX, axialY, 0);
      partGroup.rotation.y = -angRad;

      const mainPlate = new THREE.Mesh(new THREE.BoxGeometry(partR * 1.98, partLen, thick), mat);
      partGroup.add(mainPlate);

      // Cross partition for 4-pass heat exchanger look
      const crossPlate = new THREE.Mesh(new THREE.BoxGeometry(thick, partLen, partR * 0.96), mat);
      crossPlate.position.z = partR * 0.48;
      partGroup.add(crossPlate);

      g.add(partGroup);
      return g;
    }

    // 9. 防冲挡板 (GB/T 151 弧形防冲板 + 4根支撑焊柱)
    case 'impingement_baffle': {
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const innerR = Math.max(0.15, parentR - 0.085);
      const arcPlate = createCurvedPadMesh(innerR, sizeA, sizeB, thick, mat);
      holder.add(arcPlate);

      // 4 cylindrical standoff legs connecting baffle to inner shell wall
      const legLen = 0.085;
      const legGeo = new THREE.CylinderGeometry(0.012, 0.012, legLen, 10);
      legGeo.rotateZ(Math.PI / 2);
      for (const dy of [-sizeB * 0.34, sizeB * 0.34]) {
        for (const da of [-0.14, 0.14]) {
          const leg = new THREE.Mesh(legGeo, boltMat);
          const midR = innerR + legLen * 0.5;
          leg.position.set(Math.cos(da) * midR, dy, Math.sin(da) * midR);
          leg.rotation.y = -da;
          holder.add(leg);
        }
      }
      g.add(holder);
      return g;
    }

    // 10. 铭牌与保温铭牌支架 (TSG 21)
    case 'nameplate': {
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const standoff = Math.max(0.06, sizeB * 0.55);
      // Standoff channel bracket
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(standoff, sizeB * 0.72, sizeA * 0.86), mat);
      bracket.position.set(parentR + standoff * 0.5 + radExplode * 0.6, 0, 0);
      holder.add(bracket);

      // Stainless steel engraved plate + 4 corner rivets
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.008, sizeB, sizeA), boltMat);
      plate.position.set(parentR + standoff + 0.005 + radExplode, 0, 0);
      holder.add(plate);

      for (const dy of [-sizeB * 0.38, sizeB * 0.38]) {
        for (const dz of [-sizeA * 0.4, sizeA * 0.4]) {
          const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), copperMat);
          rivet.position.set(parentR + standoff + 0.01 + radExplode, dy, dz);
          holder.add(rivet);
        }
      }
      g.add(holder);
      return g;
    }

    // 11. 空间管线 (三维空间多弯头工艺连通管 + 两端配对法兰)
    case 'spatial_piping': {
      const pipeR = Math.max(0.028, (p.sizeB || 108) * 0.5 * MM_TO_M);
      const runLen = Math.max(0.5, sizeA);
      const standOut = parentR + Math.max(0.28, pipeR * 4.5);

      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const pts = [
        new THREE.Vector3(parentR, 0, 0),
        new THREE.Vector3(standOut, 0, 0),
        new THREE.Vector3(standOut, runLen * 0.55, 0),
        new THREE.Vector3(standOut, runLen * 0.55, runLen * 0.45),
        new THREE.Vector3(standOut - 0.16, runLen, runLen * 0.45),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 52, pipeR, 28, false), mat);
      holder.add(tube);

      // Start & end precision drilled WN-RF flanges
      const pipeODMm = Math.max(56, p.sizeB || 108);
      const pipeFlangeParams = {
        flangeType: 'WN-RF' as const,
        dn: Math.round(pipeODMm * 0.9),
        pipeOD: pipeODMm,
        pipeThickness: Math.max(4, Math.round(pipeODMm * 0.06)),
        flangeOD: Math.round(pipeODMm * 1.95 + 24),
        flangeThickness: Math.max(18, Math.round(pipeODMm * 0.22)),
        boltCount: pipeODMm >= 140 ? 8 : 4,
      };
      const flg1 = buildPrecisionPipeFlange({
        params: pipeFlangeParams,
        color: { r: 168, g: 180, b: 194, a: 255 },
        renderMode,
        isSelected,
        clippingPlanes,
        createMat,
        segments: 48,
      });
      flg1.group.rotation.z = -Math.PI / 2;
      flg1.group.position.set(parentR + 0.06, 0, 0);

      const flg2 = buildPrecisionPipeFlange({
        params: pipeFlangeParams,
        color: { r: 168, g: 180, b: 194, a: 255 },
        renderMode,
        isSelected,
        clippingPlanes,
        createMat,
        segments: 48,
      });
      flg2.group.position.set(standOut - 0.16, runLen - flg2.totalHeightM, runLen * 0.45);
      holder.add(flg1.group, flg2.group);

      g.add(holder);
      return g;
    }

    // 12. 保温支承 (多段环形保温支承圈 + 间隔肋板)
    case 'insulation_support': {
      // sizeA = 参考筒径 Di (mm), sizeB = 支承圈宽 W (mm)
      const ringW = Math.max(0.04, Math.min(0.32, sizeB));
      const ringT = Math.max(0.006, thick);
      const totalH = Math.max(0.8, parentEndM - parentStartM);
      const count = Math.max(2, Math.min(6, Math.round(totalH / 1.4)));
      const baseR = Math.max(parentR, sizeA * 0.5);
      for (let i = 0; i < count; i++) {
        const y = parentStartM + ((i + 0.5) / count) * totalH;
        const ring = new THREE.Mesh(makeHollowRing(baseR, baseR + ringW, ringT, 44), mat);
        ring.position.set(parentEccentricX, y, 0);
        g.add(ring);
      }
      return g;
    }

    // 13. 接地垫片 / 静电接地耳 (不锈钢/铜板 + M12接地螺栓孔与螺母)
    case 'grounding_lug': {
      // sizeA = 接地耳长 L (mm), sizeB = 接地耳宽 W (mm)
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const earL = Math.max(0.06, sizeA);
      const earW = Math.max(0.035, sizeB);
      const earGeo = createLugEarGeometry(earW, earW * 0.45, earL, Math.max(0.006, thick), earW * 0.16);
      earGeo.rotateZ(-Math.PI / 2);
      const ear = new THREE.Mesh(earGeo, copperMat);
      ear.position.set(parentR + radExplode * 0.5, 0, 0);
      holder.add(ear);

      // Grounding bolt + washer + hex nut
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, thick * 2.8, 6), boltMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(parentR + earL * 0.62 + radExplode * 0.5, 0, 0);
      holder.add(bolt);

      g.add(holder);
      return g;
    }

    // 14. 管座 (HG/T 21584 锻制仪表/放空管座 + 内螺纹孔)
    case 'pipe_boss': {
      // sizeA = 管座外径 OD (mm), sizeB = 伸出长度 L (mm)
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const bossOD = Math.max(0.032, sizeA);
      const bossH = Math.max(0.05, sizeB);
      const bossGeo = makeHollowRing(bossOD * 0.28, bossOD * 0.5, bossH, 24);
      bossGeo.rotateZ(-Math.PI / 2);
      const boss = new THREE.Mesh(bossGeo, mat);
      boss.position.set(parentR + bossH * 0.45 + radExplode, 0, 0);
      holder.add(boss);

      // Hex wrench collar at outer tip
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(bossOD * 0.56, bossOD * 0.56, bossH * 0.28, 6), boltMat);
      hex.rotation.z = -Math.PI / 2;
      hex.position.set(parentR + bossH * 0.82 + radExplode, 0, 0);
      holder.add(hex);

      g.add(holder);
      return g;
    }

    // 15. 防涡流板 (十字交叉破涡器 + 顶部圆形抑涡盖板)
    case 'vortex_breaker': {
      // sizeA = 防涡板跨径 (mm), sizeB = 叶片高度 H (mm)
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const span = Math.max(0.14, sizeA);
      const h = Math.max(0.08, sizeB);
      const plate1 = new THREE.Mesh(new THREE.BoxGeometry(h, span, thick), mat);
      const plate2 = new THREE.Mesh(new THREE.BoxGeometry(h, thick, span), mat);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(span * 0.42, span * 0.42, thick, 24), mat);
      cap.rotation.z = Math.PI / 2;

      const baseR = Math.max(0.1, parentR - h * 0.65);
      plate1.position.x = baseR;
      plate2.position.x = baseR;
      cap.position.x = baseR - h * 0.5;
      holder.add(plate1, plate2, cap);

      g.add(holder);
      return g;
    }

    // 16. 底部孔板 (多孔均匀分布圆形孔板)
    case 'bottom_orifice': {
      const discR = Math.max(0.15, Math.min(parentR - 0.025, sizeA * 0.5 || parentR * 0.75));
      const shape = new THREE.Shape();
      shape.absarc(0, 0, discR, 0, Math.PI * 2, false);

      // Punch authentic array of circular flow distribution holes
      const holeR = Math.max(0.012, discR * 0.085);
      const rings = 2;
      for (let rIdx = 1; rIdx <= rings; rIdx++) {
        const rr = (rIdx / (rings + 0.7)) * discR;
        const nHoles = rIdx * 6;
        for (let k = 0; k < nHoles; k++) {
          const a = (k / nHoles) * Math.PI * 2;
          const hPath = new THREE.Path();
          hPath.absarc(Math.cos(a) * rr, Math.sin(a) * rr, holeR, 0, Math.PI * 2, true);
          shape.holes.push(hPath);
        }
      }
      const centerHole = new THREE.Path();
      centerHole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
      shape.holes.push(centerHole);

      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 32 });
      geo.rotateX(Math.PI / 2);
      const disc = new THREE.Mesh(geo, mat);
      disc.position.set(parentEccentricX, axialY, 0);
      g.add(disc);
      return g;
    }

    // 17. 基础模板 (圆形地脚螺栓预埋钢模板 + 定位套筒组)
    case 'foundation_template': {
      // sizeA = 模板外径 OD (mm), sizeB = 环板宽度 W (mm)
      const tplOuter = Math.max(parentR + 0.06, sizeA * 0.5);
      const ringWidth = Math.max(0.08, Math.min(tplOuter - 0.1, sizeB));
      const tplInner = Math.max(0.1, tplOuter - ringWidth);
      const ring = new THREE.Mesh(makeHollowRing(tplInner, tplOuter, Math.max(0.012, thick), 48), mat);
      ring.position.set(parentEccentricX, parentStartM - 0.05 - radExplode, 0);
      g.add(ring);

      // Anchor bolt positioning sleeves around BCD
      const bcdR = (tplInner + tplOuter) * 0.5;
      const sleeveCount = 12;
      const sleeveH = Math.max(0.07, Math.min(0.16, thick * 6));
      const sleeveGeo = new THREE.CylinderGeometry(0.02, 0.02, sleeveH, 12);
      for (let i = 0; i < sleeveCount; i++) {
        const a = (i / sleeveCount) * Math.PI * 2;
        const sl = new THREE.Mesh(sleeveGeo, boltMat);
        sl.position.set(
          parentEccentricX + Math.cos(a) * bcdR,
          parentStartM - 0.05 - radExplode,
          Math.sin(a) * bcdR
        );
        g.add(sl);
      }
      return g;
    }

    // 18. 气体出口挡板 (弧形折流气相出口罩 + 双侧加强立筋)
    case 'gas_outlet_baffle': {
      const holder = new THREE.Group();
      holder.position.set(parentEccentricX, axialY, 0);
      holder.rotation.y = -angRad;

      const hoodR = Math.max(0.12, parentR - 0.14);
      const hood = createCurvedPadMesh(hoodR, sizeA * 1.15, sizeB * 1.1, thick, mat);
      holder.add(hood);

      // Side enclosure walls & stiffening ribs
      for (const dy of [-sizeB * 0.52, sizeB * 0.52]) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, thick, sizeA * 0.82), mat);
        sideWall.position.set(hoodR + 0.07, dy, 0);
        holder.add(sideWall);
      }
      g.add(holder);
      return g;
    }

    default:
      return null;
  }
}
