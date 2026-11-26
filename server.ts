import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/gif',
]);
const MAX_DECODED_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_DATASHEET_CHARS = 40_000;

interface AiVesselRequestBody {
  datasheetText?: string;
  fileBase64?: string;
  fileMimeType?: string;
  fileName?: string;
  imageBase64?: string;
  imageMimeType?: string;
  model?: string;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredCode?: string;
  preferredMaterial?: string;
}

const VESSEL_SPEC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vesselTag: { type: Type.STRING, description: '设备位号，例如 V-208、E-403、T-305' },
    vesselName: { type: Type.STRING, description: '设备中文名称，例如 卧式丙烷缓冲罐、BKU釜式重沸器' },
    equipmentType: {
      type: Type.STRING,
      description: '设备结构类型枚举：horizontal, vertical, tower, exchanger, u_exchanger, bku_reboiler, spherical_tank',
    },
    orientation: {
      type: Type.STRING,
      description: '安装方位：horizontal 或 vertical',
    },
    designCode: { type: Type.STRING, description: '设计规范，如 GB/T 150.1~150.4-2024 或 GB/T 151-2014' },
    designPressureMpa: { type: Type.NUMBER, description: '设计压力 (MPa)' },
    workPressureMpa: { type: Type.NUMBER, description: '工作压力 (MPa)' },
    designTempC: { type: Type.NUMBER, description: '设计温度 (°C)' },
    workTempC: { type: Type.NUMBER, description: '工作温度 (°C)' },
    medium: { type: Type.STRING, description: '工作介质名称' },
    material: { type: Type.STRING, description: '主壳体材质牌号，如 Q345R、S30408、S31603、Q370R' },
    shellDiameterMm: { type: Type.NUMBER, description: '主筒体或球壳内径 Di (mm)' },
    kettleDiameterMm: { type: Type.NUMBER, description: '仅 BKU 釜式重沸器扩大段内径 (mm)，其他设备填 0' },
    shellLengthMm: { type: Type.NUMBER, description: '主筒体切线长度 L (mm)' },
    shellThicknessMm: { type: Type.NUMBER, description: '主壳体名义壁厚 δn (mm)' },
    supportType: {
      type: Type.STRING,
      description: '支座类型：saddle, leg, skirt, sphere_column, lug',
    },
    tubeODMm: { type: Type.NUMBER, description: '换热管外径 (mm)，非换热器填 0' },
    tubePitchMm: { type: Type.NUMBER, description: '换热管间距 (mm)，非换热器填 0' },
    baffleCount: { type: Type.NUMBER, description: '折流板数量，非换热器填 0' },
    nozzles: {
      type: Type.ARRAY,
      description: '从数据表或图纸/PDF中提取的所有接管/人孔列表',
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING, description: '管口符号，如 N1、N2、M1' },
          purpose: { type: Type.STRING, description: '管口用途，如 物料入口、气相出口、人孔' },
          dn: { type: Type.NUMBER, description: '公称直径 DN (mm)' },
          pn: { type: Type.STRING, description: '压力等级，如 150、300、16、25' },
          angleDeg: { type: Type.NUMBER, description: '周向方位角 (0=顶部/正前, 180=底部)' },
          axialRatio: { type: Type.NUMBER, description: '沿主筒体轴向相对位置 (0.1 ~ 0.9)' },
          isManhole: { type: Type.BOOLEAN, description: '是否人孔' },
        },
        required: ['tag', 'purpose', 'dn', 'pn', 'angleDeg', 'axialRatio', 'isManhole'],
      },
    },
    engineeringNotes: {
      type: Type.STRING,
      description: 'AI 对工艺数据表、PDF/图纸和结构参数的一句话解析摘要',
    },
  },
  required: [
    'vesselTag',
    'vesselName',
    'equipmentType',
    'orientation',
    'designCode',
    'designPressureMpa',
    'workPressureMpa',
    'designTempC',
    'workTempC',
    'medium',
    'material',
    'shellDiameterMm',
    'kettleDiameterMm',
    'shellLengthMm',
    'shellThicknessMm',
    'supportType',
    'tubeODMm',
    'tubePitchMm',
    'baffleCount',
    'nozzles',
    'engineeringNotes',
  ],
};

const SYSTEM_INSTRUCTION = `你是高惠PV (GHPV V2.1) 压力容器数字化交付系统的 AI 结构建模引擎。
你的职责是将用户提供的压力容器条件图、PDF 工程图纸、DXF 标注文本、工艺数据表或简图，精准解析为符合 GB/T 150、GB/T 151、GB/T 12337 与 NB/T 47065 规范的结构化 JSON 建模参数。
规则：
1. 仔细识别设备类型：
   - 含“釜式”、“重沸器”、“BKU”、“偏心锥” -> equipmentType="bku_reboiler", orientation="horizontal", supportType="saddle"
   - 含“U形管”、“BIU” -> equipmentType="u_exchanger", orientation="horizontal", supportType="saddle"
   - 含“换热器”、“管板”、“BEM” -> equipmentType="exchanger", orientation="horizontal", supportType="saddle"
   - 含“球罐”、“球形储罐” -> equipmentType="spherical_tank", orientation="vertical", supportType="sphere_column"
   - 含“塔”、“精馏”、“吸收”、“汽提”、“裙座”、“塔盘” -> equipmentType="tower", orientation="vertical", supportType="skirt"
   - 含“立式”、“支腿”、“分离器” -> equipmentType="vertical", orientation="vertical", supportType="leg"
   - 其他卧式储罐/缓冲罐 -> equipmentType="horizontal", orientation="horizontal", supportType="saddle"
2. 所有几何尺寸单位统一为毫米 (mm)，压力单位为 MPa，温度单位为 °C。若图纸或数据表缺少某项参数，依据压力容器工程规范给出合理的标准值。
3. 至少提取或补齐合理的工艺接管表（如进料口、出料口、安全阀口、排净口、人孔），确保轴向相对位置 axialRatio 在 0.12~0.88 之间且彼此错开不干涉。
4. 仅返回严格符合 responseSchema 的 JSON 对象。`;

function mapThinkingLevel(level?: string): ThinkingLevel | undefined {
  if (level === 'LOW') return ThinkingLevel.LOW;
  if (level === 'MEDIUM') return ThinkingLevel.MEDIUM;
  if (level === 'HIGH') return ThinkingLevel.HIGH;
  return undefined;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      version: 'GHPV V2.1',
      aiReady: Boolean(process.env.GEMINI_API_KEY),
      supportedModels: Array.from(ALLOWED_MODELS),
    });
  });

  app.post('/api/ai-vessel-model', async (req, res) => {
    try {
      const body = (req.body || {}) as AiVesselRequestBody;
      const datasheetText = typeof body.datasheetText === 'string' ? body.datasheetText.trim() : '';
      const rawBase64 =
        typeof body.fileBase64 === 'string' && body.fileBase64.trim()
          ? body.fileBase64.trim()
          : typeof body.imageBase64 === 'string'
            ? body.imageBase64.trim()
            : '';
      const rawMime =
        typeof body.fileMimeType === 'string' && body.fileMimeType.trim()
          ? body.fileMimeType.trim().toLowerCase()
          : typeof body.imageMimeType === 'string'
            ? body.imageMimeType.trim().toLowerCase()
            : 'image/png';
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 120) : '';

      const requestedModel =
        typeof body.model === 'string' && ALLOWED_MODELS.has(body.model.trim())
          ? body.model.trim()
          : 'gemini-4-hydrogen';
      const thinkingLevel = mapThinkingLevel(body.thinkingLevel);
      const preferredCode =
        typeof body.preferredCode === 'string' && body.preferredCode !== 'auto'
          ? body.preferredCode.trim().slice(0, 60)
          : '';
      const preferredMaterial =
        typeof body.preferredMaterial === 'string' && body.preferredMaterial !== 'auto'
          ? body.preferredMaterial.trim().slice(0, 40)
          : '';

      if (!datasheetText && !rawBase64) {
        res.status(400).json({ error: '请输入压力容器条件数据表内容，或导入 PDF / 图纸 / DXF 文件。' });
        return;
      }
      if (datasheetText.length > MAX_DATASHEET_CHARS) {
        res.status(413).json({ error: '输入的数据表文本超过 40,000 字符上限，请精简核心参数后重试。' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        res.status(503).json({
          error: '服务端未检测到 GEMINI_API_KEY，请在 AI Studio Secrets 面板配置后重试。',
        });
        return;
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (rawBase64) {
        if (!ALLOWED_MIME_TYPES.has(rawMime)) {
          res.status(400).json({ error: `不支持的附件格式 (${rawMime})，请上传 PDF 或 PNG/JPG/WEBP 图纸。` });
          return;
        }
        const cleaned = (rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64).replace(/\s+/g, '');
        if (!cleaned || !/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
          res.status(400).json({ error: '上传附件编码格式无效，请重新选择 PDF 或图片文件。' });
          return;
        }
        const estimatedBytes = Math.floor((cleaned.length * 3) / 4);
        if (estimatedBytes > MAX_DECODED_BYTES) {
          res.status(413).json({ error: '上传的 PDF/图纸超过 15 MB 限制，请压缩或截取关键页后重试。' });
          return;
        }
        parts.push({
          inlineData: {
            mimeType: rawMime,
            data: cleaned,
          },
        });
      }

      const prefHints: string[] = [];
      if (preferredCode) prefHints.push(`若图纸未注明规范，默认采用设计标准：${preferredCode}`);
      if (preferredMaterial) prefHints.push(`若图纸未注明材质，主壳体默认优先采用：${preferredMaterial}`);
      const hintBlock = prefHints.length > 0 ? `\n\n[用户建模偏好]\n${prefHints.join('\n')}` : '';

      const docLabel = rawMime === 'application/pdf' ? 'PDF 工程图纸/数据表' : '设备条件图/简图';
      parts.push({
        text: datasheetText
          ? `请综合解析以下压力容器设计数据表${rawBase64 ? `及所附 ${docLabel} (${fileName || rawMime})` : ''}，并输出 GHPV V2.1 三维建模 JSON：${hintBlock}\n\n${datasheetText}`
          : `请仔细识别所附 ${docLabel} (${fileName || rawMime}) 中的设备位号、设计参数、主要尺寸和管口方位表，并输出 GHPV V2.1 三维建模 JSON。${hintBlock}`,
      });

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const config: {
        systemInstruction: string;
        responseMimeType: string;
        responseSchema: typeof VESSEL_SPEC_SCHEMA;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: VESSEL_SPEC_SCHEMA,
      };
      if (thinkingLevel) {
        config.thinkingConfig = { thinkingLevel };
      }

      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      let lastErr: unknown = null;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: requestedModel,
            contents: [{ role: 'user', parts }],
            config,
          });
          break;
        } catch (err) {
          lastErr = err;
          const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
          const isTransient = status === 429 || status === 503 || status === 500;
          if (!isTransient || attempt === maxAttempts) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt - 1)));
        }
      }
      if (!response) {
        throw lastErr ?? new Error('Empty AI response');
      }

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI 模型未返回有效的结构化参数，请补充设备尺寸信息后重试。' });
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        const decoded = JSON.parse(rawText);
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
          throw new Error('Invalid JSON structure');
        }
        parsed = decoded as Record<string, unknown>;
      } catch {
        res.status(502).json({ error: 'AI 返回的参数结构异常，请补充清晰的设备尺寸后重试。' });
        return;
      }
      const steps = [
        {
          tool: 'ai_model_engine',
          status: 'ok',
          detail: `调用模型 ${requestedModel}${thinkingLevel ? ` (推理深度: ${thinkingLevel})` : ''}${rawBase64 ? ` · 已读取 ${fileName || docLabel}` : ''}`,
        },
        { tool: 'parse_datasheet', status: 'ok', detail: `识别设备 ${String(parsed.vesselTag || 'V-101')} (${String(parsed.vesselName || '压力容器')})` },
        { tool: 'select_vessel_template', status: 'ok', detail: `匹配结构模板 ${String(parsed.equipmentType || 'horizontal')} (${String(parsed.orientation || 'horizontal')})` },
        {
          tool: 'build_pressure_envelope',
          status: 'ok',
          detail: `生成主壳体 Di=${String(parsed.shellDiameterMm ?? 1000)}mm × δ=${String(parsed.shellThicknessMm ?? 12)}mm × L=${String(parsed.shellLengthMm ?? 3000)}mm (${String(parsed.material || 'Q345R')})`,
        },
        {
          tool: 'mount_nozzles_and_supports',
          status: 'ok',
          detail: `自动装配 ${Array.isArray(parsed.nozzles) ? parsed.nozzles.length : 0} 个工艺管口与 ${String(parsed.supportType || 'saddle')} 支座`,
        },
      ];

      res.json({ parsed, steps, usedModel: requestedModel });
    } catch (err) {
      console.error('[GHPV AI Modeling Error]', err);
      const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
      const msg = err instanceof Error ? err.message : '';
      if (status === 403 || status === 400 && /API_KEY|PERMISSION_DENIED/i.test(msg)) {
        res.status(403).json({
          error: 'GEMINI_API_KEY 无效或权限不足，请在 AI Studio 的 Settings > Secrets 面板检查并更新密钥。',
        });
        return;
      }
      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) {
        res.status(429).json({
          error: 'AI 接口配额已达上限，请稍后重试或在 Settings > Secrets 中切换已启用计费的密钥。',
        });
        return;
      }
      if (status === 404 || /NOT_FOUND/i.test(msg)) {
        res.status(404).json({
          error: '请求的 AI 模型暂不可用，请切换为 Gemini 4 Flash (gemini-4-hydrogen) 后重试。',
        });
        return;
      }
      res.status(502).json({ error: 'AI 建模服务暂时不可用，请检查输入参数或稍后重试。' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GHPV V2.1 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
