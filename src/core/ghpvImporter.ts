import type {
  AiNozzleSpec,
  AiParsedVesselSpec,
  AssemblyPoint,
  TechnicalSpec,
} from '../types/vessel';
import { buildVesselFromAiSpec } from './vesselMath';

export interface GhpvImportResult {
  sourceFormat: 'ghpv_json' | 'ghpv_xml_text' | 'ghpv_legacy_binary';
  fileName: string;
  spec: TechnicalSpec;
  assemblies: AssemblyPoint[];
  summary: string;
  extractedText?: string;
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

function countComponents(assemblies: AssemblyPoint[]): number {
  return assemblies.reduce((sum, ap) => sum + (Array.isArray(ap.components) ? ap.components.length : 0), 0);
}

/**
 * Extract readable UTF-8 and UTF-16LE tokens from a binary or text desktop .ghpv file.
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

  // 2. UTF-16LE decode (desktop Qt/C++ QString serialization inside .ghpv files)
  try {
    const utf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
    const runs16 = utf16.match(/[\u4e00-\u9fa5A-Za-z0-9_.\-/:=°℃ΦØ×*(),; ]{4,}/g);
    if (runs16 && runs16.length > 0) {
      const meaningful = runs16.filter(
        (s) => /[\u4e00-\u9fa5]/.test(s) || /(DN\d+|PN\d+|Q345|S304|S316|GB\/T|MPa|Di|mm|N\d|M\d|V-|E-|T-|BKU|BIU|BEM)/i.test(s)
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
} {
  const combined = `${fileName}\n${text}`;
  if (/釜式|重沸器|BKU|偏心锥/i.test(combined)) {
    return { equipmentType: 'bku_reboiler', orientation: 'horizontal', supportType: 'saddle' };
  }
  if (/U形管|U型管|BIU|重叠.*换热/i.test(combined)) {
    return { equipmentType: 'u_exchanger', orientation: 'horizontal', supportType: 'saddle' };
  }
  if (/换热器|管板|折流板|BEM|AES|管束/i.test(combined)) {
    return { equipmentType: 'exchanger', orientation: 'horizontal', supportType: 'saddle' };
  }
  if (/球罐|球形储罐|橘瓣|12337/i.test(combined)) {
    return { equipmentType: 'spherical_tank', orientation: 'vertical', supportType: 'sphere_column' };
  }
  if (/精馏塔|吸收塔|汽提塔|塔器|塔盘|裙座/i.test(combined)) {
    return { equipmentType: 'tower', orientation: 'vertical', supportType: 'skirt' };
  }
  if (/立式|支腿|耳座/i.test(combined) && !/卧式|鞍座/i.test(combined)) {
    return { equipmentType: 'vertical', orientation: 'vertical', supportType: 'leg' };
  }
  return { equipmentType: 'horizontal', orientation: 'horizontal', supportType: 'saddle' };
}

function matchFirstNumber(text: string, patterns: RegExp[], min: number, max: number, fallback: number): number {
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const val = Number(m[1]);
      if (Number.isFinite(val) && val >= min && val <= max) {
        return val;
      }
    }
  }
  return fallback;
}

function extractNozzlesFromText(text: string): AiNozzleSpec[] {
  const found: AiNozzleSpec[] = [];
  const seen = new Set<string>();
  const lineRx = /\b([NMK]\d{1,2}|A\d{1,2})\b[^\n]{0,60}?DN\s*(\d{2,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = lineRx.exec(text)) !== null && found.length < 10) {
    const tag = match[1].toUpperCase();
    const dn = Math.max(25, Math.min(2000, Number(match[2]) || 100));
    if (seen.has(tag)) continue;
    seen.add(tag);
    const isManhole = tag.startsWith('M') || dn >= 450;
    const idx = found.length;
    found.push({
      tag,
      purpose: isManhole ? '检修人孔' : idx === 0 ? '工艺入口' : idx === 1 ? '工艺出口' : `工艺接管 ${tag}`,
      dn,
      pn: '150',
      angleDeg: idx % 3 === 2 ? 180 : 0,
      axialRatio: Number((0.18 + (idx % 5) * 0.16).toFixed(2)),
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
  const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/^\uFEFF/, '').trim();

  // 1. Native GHPV JSON format (either { spec, assemblies } or { parsed })
  if (utf8Text.startsWith('{') || utf8Text.startsWith('[')) {
    try {
      const parsed = JSON.parse(utf8Text) as {
        spec?: Partial<TechnicalSpec>;
        assemblies?: AssemblyPoint[];
        parsed?: AiParsedVesselSpec;
      };
      if (Array.isArray(parsed.assemblies) && parsed.assemblies.length > 0) {
        const mergedSpec: TechnicalSpec = { ...DEFAULT_SPEC, ...(parsed.spec || {}) };
        const compCount = countComponents(parsed.assemblies);
        return {
          sourceFormat: 'ghpv_json',
          fileName,
          spec: mergedSpec,
          assemblies: parsed.assemblies,
          summary: `已无损导入 GHPV 参数化工程文件 (${mergedSpec.vesselTag} · ${parsed.assemblies.length} 个装配点 / ${compCount} 个元件)`,
          componentCount: compCount,
        };
      }
      if (parsed.parsed && typeof parsed.parsed.shellDiameterMm === 'number') {
        const built = buildVesselFromAiSpec(parsed.parsed);
        return {
          sourceFormat: 'ghpv_json',
          fileName,
          spec: built.spec,
          assemblies: built.assemblies,
          summary: `已导入 GHPV 结构参数文件 (${built.spec.vesselTag})`,
          componentCount: countComponents(built.assemblies),
        };
      }
    } catch {
      // Fall through to XML / legacy desktop .ghpv parsing
    }
  }

  // 2. Desktop original .ghpv (XML / INI / binary Qt serialized project)
  const isXmlOrPlain =
    utf8Text.startsWith('<') ||
    /^[A-Za-z0-9_\u4e00-\u9fa5\s:=.,\-/"'[\]{}()<>]+$/.test(utf8Text.slice(0, 256));
  const extractedText = isXmlOrPlain ? utf8Text.slice(0, 16000) : extractReadableTextFromBuffer(buffer);

  const detected = detectEquipmentTypeFromText(extractedText, fileName);

  const baseName = fileName.replace(/\.(ghpv|json|xml)$/i, '');
  const tagMatch =
    extractedText.match(/\b(\d{3,4}-[VETRCD]-\d{2,4}[A-Z]?|[VETRCD]-\d{2,4}[A-Z]?|TK-\d{2,4})\b/i) ||
    baseName.match(/\b(\d{3,4}-[VETRCD]-\d{2,4}[A-Z]?|[VETRCD]-\d{2,4}[A-Z]?|TK-\d{2,4})\b/i);
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

  const shellDiameterMm = matchFirstNumber(
    extractedText,
    [
      /(?:Di|内径|壳体直径|筒体直径|Diameter|ShellDia)\s*[:=：]?\s*(\d{3,5})/i,
      /[ΦØ]\s*(\d{3,5})\s*[×xX*]\s*\d{1,3}/,
    ],
    300,
    25000,
    defaultDia
  );
  const shellLengthMm = matchFirstNumber(
    extractedText,
    [
      /(?:切线长|筒体长|直筒长|筒长|长度|Height|Length|L)\s*[:=：]?\s*(\d{3,5})/i,
    ],
    600,
    45000,
    defaultLen
  );
  const shellThicknessMm = matchFirstNumber(
    extractedText,
    [
      /(?:δn|δ|壁厚|厚度|Thickness)\s*[:=：]?\s*(\d{1,3}(?:\.\d+)?)/i,
      /[ΦØ]\s*\d{3,5}\s*[×xX*]\s*(\d{1,3})/,
    ],
    6,
    200,
    Math.max(10, Math.round(shellDiameterMm / 100))
  );
  const designPressureMpa = matchFirstNumber(
    extractedText,
    [/(?:设计压力|DesignPressure|P)\s*[:=：]?\s*(\d+(?:\.\d+)?)\s*(?:MPa)?/i],
    0.1,
    35,
    1.6
  );
  const designTempC = matchFirstNumber(
    extractedText,
    [/(?:设计温度|DesignTemp|T)\s*[:=：]?\s*(-?\d+(?:\.\d+)?)\s*(?:°C|℃)?/i],
    -196,
    650,
    150
  );

  const matMatch = extractedText.match(/\b(Q345R|Q245R|Q370R|S30408|S30403|S31603|S32168|15CrMoR|07MnMoVR|16MnIII|20R|SA-516-70)\b/i);
  const material = matMatch ? matMatch[1] : 'Q345R';

  const nozzles = extractNozzlesFromText(extractedText);

  const aiSpec: AiParsedVesselSpec = {
    vesselTag,
    vesselName: baseName || `高惠原版模型 ${vesselTag}`,
    equipmentType: detected.equipmentType,
    orientation: detected.orientation,
    designCode:
      detected.equipmentType === 'exchanger' ||
      detected.equipmentType === 'u_exchanger' ||
      detected.equipmentType === 'bku_reboiler'
        ? 'GB/T 151-2014'
        : detected.equipmentType === 'spherical_tank'
          ? 'GB/T 12337-2014'
          : 'GB/T 150.1~150.4-2024',
    designPressureMpa,
    workPressureMpa: Number((designPressureMpa * 0.85).toFixed(2)),
    designTempC,
    workTempC: Math.round(designTempC * 0.8),
    medium: '工艺介质',
    material,
    shellDiameterMm,
    kettleDiameterMm: detected.equipmentType === 'bku_reboiler' ? Math.round(shellDiameterMm * 1.65) : 0,
    shellLengthMm,
    shellThicknessMm,
    supportType: detected.supportType,
    tubeODMm: detected.equipmentType === 'exchanger' || detected.equipmentType === 'u_exchanger' || detected.equipmentType === 'bku_reboiler' ? 25 : 0,
    tubePitchMm: detected.equipmentType === 'exchanger' || detected.equipmentType === 'u_exchanger' || detected.equipmentType === 'bku_reboiler' ? 32 : 0,
    baffleCount: detected.equipmentType === 'exchanger' || detected.equipmentType === 'u_exchanger' || detected.equipmentType === 'bku_reboiler' ? 8 : 0,
    nozzles,
    engineeringNotes: `已从高惠原版文件 ${fileName} 解析并重建参数化模型 (Di=${shellDiameterMm}mm, L=${shellLengthMm}mm, 材质=${material})`,
  };

  const built = buildVesselFromAiSpec(aiSpec);
  return {
    sourceFormat: isXmlOrPlain ? 'ghpv_xml_text' : 'ghpv_legacy_binary',
    fileName,
    spec: built.spec,
    assemblies: built.assemblies,
    summary: aiSpec.engineeringNotes,
    extractedText: extractedText.slice(0, 4000),
    componentCount: countComponents(built.assemblies),
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
