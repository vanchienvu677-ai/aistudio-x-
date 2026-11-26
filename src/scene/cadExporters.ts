import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type Export3DFormat =
  | 'step'
  | 'iges'
  | 'stl_bin'
  | 'stl_ascii'
  | 'glb'
  | 'obj';

export interface SceneMeshStats {
  meshCount: number;
  triangleCount: number;
  sizeMm: [number, number, number];
}

interface ExtractedGroup {
  name: string;
  colorHex: string;
  rgb: [number, number, number];
  triangles: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]>; // a, b, c, normal
}

function sanitizeCadName(raw: string, fallback = 'GHPV_Part'): string {
  const cleaned = raw
    .replace(/[^\w\u4e00-\u9fa5-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

function sanitizeAsciiName(raw: string, fallback = 'GHPV_PART'): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

function findMeaningfulGroupName(obj: THREE.Object3D): string {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (
      curr.name &&
      curr.name !== 'GHPV_ModelRoot' &&
      !curr.name.startsWith('装配点') &&
      curr.name.trim().length > 0
    ) {
      return curr.name.trim();
    }
    curr = curr.parent;
  }
  return 'VesselPart';
}

function getMeshColor(mesh: THREE.Mesh): { hex: string; rgb: [number, number, number] } {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const col = (mat as THREE.MeshStandardMaterial | undefined)?.color;
  if (col) {
    return {
      hex: col.getHexString(),
      rgb: [col.r, col.g, col.b],
    };
  }
  return { hex: '94a3b8', rgb: [0.58, 0.64, 0.72] };
}

/**
 * Compute live triangle count, mesh count, and bounding box dimensions (in mm) for a Three.js scene root.
 */
export function computeSceneMeshStats(root: THREE.Object3D): SceneMeshStats {
  root.updateMatrixWorld(true);
  let meshCount = 0;
  let triangleCount = 0;

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;
    const isInst = (mesh as THREE.InstancedMesh).isInstancedMesh;
    const instances = isInst ? (mesh as THREE.InstancedMesh).count : 1;
    const triPerMesh = geo.index ? Math.floor(geo.index.count / 3) : Math.floor(pos.count / 3);
    meshCount += instances;
    triangleCount += triPerMesh * instances;
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getSize(size);
  }
  return {
    meshCount,
    triangleCount,
    sizeMm: [
      Math.round(size.x * 1000),
      Math.round(size.y * 1000),
      Math.round(size.z * 1000),
    ],
  };
}

/**
 * Collect world-space triangles grouped by component name (handles both Mesh and InstancedMesh).
 */
function collectGroupedTriangles(
  root: THREE.Object3D,
  unit: 'mm' | 'm',
  maxTriangles = Infinity
): { groups: ExtractedGroup[]; totalTriangles: number } {
  root.updateMatrixWorld(true);
  const scale = unit === 'mm' ? 1000 : 1;

  // First pass: count total triangles to determine uniform stride if decimation is needed
  let rawTotal = 0;
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;
    const isInst = (mesh as THREE.InstancedMesh).isInstancedMesh;
    const instances = isInst ? (mesh as THREE.InstancedMesh).count : 1;
    const triPerMesh = geo.index ? Math.floor(geo.index.count / 3) : Math.floor(pos.count / 3);
    rawTotal += triPerMesh * instances;
  });

  const stride = rawTotal > maxTriangles ? Math.ceil(rawTotal / maxTriangles) : 1;
  const groupMap = new Map<string, ExtractedGroup>();

  const instMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  let triCounter = 0;
  let keptTotal = 0;

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
    const mesh = obj as THREE.Mesh;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;

    const index = geo.index;
    const isInst = (mesh as THREE.InstancedMesh).isInstancedMesh;
    const instances = isInst ? (mesh as THREE.InstancedMesh).count : 1;
    const groupName = sanitizeCadName(findMeaningfulGroupName(mesh), 'VesselPart');
    const colInfo = getMeshColor(mesh);
    const key = `${groupName}__${colInfo.hex}`;

    let grp = groupMap.get(key);
    if (!grp) {
      grp = {
        name: groupName,
        colorHex: colInfo.hex,
        rgb: colInfo.rgb,
        triangles: [],
      };
      groupMap.set(key, grp);
    }

    for (let k = 0; k < instances; k++) {
      if (isInst) {
        (mesh as THREE.InstancedMesh).getMatrixAt(k, instMat);
        worldMat.multiplyMatrices(mesh.matrixWorld, instMat);
      } else {
        worldMat.copy(mesh.matrixWorld);
      }

      const triCount = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);
      for (let t = 0; t < triCount; t++) {
        triCounter++;
        if (stride > 1 && triCounter % stride !== 0) continue;

        const i0 = index ? index.getX(t * 3) : t * 3;
        const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

        const a = new THREE.Vector3().fromBufferAttribute(pos, i0).applyMatrix4(worldMat).multiplyScalar(scale);
        const b = new THREE.Vector3().fromBufferAttribute(pos, i1).applyMatrix4(worldMat).multiplyScalar(scale);
        const c = new THREE.Vector3().fromBufferAttribute(pos, i2).applyMatrix4(worldMat).multiplyScalar(scale);

        cb.subVectors(c, b);
        ab.subVectors(a, b);
        const normal = new THREE.Vector3().crossVectors(cb, ab);
        if (normal.lengthSq() < 1e-12) continue;
        normal.normalize();

        grp.triangles.push([a, b, c, normal]);
        keptTotal++;
      }
    }
  });

  return {
    groups: Array.from(groupMap.values()).filter((g) => g.triangles.length > 0),
    totalTriangles: keptTotal,
  };
}

/**
 * Export Three.js scene to compact Binary STL (.stl) — SolidWorks / FreeCAD / 3D Printing standard.
 */
export function exportSceneToBinaryStl(
  root: THREE.Object3D,
  modelName = 'GHPV_Vessel',
  unit: 'mm' | 'm' = 'mm'
): ArrayBuffer {
  const { groups, totalTriangles } = collectGroupedTriangles(root, unit);
  const bufferLength = 84 + totalTriangles * 50;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const headerText = `GHPV V2.1 Binary STL (${sanitizeAsciiName(modelName)}) Unit:${unit}`;
  for (let i = 0; i < Math.min(80, headerText.length); i++) {
    view.setUint8(i, headerText.charCodeAt(i));
  }
  view.setUint32(80, totalTriangles, true);

  let offset = 84;
  for (const grp of groups) {
    for (const [a, b, c, n] of grp.triangles) {
      view.setFloat32(offset, n.x, true); offset += 4;
      view.setFloat32(offset, n.y, true); offset += 4;
      view.setFloat32(offset, n.z, true); offset += 4;

      view.setFloat32(offset, a.x, true); offset += 4;
      view.setFloat32(offset, a.y, true); offset += 4;
      view.setFloat32(offset, a.z, true); offset += 4;

      view.setFloat32(offset, b.x, true); offset += 4;
      view.setFloat32(offset, b.y, true); offset += 4;
      view.setFloat32(offset, b.z, true); offset += 4;

      view.setFloat32(offset, c.x, true); offset += 4;
      view.setFloat32(offset, c.y, true); offset += 4;
      view.setFloat32(offset, c.z, true); offset += 4;

      view.setUint16(offset, 0, true); offset += 2;
    }
  }

  return arrayBuffer;
}

/**
 * Export Three.js scene to ASCII STL (.stl) with configurable unit (mm or m).
 */
export function exportSceneToAsciiStlWithUnit(
  root: THREE.Object3D,
  modelName = 'GHPV_Vessel',
  unit: 'mm' | 'm' = 'mm'
): string {
  const safeName = sanitizeAsciiName(modelName);
  const { groups } = collectGroupedTriangles(root, unit);
  const lines: string[] = [`solid ${safeName}`];
  const prec = unit === 'mm' ? 2 : 5;

  for (const grp of groups) {
    for (const [a, b, c, n] of grp.triangles) {
      lines.push(`  facet normal ${n.x.toFixed(5)} ${n.y.toFixed(5)} ${n.z.toFixed(5)}`);
      lines.push('    outer loop');
      lines.push(`      vertex ${a.x.toFixed(prec)} ${a.y.toFixed(prec)} ${a.z.toFixed(prec)}`);
      lines.push(`      vertex ${b.x.toFixed(prec)} ${b.y.toFixed(prec)} ${b.z.toFixed(prec)}`);
      lines.push(`      vertex ${c.x.toFixed(prec)} ${c.y.toFixed(prec)} ${c.z.toFixed(prec)}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    }
  }

  lines.push(`endsolid ${safeName}`);
  return lines.join('\n');
}

/**
 * Export Three.js scene to Wavefront OBJ + MTL preserving GHPV component groups and colors.
 */
export function exportSceneToObjAndMtl(
  root: THREE.Object3D,
  modelName = 'GHPV_Vessel',
  unit: 'mm' | 'm' = 'mm'
): { obj: string; mtl: string } {
  const safeName = sanitizeAsciiName(modelName);
  const { groups } = collectGroupedTriangles(root, unit);
  const prec = unit === 'mm' ? 2 : 5;

  const objLines: string[] = [
    `# GHPV V2.1 3D Pressure Vessel Export (Wavefront OBJ)`,
    `# Model: ${modelName} | Unit: ${unit}`,
    `mtllib ${safeName}.mtl`,
  ];
  const mtlLines: string[] = [
    `# GHPV V2.1 Material Library for ${modelName}`,
  ];

  const emittedMtls = new Set<string>();
  let vIndex = 1;
  let vnIndex = 1;

  for (let gi = 0; gi < groups.length; gi++) {
    const grp = groups[gi];
    const mtlName = `mat_${grp.colorHex}`;
    if (!emittedMtls.has(mtlName)) {
      emittedMtls.add(mtlName);
      mtlLines.push(
        `newmtl ${mtlName}`,
        `Ka ${(grp.rgb[0] * 0.25).toFixed(4)} ${(grp.rgb[1] * 0.25).toFixed(4)} ${(grp.rgb[2] * 0.25).toFixed(4)}`,
        `Kd ${grp.rgb[0].toFixed(4)} ${grp.rgb[1].toFixed(4)} ${grp.rgb[2].toFixed(4)}`,
        `Ks 0.3500 0.3500 0.3500`,
        `Ns 64.0`,
        `d 1.0`,
        ''
      );
    }

    objLines.push(`g ${grp.name}_${gi + 1}`);
    objLines.push(`usemtl ${mtlName}`);

    for (const [a, b, c, n] of grp.triangles) {
      objLines.push(`v ${a.x.toFixed(prec)} ${a.y.toFixed(prec)} ${a.z.toFixed(prec)}`);
      objLines.push(`v ${b.x.toFixed(prec)} ${b.y.toFixed(prec)} ${b.z.toFixed(prec)}`);
      objLines.push(`v ${c.x.toFixed(prec)} ${c.y.toFixed(prec)} ${c.z.toFixed(prec)}`);
      objLines.push(`vn ${n.x.toFixed(5)} ${n.y.toFixed(5)} ${n.z.toFixed(5)}`);
      objLines.push(`f ${vIndex}//${vnIndex} ${vIndex + 1}//${vnIndex} ${vIndex + 2}//${vnIndex}`);
      vIndex += 3;
      vnIndex += 1;
    }
  }

  return {
    obj: objLines.join('\n'),
    mtl: mtlLines.join('\n'),
  };
}

/**
 * Export Three.js scene to ISO-10303-21 STEP AP214 (.stp) using FACETED_BREP / POLY_LOOP.
 * Compatible with SolidWorks, AutoCAD Plant 3D, Creo, NX, Inventor, FreeCAD.
 */
export function exportSceneToStepAp214(
  root: THREE.Object3D,
  modelName = 'GHPV_Vessel',
  unit: 'mm' | 'm' = 'mm'
): string {
  const safeName = sanitizeAsciiName(modelName);
  const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '');
  // Cap facets at 10,000 so STEP files generate in <150ms in-browser and open cleanly in SolidWorks
  const { groups } = collectGroupedTriangles(root, unit, 10000);
  const prec = unit === 'mm' ? 2 : 5;

  const lines: string[] = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('GHPV V2.1 Pressure Vessel 3D Model (${unit})'),'2;1');`,
    `FILE_NAME('${safeName}.stp','${timestamp}',('GHPV Engineer'),('GHPV Digital Delivery'),'GHPV V2.1','GHPV CAD Engine','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));`,
    'ENDSEC;',
    'DATA;',
    `#1=APPLICATION_CONTEXT('automotive design');`,
    `#2=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#1);`,
    `#3=PRODUCT_CONTEXT('',#1,'mechanical');`,
    `#4=PRODUCT('${safeName}','${safeName}','Pressure Vessel exported by GHPV V2.1',(#3));`,
    `#5=PRODUCT_DEFINITION_FORMATION('1','',#4);`,
    `#6=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');`,
    `#7=PRODUCT_DEFINITION('design','',#5,#6);`,
    `#8=PRODUCT_DEFINITION_SHAPE('','',#7);`,
    unit === 'mm'
      ? `#9=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));`
      : `#9=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT($,.METRE.));`,
    `#10=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));`,
    `#11=(NAMED_UNIT(*)SOLID_ANGLE_UNIT()SI_UNIT($,.STERADIAN.));`,
    `#12=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.01),#9,'distance_accuracy_value','confusion accuracy');`,
    `#13=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#12))GLOBAL_UNIT_ASSIGNED_CONTEXT((#9,#10,#11))REPRESENTATION_CONTEXT('Context3D','3D Context'));`,
    `#14=CARTESIAN_POINT('Origin',(0.,0.,0.));`,
    `#15=DIRECTION('Z',(0.,0.,1.));`,
    `#16=DIRECTION('X',(1.,0.,0.));`,
    `#17=AXIS2_PLACEMENT_3D('WorldAxis',#14,#15,#16);`,
  ];

  let nextId = 20;
  const brepIds: number[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const grp = groups[gi];
    const partLabel = sanitizeAsciiName(grp.name, `Part_${gi + 1}`);
    const faceIds: number[] = [];

    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const norm = new THREE.Vector3();
    const refDir = new THREE.Vector3();

    for (const [a, b, c] of grp.triangles) {
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      norm.crossVectors(e1, e2);
      if (norm.lengthSq() < 1e-12) continue;
      norm.normalize();
      refDir.copy(e1).normalize();

      const p1 = nextId++;
      const p2 = nextId++;
      const p3 = nextId++;
      const dirN = nextId++;
      const dirR = nextId++;
      const axId = nextId++;
      const planeId = nextId++;
      const loopId = nextId++;
      const boundId = nextId++;
      const faceId = nextId++;

      lines.push(`#${p1}=CARTESIAN_POINT('',(${a.x.toFixed(prec)},${a.y.toFixed(prec)},${a.z.toFixed(prec)}));`);
      lines.push(`#${p2}=CARTESIAN_POINT('',(${b.x.toFixed(prec)},${b.y.toFixed(prec)},${b.z.toFixed(prec)}));`);
      lines.push(`#${p3}=CARTESIAN_POINT('',(${c.x.toFixed(prec)},${c.y.toFixed(prec)},${c.z.toFixed(prec)}));`);
      lines.push(`#${dirN}=DIRECTION('',(${norm.x.toFixed(6)},${norm.y.toFixed(6)},${norm.z.toFixed(6)}));`);
      lines.push(`#${dirR}=DIRECTION('',(${refDir.x.toFixed(6)},${refDir.y.toFixed(6)},${refDir.z.toFixed(6)}));`);
      lines.push(`#${axId}=AXIS2_PLACEMENT_3D('',#${p1},#${dirN},#${dirR});`);
      lines.push(`#${planeId}=PLANE('',#${axId});`);
      lines.push(`#${loopId}=POLY_LOOP('',(#${p1},#${p2},#${p3}));`);
      lines.push(`#${boundId}=FACE_OUTER_BOUND('',#${loopId},.T.);`);
      lines.push(`#${faceId}=FACE_SURFACE('',(#${boundId}),#${planeId},.T.);`);
      faceIds.push(faceId);
    }

    if (faceIds.length > 0) {
      const shellId = nextId++;
      const brepId = nextId++;
      lines.push(`#${shellId}=CLOSED_SHELL('${partLabel}',(${faceIds.map((id) => `#${id}`).join(',')}));`);
      lines.push(`#${brepId}=FACETED_BREP('${partLabel}',#${shellId});`);
      brepIds.push(brepId);
    }
  }

  const repId = nextId++;
  const relId = nextId++;
  const itemsList = [`#17`, ...brepIds.map((id) => `#${id}`)].join(',');
  lines.push(`#${repId}=FACETED_BREP_SHAPE_REPRESENTATION('${safeName}',(${itemsList}),#13);`);
  lines.push(`#${relId}=SHAPE_DEFINITION_REPRESENTATION(#8,#${repId});`);
  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}

function padIgesLine(content: string, sectionChar: 'S' | 'G' | 'D' | 'P' | 'T', seq: number, pDirPtr?: number): string {
  const seqStr = String(seq).padStart(7, ' ');
  if (sectionChar === 'P') {
    const body = content.slice(0, 64).padEnd(64, ' ');
    const ptrStr = String(pDirPtr ?? 1).padStart(8, ' ');
    return `${body}${ptrStr}P${seqStr}`;
  }
  const body = content.slice(0, 72).padEnd(72, ' ');
  return `${body}${sectionChar}${seqStr}`;
}

/**
 * Export Three.js scene to strict 80-column IGES 5.3 (.igs) using 3D Facet Copious Data (Entity 106 Form 12).
 */
export function exportSceneToIges(
  root: THREE.Object3D,
  modelName = 'GHPV_Vessel',
  unit: 'mm' | 'm' = 'mm'
): string {
  const safeName = sanitizeAsciiName(modelName);
  const { groups } = collectGroupedTriangles(root, unit, 8000);
  const prec = unit === 'mm' ? 2 : 5;

  const sLines = [
    padIgesLine(`GHPV V2.1 Pressure Vessel 3D Model (${safeName})`, 'S', 1),
  ];

  const unitFlag = unit === 'mm' ? 2 : 6;
  const unitStr = unit === 'mm' ? '2HMM' : '1HM';
  const hollerithName = `${safeName.length}H${safeName}`;
  const igsFileName = `${safeName}.igs`;
  const hollerithFile = `${igsFileName.length}H${igsFileName}`;
  const gPayload = `1H,,1H;,${hollerithName},${hollerithFile},8HGHPV_2.1,8HGHPV_CAD,32,38,6,308,15,${hollerithName},1.0,${unitFlag},${unitStr},1,0.1,15H20260101.000000,0.01,100000.,13HGHPV_Engineer,4HGHPV,11,0;`;

  const gLines: string[] = [];
  for (let i = 0; i < gPayload.length; i += 72) {
    gLines.push(padIgesLine(gPayload.slice(i, i + 72), 'G', gLines.length + 1));
  }

  const dLines: string[] = [];
  const pLines: string[] = [];

  for (const grp of groups) {
    for (const [a, b, c] of grp.triangles) {
      const dirIndex = dLines.length + 1;
      const paramStart = pLines.length + 1;

      // Entity 106 Form 12: 3D Closed Polyline (4 points: A -> B -> C -> A)
      const pContent = `106,2,4,${a.x.toFixed(prec)},${a.y.toFixed(prec)},${a.z.toFixed(prec)},${b.x.toFixed(prec)},${b.y.toFixed(prec)},${b.z.toFixed(prec)},${c.x.toFixed(prec)},${c.y.toFixed(prec)},${c.z.toFixed(prec)},${a.x.toFixed(prec)},${a.y.toFixed(prec)},${a.z.toFixed(prec)};`;
      const pChunks: string[] = [];
      for (let i = 0; i < pContent.length; i += 64) {
        pChunks.push(pContent.slice(i, i + 64));
      }
      for (const chunk of pChunks) {
        pLines.push(padIgesLine(chunk, 'P', pLines.length + 1, dirIndex));
      }

      const f8 = (v: number | string) => String(v).padStart(8, ' ');
      const d1 = `${f8(106)}${f8(paramStart)}${f8(0)}${f8(1)}${f8(0)}${f8(0)}${f8(0)}${f8(0)}${f8('00000000')}`;
      const d2 = `${f8(106)}${f8(0)}${f8(0)}${f8(pChunks.length)}${f8(12)}${f8(0)}${f8(0)}${f8('FACET')}${f8(0)}`;
      dLines.push(padIgesLine(d1, 'D', dirIndex));
      dLines.push(padIgesLine(d2, 'D', dirIndex + 1));
    }
  }

  const tSummary = `S${String(sLines.length).padStart(7, '0')}G${String(gLines.length).padStart(7, '0')}D${String(dLines.length).padStart(7, '0')}P${String(pLines.length).padStart(7, '0')}`;
  const tLines = [padIgesLine(tSummary, 'T', 1)];

  return [...sLines, ...gLines, ...dLines, ...pLines, ...tLines].join('\n');
}

/**
 * Export Three.js scene to binary glTF 2.0 (.glb) using Three.js GLTFExporter.
 */
export async function exportSceneToGlb(root: THREE.Object3D): Promise<ArrayBuffer> {
  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          const json = JSON.stringify(result);
          resolve(new TextEncoder().encode(json).buffer);
        }
      },
      (err) => {
        reject(err instanceof Error ? err : new Error('GLB 导出失败'));
      },
      { binary: true }
    );
  });
}

/**
 * Load an external 3D CAD mesh file (.stl, .obj, .glb, .gltf) into a normalized Three.js Group
 * ready to be inspected in GHPV Viewport3D (with auto mm->m scaling and industrial PBR material).
 */
export async function loadExternal3DModelBuffer(
  fileName: string,
  buffer: ArrayBuffer
): Promise<{ name: string; object: THREE.Group; stats: SceneMeshStats }> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const root = new THREE.Group();
  root.name = sanitizeCadName(fileName.replace(/\.[^.]+$/, ''), 'Imported3D');

  const defaultSteelMat = () =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7fa7c9'),
      roughness: 0.36,
      metalness: 0.42,
      side: THREE.DoubleSide,
    });

  if (ext === 'stl') {
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, defaultSteelMat());
    mesh.name = root.name;
    root.add(mesh);
  } else if (ext === 'obj') {
    const loader = new OBJLoader();
    const text = new TextDecoder('utf-8').decode(buffer);
    const objGroup = loader.parse(text);
    objGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (!m.geometry.attributes.normal) {
          m.geometry.computeVertexNormals();
        }
        m.material = defaultSteelMat();
      }
    });
    root.add(objGroup);
  } else if (ext === 'glb' || ext === 'gltf') {
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(
        buffer,
        '',
        (res) => resolve(res as unknown as { scene: THREE.Group }),
        (err) => reject(err instanceof Error ? err : new Error('glTF/GLB 解析失败'))
      );
    });
    root.add(gltf.scene);
  } else {
    throw new Error(`暂不支持直接渲染 .${ext} 网格格式，请使用 .stl / .obj / .glb / .gltf 或 .ghpv 工程文件。`);
  }

  // Auto-normalize CAD millimeter scale -> Three.js meters (GHPV internal scene unit)
  root.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(root);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);

  if (maxDim > 80) {
    // Almost certainly exported in millimeters (e.g. SolidWorks / GHPV STL/OBJ)
    root.scale.setScalar(0.001);
  } else if (maxDim > 0 && maxDim < 0.05) {
    root.scale.setScalar(100);
  }

  root.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  root.position.sub(center);
  root.updateMatrixWorld(true);

  const stats = computeSceneMeshStats(root);
  return { name: fileName, object: root, stats };
}
