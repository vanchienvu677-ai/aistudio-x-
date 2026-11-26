import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import type {
  AiParsedVesselSpec,
  AssemblyPoint,
  CameraAngles,
  RgbaColor,
  TechnicalSpec,
  TubeLayoutParams,
  VesselComponent,
} from '../types/vessel';
import {
  buildVesselFromAiSpec,
  computeComponentMetrics,
  computeTubeLayout,
  getComponentTypeLabel,
} from '../core/vesselMath';
import { extractTextFromCadDatasheetFile } from '../core/ghpvImporter';

export type PropPanelTab = 'property' | 'userParams' | 'aiModel';

interface AiStepLog {
  tool: string;
  status: string;
  detail: string;
}

const SAMPLE_DATASHEETS: Array<{ label: string; text: string }> = [
  {
    label: '丙烷卧罐 V-208',
    text: `设备位号: V-208  设备名称: 卧式丙烷原料缓冲罐
设备类型: 卧式压力容器 (双鞍座 NB/T 47065.1)
设计标准: GB/T 150.1~150.4-2024
设计压力: 2.16 MPa / 工作压力: 1.75 MPa
设计温度: 60 °C / 工作温度: 40 °C  工作介质: 液化丙烷 (C3H8)
主材: Q345R  筒体内径 Di=1800 mm  切线长 L=5200 mm  壁厚 δn=18 mm
管口表:
N1 液相进料口 DN150 PN300 0° 轴向位置 0.18
N2 人孔 DN500 PN300 0° 轴向位置 0.50
N3 安全阀口 DN100 PN300 0° 轴向位置 0.80
N4 底部出料口 DN150 PN300 180° 轴向位置 0.72
N5 排净口 DN80 PN300 180° 轴向位置 0.35`,
  },
  {
    label: 'BKU重沸器 E-403',
    text: `设备位号: E-403  设备名称: 轻烃塔底 BKU 釜式重沸器
结构形式: BKU 釜式重沸器 (含下平顶扩偏心锥壳 + U形换热管束)
设计标准: GB/T 151-2014
设计压力: 2.5 MPa  设计温度: 240 °C  介质: 轻烃 / 中压蒸汽
主材: Q345R  管箱内径 Di=800 mm  釜体扩大段内径 Dk=1450 mm  釜体直筒长 L=3200 mm  壁厚 δn=14 mm
换热管: Ø25×2.5  管间距 S=32 mm  折流板 6 块
管口表:
N1 壳程液相进料 DN150 PN300 180° 轴向位置 0.22
N2 壳程气相出口 DN350 PN300 0° 轴向位置 0.48
N3 溢流液相出口 DN150 PN300 180° 轴向位置 0.82
N4 安全阀口 DN80 PN300 0° 轴向位置 0.78`,
  },
  {
    label: '精馏塔 T-305',
    text: `设备位号: T-305  设备名称: 脱乙烷精馏塔
结构形式: 立式塔器 (圆筒形裙座 + 浮阀塔盘)
设计标准: GB/T 150.1~150.4-2024
设计压力: 2.6 MPa  设计温度: 190 °C  工作介质: C2/C3 混合轻烃
主材: Q345R  塔体内径 Di=1600 mm  直筒高度 L=6800 mm  壁厚 δn=16 mm
管口表:
N1 塔底进料 DN200 PN300 0° 轴向位置 0.20
N2 塔中回流口 DN150 PN300 180° 轴向位置 0.55
N3 塔顶气相口 DN250 PN300 0° 轴向位置 0.88
M1 检修人孔 DN500 PN300 90° 轴向位置 0.36`,
  },
];

interface PropertyPanelProps {
  assembly: AssemblyPoint | null;
  component: VesselComponent | null;
  selectedSubNode?: string | null;
  spec: TechnicalSpec;
  totalVesselWeightKg: number;
  totalVesselVolumeM3: number;
  explodeEnabled: boolean;
  explodeFactor: number;
  cameraAngles: CameraAngles;
  activePropTab: PropPanelTab;
  onChangePropTab: (tab: PropPanelTab) => void;
  onToggleExplode: (enabled: boolean) => void;
  onChangeExplodeFactor: (factor: number) => void;
  onChangeCameraAngles: (angles: CameraAngles) => void;
  onUpdateAssembly: (
    assemblyId: string,
    patch: Partial<Pick<AssemblyPoint, 'name' | 'x' | 'z' | 'orientation'>>
  ) => void;
  onUpdateName: (componentId: string, name: string) => void;
  onUpdateColor: (componentId: string, color: RgbaColor) => void;
  onOpenDetailDialog: (component: VesselComponent) => void;
  onOpenTechSpec: () => void;
  injectedAiDatasheet?: { token: number; text: string } | null;
  onApplyAiModel: (
    presetId: string,
    spec: TechnicalSpec,
    assemblies: AssemblyPoint[],
    notes: string
  ) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  assembly,
  component,
  selectedSubNode = null,
  spec,
  totalVesselWeightKg,
  totalVesselVolumeM3,
  explodeEnabled,
  explodeFactor,
  cameraAngles,
  activePropTab,
  onChangePropTab,
  onToggleExplode,
  onChangeExplodeFactor,
  onChangeCameraAngles,
  onUpdateAssembly,
  onUpdateName,
  onUpdateColor,
  onOpenDetailDialog,
  onOpenTechSpec,
  injectedAiDatasheet = null,
  onApplyAiModel,
}) => {
  const [colorExpanded, setColorExpanded] = useState(true);
  const [dockTab, setDockTab] = useState<'ops' | 'camera'>('ops');

  // AI Modeling docked state (GHPV V2.1 Episode 15 + Model Config + PDF/Drawing/DXF Import)
  const [datasheetText, setDatasheetText] = useState<string>(SAMPLE_DATASHEETS[0].text);
  const [aiSettingsOpen, setAiSettingsOpen] = useState<boolean>(true);
  const [aiModel, setAiModel] = useState<string>('gemini-4-hydrogen');
  const [thinkingLevel, setThinkingLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [preferredCode, setPreferredCode] = useState<string>('auto');
  const [preferredMaterial, setPreferredMaterial] = useState<string>('auto');

  const [attachedFileDataUrl, setAttachedFileDataUrl] = useState<string | null>(null);
  const [attachedMimeType, setAttachedMimeType] = useState<string>('image/png');
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [attachedFileSizeKb, setAttachedFileSizeKb] = useState<number>(0);
  const [importedTextNotice, setImportedTextNotice] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSteps, setAiSteps] = useState<AiStepLog[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const sketchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (injectedAiDatasheet && injectedAiDatasheet.text) {
      setDatasheetText(injectedAiDatasheet.text);
      setImportedTextNotice('已载入高惠原版文件提取参数，可直接点击下方按钮用 AI 补全三维模型');
      setAiError(null);
    }
  }, [injectedAiDatasheet]);

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiError(null);
    setImportedTextNotice(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isImage =
      file.type.startsWith('image/') && ext !== 'svg';

    if (isPdf || isImage) {
      if (file.size > 15 * 1024 * 1024) {
        setAiError('上传的 PDF / 图纸文件超过 15 MB 上限，请压缩或截取单页后重试。');
        e.target.value = '';
        return;
      }
      setAttachedMimeType(isPdf ? 'application/pdf' : file.type || 'image/png');
      setAttachedFileName(file.name);
      setAttachedFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFileDataUrl(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    } else if (['dxf', 'svg', 'txt', 'csv', 'json', 'xml'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || '');
        const extracted = extractTextFromCadDatasheetFile(file.name, raw);
        setDatasheetText(extracted);
        setImportedTextNotice(`已解析 ${file.name} (${ext.toUpperCase()}) 文本内容并填入下方数据表`);
      };
      reader.readAsText(file);
    } else {
      setAiError(`暂不支持 .${ext} 格式，请导入 PDF、PNG/JPG/WEBP 图纸或 DXF/SVG/CSV/TXT 数据表。`);
    }

    e.target.value = '';
  };

  const handleRunAiModel = async () => {
    if (!datasheetText.trim() && !attachedFileDataUrl) {
      setAiError('请粘贴压力容器数据表文本，或导入 PDF / 图纸 / DXF 文件。');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiSteps([]);
    setAiSummary(null);

    try {
      const resp = await fetch('/api/ai-vessel-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasheetText: datasheetText.trim(),
          fileBase64: attachedFileDataUrl || undefined,
          fileMimeType: attachedFileDataUrl ? attachedMimeType : undefined,
          fileName: attachedFileDataUrl ? attachedFileName : undefined,
          model: aiModel,
          thinkingLevel,
          preferredCode,
          preferredMaterial,
        }),
      });
      const data = (await resp.json()) as {
        parsed?: AiParsedVesselSpec;
        steps?: AiStepLog[];
        error?: string;
      };

      if (!resp.ok || !data.parsed) {
        setAiError(data.error || `服务端返回异常状态 (${resp.status})`);
        return;
      }

      const built = buildVesselFromAiSpec(data.parsed);
      setAiSteps(Array.isArray(data.steps) ? data.steps : []);
      setAiSummary(data.parsed.engineeringNotes || `已完成 ${built.spec.vesselTag} 三维建模`);
      onApplyAiModel(built.presetId, built.spec, built.assemblies, data.parsed.engineeringNotes || '');
    } catch (err) {
      setAiError(err instanceof Error ? `网络请求失败：${err.message}` : 'AI 建模服务连接失败');
    } finally {
      setAiLoading(false);
    }
  };

  const renderBottomDock = () => (
    <div className="shrink-0 border-t-2 border-[#cbd5e1] bg-[#f8fafc] select-none">
      {/* GHPV V2.1 Bottom Dock Tabs: 操作视图 | 视角 */}
      <div className="h-[22px] px-1.5 flex items-center justify-between bg-[#eef1f5] border-b border-[#cbd5e1]">
        <div className="flex items-center gap-0.5 h-full">
          <button
            type="button"
            onClick={() => setDockTab('ops')}
            className={`px-2.5 h-full text-[11px] border-t border-x rounded-t-[2px] ${
              dockTab === 'ops'
                ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            操作视图
          </button>
          <button
            type="button"
            onClick={() => setDockTab('camera')}
            className={`px-2.5 h-full text-[11px] border-t border-x rounded-t-[2px] ${
              dockTab === 'camera'
                ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            视角
          </button>
        </div>
        <span className="text-[10px] text-[#64748b] tabular-nums">
          {dockTab === 'ops' ? (explodeEnabled ? `爆炸 ${Math.round(explodeFactor * 100)}%` : '装配态') : `${cameraAngles.zoomPercent}%`}
        </span>
      </div>

      {/* Dock Content */}
      <div className="p-2 bg-white text-[11px] space-y-2 tabular-nums">
        {dockTab === 'ops' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#1e293b]">
                <input
                  type="checkbox"
                  aria-label="爆炸视图开关"
                  checked={explodeEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onToggleExplode(checked);
                    if (checked && explodeFactor === 0) {
                      onChangeExplodeFactor(0.55);
                    }
                  }}
                />
                <span>爆炸</span>
              </label>
              <span className="text-[#2563eb] font-medium">
                {Math.round((explodeEnabled ? explodeFactor : 0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              aria-label="爆炸间距"
              min={0}
              max={100}
              step={2}
              value={Math.round((explodeEnabled ? explodeFactor : 0) * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                if (!explodeEnabled && v > 0) onToggleExplode(true);
                onChangeExplodeFactor(v);
              }}
              className="w-full h-1.5 accent-[#2563eb] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-[#64748b]">
              <span>0% 装配</span>
              <button
                type="button"
                onClick={() => {
                  onToggleExplode(false);
                  onChangeExplodeFactor(0);
                }}
                className="text-[#2563eb] hover:underline"
              >
                复位
              </button>
              <span>100% 展开</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[44px_1fr_32px_30px] items-center gap-1">
              <span className="text-[#475569]">水平角</span>
              <input
                type="range"
                aria-label="水平旋转角度"
                min={-180}
                max={180}
                value={Math.round(cameraAngles.azimuthDeg)}
                onChange={(e) =>
                  onChangeCameraAngles({ ...cameraAngles, azimuthDeg: Number(e.target.value) })
                }
                className="w-full h-1.5 accent-[#2563eb]"
              />
              <span className="text-right text-[#1e293b]">{Math.round(cameraAngles.azimuthDeg)}°</span>
              <button
                type="button"
                onClick={() => onChangeCameraAngles({ ...cameraAngles, azimuthDeg: 0 })}
                className="text-[10px] text-[#2563eb] hover:underline"
                title="水平角归零"
              >
                归零
              </button>
            </div>
            <div className="grid grid-cols-[44px_1fr_32px_30px] items-center gap-1">
              <span className="text-[#475569]">俯仰角</span>
              <input
                type="range"
                aria-label="垂直俯仰角度"
                min={-75}
                max={75}
                value={Math.round(cameraAngles.elevationDeg)}
                onChange={(e) =>
                  onChangeCameraAngles({ ...cameraAngles, elevationDeg: Number(e.target.value) })
                }
                className="w-full h-1.5 accent-[#2563eb]"
              />
              <span className="text-right text-[#1e293b]">{Math.round(cameraAngles.elevationDeg)}°</span>
              <button
                type="button"
                onClick={() => onChangeCameraAngles({ ...cameraAngles, elevationDeg: 0 })}
                className="text-[10px] text-[#2563eb] hover:underline"
                title="俯仰角归零"
              >
                归零
              </button>
            </div>
            <div className="grid grid-cols-[44px_1fr_32px_30px] items-center gap-1">
              <span className="text-[#475569]">缩放比</span>
              <input
                type="range"
                aria-label="视角缩放比例"
                min={45}
                max={200}
                value={Math.round(cameraAngles.zoomPercent)}
                onChange={(e) =>
                  onChangeCameraAngles({ ...cameraAngles, zoomPercent: Number(e.target.value) })
                }
                className="w-full h-1.5 accent-[#2563eb]"
              />
              <span className="text-right text-[#1e293b]">{Math.round(cameraAngles.zoomPercent)}%</span>
              <button
                type="button"
                onClick={() => onChangeCameraAngles({ ...cameraAngles, zoomPercent: 100 })}
                className="text-[10px] text-[#2563eb] hover:underline"
                title="缩放复位"
              >
                <RotateCcw className="w-3 h-3 mx-auto" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Summary Strip */}
      <div className="px-2 py-1 bg-[#f1f4f8] border-t border-[#cbd5e1] text-[10.5px] text-[#475569] flex justify-between tabular-nums">
        <span>总重: {totalVesselWeightKg.toFixed(1)} kg</span>
        <span>容积: {totalVesselVolumeM3.toFixed(2)} m³</span>
      </div>
    </div>
  );

  const metrics = component ? computeComponentMetrics(component) : null;
  const material = component ? (component.params as { material?: string }).material || 'Q345R' : 'Q345R';
  const density = component ? (component.params as { density?: number }).density || 7.85 : 7.85;

  const handleChannel = (channel: keyof RgbaColor, raw: string) => {
    if (!component) return;
    const val = Math.max(0, Math.min(255, Number(raw) || 0));
    onUpdateColor(component.id, { ...component.color, [channel]: val });
  };

  const isBaffleSubSelected =
    !!component &&
    component.type === 'tube_layout' &&
    !!selectedSubNode &&
    /^折流板\d+$/.test(selectedSubNode);

  const baffleInfo = (() => {
    if (!isBaffleSubSelected || !component) return null;
    const tp = component.params as TubeLayoutParams;
    const layout = computeTubeLayout(tp);
    const outerDia = Math.max(100, tp.shellDiameter - 6);
    const thickness = 8;
    // 78% segmental baffle disc minus tube holes
    const discAreaMm2 = Math.PI * (outerDia / 2) * (outerDia / 2) * 0.78;
    const holeCount = Math.max(12, Math.round(layout.totalCount * 0.44));
    const holesAreaMm2 = holeCount * Math.PI * ((tp.tubeOD + 0.8) / 2) ** 2;
    const netAreaMm2 = Math.max(discAreaMm2 * 0.35, discAreaMm2 - holesAreaMm2);
    const volumeM3 = (netAreaMm2 * thickness) / 1e9;
    const weightKg = volumeM3 * 7850;
    return {
      name: selectedSubNode!,
      color: { r: 170, g: 85, b: 255, a: 255 } as RgbaColor,
      outerDia,
      thickness,
      holeCount,
      volumeM3,
      weightKg,
    };
  })();

  const displayColor = baffleInfo ? baffleInfo.color : component?.color ?? { r: 198, g: 136, b: 32, a: 255 };

  const rows: Array<{ label: string; value: string }> = baffleInfo
    ? [
        { label: '零件实体', value: '折流板' },
        { label: '材料', value: 'Q235B' },
        { label: '密度(t/m3)', value: '7.85' },
        { label: '重量(kg)', value: baffleInfo.weightKg.toFixed(3) },
        { label: '体积(m3)', value: baffleInfo.volumeM3.toFixed(6) },
        { label: '外径(mm)', value: String(baffleInfo.outerDia) },
        { label: '厚度(mm)', value: String(baffleInfo.thickness) },
        { label: '开孔数量', value: String(baffleInfo.holeCount) },
      ]
    : component && metrics
      ? [
          { label: '元件类型', value: getComponentTypeLabel(component.type) },
          { label: '材料', value: material },
          { label: '材料密度', value: density.toFixed(2) },
          { label: '单重(kg)', value: metrics.weightKg.toFixed(1) },
          { label: '体积(m3)', value: metrics.volumeM3.toFixed(4) },
          ...(metrics.internalVolumeM3 > 0
            ? [{ label: '内容积(m3)', value: metrics.internalVolumeM3.toFixed(4) }]
            : []),
          ...(metrics.outerAreaM2 > 0
            ? [{ label: '外表面积(m2)', value: metrics.outerAreaM2.toFixed(4) }]
            : []),
          ...(metrics.innerAreaM2 > 0
            ? [{ label: '内表面积(m2)', value: metrics.innerAreaM2.toFixed(4) }]
            : []),
          { label: '质心(距起始点)', value: metrics.cogMm.toFixed(2) },
          ...metrics.extraProperties,
          { label: '规格描述', value: metrics.specText },
        ]
      : [];

  return (
    <aside
      aria-label="属性栏"
      className="w-[264px] shrink-0 h-full flex flex-col bg-white border-l border-[#cbd5e1] select-none"
    >
      {/* Panel Header */}
      {activePropTab === 'aiModel' ? (
        <div className="h-[22px] px-2 flex items-center justify-between bg-[#eff6ff] border-b border-[#bfdbfe] text-[11px] font-semibold text-[#1e3a8a] shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#2563eb]" />
            GHPV V2.1 AI 数据表建模
          </span>
          <span className="text-[10px] font-normal text-[#3b82f6]">数据表 → 3D</span>
        </div>
      ) : (
        <div className="grid grid-cols-[110px_1fr] h-[22px] bg-[#f1f4f8] border-b border-[#cbd5e1] text-[11px] font-medium text-[#334155] shrink-0">
          <div className="px-2 flex items-center border-r border-[#d5dbe3]">Property</div>
          <div className="px-2 flex items-center">Value</div>
        </div>
      )}

      {/* Scrollable Body: Property | User Params | AI 建模 */}
      <div className="flex-1 min-h-0 overflow-y-auto text-[11px] tabular-nums">
        {activePropTab === 'aiModel' ? (
          <div className="p-2 space-y-2 select-text">
            <div className="text-[10.5px] text-[#475569] leading-snug">
              支持导入 PDF 图纸、PNG/JPG 条件图、DXF/CSV 数据表或粘贴工艺文本，配置 AI 模型参数后一键生成 3D 压力容器。
            </div>

            {/* Collapsible AI Model Configuration Box */}
            <div className="border border-[#cbd5e1] rounded-[2px] bg-[#f8fafc] overflow-hidden">
              <button
                type="button"
                onClick={() => setAiSettingsOpen((v) => !v)}
                className="w-full h-[22px] px-2 flex items-center justify-between bg-[#eef2f6] hover:bg-[#e2e8f0] text-[10.5px] font-semibold text-[#1e293b]"
              >
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-[#2563eb]" />
                  <span>AI 模型设置</span>
                </span>
                {aiSettingsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {aiSettingsOpen && (
                <div className="p-1.5 space-y-1.5 bg-white border-t border-[#e2e8f0] text-[10.5px]">
                  <div className="grid grid-cols-[62px_1fr] items-center gap-1">
                    <label htmlFor="ai-model-select" className="text-[#475569]">识别模型</label>
                    <select
                      id="ai-model-select"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="h-[21px] px-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#0f172a]"
                    >
                      <option value="gemini-4-hydrogen">Gemini 4 Flash (推荐·PDF)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Lite (极速)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-[62px_1fr] items-center gap-1">
                    <label htmlFor="ai-thinking-select" className="text-[#475569]">推理深度</label>
                    <select
                      id="ai-thinking-select"
                      value={thinkingLevel}
                      onChange={(e) => setThinkingLevel(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                      className="h-[21px] px-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#0f172a]"
                    >
                      <option value="LOW">快速解析 (LOW)</option>
                      <option value="MEDIUM">标准平衡 (MEDIUM)</option>
                      <option value="HIGH">深度核校 (HIGH)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-[62px_1fr] items-center gap-1">
                    <label htmlFor="ai-code-select" className="text-[#475569]">默认规范</label>
                    <select
                      id="ai-code-select"
                      value={preferredCode}
                      onChange={(e) => setPreferredCode(e.target.value)}
                      className="h-[21px] px-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#0f172a]"
                    >
                      <option value="auto">自动识别图纸规范</option>
                      <option value="GB/T 150.1~150.4-2024">GB/T 150-2024 (容器)</option>
                      <option value="GB/T 151-2014">GB/T 151-2014 (换热器)</option>
                      <option value="GB/T 12337-2014">GB/T 12337 (球罐)</option>
                      <option value="ASME VIII Div.1">ASME VIII Div.1</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-[62px_1fr] items-center gap-1">
                    <label htmlFor="ai-mat-select" className="text-[#475569]">主材偏好</label>
                    <select
                      id="ai-mat-select"
                      value={preferredMaterial}
                      onChange={(e) => setPreferredMaterial(e.target.value)}
                      className="h-[21px] px-1 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#0f172a]"
                    >
                      <option value="auto">自动识别</option>
                      <option value="Q345R">Q345R (低合金钢)</option>
                      <option value="S30408">S30408 (304不锈钢)</option>
                      <option value="S31603">S31603 (316L不锈钢)</option>
                      <option value="15CrMoR">15CrMoR (铬钼耐热钢)</option>
                      <option value="Q370R">Q370R (高强容器板)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Sample Datasheet Loaders */}
            <div className="flex flex-wrap gap-1">
              {SAMPLE_DATASHEETS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setDatasheetText(s.text);
                    setAiError(null);
                    setImportedTextNotice(null);
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-[#f1f5f9] hover:bg-[#dbeafe] text-[#1e3a8a] border border-[#cbd5e1] rounded-[2px] transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Multi-format Drawing / PDF / DXF / Datasheet Upload */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1.5">
                <input
                  ref={sketchInputRef}
                  type="file"
                  accept=".pdf,image/*,.dxf,.svg,.txt,.csv,.json,.xml"
                  className="hidden"
                  onChange={handleDocumentUpload}
                />
                <button
                  type="button"
                  onClick={() => sketchInputRef.current?.click()}
                  className="flex-1 h-[25px] px-2 flex items-center justify-center gap-1 text-[10.5px] bg-[#f8fafc] hover:bg-[#dbeafe] border border-[#93c5fd] rounded-[2px] text-[#1e3a8a] font-medium transition-colors"
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span className="truncate">导入图纸 / PDF / DXF / 数据表</span>
                </button>
                {attachedFileDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFileDataUrl(null);
                      setAttachedFileName('');
                      setAttachedFileSizeKb(0);
                    }}
                    className="px-1.5 h-[25px] text-[10px] text-[#dc2626] hover:bg-[#fee2e2] border border-[#fecaca] rounded-[2px]"
                  >
                    清除
                  </button>
                )}
              </div>

              {attachedFileDataUrl && (
                <div className="border border-[#bfdbfe] rounded-[2px] overflow-hidden bg-[#f8fafc] p-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="flex items-center gap-1 font-medium text-[#1e3a8a] truncate">
                      <FileText className="w-3 h-3 text-[#2563eb] shrink-0" />
                      <span className="px-1 bg-[#dbeafe] text-[#1d4ed8] rounded-[2px] font-mono">
                        {attachedMimeType === 'application/pdf' ? 'PDF' : '图纸'}
                      </span>
                      <span className="truncate" title={attachedFileName}>
                        {attachedFileName}
                      </span>
                    </span>
                    <span className="text-[#64748b] shrink-0">{attachedFileSizeKb} KB</span>
                  </div>
                  {attachedMimeType.startsWith('image/') && (
                    <img
                      src={attachedFileDataUrl}
                      alt="上传的压力容器条件图"
                      className="w-full max-h-[76px] object-contain bg-white border border-[#e2e8f0]"
                    />
                  )}
                </div>
              )}

              {importedTextNotice && (
                <div className="px-1.5 py-1 bg-[#ecfdf5] border border-[#a7f3d0] rounded-[2px] text-[10px] text-[#047857]">
                  {importedTextNotice}
                </div>
              )}
            </div>

            {/* Datasheet Textarea */}
            <div>
              <label htmlFor="ai-datasheet-input" className="block text-[10.5px] font-medium text-[#334155] mb-0.5">
                设备数据表 / 工艺条件文本 (可配合 PDF/图纸补充说明)
              </label>
              <textarea
                id="ai-datasheet-input"
                rows={6}
                value={datasheetText}
                onChange={(e) => setDatasheetText(e.target.value)}
                placeholder="输入位号、设备类型、内径 Di、长度 L、壁厚、设计压力、材质及管口表，或直接导入 PDF/图纸/DXF..."
                className="w-full p-1.5 text-[10.5px] leading-relaxed font-mono bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#0f172a] focus:outline-none focus:border-[#2563eb] resize-y"
              />
            </div>

            {/* Primary Trigger */}
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleRunAiModel}
              className="w-full h-[28px] flex items-center justify-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#93c5fd] text-white font-medium text-[11.5px] rounded-[2px] transition-colors"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI 正在解析数据表并建模...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI 解析并生成 3D</span>
                </>
              )}
            </button>

            {/* Error Banner (never faked) */}
            {aiError && (
              <div className="p-2 bg-[#fef2f2] border border-[#fca5a5] rounded-[2px] text-[10.5px] text-[#991b1b] flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#dc2626]" />
                <span>{aiError}</span>
              </div>
            )}

            {/* Execution Log Console */}
            {aiSteps.length > 0 && (
              <div className="border border-[#bfdbfe] bg-[#f8fafc] rounded-[2px] p-1.5 space-y-1">
                <div className="text-[10px] font-semibold text-[#1e40af] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                  <span>GHPV AI 工具调用记录</span>
                </div>
                {aiSteps.map((st, idx) => (
                  <div key={`${st.tool}-${idx}`} className="text-[10px] leading-snug border-t border-[#e2e8f0] pt-1">
                    <span className="font-mono text-[#2563eb]">{st.tool}</span>
                    <div className="text-[#334155]">{st.detail}</div>
                  </div>
                ))}
                {aiSummary && (
                  <div className="text-[10px] text-[#047857] bg-[#ecfdf5] border border-[#a7f3d0] rounded-[2px] p-1">
                    {aiSummary}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activePropTab === 'userParams' ? (
          <div>
            <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[24px]">
              <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                技术特性表
              </div>
              <div className="px-1 py-0.5 flex items-center bg-white">
                <button
                  type="button"
                  onClick={onOpenTechSpec}
                  className="w-full h-[19px] text-[11px] bg-[#f1f5f9] hover:bg-[#dbeafe] border border-[#cbd5e1] hover:border-[#60a5fa] text-[#1e293b] rounded-[2px] transition-colors"
                >
                  编辑技术参数
                </button>
              </div>
            </div>
            {[
              ['设备位号', spec.vesselTag],
              ['设备名称', spec.vesselName],
              ['设计标准', spec.designCode],
              ['设计压力(MPa)', String(spec.designPressure)],
              ['工作压力(MPa)', String(spec.workPressure)],
              ['试验压力(MPa)', String(spec.testPressure)],
              ['设计温度(°C)', String(spec.designTemp)],
              ['腐蚀裕量(mm)', String(spec.corrosionAllowance)],
              ['焊缝系数', String(spec.weldEfficiency)],
              ['无损检测', spec.ndtMethod],
              ['图号', spec.drawingNo],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] min-h-[21px] ${
                  i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'
                }`}
              >
                <div className="px-2 py-0.5 flex items-center border-r border-[#e5e7eb] text-[#334155] truncate">
                  {k}
                </div>
                <div className="px-1.5 py-0.5 flex items-center text-[#0f172a] truncate" title={v}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        ) : !component ? (
          assembly ? (
            <div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
                <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                  装配点名
                </div>
                <input
                  type="text"
                  aria-label="装配点名"
                  value={assembly.name}
                  onChange={(e) => onUpdateAssembly(assembly.id, { name: e.target.value })}
                  className="px-1.5 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                />
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
                <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                  方位型式
                </div>
                <select
                  aria-label="装配点方位"
                  value={assembly.orientation}
                  onChange={(e) =>
                    onUpdateAssembly(assembly.id, {
                      orientation: e.target.value as AssemblyPoint['orientation'],
                    })
                  }
                  className="px-1 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                >
                  <option value="horizontal">卧式 (Horizontal)</option>
                  <option value="vertical">立式 (Vertical)</option>
                </select>
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
                <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                  起始 X(mm)
                </div>
                <input
                  type="number"
                  aria-label="装配点X坐标"
                  value={assembly.x}
                  onChange={(e) => onUpdateAssembly(assembly.id, { x: Number(e.target.value) || 0 })}
                  className="px-1.5 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                />
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
                <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                  起始 Z(mm)
                </div>
                <input
                  type="number"
                  aria-label="装配点Z坐标"
                  value={assembly.z}
                  onChange={(e) => onUpdateAssembly(assembly.id, { z: Number(e.target.value) || 0 })}
                  className="px-1.5 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                />
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] min-h-[21px] bg-[#f8fafc]">
                <div className="px-2 py-0.5 flex items-center border-r border-[#e5e7eb] text-[#334155]">
                  所含元件数
                </div>
                <div className="px-1.5 py-0.5 flex items-center text-[#0f172a]">
                  {assembly.components.length} 项
                </div>
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] min-h-[21px] bg-white">
                <div className="px-2 py-0.5 flex items-center border-r border-[#e5e7eb] text-[#334155]">
                  设备总重(kg)
                </div>
                <div className="px-1.5 py-0.5 flex items-center text-[#0f172a]">
                  {totalVesselWeightKg.toFixed(1)}
                </div>
              </div>
              <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] min-h-[21px] bg-[#f8fafc]">
                <div className="px-2 py-0.5 flex items-center border-r border-[#e5e7eb] text-[#334155]">
                  设备总容积(m³)
                </div>
                <div className="px-1.5 py-0.5 flex items-center text-[#0f172a]">
                  {totalVesselVolumeM3.toFixed(4)}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 text-[11.5px] text-[#64748b] space-y-2">
              <p>请在左侧结构树或三维视口中选择一个元件或装配点以查看和编辑属性。</p>
            </div>
          )
        ) : (
          <>
            {/* 元件名 */}
            <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
              <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                元件名
              </div>
              {baffleInfo ? (
                <div className="px-1.5 flex items-center bg-white text-[#0f172a] font-medium">
                  {baffleInfo.name}
                </div>
              ) : (
                <input
                  type="text"
                  aria-label="元件名"
                  value={component.name}
                  onChange={(e) => onUpdateName(component.id, e.target.value)}
                  className="px-1.5 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                />
              )}
            </div>

            {/* 模型颜色 (Expandable RGBA) */}
            <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[22px]">
              <button
                type="button"
                onClick={() => setColorExpanded((v) => !v)}
                className="px-1 flex items-center gap-0.5 bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155] text-left hover:bg-[#eef2f6]"
              >
                {colorExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                <span>模型颜色</span>
              </button>
              <div className="px-1.5 flex items-center gap-1.5 bg-white truncate">
                <span
                  className="w-3 h-3 border border-[#64748b] shrink-0 inline-block"
                  style={{
                    backgroundColor: `rgba(${displayColor.r},${displayColor.g},${displayColor.b},${displayColor.a / 255})`,
                  }}
                />
                <span className="truncate text-[#1e293b]">
                  [{displayColor.r}, {displayColor.g}, {displayColor.b}] ({displayColor.a})
                </span>
              </div>
            </div>

            {colorExpanded && (
              <>
                {(
                  [
                    ['Red', 'r', displayColor.r],
                    ['Green', 'g', displayColor.g],
                    ['Blue', 'b', displayColor.b],
                    ['Alpha', 'a', displayColor.a],
                  ] as Array<[string, keyof RgbaColor, number]>
                ).map(([label, key, val]) => (
                  <div key={key} className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[21px]">
                    <div className="pl-5 pr-2 flex items-center bg-[#fbfcfd] border-r border-[#e5e7eb] text-[#475569]">
                      {label}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      aria-label={`颜色 ${label}`}
                      value={val}
                      readOnly={!!baffleInfo}
                      onChange={(e) => !baffleInfo && handleChannel(key, e.target.value)}
                      className="px-1.5 w-full h-full bg-white text-[#0f172a] focus:outline-none focus:bg-[#eff6ff]"
                    />
                  </div>
                ))}
              </>
            )}

            {/* 详细参数 -> 设置 button */}
            <div className="grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] h-[24px]">
              <div className="px-2 flex items-center bg-[#f8fafc] border-r border-[#e5e7eb] text-[#334155]">
                详细参数
              </div>
              <div className="px-1 py-0.5 flex items-center bg-white">
                <button
                  type="button"
                  onClick={() => onOpenDetailDialog(component)}
                  className="w-full h-[19px] text-[11px] bg-[#f1f5f9] hover:bg-[#dbeafe] border border-[#cbd5e1] hover:border-[#60a5fa] text-[#1e293b] rounded-[2px] transition-colors"
                >
                  设置
                </button>
              </div>
            </div>

            {/* Computed Engineering Attributes */}
            {rows.map((row, i) => (
              <div
                key={`${row.label}-${i}`}
                className={`grid grid-cols-[110px_1fr] border-b border-[#e5e7eb] min-h-[21px] ${
                  i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'
                }`}
              >
                <div className="px-2 py-0.5 flex items-center border-r border-[#e5e7eb] text-[#334155] truncate">
                  {row.label}
                </div>
                <div className="px-1.5 py-0.5 flex items-center text-[#0f172a] truncate" title={row.value}>
                  {row.value}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* GHPV V2.1 Sub-Tab Strip: 属性 | 用户参数 | AI 建模 */}
      <div className="h-[22px] px-1.5 flex items-center gap-0.5 bg-[#eef1f5] border-t border-[#cbd5e1] shrink-0">
        {(
          [
            ['property', '属性'],
            ['userParams', '用户参数'],
            ['aiModel', 'AI 建模'],
          ] as Array<[PropPanelTab, string]>
        ).map(([key, label]) => {
          const active = activePropTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChangePropTab(key)}
              className={`px-2.5 h-full text-[10.5px] border-x border-b rounded-b-[2px] ${
                active
                  ? key === 'aiModel'
                    ? 'bg-[#eff6ff] text-[#1d4ed8] font-semibold border-[#93c5fd]'
                    : 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1]'
                  : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* GHPV V2.1 Docked Bottom Panel: 操作视图 (爆炸) | 视角 */}
      {renderBottomDock()}
    </aside>
  );
};
