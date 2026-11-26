import { unzipSync, gunzipSync, unzlibSync } from 'fflate';
import type {
  AiNozzleSpec,
  AiParsedVesselSpec,
  AssemblyPoint,
  ComponentType,
  RgbaColor,
  TechnicalSpec,
  VesselComponent,
} from '../types/vessel';
import { buildVesselFromAiSpec } from './vesselMath';

export interface GhpvArchiveEntry {
  name: string;
  sizeBytes: number;
  kind: 'JSON' | 'XML' | '3D网格' | 'BRep几何' | '文本/参数' | '图片' | '二进制';
}

export interface GhpvEmbeddedMesh {
  name: string;
  ext: string;
  data: Uint8Array;
}

export interface GhpvImportResult {
  sourceFormat: 'ghpv_json' | 'ghpv_xml_text' | 'ghpv_zip_archive' | 'ghpv_legacy_binary';
  fileName: string;
  spec: TechnicalSpec;
  assemblies: AssemblyPoint[];
  summary: string;
  warnings?: string[];
  extractedText?: string;
  extraMetadata?: Array<{ key: string; value: string }>;
  archiveEntries?: GhpvArchiveEntry[];
  embeddedMeshes?: GhpvEmbeddedMesh[];
  reboundAttachmentCount?: number;
  componentCount: number;
}

const DEFAULT_SPEC: TechnicalSpec = {
  vesselTag: 'V-101',
  vesselName: '导入的高惠压力容器',
  designCode: 'GB/T 150.1~150.4-2024',
  vesselClass: '二类 (第II类)',
  designPressure: 1.6,
  workPressure: 1.3,
  testPressure: 2.0,
  designTemp: 150,
  workTemp: 110,
  medium: '工艺介质',
  corrosionAllowance: 2,
  weldEfficiency: 1.0,
  ndtMethod: '100% RT (NB/T 47013.2-II级)',
  heatTreatment: '焊后消除应力热处理',
  companyName: '高惠PV压力容器数字化交付系统',
  projectName: '导入的高惠工程模型',
  drawingNo: 'GHPV-IMP-01',
};

const KNOWN_SPEC_KEYS = new Set<string>(Object.keys(DEFAULT_SPEC));

const VALID_MAIN_TYPES = new Set<string>([
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
]);

const VALID_ATTACHMENT_TYPES = new Set<string>([
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
]);

function countComponents(assemblies: AssemblyPoint[]): number {
  return assemblies.reduce(
    (sum, ap) => sum + (Array.isArray(ap.components) ? ap.components.length : 0),
    0
  );
}

function clampByte(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function sanitizeColor(raw: unknown): RgbaColor {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      r: clampByte(obj.r, 196),
      g: clampByte(obj.g, 136),
      b: clampByte(obj.b, 32),
      a: clampByte(obj.a, 255),
    };
  }
  return { r: 196, g: 136, b: 32, a: 255 };
}

function sanitizeImportedAssemblies(rawAssemblies: unknown): {
  assemblies: AssemblyPoint[];
  droppedCount: number;
  reboundCount: number;
} {
  if (!Array.isArray(rawAssemblies)) {
    return { assemblies: [], droppedCount: 0, reboundCount: 0 };
  }

  let droppedCount = 0;
  let reboundCount = 0;
  const assemblies: AssemblyPoint[] = [];

  for (let i = 0; i < rawAssemblies.length; i++) {
    const rawAp = rawAssemblies[i];
    if (!rawAp || typeof rawAp !== 'object') {
      droppedCount++;
      continue;
    }
    const apObj = rawAp as Record<string, unknown>;
    const orientation = apObj.orientation === 'vertical' ? 'vertical' : 'horizontal';
    const x = Number.isFinite(Number(apObj.x)) ? Number(apObj.x) : 0;
    const y = Number.isFinite(Number(apObj.y)) ? Number(apObj.y) : 0;
    const z = Number.isFinite(Number(apObj.z)) ? Number(apObj.z) : 0;
    const rawComps = Array.isArray(apObj.components) ? apObj.components : [];
    const components: VesselComponent[] = [];

    for (let j = 0; j < rawComps.length; j++) {
      const rawComp = rawComps[j];
      if (!rawComp || typeof rawComp !== 'object') {
        droppedCount++;
        continue;
      }
      const cObj = rawComp as Record<string, unknown>;
      const typeStr = typeof cObj.type === 'string' ? cObj.type : '';
      const isMain = VALID_MAIN_TYPES.has(typeStr);
      const isAttach = VALID_ATTACHMENT_TYPES.has(typeStr);
      if (!isMain && !isAttach) {
        droppedCount++;
        continue;
      }
      if (!cObj.params || typeof cObj.params !== 'object' || Array.isArray(cObj.params)) {
        droppedCount++;
        continue;
      }

      components.push({
        id:
          typeof cObj.id === 'string' && cObj.id.trim()
            ? cObj.id.trim()
            : `imp-comp-${i + 1}-${j + 1}`,
        name:
          typeof cObj.name === 'string' && cObj.name.trim()
            ? cObj.name.trim()
            : `${typeStr}_${j + 1}`,
        type: typeStr as ComponentType,
        category: isMain ? 'main' : 'attachment',
        parentId: typeof cObj.parentId === 'string' ? cObj.parentId : undefined,
        visible: cObj.visible !== false,
        color: sanitizeColor(cObj.color),
        params: cObj.params as VesselComponent['params'],
        subNodes: Array.isArray(cObj.subNodes)
          ? cObj.subNodes.filter((s): s is string => typeof s === 'string')
          : undefined,
      });
    }

    // Ensure every attachment has a valid parentId so none disappear from StructureTree
    const mainIds = new Set(components.filter((c) => c.category === 'main').map((c) => c.id));
    const fallbackMain =
      components.find((c) => c.type === 'shell' || c.type === 'spherical_tank') ||
      components.find((c) => c.category === 'main');
    if (fallbackMain) {
      for (const comp of components) {
        if (comp.category === 'attachment' && (!comp.parentId || !mainIds.has(comp.parentId))) {
          comp.parentId = fallbackMain.id;
          reboundCount++;
        }
      }
    }

    assemblies.push({
      id:
        typeof apObj.id === 'string' && apObj.id.trim()
          ? apObj.id.trim()
          : `imp-ap-${i + 1}`,
      name:
        typeof apObj.name === 'string' && apObj.name.trim()
          ? apObj.name.trim()
          : `装配点${i + 1}`,
      x,
      ...(y !== 0 ? { y } : {}),
      z,
      orientation,
      components,
    });
  }

  return { assemblies, droppedCount, reboundCount };
}

function sanitizeSpec(raw: unknown): TechnicalSpec {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SPEC };
  const src = raw as Record<string, unknown>;
  const pickStr = (k: keyof TechnicalSpec, fb: string) =>
    typeof src[k] === 'string' && (src[k] as string).trim().length > 0
      ? (src[k] as string).trim()
      : fb;
  const pickNum = (k: keyof TechnicalSpec, fb: number) => {
    const n = Number(src[k]);
    return Number.isFinite(n) ? n : fb;
  };
  return {
    vesselTag: pickStr('vesselTag', DEFAULT_SPEC.vesselTag),
    vesselName: pickStr('vesselName', DEFAULT_SPEC.vesselName),
    designCode: pickStr('designCode', DEFAULT_SPEC.designCode),
    vesselClass: pickStr('vesselClass', DEFAULT_SPEC.vesselClass),
    designPressure: pickNum('designPressure', DEFAULT_SPEC.designPressure),
    workPressure: pickNum('workPressure', DEFAULT_SPEC.workPressure),
    testPressure: pickNum('testPressure', DEFAULT_SPEC.testPressure),
    designTemp: pickNum('designTemp', DEFAULT_SPEC.designTemp),
    workTemp: pickNum('workTemp', DEFAULT_SPEC.workTemp),
    medium: pickStr('medium', DEFAULT_SPEC.medium),
    corrosionAllowance: pickNum('corrosionAllowance', DEFAULT_SPEC.corrosionAllowance),
    weldEfficiency: pickNum('weldEfficiency', DEFAULT_SPEC.weldEfficiency),
    ndtMethod: pickStr('ndtMethod', DEFAULT_SPEC.ndtMethod),
    heatTreatment: pickStr('heatTreatment', DEFAULT_SPEC.heatTreatment),
    companyName: pickStr('companyName', DEFAULT_SPEC.companyName),
    projectName: pickStr('projectName', DEFAULT_SPEC.projectName),
    drawingNo: pickStr('drawingNo', DEFAULT_SPEC.drawingNo),
  };
}

function collectJsonExtraMetadata(
  root: Record<string, unknown>,
  rawSpec: unknown
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const seen = new Set<string>();
  const addEntry = (key: string, val: unknown) => {
    if (val === undefined || val === null) return;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      const str = String(val).trim();
      if (!str || seen.has(key)) return;
      seen.add(key);
      out.push({ key, value: str.slice(0, 200) });
    }
  };

  for (const [k, v] of Object.entries(root)) {
    if (k === 'spec' || k === 'assemblies' || k === 'parsed') continue;
    addEntry(k, v);
  }
  if (rawSpec && typeof rawSpec === 'object' && !Array.isArray(rawSpec)) {
    for (const [k, v] of Object.entries(rawSpec as Record<string, unknown>)) {
      if (KNOWN_SPEC_KEYS.has(k)) continue;
      addEntry(k, v);
    }
  }
  return out.slice(0, 40);
}

const MAPPED_TEXT_META_KEYS = new Set([
  'vesseltag',
  'vesselname',
  'equipmentname',
  'vesselclass',
  'designcode',
  'designpressure',
  'workpressure',
  'testpressure',
  'designtemp',
  'worktemp',
  'medium',
  'corrosionallowance',
  'weldefficiency',
  'ndt',
  'ndtmethod',
  'heattreatment',
  'drawingno',
  'projectname',
  'companyname',
  'designunit',
  '设备位号',
  '设备名称',
  '容器类别',
  '设计标准',
  '设计规范',
  '设计压力',
  '工作压力',
  '试验压力',
  '设计温度',
  '工作温度',
  '工作介质',
  '介质',
  '腐蚀裕量',
  '焊缝系数',
  '无损检测',
  '热处理',
  '图号',
  '项目名称',
  '设计单位',
]);

function collectTextExtraMetadata(text: string): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const seen = new Set<string>();
  const add = (k: string, v: string) => {
    const ck = k.trim();
    const cv = v.trim().replace(/\s+/g, ' ');
    if (!ck || !cv || ck.length > 40 || cv.length > 160) return;
    const id = ck.toLowerCase();
    if (seen.has(id) || MAPPED_TEXT_META_KEYS.has(id)) return;
    seen.add(id);
    out.push({ key: ck, value: cv });
  };

  // 1. XML <Tag>Value</Tag> pairs
  const xmlRx = /<([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_.-]{1,28})>([^<]{1,120})<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = xmlRx.exec(text)) !== null && out.length < 48) {
    add(m[1], m[2]);
  }

  // 2. FreeCAD / OpenCASCADE / Qt <Property name="..."><Float|String|Integer|Bool|Quantity value="..."/></Property>
  const propRx =
    /<Property\b[^>]*\bname="([^"]{1,40})"[^>]*>[\s\S]{0,240}?<(?:Float|String|Integer|Bool|Quantity|Length|Angle|Pressure|Value)\b[^>]*\bvalue="([^"]{1,140})"/gi;
  while ((m = propRx.exec(text)) !== null && out.length < 48) {
    add(m[1], m[2]);
  }

  // 3. Key: Value or Key=Value lines
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    if (out.length >= 48) break;
    const line = rawLine.trim();
    if (line.length < 4 || line.length > 180 || line.startsWith('<')) continue;
    const kv = line.match(
      /^([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5_()（）/.\- ]{1,32})\s*[:=：]\s*(.{1,120})$/
    );
    if (kv) {
      add(kv[1], kv[2]);
    }
  }

  return out;
}

/**
 * Normalize FreeCAD/Qt/OpenCASCADE XML (<Property name="X"><Float value="Y"/>, <Object type="..." name="..."/>,
 * and attribute-heavy XML tags) into clean "Key: Value" lines so regex extractors and human viewers read them easily.
 */
function normalizeXmlToReadableLines(xmlText: string): string {
  const lines: string[] = [];

  // Extract <Object type="..." name="..."/>
  const objRx = /<Object\b([^>]{2,260})\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = objRx.exec(xmlText)) !== null && lines.length < 300) {
    const attrs = m[1];
    const nameM = attrs.match(/\bname="([^"]+)"/i);
    const typeM = attrs.match(/\btype="([^"]+)"/i);
    if (nameM) {
      lines.push(typeM ? `Object: ${nameM[1]} (${typeM[1]})` : `Object: ${nameM[1]}`);
    }
  }

  // Extract <Property name="..."><Float|String|Integer|Bool|Quantity value="..."/>
  const propRx =
    /<Property\b[^>]*\bname="([^"]{1,48})"[^>]*>[\s\S]{0,280}?<(?:Float|String|Integer|Bool|Quantity|Length|Angle|Pressure|Value)\b[^>]*\bvalue="([^"]{1,160})"/gi;
  while ((m = propRx.exec(xmlText)) !== null && lines.length < 600) {
    lines.push(`${m[1]}: ${m[2]}`);
  }

  // Extract generic <Item|Param|Attr key|name="..." value="..."/>
  const itemRx =
    /<(?:Item|Param|Parameter|Attr|Attribute|Field|Node|Part|Component|Nozzle)\b([^>]{4,320})\/?>/gi;
  while ((m = itemRx.exec(xmlText)) !== null && lines.length < 800) {
    const attrs = m[1];
    const kM = attrs.match(/\b(?:name|key|tag|id)="([^"]+)"/i);
    const vM = attrs.match(/\b(?:value|val)="([^"]+)"/i);
    if (kM && vM) {
      lines.push(`${kM[1]}: ${vM[1]}`);
    } else {
      const pairs: string[] = [];
      const attrRx = /([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_-]{0,28})="([^"]{1,80})"/g;
      let am: RegExpExecArray | null;
      while ((am = attrRx.exec(attrs)) !== null) {
        pairs.push(`${am[1]}=${am[2]}`);
      }
      if (pairs.length > 0) {
        lines.push(pairs.join(' '));
      }
    }
  }

  // Extract simple <Tag>Value</Tag>
  const tagRx = /<([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_.-]{1,32})>([^<]{1,140})<\/\1>/g;
  while ((m = tagRx.exec(xmlText)) !== null && lines.length < 1000) {
    const v = m[2].trim();
    if (v) lines.push(`${m[1]}: ${v}`);
  }

  return lines.join('\n');
}

/**
 * Flatten an arbitrary desktop GHPV JSON object into readable "key: value" lines.
 */
function flattenJsonToReadableLines(obj: unknown, prefix = '', out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length >= 600 || obj === null || obj === undefined) return out;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    const s = String(obj).trim();
    if (s && s.length <= 180) {
      out.push(prefix ? `${prefix}: ${s}` : s);
    }
    return out;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 40) && out.length < 600; i++) {
      flattenJsonToReadableLines(obj[i], prefix ? `${prefix}[${i}]` : `[${i}]`, out, depth + 1);
    }
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (out.length >= 600) break;
      const nextKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const s = String(v).trim();
        if (s && s.length <= 180) {
          out.push(`${k}: ${s}`);
          if (prefix) out.push(`${nextKey}: ${s}`);
        }
      } else {
        flattenJsonToReadableLines(v, nextKey, out, depth + 1);
      }
    }
  }
  return out;
}

function classifyArchiveEntryKind(name: string): GhpvArchiveEntry['kind'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'json' || ext === 'ghpv') return 'JSON';
  if (ext === 'xml' || ext === 'xaml' || ext === 'svg') return 'XML';
  if (['stl', 'obj', 'glb', 'gltf', 'stp', 'step', 'igs', 'iges'].includes(ext)) return '3D网格';
  if (ext === 'brp' || ext === 'brep') return 'BRep几何';
  if (['txt', 'ini', 'cfg', 'csv', 'prop', 'info', 'yaml', 'yml', 'log'].includes(ext)) return '文本/参数';
  if (['png', 'jpg', 'jpeg', 'bmp', 'webp', 'ico', 'gif'].includes(ext)) return '图片';
  return '二进制';
}

interface ZipHeaderScan {
  hasEncryptedEntry: boolean;
  entryNames: string[];
  rawToDecodedName: Map<string, string>;
}

/**
 * Scan PKZIP local file headers (PK\x03\x04) to detect password encryption (bit 0)
 * and properly decode non-UTF8 (GB18030/GBK) Chinese entry filenames common on Windows.
 */
function scanZipHeaders(bytes: Uint8Array): ZipHeaderScan {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let hasEncryptedEntry = false;
  const entryNames: string[] = [];
  const rawToDecodedName = new Map<string, string>();

  // Walk Central Directory if End of Central Directory (PK\x05\x06) exists for reliable scanning
  let eocdOffset = -1;
  const minEocd = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset >= 0 && eocdOffset + 22 <= bytes.length) {
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let p = cdOffset;
    const end = Math.min(bytes.length, cdOffset + cdSize);
    while (p + 46 <= end) {
      if (
        bytes[p] !== 0x50 ||
        bytes[p + 1] !== 0x4b ||
        bytes[p + 2] !== 0x01 ||
        bytes[p + 3] !== 0x02
      ) {
        break;
      }
      const flags = view.getUint16(p + 8, true);
      if ((flags & 0x01) !== 0) hasEncryptedEntry = true;
      const localHeaderOffset = view.getUint32(p + 42, true);
      if (
        localHeaderOffset + 30 <= bytes.length &&
        bytes[localHeaderOffset] === 0x50 &&
        bytes[localHeaderOffset + 1] === 0x4b &&
        bytes[localHeaderOffset + 2] === 0x03 &&
        bytes[localHeaderOffset + 3] === 0x04
      ) {
        const localFlags = view.getUint16(localHeaderOffset + 6, true);
        if ((localFlags & 0x01) !== 0) hasEncryptedEntry = true;
      }
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      if (p + 46 + nameLen > end) break;

      const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
      const isUtf8 = (flags & 0x0800) !== 0;
      const utf8Raw = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
      let decoded = utf8Raw;
      if (!isUtf8) {
        try {
          new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
        } catch {
          try {
            decoded = new TextDecoder('gb18030', { fatal: false }).decode(nameBytes);
          } catch {
            decoded = utf8Raw;
          }
        }
      }
      entryNames.push(decoded);
      rawToDecodedName.set(utf8Raw, decoded);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { hasEncryptedEntry, entryNames, rawToDecodedName };
  }

  // Fallback: inspect very first local header (PK\x03\x04)
  if (bytes.length >= 30 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const flags = view.getUint16(6, true);
    if ((flags & 0x01) !== 0) hasEncryptedEntry = true;
  }

  return { hasEncryptedEntry, entryNames, rawToDecodedName };
}

/**
 * Decode an ArrayBuffer into text with automatic UTF-8 / UTF-16LE / GB18030 (GBK) detection.
 * Prevents Chinese AutoCAD DXF, CSV, TXT, and legacy GHPV XML files from turning into mojibake.
 */
export function decodeTextBufferSmart(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';

  // UTF-16LE BOM (FF FE)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    try {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    } catch {
      // fall through
    }
  }
  // UTF-16BE BOM (FE FF)
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    } catch {
      // fall through
    }
  }
  // UTF-8 BOM (EF BB BF)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(3));
  }

  // Strict UTF-8 first; if invalid byte sequences occur (typical for GBK/GB18030 Chinese CAD files), try gb18030
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('gb18030', { fatal: false }).decode(bytes);
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
  }
}

function detectBinaryContainerKind(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return 'ZIP 压缩包容器';
  }
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return 'GZIP 压缩二进制文件';
  }
  if (bytes.length >= 16) {
    const sig = new TextDecoder('ascii', { fatal: false }).decode(bytes.subarray(0, 15));
    if (sig.startsWith('SQLite format 3')) {
      return 'SQLite 二进制数据库';
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return 'OLE2 复合二进制文档';
  }
  return null;
}

/**
 * Extract readable UTF-8, GB18030, and UTF-16LE tokens from a binary or text desktop .ghpv file.
 */
function extractReadableTextFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  // 1. UTF-8 decode & pull printable / CJK runs
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const runs = utf8.match(/[\u4e00-\u9fa5A-Za-z0-9_.\-/:=°℃ΦØ×*(),;<>[\]{} ]{4,}/g);
    if (runs && runs.length > 0) {
      chunks.push(runs.slice(0, 400).join('\n'));
    }
  } catch {
    // ignore
  }

  // 2. GB18030 decode (legacy Windows/MFC/Qt Chinese desktop .ghpv files)
  try {
    const gbk = new TextDecoder('gb18030', { fatal: false }).decode(bytes);
    const gbkRuns = gbk.match(/[\u4e00-\u9fa5A-Za-z0-9_.\-/:=°℃ΦØ×*(),;<> ]{4,}/g);
    if (gbkRuns && gbkRuns.length > 0) {
      const meaningfulGbk = gbkRuns.filter(
        (s) =>
          /[\u4e00-\u9fa5]{2,}/.test(s) &&
          /(内径|筒体|封头|换热|管板|折流板|重沸器|球罐|精馏塔|卧式|立式|鞍座|裙座|法兰|人孔|压力|温度|材质|壁厚|长度|位号|管口|介质|图号|项目|单位|腐蚀|检测|热处理)/.test(
            s
          )
      );
      if (meaningfulGbk.length > 0) {
        chunks.push(meaningfulGbk.slice(0, 300).join('\n'));
      }
    }
  } catch {
    // ignore
  }

  // 3. UTF-16LE decode (desktop Qt/C++ QString serialization inside .ghpv files)
  try {
    const utf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
    const runs16 = utf16.match(/[\u4e00-\u9fa5A-Za-z0-9_.\-/:=°℃ΦØ×*(),; ]{4,}/g);
    if (runs16 && runs16.length > 0) {
      const meaningful = runs16.filter(
        (s) =>
          /[\u4e00-\u9fa5]/.test(s) ||
          /(DN\d+|PN\d+|Q345|S304|S316|GB\/T|MPa|Di|mm|N\d|M\d|V-|E-|T-|BKU|BIU|BEM)/i.test(s)
      );
      if (meaningful.length > 0) {
        chunks.push(meaningful.slice(0, 300).join('\n'));
      }
    }
  } catch {
    // ignore
  }

  return chunks.join('\n').slice(0, 16000);
}

function detectEquipmentTypeFromText(
  text: string,
  fileName: string
): {
  equipmentType: AiParsedVesselSpec['equipmentType'];
  orientation: 'horizontal' | 'vertical';
  supportType: AiParsedVesselSpec['supportType'];
  matchedKeyword: boolean;
} {
  const combined = `${fileName}\n${text}`;
  if (/釜式|重沸器|BKU|偏心锥/i.test(combined)) {
    return {
      equipmentType: 'bku_reboiler',
      orientation: 'horizontal',
      supportType: 'saddle',
      matchedKeyword: true,
    };
  }
  if (/U形管|U型管|BIU|重叠.*换热/i.test(combined)) {
    return {
      equipmentType: 'u_exchanger',
      orientation: 'horizontal',
      supportType: 'saddle',
      matchedKeyword: true,
    };
  }
  if (/换热器|管板|折流板|BEM|AES|管束/i.test(combined)) {
    return {
      equipmentType: 'exchanger',
      orientation: 'horizontal',
      supportType: 'saddle',
      matchedKeyword: true,
    };
  }
  if (/球罐|球形储罐|橘瓣|12337/i.test(combined)) {
    return {
      equipmentType: 'spherical_tank',
      orientation: 'vertical',
      supportType: 'sphere_column',
      matchedKeyword: true,
    };
  }
  if (/精馏塔|吸收塔|汽提塔|塔器|塔盘|裙座/i.test(combined)) {
    return {
      equipmentType: 'tower',
      orientation: 'vertical',
      supportType: 'skirt',
      matchedKeyword: true,
    };
  }
  if (/立式|支腿|耳座/i.test(combined) && !/卧式|鞍座/i.test(combined)) {
    return {
      equipmentType: 'vertical',
      orientation: 'vertical',
      supportType: 'leg',
      matchedKeyword: true,
    };
  }
  if (/卧式|储罐|分离器|容器|缓冲罐|鞍座|筒体|椭圆封头/i.test(combined)) {
    return {
      equipmentType: 'horizontal',
      orientation: 'horizontal',
      supportType: 'saddle',
      matchedKeyword: true,
    };
  }
  return {
    equipmentType: 'horizontal',
    orientation: 'horizontal',
    supportType: 'saddle',
    matchedKeyword: false,
  };
}

function matchFirstNumber(
  text: string,
  patterns: RegExp[],
  min: number,
  max: number,
  fallback: number
): { value: number; matched: boolean } {
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const val = Number(m[1]);
      if (Number.isFinite(val) && val >= min && val <= max) {
        return { value: val, matched: true };
      }
    }
  }
  return { value: fallback, matched: false };
}

function matchFirstString(text: string, patterns: RegExp[], fallback: string): { value: string; matched: boolean } {
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const clean = m[1].replace(/<[^>]+>/g, '').trim();
      if (clean.length > 0 && clean.length <= 120) {
        return { value: clean, matched: true };
      }
    }
  }
  return { value: fallback, matched: false };
}

function extractNozzlesFromText(text: string, shellLenMm: number): AiNozzleSpec[] {
  const found: AiNozzleSpec[] = [];
  const seen = new Set<string>();
  const lineRx = /\b([NMK]\d{1,2}|A\d{1,2})\b([^\n]{0,120})/gi;
  let match: RegExpExecArray | null;
  while ((match = lineRx.exec(text)) !== null && found.length < 32) {
    const tag = match[1].toUpperCase();
    const rest = match[2] || '';
    const dnMatch = rest.match(/DN\s*[:=：]?\s*(\d{2,4})/i);
    if (!dnMatch) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);

    const dn = Math.max(25, Math.min(2000, Number(dnMatch[1]) || 100));
    const pnMatch = rest.match(/(?:PN|CL|Class)\s*[:=：]?\s*(\d{1,4})/i);
    const angleMatch = rest.match(/(?:方位角?|角度|Angle)?\s*[:=：]?\s*(\d{1,3})\s*(?:°|deg)/i);
    const ratioMatch = rest.match(/(?:轴向位置|位置比|ratio)\s*[:=：]?\s*(0\.\d+)/i);
    const offsetMatch = rest.match(/(?:轴向距离|轴向|offset|H|L)\s*[:=：]?\s*(\d{2,5})\s*mm/i);
    const purposeMatch = rest.match(/([\u4e00-\u9fa5]{2,12}(?:进料|出料|入口|出口|人孔|手孔|液位|压力表|温度计|安全阀|放空|排净|排污|回流|气相|液相|口)?)/);

    const isManhole = tag.startsWith('M') || dn >= 450;
    const idx = found.length;
    const rawPurpose =
      purposeMatch && !/^(方位角|轴向位置|轴向距离|公称直径|压力等级)$/.test(purposeMatch[1])
        ? purposeMatch[1]
        : isManhole
          ? '检修人孔'
          : idx === 0
            ? '工艺入口'
            : idx === 1
              ? '工艺出口'
              : `工艺接管 ${tag}`;

    let axialRatio = Number((0.18 + (idx % 5) * 0.16).toFixed(2));
    if (ratioMatch) {
      axialRatio = Math.max(0.08, Math.min(0.92, Number(ratioMatch[1])));
    } else if (offsetMatch && shellLenMm > 0) {
      axialRatio = Math.max(0.08, Math.min(0.92, Number((Number(offsetMatch[1]) / shellLenMm).toFixed(2))));
    }

    found.push({
      tag,
      purpose: rawPurpose,
      dn,
      pn: pnMatch ? pnMatch[1] : '150',
      angleDeg: angleMatch ? Number(angleMatch[1]) % 360 : idx % 3 === 2 ? 180 : 0,
      axialRatio,
      isManhole,
    });
  }
  return found;
}

/**
 * Parse a GHPV project file (.ghpv, .ghpv.json, .json, .xml) from an ArrayBuffer into
 * fully parametric GHPV assemblies + TechnicalSpec.
 */
export function parseGhpvFileBuffer(fileName: string, buffer: ArrayBuffer): GhpvImportResult {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`文件 "${fileName}" 为空（0 字节），无法解析。`);
  }

  const bytes = new Uint8Array(buffer);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // 0A. Transparently unwrap GZIP-compressed .ghpv files (0x1F 0x8B)
  if (bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const inflated = gunzipSync(bytes);
      const innerBuf = inflated.buffer.slice(
        inflated.byteOffset,
        inflated.byteOffset + inflated.byteLength
      ) as ArrayBuffer;
      const innerRes = parseGhpvFileBuffer(fileName, innerBuf);
      return innerRes;
    } catch {
      // fall through to diagnostic error
    }
  }

  // 0B. Transparently unwrap ZLIB-compressed .ghpv files (0x78 0x01 / 0x78 0x9C / 0x78 0xDA)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x78 &&
    (bytes[1] === 0x01 || bytes[1] === 0x9c || bytes[1] === 0xda)
  ) {
    try {
      const inflated = unzlibSync(bytes);
      const innerBuf = inflated.buffer.slice(
        inflated.byteOffset,
        inflated.byteOffset + inflated.byteLength
      ) as ArrayBuffer;
      return parseGhpvFileBuffer(fileName, innerBuf);
    } catch {
      // fall through
    }
  }

  // 0C. Unpack PKZIP-packaged desktop .ghpv containers (PK\x03\x04 / PK\x05\x06)
  let zipArchiveEntries: GhpvArchiveEntry[] | undefined;
  let zipEmbeddedMeshes: GhpvEmbeddedMesh[] | undefined;
  let zipCombinedText: string | null = null;
  let zipExtraMetadata: Array<{ key: string; value: string }> = [];

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05)
  ) {
    const headerScan = scanZipHeaders(bytes);
    if (headerScan.hasEncryptedEntry) {
      const previewNames = headerScan.entryNames.slice(0, 6).join(', ');
      throw new Error(
        `无法解压 "${fileName}"（检测到受密码保护的 ZIP 压缩包容器${
          previewNames ? `，包含：${previewNames}` : ''
        }）。请在原版高惠中另存为 .stp / .stl / .obj 外部三维模型，或导出图纸 PDF / DXF 后通过「AI 建模」重建。`
      );
    }

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(bytes);
    } catch {
      throw new Error(
        `无法解压 "${fileName}"（检测到 ZIP 压缩包容器，但压缩目录不完整、损坏或使用了非标准加密算法）。若这是桌面原版加密 .ghpv 文件，建议在原版高惠中另存为 .stp / .stl / .obj 外部三维模型，或导出图纸 PDF / DXF 后通过「AI 建模」重建。`
      );
    }

    const entries: GhpvArchiveEntry[] = [];
    const meshes: GhpvEmbeddedMesh[] = [];
    const textChunks: string[] = [];
    const meshExts = new Set(['stl', 'obj', 'glb', 'gltf', 'stp', 'step', 'igs', 'iges', 'brp', 'brep']);
    const textExts = new Set(['xml', 'xaml', 'txt', 'ini', 'cfg', 'csv', 'prop', 'info', 'yaml', 'yml', 'log']);
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'bmp', 'webp', 'ico', 'gif']);

    for (const [rawEntryName, entryBytes] of Object.entries(unzipped)) {
      if (rawEntryName.endsWith('/') || entryBytes.byteLength === 0) continue;
      const entryName = headerScan.rawToDecodedName.get(rawEntryName) || rawEntryName;
      const entryExt = entryName.split('.').pop()?.toLowerCase() || '';
      const kind = classifyArchiveEntryKind(entryName);
      entries.push({ name: entryName, sizeBytes: entryBytes.byteLength, kind });

      const entryBuf = entryBytes.buffer.slice(
        entryBytes.byteOffset,
        entryBytes.byteOffset + entryBytes.byteLength
      ) as ArrayBuffer;

      // Priority 1: Native GHPV JSON embedded inside the ZIP archive
      if (entryExt === 'json' || entryExt === 'ghpv') {
        const entryText = decodeTextBufferSmart(entryBuf).replace(/^\uFEFF/, '').trim();
        if (entryText.startsWith('{')) {
          try {
            const parsedObj = JSON.parse(entryText) as {
              spec?: unknown;
              assemblies?: unknown;
              parsed?: AiParsedVesselSpec;
            };
            if (Array.isArray(parsedObj.assemblies)) {
              const nativeRes = parseGhpvFileBuffer(fileName, entryBuf);
              return {
                ...nativeRes,
                sourceFormat: 'ghpv_zip_archive',
                archiveEntries: entries,
              };
            }
            if (
              parsedObj.parsed &&
              typeof parsedObj.parsed === 'object' &&
              typeof parsedObj.parsed.shellDiameterMm === 'number'
            ) {
              const nativeRes = parseGhpvFileBuffer(fileName, entryBuf);
              return {
                ...nativeRes,
                sourceFormat: 'ghpv_zip_archive',
                archiveEntries: entries,
              };
            }
            // Non-native desktop JSON schema inside ZIP: flatten all key-value pairs!
            const flatLines = flattenJsonToReadableLines(parsedObj);
            if (flatLines.length > 0) {
              textChunks.push(`[ZIP/${entryName}]\n${flatLines.join('\n')}`);
            }
          } catch {
            // Non-JSON .ghpv entry inside ZIP -> fall through to text/binary scan
            const fallback = extractReadableTextFromBuffer(entryBuf);
            if (fallback) textChunks.push(`[ZIP/${entryName}]\n${fallback}`);
          }
        } else {
          const fallback = extractReadableTextFromBuffer(entryBuf);
          if (fallback) textChunks.push(`[ZIP/${entryName}]\n${fallback}`);
        }
        continue;
      }

      // Priority 2: Embedded 3D Mesh / OpenCASCADE BRep files inside the ZIP
      if (meshExts.has(entryExt)) {
        meshes.push({ name: entryName, ext: entryExt, data: entryBytes });
        continue;
      }

      // Skip thumbnails/icons
      if (imageExts.has(entryExt)) continue;

      // Priority 3: XML / FreeCAD Document.xml / INI / TXT / CSV parameter files
      if (entryExt === 'xml' || entryExt === 'xaml') {
        const xmlText = decodeTextBufferSmart(entryBuf).replace(/^\uFEFF/, '').trim();
        const normalized = normalizeXmlToReadableLines(xmlText);
        if (normalized) {
          textChunks.push(`[ZIP/${entryName}]\n${normalized}`);
        } else if (xmlText) {
          textChunks.push(`[ZIP/${entryName}]\n${xmlText.slice(0, 6000)}`);
        }
        continue;
      }

      if (textExts.has(entryExt)) {
        const txt = decodeTextBufferSmart(entryBuf).replace(/^\uFEFF/, '').trim();
        if (txt) {
          textChunks.push(`[ZIP/${entryName}]\n${txt.slice(0, 6000)}`);
        }
        continue;
      }

      // Priority 4: Unknown/binary entry inside ZIP — check if it starts with JSON/XML or contains readable Qt/UTF16/GBK strings
      const sniffText = decodeTextBufferSmart(entryBuf.slice(0, Math.min(entryBuf.byteLength, 65536)))
        .replace(/^\uFEFF/, '')
        .trim();
      if (sniffText.startsWith('<')) {
        const normalized = normalizeXmlToReadableLines(sniffText);
        textChunks.push(`[ZIP/${entryName}]\n${normalized || sniffText.slice(0, 6000)}`);
      } else if (sniffText.startsWith('{')) {
        try {
          const parsedAny = JSON.parse(decodeTextBufferSmart(entryBuf));
          const flat = flattenJsonToReadableLines(parsedAny);
          if (flat.length > 0) textChunks.push(`[ZIP/${entryName}]\n${flat.join('\n')}`);
        } catch {
          const readable = extractReadableTextFromBuffer(entryBuf);
          if (readable) textChunks.push(`[ZIP/${entryName}]\n${readable}`);
        }
      } else {
        const readable = extractReadableTextFromBuffer(entryBuf);
        if (readable) textChunks.push(`[ZIP/${entryName}]\n${readable}`);
      }
    }

    zipArchiveEntries = entries;
    if (meshes.length > 0) {
      zipEmbeddedMeshes = meshes;
    }
    zipCombinedText = textChunks.join('\n\n').slice(0, 24000);
    zipExtraMetadata = collectTextExtraMetadata(zipCombinedText);
  }

  const decodedText = zipCombinedText !== null ? zipCombinedText : decodeTextBufferSmart(buffer).replace(/^\uFEFF/, '').trim();

  // 1. Native GHPV JSON format (either { spec, assemblies } or { parsed })
  const looksLikeJson = zipCombinedText === null && (decodedText.startsWith('{') || decodedText.startsWith('['));
  if (looksLikeJson || (zipCombinedText === null && ext === 'json')) {
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(decodedText);
    } catch (err) {
      if (ext === 'json' || looksLikeJson) {
        const msg = err instanceof Error ? err.message : 'JSON 语法错误';
        throw new Error(`工程文件 "${fileName}" 的 JSON 格式损坏，无法解析（${msg}）。`);
      }
      parsedRaw = null;
    }

    if (parsedRaw && typeof parsedRaw === 'object' && !Array.isArray(parsedRaw)) {
      const rootObj = parsedRaw as Record<string, unknown>;
      const parsed = parsedRaw as {
        spec?: unknown;
        assemblies?: unknown;
        parsed?: AiParsedVesselSpec;
      };

      if (Array.isArray(parsed.assemblies)) {
        const { assemblies, droppedCount, reboundCount } = sanitizeImportedAssemblies(parsed.assemblies);
        if (assemblies.length === 0) {
          throw new Error(
            `文件 "${fileName}" 不包含有效的装配点数据（assemblies 为空或结构无效）。`
          );
        }
        const mergedSpec = sanitizeSpec(parsed.spec);
        const compCount = countComponents(assemblies);
        const extraMetadata = collectJsonExtraMetadata(rootObj, parsed.spec);
        const warnings: string[] = [];
        if (droppedCount > 0) {
          warnings.push(`已跳过 ${droppedCount} 个格式不兼容或损坏的构件记录。`);
        }
        if (reboundCount > 0) {
          warnings.push(`已自动将 ${reboundCount} 个未关联父筒体的附属件挂载到主构件下，确保结构树完整显示。`);
        }
        if (compCount === 0) {
          warnings.push('该工程文件当前为空白装配点（0 个构件），可在左侧结构树或顶部功能区继续添加。');
        }
        return {
          sourceFormat: 'ghpv_json',
          fileName,
          spec: mergedSpec,
          assemblies,
          summary: `已无损导入 GHPV 参数化工程文件 (${mergedSpec.vesselTag} · ${assemblies.length} 个装配点 / ${compCount} 个元件)`,
          warnings: warnings.length > 0 ? warnings : undefined,
          extraMetadata: extraMetadata.length > 0 ? extraMetadata : undefined,
          reboundAttachmentCount: reboundCount,
          componentCount: compCount,
        };
      }

      if (
        parsed.parsed &&
        typeof parsed.parsed === 'object' &&
        typeof parsed.parsed.shellDiameterMm === 'number' &&
        Number.isFinite(parsed.parsed.shellDiameterMm)
      ) {
        const built = buildVesselFromAiSpec(parsed.parsed);
        const extraMetadata = collectJsonExtraMetadata(rootObj, undefined);
        return {
          sourceFormat: 'ghpv_json',
          fileName,
          spec: built.spec,
          assemblies: built.assemblies,
          summary: `已导入 GHPV 结构参数文件 (${built.spec.vesselTag})`,
          extraMetadata: extraMetadata.length > 0 ? extraMetadata : undefined,
          componentCount: countComponents(built.assemblies),
        };
      }
    }

    // Valid JSON but NOT a GHPV project structure
    if (ext === 'json') {
      throw new Error(
        `文件 "${fileName}" 是有效的 JSON，但缺少 GHPV 工程结构（需要包含 assemblies 或 parsed 字段）。若这是设备参数表，请通过右侧「AI 建模」导入。`
      );
    }
  }

  // 2. Desktop original .ghpv (unpacked ZIP archive OR plain XML / INI / binary Qt serialized project)
  const sampleSlice = bytes.subarray(0, Math.min(256, bytes.length));
  let nonTextByteCount = 0;
  for (let i = 0; i < sampleSlice.length; i++) {
    const b = sampleSlice[i];
    if (b === 0 || (b < 0x09) || (b > 0x0d && b < 0x20)) {
      nonTextByteCount++;
    }
  }
  const isXmlOrPlain =
    zipCombinedText !== null ||
    decodedText.startsWith('<') ||
    (nonTextByteCount === 0 && decodedText.length > 0);
  const extractedText =
    zipCombinedText !== null
      ? zipCombinedText
      : isXmlOrPlain
      ? decodedText.startsWith('<')
        ? `${decodedText.slice(0, 12000)}\n${normalizeXmlToReadableLines(decodedText).slice(0, 8000)}`
        : decodedText.slice(0, 16000)
      : extractReadableTextFromBuffer(buffer);

  const detected = detectEquipmentTypeFromText(extractedText, fileName);

  const baseName = fileName.replace(/\.(ghpv|json|xml)$/i, '');
  const tagInContent = extractedText.match(
    /\b(\d{3,4}-[VETRCD]-\d{2,4}[A-Z]?|[VETRCD]-\d{2,4}[A-Z]?|TK-\d{2,4})\b/i
  );
  const tagInName = baseName.match(
    /\b(\d{3,4}-[VETRCD]-\d{2,4}[A-Z]?|[VETRCD]-\d{2,4}[A-Z]?|TK-\d{2,4})\b/i
  );
  const tagMatch = tagInContent || tagInName;
  const vesselTag = tagMatch ? tagMatch[1].toUpperCase() : baseName.slice(0, 16) || 'V-101';

  const defaultDia =
    detected.equipmentType === 'spherical_tank'
      ? 12300
      : detected.equipmentType === 'exchanger' || detected.equipmentType === 'u_exchanger'
        ? 900
        : 1600;
  const defaultLen =
    detected.equipmentType === 'tower'
      ? 8000
      : detected.equipmentType === 'spherical_tank'
        ? 12300
        : 4800;

  const diaRes = matchFirstNumber(
    extractedText,
    [
      /(?:Di|内径|壳体直径|筒体直径|Diameter|ShellDia)\s*[:=：>]?\s*(\d{3,5})/i,
      /[ΦØ]\s*(\d{3,5})\s*[×xX*]\s*\d{1,3}/,
    ],
    300,
    25000,
    defaultDia
  );
  const lenRes = matchFirstNumber(
    extractedText,
    [
      /(?:切线长|筒体长|直筒长|筒长|长度|Height|Length)\s*[:=：>]?\s*(\d{3,5})/i,
      /\bL\s*[:=：]\s*(\d{3,5})/i,
    ],
    600,
    45000,
    defaultLen
  );
  const thkRes = matchFirstNumber(
    extractedText,
    [
      /(?:δn|壁厚|厚度|Thickness)\s*[:=：>]?\s*(\d{1,3}(?:\.\d+)?)/i,
      /δ\s*[:=：]?\s*(\d{1,3}(?:\.\d+)?)/i,
      /[ΦØ]\s*\d{3,5}\s*[×xX*]\s*(\d{1,3})/,
    ],
    6,
    200,
    Math.max(10, Math.round(diaRes.value / 100))
  );
  const presRes = matchFirstNumber(
    extractedText,
    [
      /(?:设计压力|DesignPressure)\s*[:=：>]?\s*(\d+(?:\.\d+)?)\s*(?:MPa)?/i,
      /\bP\s*[:=：]\s*(\d+(?:\.\d+)?)\s*(?:MPa)?/i,
    ],
    0.1,
    35,
    1.6
  );
  const workPresRes = matchFirstNumber(
    extractedText,
    [/(?:工作压力|操作压力|WorkPressure)\s*[:=：>]?\s*(\d+(?:\.\d+)?)\s*(?:MPa)?/i],
    0,
    35,
    Number((presRes.value * 0.85).toFixed(2))
  );
  const testPresRes = matchFirstNumber(
    extractedText,
    [/(?:试验压力|水压试验压力|耐压试验|TestPressure)\s*[:=：>]?\s*(\d+(?:\.\d+)?)\s*(?:MPa)?/i],
    0.1,
    50,
    Number((presRes.value * 1.25).toFixed(2))
  );
  const tempRes = matchFirstNumber(
    extractedText,
    [
      /(?:设计温度|DesignTemp)\s*[:=：>]?\s*(-?\d+(?:\.\d+)?)\s*(?:°C|℃)?/i,
      /\bT\s*[:=：]\s*(-?\d+(?:\.\d+)?)\s*(?:°C|℃)?/i,
    ],
    -196,
    650,
    150
  );
  const workTempRes = matchFirstNumber(
    extractedText,
    [/(?:工作温度|操作温度|WorkTemp)\s*[:=：>]?\s*(-?\d+(?:\.\d+)?)\s*(?:°C|℃)?/i],
    -196,
    650,
    Math.round(tempRes.value * 0.8)
  );
  const corrRes = matchFirstNumber(
    extractedText,
    [/(?:腐蚀裕量|CorrosionAllowance|C2)\s*[:=：>]?\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i],
    0,
    20,
    2.0
  );
  const weldEffRes = matchFirstNumber(
    extractedText,
    [/(?:焊缝系数|焊接接头系数|WeldEfficiency|φ)\s*[:=：>]?\s*(0\.\d+|1(?:\.0)?)/i],
    0.6,
    1.0,
    1.0
  );
  const tubeODRes = matchFirstNumber(
    extractedText,
    [/(?:换热管外径|管外径|TubeOD)\s*[:=：>]?\s*(\d{2}(?:\.\d+)?)/i, /换热管[^\n]{0,18}[ΦØ]\s*(\d{2})/i],
    14,
    57,
    25
  );
  const tubePitchRes = matchFirstNumber(
    extractedText,
    [/(?:管间距|换热管间距|TubePitch)\s*[:=：>]?\s*(\d{2}(?:\.\d+)?)/i],
    18,
    80,
    32
  );
  const baffleCountRes = matchFirstNumber(
    extractedText,
    [/(?:折流板数量?|BaffleCount)\s*[:=：>]?\s*(\d{1,2})/i],
    2,
    24,
    8
  );

  const nameRes = matchFirstString(
    extractedText,
    [
      /<(?:VesselName|EquipmentName|设备名称)>([^<]{2,80})<\/(?:VesselName|EquipmentName|设备名称)>/i,
      /(?:设备名称|VesselName|EquipmentName)\s*[:=：]\s*([^\r\n,;]{2,60})/i,
    ],
    baseName || `高惠原版模型 ${vesselTag}`
  );
  const mediumRes = matchFirstString(
    extractedText,
    [
      /<(?:Medium|介质|工作介质)>([^<]{1,60})<\/(?:Medium|介质|工作介质)>/i,
      /(?:工作介质|操作介质|介质|Medium)\s*[:=：]\s*([^\r\n,;]{1,40})/i,
    ],
    '工艺介质'
  );
  const classRes = matchFirstString(
    extractedText,
    [
      /<(?:VesselClass|容器类别)>([^<]{1,40})<\/(?:VesselClass|容器类别)>/i,
      /(?:容器类别|设备类别|VesselClass)\s*[:=：]\s*([^\r\n,;]{1,30})/i,
    ],
    ''
  );
  const codeRes = matchFirstString(
    extractedText,
    [
      /<(?:DesignCode|设计规范|设计标准)>([^<]{3,60})<\/(?:DesignCode|设计规范|设计标准)>/i,
      /(?:设计标准|设计规范|DesignCode)\s*[:=：]\s*([^\r\n,;]{3,45})/i,
      /\b(GB\/T\s*150(?:\.1~150\.4)?(?:-\d{4})?|GB\/T\s*151(?:-\d{4})?|GB\/T\s*12337(?:-\d{4})?|ASME\s*VIII[^\r\n,;]{0,16})\b/i,
    ],
    detected.equipmentType === 'exchanger' ||
    detected.equipmentType === 'u_exchanger' ||
    detected.equipmentType === 'bku_reboiler'
      ? 'GB/T 151-2014'
      : detected.equipmentType === 'spherical_tank'
        ? 'GB/T 12337-2014'
        : 'GB/T 150.1~150.4-2024'
  );
  const ndtRes = matchFirstString(
    extractedText,
    [
      /<(?:NDT|NdtMethod|无损检测)>([^<]{2,60})<\/(?:NDT|NdtMethod|无损检测)>/i,
      /(?:无损检测|探伤要求|NDT)\s*[:=：]\s*([^\r\n,;]{2,45})/i,
    ],
    ''
  );
  const heatRes = matchFirstString(
    extractedText,
    [
      /<(?:HeatTreatment|热处理)>([^<]{2,60})<\/(?:HeatTreatment|热处理)>/i,
      /(?:热处理|焊后热处理|HeatTreatment)\s*[:=：]\s*([^\r\n,;]{2,45})/i,
    ],
    ''
  );
  const drawingRes = matchFirstString(
    extractedText,
    [
      /<(?:DrawingNo|图号)>([^<]{2,60})<\/(?:DrawingNo|图号)>/i,
      /(?:图号|图纸编号|DrawingNo)\s*[:=：]\s*([A-Za-z0-9_.\-/]{3,40})/i,
    ],
    ''
  );
  const companyRes = matchFirstString(
    extractedText,
    [
      /<(?:CompanyName|DesignUnit|设计单位)>([^<]{2,80})<\/(?:CompanyName|DesignUnit|设计单位)>/i,
      /(?:设计单位|制造单位|公司名称|CompanyName)\s*[:=：]\s*([^\r\n,;]{2,60})/i,
    ],
    ''
  );
  const projectRes = matchFirstString(
    extractedText,
    [
      /<(?:ProjectName|项目名称)>([^<]{2,80})<\/(?:ProjectName|项目名称)>/i,
      /(?:项目名称|工程名称|ProjectName)\s*[:=：]\s*([^\r\n,;]{2,60})/i,
    ],
    ''
  );

  const matMatch = extractedText.match(
    /\b(Q345R|Q245R|Q370R|S30408|S30403|S31603|S32168|15CrMoR|07MnMoVR|16MnIII|20R|SA-516-70)\b/i
  );
  const material = matMatch ? matMatch[1] : 'Q345R';
  const nozzles = extractNozzlesFromText(extractedText, lenRes.value);
  const extraMetadata = zipExtraMetadata.length > 0 ? zipExtraMetadata : collectTextExtraMetadata(extractedText);
  const hasZipEntries = Boolean(zipArchiveEntries && zipArchiveEntries.length > 0);
  const hasEmbeddedMeshes = Boolean(zipEmbeddedMeshes && zipEmbeddedMeshes.length > 0);

  // Honest check: count how many genuine engineering fields were extracted from the file payload
  const contentSignals = [
    diaRes.matched,
    lenRes.matched,
    thkRes.matched,
    presRes.matched,
    tempRes.matched,
    mediumRes.matched,
    Boolean(matMatch),
    nozzles.length > 0,
    Boolean(tagInContent),
    /筒体|封头|换热器|管板|折流板|重沸器|精馏塔|球罐|鞍座|裙座|法兰|压力容器|GB\/T\s*150|GB\/T\s*151/i.test(
      extractedText
    ),
  ].filter(Boolean).length;

  if (contentSignals === 0 && !hasEmbeddedMeshes && !(hasZipEntries && extraMetadata.length > 0)) {
    if (hasZipEntries && zipArchiveEntries) {
      const entryPreview = zipArchiveEntries
        .slice(0, 8)
        .map((e) => `${e.name} (${e.kind})`)
        .join('、');
      throw new Error(
        `已成功解压 ZIP 压缩包容器 "${fileName}"（共 ${zipArchiveEntries.length} 个内部文件：${entryPreview}），但内部均为专有二进制或非文本数据，未能提取到可读的设备尺寸或三维网格。建议在原版高惠中另存为 .stp / .stl / .obj 外部三维模型，或导出图纸 PDF / DXF 后通过「AI 建模」重建。`
      );
    }
    const containerKind = detectBinaryContainerKind(bytes);
    const kindHint = containerKind
      ? `（检测到 ${containerKind}，内部数据已压缩或加密）`
      : '（未提取到内径、长度、材质、管口或设备类型等可读工程字段）';
    throw new Error(
      `无法直接解析 "${fileName}"${kindHint}。若这是桌面原版加密/压缩 .ghpv 文件，建议在原版高惠中另存为 .stp / .stl / .obj 外部三维模型，或导出图纸 PDF / DXF 后通过「AI 建模」重建。`
    );
  }

  const warnings: string[] = [];
  if (hasEmbeddedMeshes && zipEmbeddedMeshes) {
    warnings.push(
      `压缩包内检测到 ${zipEmbeddedMeshes.length} 个原生三维几何/BRep 文件，将优先尝试直接渲染真实三维实体。`
    );
  }
  if (!diaRes.matched) {
    warnings.push(`文件中未识别到明确内径，已按设备类型暂估 Di=${diaRes.value} mm`);
  }
  if (!lenRes.matched && detected.equipmentType !== 'spherical_tank') {
    warnings.push(`文件中未识别到明确筒长，已按设备类型暂估 L=${lenRes.value} mm`);
  }
  if (!matMatch) {
    warnings.push(`未识别到主体材质牌号，默认采用 ${material}`);
  }

  const isExchanger =
    detected.equipmentType === 'exchanger' ||
    detected.equipmentType === 'u_exchanger' ||
    detected.equipmentType === 'bku_reboiler';

  const archiveHint = hasZipEntries
    ? `已自动解压高惠 ZIP 工程包 ${fileName}（内含 ${zipArchiveEntries!.length} 个文件${
        hasEmbeddedMeshes ? `，含 ${zipEmbeddedMeshes!.length} 个三维几何体` : ''
      }）并提取参数 (Di=${diaRes.value}mm, L=${lenRes.value}mm, 材质=${material})`
    : `已从高惠原版文件 ${fileName} 解析并重建参数化模型 (Di=${diaRes.value}mm, L=${lenRes.value}mm, 材质=${material})`;

  const aiSpec: AiParsedVesselSpec = {
    vesselTag,
    vesselName: nameRes.value,
    equipmentType: detected.equipmentType,
    orientation: detected.orientation,
    designCode: codeRes.value,
    designPressureMpa: presRes.value,
    workPressureMpa: workPresRes.value,
    designTempC: tempRes.value,
    workTempC: workTempRes.value,
    medium: mediumRes.value,
    material,
    shellDiameterMm: diaRes.value,
    kettleDiameterMm:
      detected.equipmentType === 'bku_reboiler' ? Math.round(diaRes.value * 1.65) : 0,
    shellLengthMm: lenRes.value,
    shellThicknessMm: thkRes.value,
    supportType: detected.supportType,
    tubeODMm: isExchanger ? tubeODRes.value : 0,
    tubePitchMm: isExchanger ? tubePitchRes.value : 0,
    baffleCount: isExchanger ? baffleCountRes.value : 0,
    nozzles,
    engineeringNotes: archiveHint,
  };

  const built = buildVesselFromAiSpec(aiSpec);
  const cleanedAssemblies = built.assemblies.map((ap, idx) => ({
    ...ap,
    name: ap.name.includes('(AI建模)') ? `装配点${idx + 1}` : ap.name,
  }));
  const enrichedSpec: TechnicalSpec = {
    ...built.spec,
    vesselName: nameRes.value,
    designCode: codeRes.value,
    vesselClass: classRes.matched ? classRes.value : built.spec.vesselClass,
    workPressure: workPresRes.value,
    testPressure: testPresRes.value,
    workTemp: workTempRes.value,
    medium: mediumRes.value,
    corrosionAllowance: corrRes.value,
    weldEfficiency: weldEffRes.value,
    ndtMethod: ndtRes.matched ? ndtRes.value : built.spec.ndtMethod,
    heatTreatment: heatRes.matched ? heatRes.value : built.spec.heatTreatment,
    drawingNo: drawingRes.matched ? drawingRes.value : built.spec.drawingNo,
    companyName: companyRes.matched ? companyRes.value : built.spec.companyName,
    projectName: projectRes.matched ? projectRes.value : built.spec.projectName,
  };

  return {
    sourceFormat: hasZipEntries
      ? 'ghpv_zip_archive'
      : isXmlOrPlain
      ? 'ghpv_xml_text'
      : 'ghpv_legacy_binary',
    fileName,
    spec: enrichedSpec,
    assemblies: cleanedAssemblies,
    summary: aiSpec.engineeringNotes,
    warnings: warnings.length > 0 ? warnings : undefined,
    extractedText: extractedText.slice(0, 6000),
    extraMetadata: extraMetadata.length > 0 ? extraMetadata : undefined,
    archiveEntries: zipArchiveEntries,
    embeddedMeshes: zipEmbeddedMeshes,
    componentCount: countComponents(cleanedAssemblies),
  };
}

/**
 * Extract clean engineering text from DXF, SVG, CSV, TXT, or JSON drawings/datasheets
 * so they can be fed directly into GHPV AI Modeling.
 */
export function extractTextFromCadDatasheetFile(fileName: string, rawText: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'dxf') {
    const lines = rawText.split(/\r?\n/);
    const extracted: string[] = [];
    const seen = new Set<string>();
    let inTextEntity = false;

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i].trim();
      const val = lines[i + 1].trim();
      if (code === '0') {
        inTextEntity = /^(TEXT|MTEXT|ATTRIB|ATTDEF|DIMENSION)$/i.test(val);
      } else if (inTextEntity && (code === '1' || code === '3')) {
        const cleaned = val
          .replace(/\\P/g, ' ')
          .replace(/\{\\[^;]+;|[{}]/g, '')
          .replace(/%%c/gi, 'Ø')
          .replace(/%%d/gi, '°')
          .replace(/%%p/gi, '±')
          .trim();
        if (cleaned.length >= 2 && !seen.has(cleaned)) {
          seen.add(cleaned);
          extracted.push(cleaned);
        }
      }
    }

    if (extracted.length > 0) {
      return `[DXF 图纸文字提取: ${fileName}]\n${extracted.slice(0, 260).join('\n')}`;
    }
    return `[DXF 文件: ${fileName}]\n${rawText.slice(0, 6000)}`;
  }

  if (ext === 'svg') {
    const textMatches = rawText.match(/<text[^>]*>[\s\S]*?<\/text>/gi) || [];
    const cleaned = textMatches
      .map((t) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0);
    if (cleaned.length > 0) {
      return `[SVG 矢量图文字提取: ${fileName}]\n${cleaned.slice(0, 260).join('\n')}`;
    }
  }

  return `[导入文件: ${fileName}]\n${rawText.slice(0, 10000)}`;
}
