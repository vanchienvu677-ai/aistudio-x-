import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileBox,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { NozzleManholeParams, TechnicalSpec } from '../../types/vessel';
import type { Export3DFormat, SceneMeshStats } from '../../scene/cadExporters';
import { generateBOM } from '../../core/vesselMath';
import {
  decodeTextBufferSmart,
  extractTextFromCadDatasheetFile,
  parseGhpvFileBuffer,
  type GhpvImportResult,
} from '../../core/ghpvImporter';

interface Export3DModelDialogProps {
  spec: TechnicalSpec;
  componentCount: number;
  meshStats: SceneMeshStats;
  onExport3D: (format: Export3DFormat, unit: 'mm' | 'm') => Promise<{ fileName: string; sizeBytes: number }>;
  onExportGhpvProject: () => void;
  onOpenPdms: () => void;
  onClose: () => void;
}

interface ExportFormatItem {
  id: Export3DFormat | 'pdms' | 'ghpv';
  ext: string;
  name: string;
  software: string;
  desc: string;
  recommended?: boolean;
}

const EXPORT_FORMATS: ExportFormatItem[] = [
  {
    id: 'step',
    ext: '.stp',
    name: 'STEP 国际标准实体交换格式 (AP214)',
    software: 'SolidWorks / Creo / NX / AutoCAD Plant 3D / Inventor',
    desc: 'ISO-10303-21 工业通用三维 CAD 实体交换标准，按组件分组，推荐用于下游机械与工厂设计软件。',
    recommended: true,
  },
  {
    id: 'iges',
    ext: '.igs',
    name: 'IGES 通用三维几何格式 (IGES 5.3)',
    software: 'SolidWorks / Mastercam / ANSYS / CAXA / 传统 CAD',
    desc: '标准 80 列定宽 IGES 几何文件，兼容早期工业 CAD 与有限元前处理软件。',
  },
  {
    id: 'stl_bin',
    ext: '.stl',
    name: 'STL 三维实体网格 — 二进制 (Binary)',
    software: 'SolidWorks / FreeCAD / 3D 打印 / 快速预览',
    desc: '高压缩二进制三角网格，文件体积小、读取速度快，适合快速评审与样机打印。',
  },
  {
    id: 'stl_ascii',
    ext: '.stl',
    name: 'STL 三维实体网格 — ASCII 文本',
    software: 'FreeCAD / 文本审查 / 脚本后处理',
    desc: '可读明文 STL 网格，方便外部脚本解析法向量与三维顶点坐标。',
  },
  {
    id: 'glb',
    ext: '.glb',
    name: 'glTF 2.0 二进制三维模型',
    software: 'Web 3D / Navisworks / Unity / Unreal / 数字孪生平台',
    desc: '完整保留材质颜色与装配层级，适合轻量化网页展示、VR 漫游与数字化交付平台。',
    recommended: true,
  },
  {
    id: 'obj',
    ext: '.obj',
    name: 'Wavefront OBJ + MTL 材质组',
    software: 'Blender / Rhino / 3ds Max / KeyShot / SolidWorks',
    desc: '同时导出 .obj 网格与 .mtl 材质库，保留每个部件的分组命名与着色。',
  },
  {
    id: 'pdms',
    ext: '.mac',
    name: 'AVEVA PDMS / E3D 配管设备宏',
    software: 'AVEVA PDMS / AVEVA E3D 工厂三维配管',
    desc: '生成原生 EQUI / CYLI / DISH / NOZZ 宏脚本，直接导入工厂三维配管系统。',
  },
  {
    id: 'ghpv',
    ext: '.ghpv',
    name: 'GHPV 高惠参数化工程文件',
    software: '高惠PV (GHPV V2.1) 原生工程存档',
    desc: '保存完整技术特性表、结构树、构件参数与配色，下次打开可 100% 继续参数化编辑。',
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const Export3DModelDialog: React.FC<Export3DModelDialogProps> = ({
  spec,
  componentCount,
  meshStats,
  onExport3D,
  onExportGhpvProject,
  onOpenPdms,
  onClose,
}) => {
  const [unit, setUnit] = useState<'mm' | 'm'>('mm');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClickExport = async (item: ExportFormatItem) => {
    setErrorMsg(null);
    if (item.id === 'pdms') {
      onClose();
      onOpenPdms();
      return;
    }
    if (item.id === 'ghpv') {
      onExportGhpvProject();
      setLastResult(`已保存高惠工程文件: ${spec.vesselTag || 'GHPV_Vessel'}.ghpv`);
      return;
    }

    setExportingId(item.id);
    try {
      const res = await onExport3D(item.id, unit);
      setLastResult(`已成功导出 ${res.fileName} (${formatBytes(res.sizeBytes)} · 单位 ${unit})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '模型导出失败，请重试');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="另存为三维模型"
    >
      <div className="w-[690px] max-w-[96vw] max-h-[90vh] flex flex-col bg-[#f3f5f8] border border-[#94a3b8] shadow-xl text-[12px] text-[#1f2937]">
        {/* Title Bar */}
        <div className="h-[30px] px-2.5 flex items-center justify-between bg-gradient-to-b from-white to-[#e6ebf2] border-b border-[#cbd5e1] select-none shrink-0">
          <div className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
            <FileBox className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>另存为三维模型 — 多格式 CAD 导出 ({spec.vesselTag})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导出窗口"
            className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#ef4444] hover:text-white text-[#475569]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Model Summary Strip + Unit Switcher */}
        <div className="px-3 py-2 bg-white border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-[#334155]">
            <span>
              设备: <strong className="text-[#0f172a]">{spec.vesselTag}</strong> ({spec.vesselName})
            </span>
            <span>元件: {componentCount} 项</span>
            <span>三角面片: {meshStats.triangleCount.toLocaleString()}</span>
            <span>
              包络尺寸: {meshStats.sizeMm[0]} × {meshStats.sizeMm[1]} × {meshStats.sizeMm[2]} mm
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#475569]">导出单位:</span>
            <select
              aria-label="三维模型导出单位"
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'mm' | 'm')}
              className="h-[22px] px-1.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[11px]"
            >
              <option value="mm">毫米 (mm — 机械 CAD 标准)</option>
              <option value="m">米 (m — 工厂/BIM)</option>
            </select>
          </div>
        </div>

        {/* Formats List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 bg-[#f8fafc]">
          {EXPORT_FORMATS.map((fmt) => {
            const busy = exportingId === fmt.id;
            return (
              <div
                key={fmt.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-white border border-[#cbd5e1] hover:border-[#60a5fa] rounded-[2px] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10.5px] font-mono font-semibold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] rounded-[2px]">
                      {fmt.ext}
                    </span>
                    <span className="font-semibold text-[#0f172a] truncate">{fmt.name}</span>
                    {fmt.recommended && (
                      <span className="px-1.5 py-0 text-[10px] bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] rounded-[2px]">
                        推荐
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-[#475569] mt-0.5">{fmt.desc}</div>
                  <div className="text-[10px] text-[#64748b] mt-0.5">兼容软件：{fmt.software}</div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleClickExport(fmt)}
                  className="shrink-0 h-[28px] px-3 flex items-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#93c5fd] text-white text-[11px] font-medium rounded-[2px] transition-colors"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>导出 {fmt.ext}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Feedback */}
        <div className="px-3 py-2 bg-[#eef1f5] border-t border-[#cbd5e1] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1 text-[11px]">
            {errorMsg ? (
              <span className="flex items-center gap-1 text-[#b91c1c]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </span>
            ) : lastResult ? (
              <span className="flex items-center gap-1 text-[#047857] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{lastResult}</span>
              </span>
            ) : (
              <span className="text-[#64748b]">
                提示：SolidWorks / Creo / NX 推荐导出 .stp (AP214) 或二进制 .stl；Web/BIM 推荐 .glb。
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-[26px] px-4 bg-white hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-[2px] text-[11.5px]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

interface ImportModelDialogProps {
  onImportGhpvResult: (result: GhpvImportResult) => void;
  onInspectImportedParams?: () => void;
  onSendExtractedToAi: (fileName: string, extractedText: string, notice?: string) => void;
  onSendBinaryDrawingToAi: (
    fileName: string,
    mimeType: string,
    dataUrl: string,
    sizeKb: number
  ) => void;
  onImportExternal3DFile: (fileName: string, buffer: ArrayBuffer) => Promise<SceneMeshStats>;
  onClose: () => void;
}

const MESH_3D_EXTS = new Set(['stl', 'obj', 'glb', 'gltf', 'stp', 'step', 'igs', 'iges', 'brp', 'brep']);
const GHPV_PROJECT_EXTS = new Set(['ghpv', 'json', 'xml']);
const DRAWING_BINARY_EXTS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp']);
const DRAWING_TEXT_EXTS = new Set(['dxf', 'svg', 'txt', 'csv']);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`读取文件 "${file.name}" 失败`));
    reader.readAsDataURL(file);
  });
}

export const ImportModelDialog: React.FC<ImportModelDialogProps> = ({
  onImportGhpvResult,
  onInspectImportedParams,
  onSendExtractedToAi,
  onSendBinaryDrawingToAi,
  onImportExternal3DFile,
  onClose,
}) => {
  const [tab, setTab] = useState<'ghpv' | 'mesh3d' | 'drawing'>('ghpv');
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ghpvResult, setGhpvResult] = useState<GhpvImportResult | null>(null);
  const [meshResult, setMeshResult] = useState<{ fileName: string; stats: SceneMeshStats } | null>(
    null
  );

  const ghpvInputRef = useRef<HTMLInputElement | null>(null);
  const meshInputRef = useRef<HTMLInputElement | null>(null);
  const drawingInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (MESH_3D_EXTS.has(ext)) {
        setTab('mesh3d');
        const buffer = await file.arrayBuffer();
        const stats = await onImportExternal3DFile(file.name, buffer);
        setMeshResult({ fileName: file.name, stats });
        setGhpvResult(null);
      } else if (GHPV_PROJECT_EXTS.has(ext)) {
        setTab('ghpv');
        const buffer = await file.arrayBuffer();
        const res = parseGhpvFileBuffer(file.name, buffer);
        setGhpvResult(res);
        setMeshResult(null);
        onImportGhpvResult(res);
      } else if (
        DRAWING_BINARY_EXTS.has(ext) ||
        file.type === 'application/pdf' ||
        (file.type.startsWith('image/') && ext !== 'svg')
      ) {
        setTab('drawing');
        if (file.size > 15 * 1024 * 1024) {
          throw new Error('上传的 PDF / 图纸文件超过 15 MB 上限，请压缩或截取单页后重试。');
        }
        const mimeType =
          ext === 'pdf' || file.type === 'application/pdf'
            ? 'application/pdf'
            : file.type || 'image/png';
        const dataUrl = await readFileAsDataUrl(file);
        const sizeKb = Math.max(1, Math.round(file.size / 1024));
        onSendBinaryDrawingToAi(file.name, mimeType, dataUrl, sizeKb);
        onClose();
      } else if (DRAWING_TEXT_EXTS.has(ext)) {
        setTab('drawing');
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength === 0) {
          throw new Error(`图纸/数据表文件 "${file.name}" 为空（0 字节）。`);
        }
        const raw = decodeTextBufferSmart(buffer);
        const extracted = extractTextFromCadDatasheetFile(file.name, raw);
        onSendExtractedToAi(
          file.name,
          extracted,
          `已通过「打开文件」解析 ${file.name} (${ext.toUpperCase()} · 自动适配 UTF-8/GBK)，点击下方按钮即可 AI 生成 3D 模型`
        );
        onClose();
      } else {
        setErrorMsg(
          `不支持的文件扩展名 .${ext || '(无扩展名)'}。支持：高惠工程 (.ghpv/.json/.xml)、三维模型 (.stp/.igs/.stl/.obj/.glb/.gltf) 以及图纸数据表 (.pdf/.dxf/.svg/.png/.jpg/.csv/.txt)。`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导入模型失败，请检查文件格式是否正确。');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="打开与导入模型"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      <div className="w-[620px] max-w-[96vw] flex flex-col bg-[#f3f5f8] border border-[#94a3b8] shadow-xl text-[12px] text-[#1f2937]">
        {/* Title Bar */}
        <div className="h-[30px] px-2.5 flex items-center justify-between bg-gradient-to-b from-white to-[#e6ebf2] border-b border-[#cbd5e1] select-none">
          <div className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
            <FolderOpen className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>打开文件 — 高惠工程 / 三维模型 / 图纸数据表</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导入窗口"
            className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#ef4444] hover:text-white text-[#475569]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-3 pt-2 flex items-center gap-1 bg-[#eef1f5] border-b border-[#cbd5e1] overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setTab('ghpv');
              setErrorMsg(null);
            }}
            className={`px-3 py-1 text-[11.5px] border-t border-x rounded-t-[2px] whitespace-nowrap ${
              tab === 'ghpv'
                ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            高惠工程 (.ghpv / .json / .xml)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('mesh3d');
              setErrorMsg(null);
            }}
            className={`px-3 py-1 text-[11.5px] border-t border-x rounded-t-[2px] whitespace-nowrap ${
              tab === 'mesh3d'
                ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            外部 3D 模型 (.stp / .igs / .stl / .obj / .glb)
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('drawing');
              setErrorMsg(null);
            }}
            className={`px-3 py-1 text-[11.5px] border-t border-x rounded-t-[2px] whitespace-nowrap ${
              tab === 'drawing'
                ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            图纸 / PDF / DXF (AI 识图)
          </button>
        </div>

        {/* Body */}
        <div className="p-4 bg-white space-y-3">
          {tab === 'ghpv' ? (
            <>
              <div className="text-[11px] text-[#475569] leading-relaxed">
                无损打开本系统保存的 <code className="px-1 bg-[#f1f5f9] rounded">.ghpv</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.json</code> 参数化工程，同时支持自动解压桌面原版高惠{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.ghpv</code>（含 ZIP/GZIP 压缩容器、XML/JSON 参数及内嵌 BRep/3D 几何体，自动适配 UTF-8 / GBK / UTF-16LE）。
              </div>

              <input
                ref={ghpvInputRef}
                type="file"
                accept=".ghpv,.json,.xml,.stp,.step,.igs,.iges,.stl,.obj,.glb,.gltf,.pdf,.dxf,.svg,.txt,.csv,image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => ghpvInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[3px] p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#2563eb] bg-[#dbeafe]'
                    : 'border-[#93c5fd] hover:border-[#2563eb] bg-[#f8fafc] hover:bg-[#eff6ff]'
                }`}
              >
                {busy ? (
                  <Loader2 className="w-7 h-7 text-[#2563eb] animate-spin" />
                ) : (
                  <Upload className="w-7 h-7 text-[#2563eb]" />
                )}
                <div className="font-semibold text-[#1e293b]">
                  点击选择或拖入高惠模型文件 (.ghpv / .json / .xml)
                </div>
                <div className="text-[10.5px] text-[#64748b]">
                  也支持直接拖入 .stp / .igs / .stl / .obj / .glb / .pdf / .dxf，系统会自动识别并分流打开
                </div>
              </div>

              {ghpvResult && (() => {
                const bom = generateBOM(ghpvResult.assemblies);
                const allComps = ghpvResult.assemblies.flatMap((ap) => ap.components);
                const mainCount = allComps.filter((c) => c.category === 'main').length;
                const nozzles = allComps.filter((c) => c.type === 'nozzle_manhole');
                const formatLabel =
                  ghpvResult.sourceFormat === 'ghpv_json'
                    ? 'GHPV 原生参数化'
                    : ghpvResult.sourceFormat === 'ghpv_zip_archive'
                    ? '高惠 ZIP 工程包'
                    : ghpvResult.sourceFormat === 'ghpv_xml_text'
                    ? '高惠 XML/文本'
                    : '高惠原版二进制';
                const sp = ghpvResult.spec;

                return (
                  <div className="p-2.5 bg-[#ecfdf5] border border-[#a7f3d0] rounded-[2px] space-y-2 text-[11px] max-h-[280px] overflow-y-auto tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-[#047857] min-w-0">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">打开成功：{ghpvResult.fileName}</span>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] bg-white border border-[#6ee7b7] text-[#047857] rounded-[2px]">
                        {formatLabel}
                      </span>
                    </div>

                    <div className="text-[#065f46]">{ghpvResult.summary}</div>

                    {/* BOM & Assembly Overview Strip */}
                    <div className="px-2 py-1 bg-white border border-[#a7f3d0] rounded-[2px] flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-[#1e293b]">
                      <span>装配点: <strong>{ghpvResult.assemblies.length}</strong></span>
                      <span>主构件: <strong>{mainCount}</strong></span>
                      <span>管口/人孔: <strong>{nozzles.length}</strong></span>
                      <span>估算净重: <strong>{bom.totalWeightKg.toFixed(1)} kg</strong></span>
                      <span>内容积: <strong>{bom.totalInternalVolumeM3.toFixed(2)} m³</strong></span>
                    </div>

                    {/* Parsed TechnicalSpec Compact Grid */}
                    <div className="bg-white border border-[#cbd5e1] rounded-[2px] grid grid-cols-2 text-[10.5px]">
                      {[
                        ['设备位号', `${sp.vesselTag} · ${sp.vesselName}`],
                        ['规范/类别', `${sp.designCode} · ${sp.vesselClass}`],
                        [
                          '压力(MPa)',
                          `设计 ${sp.designPressure} / 工作 ${sp.workPressure} / 试验 ${sp.testPressure}`,
                        ],
                        ['温度(°C)', `设计 ${sp.designTemp} / 工作 ${sp.workTemp}`],
                        ['工作介质', sp.medium],
                        ['腐蚀/焊缝', `${sp.corrosionAllowance} mm / φ=${sp.weldEfficiency}`],
                        ['无损检测', sp.ndtMethod],
                        ['热处理/图号', `${sp.heatTreatment} · ${sp.drawingNo}`],
                      ].map(([k, v], idx) => (
                        <div
                          key={k}
                          className={`px-2 py-1 flex items-center gap-1.5 border-b border-[#e2e8f0] ${
                            idx % 2 === 0 ? 'border-r border-[#e2e8f0]' : ''
                          }`}
                        >
                          <span className="text-[#64748b] shrink-0">{k}:</span>
                          <span className="text-[#0f172a] truncate" title={v}>
                            {v || '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Nozzle Roster */}
                    {nozzles.length > 0 && (
                      <div className="bg-white border border-[#cbd5e1] rounded-[2px] px-2 py-1.5 space-y-1">
                        <div className="text-[10px] font-semibold text-[#334155]">
                          已解析管口与人孔 ({nozzles.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nozzles.slice(0, 12).map((nz) => {
                            const p = nz.params as NozzleManholeParams;
                            return (
                              <span
                                key={nz.id}
                                className="px-1.5 py-0.5 text-[10px] bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#1e293b]"
                                title={`${p.tag} ${p.purpose} DN${p.dn} PN${p.pn} ${p.angleDeg}°`}
                              >
                                {p.tag} DN{p.dn} ({p.angleDeg}°)
                              </span>
                            );
                          })}
                          {nozzles.length > 12 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#64748b]">
                              +{nozzles.length - 12} 项
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Archive File Manifest (for ZIP-packaged .ghpv) */}
                    {ghpvResult.archiveEntries && ghpvResult.archiveEntries.length > 0 && (
                      <div className="bg-white border border-[#cbd5e1] rounded-[2px] px-2 py-1.5 space-y-1">
                        <div className="text-[10px] font-semibold text-[#334155]">
                          已解压内部文件清单 ({ghpvResult.archiveEntries.length} 个)
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ghpvResult.archiveEntries.slice(0, 12).map((ent, idx) => (
                            <span
                              key={`${ent.name}-${idx}`}
                              className="px-1.5 py-0.5 text-[10px] bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] text-[#334155]"
                              title={`${ent.name} (${formatBytes(ent.sizeBytes)} · ${ent.kind})`}
                            >
                              {ent.name} · {ent.kind}
                            </span>
                          ))}
                          {ghpvResult.archiveEntries.length > 12 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#64748b]">
                              +{ghpvResult.archiveEntries.length - 12} 个文件
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Extra Metadata Preview */}
                    {ghpvResult.extraMetadata && ghpvResult.extraMetadata.length > 0 && (
                      <div className="bg-white border border-[#cbd5e1] rounded-[2px] px-2 py-1.5 space-y-1">
                        <div className="text-[10px] font-semibold text-[#334155]">
                          附加档案字段 ({ghpvResult.extraMetadata.length} 项 · 完整信息见右侧「用户参数」)
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#475569]">
                          {ghpvResult.extraMetadata.slice(0, 6).map((item, idx) => (
                            <span key={`${item.key}-${idx}`} className="truncate max-w-[240px]">
                              <strong className="text-[#334155] font-medium">{item.key}:</strong> {item.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ghpvResult.warnings && ghpvResult.warnings.length > 0 && (
                      <div className="p-2 bg-[#fffbeb] border border-[#fcd34d] rounded-[2px] text-[10.5px] text-[#92400e] space-y-0.5">
                        <div className="flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#d97706]" />
                          <span>解析提示（请核对以下推断参数）</span>
                        </div>
                        {ghpvResult.warnings.map((w, i) => (
                          <div key={i}>• {w}</div>
                        ))}
                      </div>
                    )}

                    {ghpvResult.sourceFormat !== 'ghpv_json' && ghpvResult.extractedText && (
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#a7f3d0]">
                        <span className="text-[10.5px] text-[#047857]">
                          检测到高惠桌面原版文件，已按提取字段重建三维模型，也可交给 AI 进一步补全细部管口：
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onSendExtractedToAi(
                              ghpvResult.fileName,
                              `[高惠原版文件解析文本: ${ghpvResult.fileName}]\n${ghpvResult.extractedText || ''}`,
                              '已载入高惠原版文件提取参数，可直接点击下方按钮用 AI 补全三维模型'
                            );
                            onClose();
                          }}
                          className="shrink-0 h-[24px] px-2.5 flex items-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[10.5px] rounded-[2px]"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>送入 AI 补全</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : tab === 'mesh3d' ? (
            <>
              <div className="text-[11px] text-[#475569] leading-relaxed">
                支持将 SolidWorks、Creo、NX 或本系统导出的三维文件（
                <code className="px-1 bg-[#f1f5f9] rounded">.stp</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.igs</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.stl</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.obj</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.glb</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.gltf</code>
                ）载入三维视口，支持 360° 旋转、线框/投影线框切换、三轴剖视图与两点距离测量。
              </div>

              <input
                ref={meshInputRef}
                type="file"
                accept=".stp,.step,.igs,.iges,.stl,.obj,.glb,.gltf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => meshInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[3px] p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#2563eb] bg-[#dbeafe]'
                    : 'border-[#93c5fd] hover:border-[#2563eb] bg-[#f8fafc] hover:bg-[#eff6ff]'
                }`}
              >
                {busy ? (
                  <Loader2 className="w-7 h-7 text-[#2563eb] animate-spin" />
                ) : (
                  <Layers className="w-7 h-7 text-[#2563eb]" />
                )}
                <div className="font-semibold text-[#1e293b]">
                  点击选择或拖入外部三维模型 (.stp / .igs / .stl / .obj / .glb / .gltf)
                </div>
                <div className="text-[10.5px] text-[#64748b]">
                  自动识别毫米/米单位并居中对焦，可在视口顶部一键切换回参数化编辑模型
                </div>
              </div>

              {meshResult && (
                <div className="p-2.5 bg-[#eff6ff] border border-[#93c5fd] rounded-[2px] space-y-1 text-[11px] tabular-nums">
                  <div className="flex items-center gap-1.5 font-semibold text-[#1e40af]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2563eb]" />
                    <span>已在三维视口加载：{meshResult.fileName}</span>
                  </div>
                  <div className="text-[#1e3a8a]">
                    三角面片：{meshResult.stats.triangleCount.toLocaleString()} · 外形包络：
                    {meshResult.stats.sizeMm[0]} × {meshResult.stats.sizeMm[1]} ×{' '}
                    {meshResult.stats.sizeMm[2]} mm
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] text-[#475569] leading-relaxed">
                打开压力容器设计条件图、竣工图或设备数据表（
                <code className="px-1 bg-[#f1f5f9] rounded">.pdf</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.dxf</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.png</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.jpg</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.svg</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.csv</code> /{' '}
                <code className="px-1 bg-[#f1f5f9] rounded">.txt</code>
                ），系统将自动载入右侧「AI 建模」面板，支持 GBK/UTF-8 自动解码并一键生成 1:1 参数化三维设备。
              </div>

              <input
                ref={drawingInputRef}
                type="file"
                accept=".pdf,image/*,.dxf,.svg,.txt,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => drawingInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[3px] p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#2563eb] bg-[#dbeafe]'
                    : 'border-[#93c5fd] hover:border-[#2563eb] bg-[#f8fafc] hover:bg-[#eff6ff]'
                }`}
              >
                {busy ? (
                  <Loader2 className="w-7 h-7 text-[#2563eb] animate-spin" />
                ) : (
                  <FileText className="w-7 h-7 text-[#2563eb]" />
                )}
                <div className="font-semibold text-[#1e293b]">
                  点击选择或拖入图纸 / PDF / DXF / 数据表
                </div>
                <div className="text-[10.5px] text-[#64748b]">
                  选定后将自动切换到右侧「AI 建模」面板并挂载文件（PDF/图纸上限 15 MB）
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="p-2 bg-[#fef2f2] border border-[#fca5a5] rounded-[2px] text-[11px] text-[#991b1b] flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-[#eef1f5] border-t border-[#cbd5e1] flex justify-end gap-2">
          {ghpvResult && onInspectImportedParams && (
            <button
              type="button"
              onClick={onInspectImportedParams}
              className="h-[26px] px-3 bg-white hover:bg-[#dbeafe] border border-[#93c5fd] text-[#1d4ed8] rounded-[2px] text-[11.5px] font-medium"
            >
              查看完整参数与档案
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-[26px] px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px] text-[11.5px] font-medium"
          >
            {ghpvResult || meshResult ? '进入视口查看' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
};
