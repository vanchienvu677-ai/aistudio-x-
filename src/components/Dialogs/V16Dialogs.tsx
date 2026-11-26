import React, { useMemo, useRef, useState } from 'react';
import { X, Copy, Check, Download, Upload, ClipboardPaste, Plus, Trash2, Search, AlertTriangle, CheckCircle2, Crosshair, Wrench } from 'lucide-react';
import type {
  AssemblyPoint,
  NozzleManholeParams,
  TechnicalSpec,
  VesselComponent,
} from '../../types/vessel';
import {
  calculateCostEstimate,
  checkInterferences,
  generateBOM,
  generatePdmsMacro,
  MATERIAL_CATALOG,
} from '../../core/vesselMath';
import {
  GHPV_FLANGE_ACCENT,
  VESSEL_PRESETS,
} from '../../data/presets';
import {
  exportNozzleTableCsv,
  parseNozzleTableText,
  TOWER_NOZZLE_SAMPLE_CSV,
} from '../../core/douyinDeliveryTools';

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================================
 * 1. 向导式建模 Dialog (Guided Parametric Wizard — Matches GHPV V1.6 Video)
 * ============================================================================ */
export const GuidedWizardDialog: React.FC<{
  onApply: (presetId: string, spec: TechnicalSpec, assemblies: AssemblyPoint[]) => void;
  onGenerateAndDraw?: (presetId: string, spec: TechnicalSpec, assemblies: AssemblyPoint[]) => void;
  onClose: () => void;
}> = ({ onApply, onGenerateAndDraw, onClose }) => {
  const [templateId, setTemplateId] = useState<string>('u_exchanger');
  const [vesselTag, setVesselTag] = useState<string>('E-402');
  const [diameter, setDiameter] = useState<number>(1000);
  const [mainLength, setMainLength] = useState<number>(3200);
  const [thickness, setThickness] = useState<number>(14);
  const [designPressure, setDesignPressure] = useState<number>(2.5);
  const [material, setMaterial] = useState<string>('Q345R');

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    const preset = VESSEL_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setVesselTag(preset.spec.vesselTag);
    setDesignPressure(preset.spec.designPressure);
    if (id === 'spherical_tank') {
      setDiameter(12300);
      setMainLength(12300);
      setThickness(34);
      setMaterial('Q370R');
    } else if (id === 'tower') {
      setDiameter(1600);
      setMainLength(3600);
      setThickness(14);
      setMaterial('Q345R');
    } else if (id === 'horizontal') {
      setDiameter(1200);
      setMainLength(3600);
      setThickness(12);
      setMaterial('Q345R');
    } else {
      setDiameter(1000);
      setMainLength(3200);
      setThickness(14);
      setMaterial('Q345R');
    }
  };

  const buildWizardResult = () => {
    const basePreset = VESSEL_PRESETS.find((p) => p.id === templateId) || VESSEL_PRESETS[0];
    const clonedAssemblies = JSON.parse(JSON.stringify(basePreset.assemblies)) as AssemblyPoint[];
    const matInfo = MATERIAL_CATALOG.find((m) => m.grade === material);
    const density = matInfo?.density ?? 7.85;

    const safeD = Math.max(300, Number(diameter) || 1000);
    const safeL = Math.max(500, Number(mainLength) || 3000);
    const safeT = Math.max(4, Number(thickness) || 12);

    // Apply wizard dimensions cleanly across main components & tube bundles
    for (const ap of clonedAssemblies) {
      for (const comp of ap.components) {
        const p = comp.params as unknown as Record<string, unknown>;
        if (comp.type === 'spherical_tank') {
          p.diameter = safeD;
          p.thickness = safeT;
          p.material = material;
          p.density = density;
        } else if (comp.type === 'shell') {
          p.diameter = safeD;
          p.thickness = safeT;
          p.material = material;
          p.density = density;
          if (!comp.name.includes('管箱')) {
            p.length = templateId === 'exchanger' ? Math.round(safeL * 0.45) : safeL;
          }
        } else if (comp.type === 'elliptical_head') {
          p.diameter = safeD;
          p.nominalThickness = safeT;
          p.blankThickness = safeT;
          p.minThickness = Math.round(safeT * 0.85 * 10) / 10;
          p.material = material;
          p.density = density;
        } else if (comp.type === 'equipment_flange') {
          p.dn = safeD;
          p.outerDiameter = safeD + 150;
          p.boltCircle = safeD + 105;
        } else if (comp.type === 'fixed_tubesheet' || comp.type === 'u_tube_head') {
          p.diameter = safeD;
          p.outerDiameter = safeD + 150;
          p.bcd = safeD + 105;
        } else if (comp.type === 'expansion_joint') {
          p.dn = safeD;
        } else if (comp.type === 'tube_layout') {
          p.shellDiameter = safeD;
          p.outerLimitDiameter = Math.max(250, safeD - 70);
          p.tubeLength = Math.max(1200, safeL - 480);
        } else if (comp.type === 'saddle') {
          p.vesselDiameter = safeD;
          p.centerHeight = Math.round(safeD * 0.82);
          p.baseLength = Math.round(safeD * 0.78);
        }
      }
    }

    const nextSpec: TechnicalSpec = {
      ...basePreset.spec,
      vesselTag: vesselTag.trim() || basePreset.spec.vesselTag,
      designPressure: Number(designPressure) || basePreset.spec.designPressure,
      testPressure: Math.round((Number(designPressure) || 1.6) * 1.25 * 100) / 100,
    };

    return { nextSpec, clonedAssemblies };
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const { nextSpec, clonedAssemblies } = buildWizardResult();
    onApply(templateId, nextSpec, clonedAssemblies);
    onClose();
  };

  const handleGenerateAndDraw = () => {
    const { nextSpec, clonedAssemblies } = buildWizardResult();
    if (onGenerateAndDraw) {
      onGenerateAndDraw(templateId, nextSpec, clonedAssemblies);
    } else {
      onApply(templateId, nextSpec, clonedAssemblies);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="向导式建模"
        className="w-[620px] max-w-[94vw] bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1]">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            向导式建模 — 快速参数化生成三维压力容器
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭向导式建模"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-3.5 space-y-3 text-[11.5px]">
          <div>
            <div className="font-medium text-[#334155] mb-1.5">1. 选择典型设备模板</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'exchanger', title: '固定管板', sub: 'BEM / 膨胀节' },
                { id: 'u_exchanger', title: 'U形管换热器', sub: 'BIU / 折流板' },
                { id: 'bku_reboiler', title: 'BKU 釜式重沸器', sub: '偏心锥 + U形管' },
                { id: 'tower', title: '精馏塔器', sub: '裙座+塔盘+平台' },
                { id: 'spherical_tank', title: '橘瓣球罐', sub: 'GB/T 12337' },
                { id: 'horizontal', title: '卧式储罐', sub: '双鞍座+人孔' },
              ].map((item) => {
                const active = templateId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTemplate(item.id)}
                    className={`p-2 text-left rounded-[2px] border transition-colors ${
                      active
                        ? 'bg-[#eff6ff] border-[#2563eb] text-[#1d4ed8]'
                        : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <div className="font-semibold text-[11.5px]">{item.title}</div>
                    <div className="text-[10px] text-[#64748b] mt-0.5">{item.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-[#cbd5e1] p-3 rounded-[2px]">
            <div className="font-medium text-[#334155] mb-2">2. 核心工艺与几何参数</div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 tabular-nums">
              <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                <span>设备位号</span>
                <input
                  type="text"
                  value={vesselTag}
                  onChange={(e) => setVesselTag(e.target.value)}
                  className="h-[23px] px-1.5 border border-[#cbd5e1] rounded-[2px]"
                />
              </label>
              <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                <span>主材牌号</span>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="h-[23px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                >
                  {MATERIAL_CATALOG.filter((m) => m.category !== '非金属垫片').map((m) => (
                    <option key={m.grade} value={m.grade}>
                      {m.grade} ({m.standard})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                <span>{templateId === 'spherical_tank' ? '球壳内径 Di(mm)' : '筒体内径 Di(mm)'}</span>
                <input
                  type="number"
                  min={300}
                  step={100}
                  value={diameter}
                  onChange={(e) => setDiameter(Number(e.target.value))}
                  className="h-[23px] px-1.5 border border-[#cbd5e1] rounded-[2px]"
                />
              </label>
              <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                <span>主壳壁厚 δn(mm)</span>
                <input
                  type="number"
                  min={4}
                  step={2}
                  value={thickness}
                  onChange={(e) => setThickness(Number(e.target.value))}
                  className="h-[23px] px-1.5 border border-[#cbd5e1] rounded-[2px]"
                />
              </label>
              {templateId !== 'spherical_tank' && (
                <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                  <span>主壳体长度 L(mm)</span>
                  <input
                    type="number"
                    min={600}
                    step={200}
                    value={mainLength}
                    onChange={(e) => setMainLength(Number(e.target.value))}
                    className="h-[23px] px-1.5 border border-[#cbd5e1] rounded-[2px]"
                  />
                </label>
              )}
              <label className="grid grid-cols-[95px_1fr] items-center gap-2">
                <span>设计压力 P(MPa)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={designPressure}
                  onChange={(e) => setDesignPressure(Number(e.target.value))}
                  className="h-[23px] px-1.5 border border-[#cbd5e1] rounded-[2px]"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-[26px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              取消
            </button>
            {onGenerateAndDraw && (
              <button
                type="button"
                onClick={handleGenerateAndDraw}
                className="px-3.5 h-[26px] bg-[#0f766e] hover:bg-[#115e59] text-white font-medium rounded-[2px]"
              >
                一键建模并出图
              </button>
            )}
            <button
              type="submit"
              className="px-4 h-[26px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-[2px]"
            >
              一键生成三维模型
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. 批量管口建模 Dialog (Batch Nozzle Table Editor)
 * ============================================================================ */
interface NozzleDraftRow {
  id: string;
  parentId: string;
  tag: string;
  purpose: string;
  dn: number;
  pn: string;
  axialOffset: number;
  angleDeg: number;
  protrusion: number;
  hasPad: boolean;
  isManhole: boolean;
}

export const BatchNozzleDialog: React.FC<{
  assembly: AssemblyPoint;
  onApplyNozzles: (assemblyId: string, updatedNozzles: VesselComponent[]) => void;
  onClose: () => void;
}> = ({ assembly, onApplyNozzles, onClose }) => {
  const mainComponents = assembly.components.filter((c) => c.category === 'main');
  const defaultParentId =
    mainComponents.find((c) => c.type === 'shell')?.id || mainComponents[0]?.id || '';

  const [rows, setRows] = useState<NozzleDraftRow[]>(() =>
    assembly.components
      .filter((c) => c.type === 'nozzle_manhole')
      .map((c) => {
        const p = c.params as NozzleManholeParams;
        return {
          id: c.id,
          parentId: c.parentId || defaultParentId,
          tag: p.tag,
          purpose: p.purpose,
          dn: p.dn,
          pn: p.pn,
          axialOffset: p.axialOffset,
          angleDeg: p.angleDeg,
          protrusion: p.protrusion,
          hasPad: p.hasPad,
          isManhole: p.isManhole,
        };
      })
  );

  const handleAddRow = () => {
    const nextIdx = rows.length + 1;
    setRows((prev) => [
      ...prev,
      {
        id: `batch-nozzle-${Date.now()}-${nextIdx}`,
        parentId: defaultParentId,
        tag: `N${nextIdx}`,
        purpose: '工艺备用口',
        dn: 100,
        pn: '150',
        axialOffset: 1000,
        angleDeg: (nextIdx * 45) % 360,
        protrusion: 240,
        hasPad: false,
        isManhole: false,
      },
    ]);
  };

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportText = (raw: string, mode: 'append' | 'replace') => {
    const res = parseNozzleTableText(raw, mainComponents, defaultParentId);
    if (res.rows.length === 0) {
      setImportNotice(res.warnings[0] || '未能解析出有效管口行，请检查逗号/制表符分隔格式');
      return;
    }
    setRows((prev) => (mode === 'replace' ? res.rows : [...prev, ...res.rows]));
    setImportNotice(
      `已自动导入 ${res.rows.length} 个管口${
        res.skippedCount > 0 ? `（跳过 ${res.skippedCount} 行无效数据）` : ''
      }`
    );
    setShowPasteBox(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      handleImportText(text, importMode);
    } catch {
      setImportNotice('读取管口表文件失败，请确认文件为 UTF-8 编码的 CSV/TXT 文本');
    }
  };

  const handleExportNozzlesCsv = () => {
    const csv = exportNozzleTableCsv(rows, mainComponents);
    triggerDownload(`${assembly.name}_管口表.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleApply = () => {
    const existingById = new Map(
      assembly.components
        .filter((c) => c.type === 'nozzle_manhole')
        .map((c) => [c.id, c])
    );

    const rebuilt: VesselComponent[] = rows
      .filter((r) => r.tag.trim().length > 0 && r.dn > 0)
      .map((r) => {
        const orig = existingById.get(r.id);
        const origParams = orig?.params as NozzleManholeParams | undefined;
        const dn = Math.max(15, Number(r.dn) || 100);
        const pipeOD = Math.round(dn * 1.08 * 10) / 10;
        const flangeOD = Math.round(dn * 1.45 + 65);
        const dnUnchanged = Boolean(origParams && origParams.dn === dn);

        const params: NozzleManholeParams = {
          ...(origParams || {}),
          tag: r.tag.trim(),
          purpose: r.purpose.trim() || '工艺管口',
          isManhole: r.isManhole,
          manholeType: origParams?.manholeType ?? '水平吊盖带颈对焊法兰人孔',
          flangeStandard: origParams?.flangeStandard ?? 'HG美标法兰',
          flangeSpec: origParams?.flangeSpec ?? 'HG/T 20615-2009',
          flangeType: origParams?.flangeType ?? 'WN-RF',
          pn: r.pn || '150',
          dn,
          pipeOD: dnUnchanged && origParams ? origParams.pipeOD : pipeOD,
          pipeThickness: origParams?.pipeThickness ?? (dn >= 200 ? 10 : 6),
          axialOffset: Number(r.axialOffset) || 0,
          angleDeg: Number(r.angleDeg) || 0,
          protrusion: Math.max(80, Number(r.protrusion) || 240),
          innerProtrusion: origParams?.innerProtrusion ?? 0,
          hasBlindCover: r.isManhole || (origParams?.hasBlindCover ?? false),
          hasPad: r.hasPad,
          hasElbow: origParams?.hasElbow ?? false,
          elbowDirDeg: origParams?.elbowDirDeg ?? 0,
          boltCount: dnUnchanged && origParams ? origParams.boltCount : dn >= 400 ? 20 : dn >= 200 ? 12 : 8,
          flangeOD: dnUnchanged && origParams ? origParams.flangeOD : flangeOD,
          flangeThickness: dnUnchanged && origParams ? origParams.flangeThickness : dn >= 400 ? 38 : 26,
          material: origParams?.material ?? '16MnIII',
          pipeMaterial: origParams?.pipeMaterial ?? '20',
          density: origParams?.density ?? 7.85,
        };

        return {
          id: r.id,
          name: params.tag,
          type: 'nozzle_manhole',
          category: 'attachment',
          parentId: r.parentId || defaultParentId,
          visible: orig?.visible ?? true,
          color: orig?.color ?? { ...GHPV_FLANGE_ACCENT },
          subNodes:
            orig?.subNodes && origParams?.isLiquidBoot
              ? orig.subNodes
              : params.hasPad
              ? ['接管', '法兰', '补强圈']
              : ['接管', '法兰'],
          params,
        };
      });

    onApplyNozzles(assembly.id, rebuilt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="批量管口建模"
        className="w-[900px] max-w-[95vw] h-[76vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            批量管口建模与自动导入 — {assembly.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭批量管口建模"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Auto-Import Toolbar (CSV / Excel Clipboard Paste / Export) */}
        <div className="px-3 py-1.5 bg-[#eef1f5] border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 h-[24px] flex items-center gap-1 bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px] text-[#1e293b]"
            >
              <Upload className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>导入管口表 (.csv/.txt)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className={`px-2.5 h-[24px] flex items-center gap-1 border rounded-[2px] ${
                showPasteBox
                  ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                  : 'bg-white hover:bg-[#dbeafe] border-[#94a3b8] text-[#1e293b]'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>粘贴 Excel 管口表</span>
            </button>
            <button
              type="button"
              onClick={handleExportNozzlesCsv}
              className="px-2.5 h-[24px] flex items-center gap-1 bg-white hover:bg-[#dcfce7] border border-[#94a3b8] rounded-[2px] text-[#166534]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出管口表 (.csv)</span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-[#475569]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="nozzle-import-mode"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
              />
              <span>追加导入</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="nozzle-import-mode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
              />
              <span>覆盖现有</span>
            </label>
          </div>
        </div>

        {showPasteBox && (
          <div className="px-3 py-2 bg-[#f8fafc] border-b border-[#cbd5e1] space-y-1.5 text-[11px] shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[#334155] font-medium">
                直接粘贴 Excel 工艺管口表或 CSV 文本（自动识别 符号 / 用途 / DN / PN / 定位距离 / 方位角 / 外伸 / 补强圈 / 人孔）
              </span>
              <button
                type="button"
                onClick={() => setPasteText(TOWER_NOZZLE_SAMPLE_CSV)}
                className="px-2 h-[21px] bg-white hover:bg-[#eff6ff] border border-[#93c5fd] text-[#1d4ed8] rounded-[2px]"
              >
                填入塔器典型管口示例
              </button>
            </div>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="例如：N1,塔顶气相口,250,150,200,0,280,是,否"
              className="w-full p-1.5 font-mono text-[10.5px] bg-white border border-[#cbd5e1] rounded-[2px] focus:border-[#2563eb] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3 h-[23px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
              >
                收起
              </button>
              <button
                type="button"
                onClick={() => handleImportText(pasteText, importMode)}
                className="px-3 h-[23px] bg-[#0f766e] hover:bg-[#115e59] text-white font-medium rounded-[2px]"
              >
                解析并自动导入管口
              </button>
            </div>
          </div>
        )}

        {importNotice && (
          <div className="px-3 py-1 bg-[#eff6ff] border-b border-[#bfdbfe] text-[11px] text-[#1e40af] flex items-center justify-between shrink-0">
            <span>{importNotice}</span>
            <button
              type="button"
              onClick={() => setImportNotice(null)}
              className="text-[10px] underline hover:text-[#1e3a8a]"
            >
              知道了
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-white p-2">
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-[#eef2f6] text-[#1e293b]">
              <tr>
                {['符号', '依附主构件', '管口用途', 'DN(mm)', 'PN', '定位距离(mm)', '方位角(°)', '外伸L1', '补强圈', '人孔', '操作'].map((h) => (
                  <th key={h} className="border border-[#cbd5e1] px-1.5 py-1 text-center font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}>
                  <td className="border border-[#e2e8f0] p-0.5 w-[56px]">
                    <input
                      type="text"
                      value={r.tag}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, tag: e.target.value } : x)))
                      }
                      className="w-full h-[21px] px-1 border border-transparent focus:border-[#3b82f6] focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[125px]">
                    <select
                      value={r.parentId}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, parentId: e.target.value } : x)))
                      }
                      className="w-full h-[21px] bg-transparent focus:outline-none"
                    >
                      {mainComponents.map((mc) => (
                        <option key={mc.id} value={mc.id}>
                          {mc.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5">
                    <input
                      type="text"
                      value={r.purpose}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, purpose: e.target.value } : x)))
                      }
                      className="w-full h-[21px] px-1 border border-transparent focus:border-[#3b82f6] focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[64px]">
                    <input
                      type="number"
                      min={15}
                      value={r.dn}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, dn: Number(e.target.value) } : x)))
                      }
                      className="w-full h-[21px] px-1 text-right focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[54px]">
                    <input
                      type="text"
                      value={r.pn}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, pn: e.target.value } : x)))
                      }
                      className="w-full h-[21px] px-1 text-center focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[76px]">
                    <input
                      type="number"
                      value={r.axialOffset}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, axialOffset: Number(e.target.value) } : x)))
                      }
                      className="w-full h-[21px] px-1 text-right focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[62px]">
                    <input
                      type="number"
                      value={r.angleDeg}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, angleDeg: Number(e.target.value) } : x)))
                      }
                      className="w-full h-[21px] px-1 text-right focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] p-0.5 w-[62px]">
                    <input
                      type="number"
                      min={80}
                      value={r.protrusion}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, protrusion: Number(e.target.value) } : x)))
                      }
                      className="w-full h-[21px] px-1 text-right focus:outline-none"
                    />
                  </td>
                  <td className="border border-[#e2e8f0] text-center">
                    <input
                      type="checkbox"
                      checked={r.hasPad}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, hasPad: e.target.checked } : x)))
                      }
                    />
                  </td>
                  <td className="border border-[#e2e8f0] text-center">
                    <input
                      type="checkbox"
                      checked={r.isManhole}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isManhole: e.target.checked } : x)))
                      }
                    />
                  </td>
                  <td className="border border-[#e2e8f0] text-center w-[42px]">
                    <button
                      type="button"
                      aria-label={`删除 ${r.tag}`}
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="p-0.5 text-[#64748b] hover:text-[#dc2626]"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-between shrink-0 text-[11.5px]">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 h-[25px] flex items-center gap-1 bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px] text-[#1e293b]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增管口行</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-[25px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 h-[25px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-[2px]"
            >
              应用到三维模型 ({rows.length} 个管口)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. 造价估算 Dialog (Manufacturing Cost Estimator — Matches GHPV V1.6 Video)
 * ============================================================================ */
export const CostEstimateDialog: React.FC<{
  assemblies: AssemblyPoint[];
  spec: TechnicalSpec;
  onClose: () => void;
}> = ({ assemblies, spec, onClose }) => {
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});

  const summary = useMemo(() => {
    const bom = generateBOM(assemblies);
    return calculateCostEstimate(bom.rows, bom, priceOverrides);
  }, [assemblies, priceOverrides]);

  const handleExportCsv = () => {
    const lines = [
      '费用项目,计算依据,参考单价,估算金额(RMB)',
      ...summary.breakdownRows.map(
        (r) => `"${r.category}","${r.basis}","${r.unitPriceLabel}",${r.amountRmb.toFixed(2)}`
      ),
      `加工检测及管理费,,,${summary.manufacturingTotalRmb.toFixed(2)}`,
      `增值税 (13%),,,${summary.taxRmb.toFixed(2)}`,
      `设备含税总造价,,,${summary.grandTotalRmb.toFixed(2)}`,
    ];
    triggerDownload(`${spec.vesselTag}_设备造价估算.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8;');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="压力容器造价估算"
        className="w-[820px] max-w-[94vw] max-h-[82vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            压力容器全成本造价估算 — {spec.vesselTag} {spec.vesselName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭造价估算"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3 text-[11.5px] tabular-nums">
          {/* Top KPI Strip */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white border border-[#cbd5e1] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#64748b]">主材及辅材费用</div>
              <div className="text-[16px] font-bold text-[#0f172a] mt-0.5">
                ¥ {summary.materialTotalRmb.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-white border border-[#cbd5e1] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#64748b]">加工检测及管理费</div>
              <div className="text-[16px] font-bold text-[#0f172a] mt-0.5">
                ¥ {summary.manufacturingTotalRmb.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-[#fffbeb] border border-[#f59e0b] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#92400e]">含税总造价 (13% VAT)</div>
              <div className="text-[16px] font-bold text-[#b45309] mt-0.5">
                ¥ {summary.grandTotalRmb.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-white border border-[#cbd5e1] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#64748b]">综合吨钢/公斤单价</div>
              <div className="text-[16px] font-bold text-[#1d4ed8] mt-0.5">
                ¥ {summary.unitPricePerKg.toFixed(2)} / kg
              </div>
            </div>
          </div>

          {/* Editable Material Price Table */}
          <div className="bg-white border border-[#cbd5e1] rounded-[2px] overflow-hidden">
            <div className="px-2.5 py-1.5 bg-[#eef2f6] border-b border-[#cbd5e1] font-semibold text-[#1e293b]">
              按材质分类汇总 (支持实时修改市场钢材单价)
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#f8fafc] text-[#475569]">
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-left">材质牌号</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-right">净重 (kg)</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-right">单价 (元/吨)</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-right">材料小计 (RMB)</th>
                </tr>
              </thead>
              <tbody>
                {summary.materialRows.map((m) => (
                  <tr key={m.material} className="border-b border-[#f1f5f9]">
                    <td className="px-2 py-1 font-medium text-[#0f172a]">{m.material}</td>
                    <td className="px-2 py-1 text-right">{m.weightKg.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        step={200}
                        min={1000}
                        aria-label={`${m.material} 单价`}
                        value={priceOverrides[m.material] ?? m.unitPricePerTon}
                        onChange={(e) =>
                          setPriceOverrides((prev) => ({
                            ...prev,
                            [m.material]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-[84px] h-[20px] px-1 text-right border border-[#cbd5e1] rounded-[2px]"
                      />
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      ¥ {m.costRmb.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Cost Breakdown */}
          <div className="bg-white border border-[#cbd5e1] rounded-[2px] overflow-hidden">
            <div className="px-2.5 py-1.5 bg-[#eef2f6] border-b border-[#cbd5e1] font-semibold text-[#1e293b]">
              制造与检测费用明细表
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#f8fafc] text-[#475569]">
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-left">费用项目</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-left">计算依据</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-right">费率 / 单价</th>
                  <th className="border-b border-[#e2e8f0] px-2 py-1 text-right">金额 (RMB)</th>
                </tr>
              </thead>
              <tbody>
                {summary.breakdownRows.map((row) => (
                  <tr key={row.category} className="border-b border-[#f1f5f9]">
                    <td className="px-2 py-1 font-medium text-[#0f172a]">{row.category}</td>
                    <td className="px-2 py-1 text-[#475569]">{row.basis}</td>
                    <td className="px-2 py-1 text-right text-[#475569]">{row.unitPriceLabel}</td>
                    <td className="px-2 py-1 text-right font-medium">
                      ¥ {row.amountRmb.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#fefce8] font-semibold text-[#92400e]">
                  <td className="px-2 py-1.5" colSpan={3}>
                    增值税 (13%) + 含税总造价合计
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    ¥ {summary.grandTotalRmb.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 h-[25px] flex items-center gap-1 text-[11.5px] bg-[#d97706] hover:bg-[#b45309] text-white rounded-[2px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出造价表 (.csv)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[25px] text-[11.5px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. 导入配管 PDMS / E3D 宏输出 Dialog (Matches GHPV V1.6 Video "转到PDMS")
 * ============================================================================ */
export const PdmsExportDialog: React.FC<{
  assemblies: AssemblyPoint[];
  spec: TechnicalSpec;
  onClose: () => void;
}> = ({ assemblies, spec, onClose }) => {
  const [copied, setCopied] = useState(false);
  const macroText = useMemo(() => generatePdmsMacro(assemblies, spec), [assemblies, spec]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(macroText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    triggerDownload(`${spec.vesselTag || 'EQUIP'}_PDMS.mac`, macroText, 'text/plain;charset=utf-8;');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="导入配管 PDMS / E3D 宏脚本"
        className="w-[740px] max-w-[94vw] h-[72vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            导入配管系统 (AVEVA PDMS / E3D PML Macro) — /{spec.vesselTag}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭PDMS导出"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-1.5 bg-[#eff6ff] border-b border-[#bfdbfe] text-[11px] text-[#1e40af] shrink-0">
          在 AVEVA PDMS / E3D 命令行输入 <code className="font-mono font-bold">$m/{spec.vesselTag}_PDMS.mac</code> 即可无损重建设备本体与所有带定位管口。
        </div>

        <div className="flex-1 min-h-0 p-2.5 bg-[#0f172a] overflow-auto">
          <pre className="text-[11px] leading-relaxed font-mono text-[#e2e8f0] whitespace-pre">
            {macroText}
          </pre>
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-end gap-2 shrink-0 text-[11.5px]">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 h-[25px] flex items-center gap-1 bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#16a34a]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制宏代码' : '复制 PML 宏'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 h-[25px] flex items-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 .mac 文件</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[25px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. 材料库 Dialog (GB/T 713 / NB/T 47008 Steel Material Catalog)
 * ============================================================================ */
export const MaterialLibraryDialog: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('全部');

  const filtered = MATERIAL_CATALOG.filter((m) => {
    const matchCat = category === '全部' || m.category === category;
    const q = query.trim().toLowerCase();
    const matchQ =
      !q || m.grade.toLowerCase().includes(q) || m.standard.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="压力容器标准材料库"
        className="w-[780px] max-w-[94vw] max-h-[75vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            压力容器标准材料库 (GB/T 150.2-2024 / GB/T 713 / NB/T 47008)
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭材料库"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-2 bg-[#eef1f5] border-b border-[#cbd5e1] flex items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1">
            {['全部', '碳素钢/低合金钢', '不锈钢', '锻件', '非金属垫片'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-2 py-0.5 rounded-[2px] border ${
                  category === c
                    ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                    : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f8fafc]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索牌号或标准号..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-[22px] pl-6 pr-2 w-[170px] bg-white border border-[#cbd5e1] rounded-[2px] focus:outline-none focus:border-[#2563eb]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-[#eef2f6] text-[#1e293b]">
              <tr>
                {[
                  '牌号',
                  '类别',
                  '执行标准',
                  '密度(g/cm³)',
                  '屈服 ReL(MPa)',
                  '[σ] 20°C',
                  '[σ] 150°C',
                  '[σ] 250°C',
                  '参考价(元/吨)',
                ].map((h) => (
                  <th key={h} className="border border-[#cbd5e1] px-2 py-1 text-center font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.grade} className={i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}>
                  <td className="border border-[#e2e8f0] px-2 py-1 font-semibold text-[#1d4ed8]">{m.grade}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1">{m.category}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1">{m.standard}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{m.density.toFixed(2)}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{m.yieldStrengthMpa || '-'}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{m.allowableStress20 || '-'}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{m.allowableStress150 || '-'}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{m.allowableStress250 || '-'}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right font-medium">
                    ¥ {m.refPricePerTon.toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[25px] text-[11.5px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. 三维干涉检查 Dialog (GHPV Ep 11: 管束交错干涉/管口碰撞检测与一键修正)
 * ============================================================================ */
export const InterferenceCheckDialog: React.FC<{
  assemblies: AssemblyPoint[];
  spec: TechnicalSpec;
  onLocateComponent: (compId: string) => void;
  onAutoFix: () => void;
  onOpen2DDrawing?: () => void;
  onClose: () => void;
}> = ({ assemblies, spec, onLocateComponent, onAutoFix, onOpen2DDrawing, onClose }) => {
  const report = useMemo(() => checkInterferences(assemblies), [assemblies]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="三维干涉检查"
        className="w-[780px] max-w-[94vw] max-h-[80vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            三维装配与管束干涉检查 — {spec.vesselTag} {spec.vesselName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭干涉检查"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3 text-[11.5px] tabular-nums">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-[#cbd5e1] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#64748b]">空间检测项总数</div>
              <div className="text-[18px] font-bold text-[#0f172a] mt-0.5">{report.checkedCount} 项</div>
            </div>
            <div
              className={`p-2.5 rounded-[2px] border ${
                report.errorCount > 0
                  ? 'bg-[#fef2f2] border-[#fca5a5]'
                  : 'bg-[#ecfdf5] border-[#86efac]'
              }`}
            >
              <div className="text-[10.5px] text-[#475569]">严重干涉冲突</div>
              <div
                className={`text-[18px] font-bold mt-0.5 ${
                  report.errorCount > 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                }`}
              >
                {report.errorCount} 处
              </div>
            </div>
            <div className="bg-white border border-[#cbd5e1] p-2.5 rounded-[2px]">
              <div className="text-[10.5px] text-[#64748b]">安全间距预警</div>
              <div className="text-[18px] font-bold text-[#d97706] mt-0.5">{report.warningCount} 处</div>
            </div>
          </div>

          {report.issues.length === 0 ? (
            <div className="bg-[#ecfdf5] border border-[#86efac] rounded-[2px] p-5 flex items-center gap-3 text-[#166534]">
              <CheckCircle2 className="w-7 h-7 text-[#16a34a] shrink-0" />
              <div>
                <div className="font-semibold text-[13px]">干涉检查全部通过（0 处冲突）</div>
                <div className="text-[11px] mt-0.5 text-[#15803d]">
                  当前三维模型的换热管束管桥/限定圆、工艺管口法兰包络及支座垫板区均满足 GB/T 150 与 GB/T 151 安全间隙要求，可直接一键出图。
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {report.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="bg-white border border-[#cbd5e1] rounded-[2px] p-2.5 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          issue.severity === 'error' ? 'text-[#dc2626]' : 'text-[#d97706]'
                        }`}
                      />
                      <span className="font-semibold text-[#0f172a]">{issue.title}</span>
                      <span
                        className={`px-1.5 py-0.2 text-[10px] rounded-[2px] font-medium ${
                          issue.severity === 'error'
                            ? 'bg-[#fee2e2] text-[#b91c1c]'
                            : 'bg-[#fef3c7] text-[#92400e]'
                        }`}
                      >
                        干涉量 {issue.clearanceMm} mm
                      </span>
                      <span className="text-[10.5px] text-[#64748b]">对象: {issue.componentNames}</span>
                    </div>
                    <p className="text-[11px] text-[#334155]">{issue.detail}</p>
                    <p className="text-[10.5px] text-[#1d4ed8]">修正建议: {issue.suggestion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (issue.componentIds[0]) {
                        onLocateComponent(issue.componentIds[0]);
                      }
                    }}
                    className="px-2.5 h-[24px] shrink-0 flex items-center gap-1 text-[11px] bg-[#f8fafc] hover:bg-[#dbeafe] border border-[#cbd5e1] hover:border-[#60a5fa] text-[#1e293b] rounded-[2px]"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>定位</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-between shrink-0 text-[11.5px]">
          <span className="text-[#475569] text-[10.5px]">
            检查标准: GB/T 151-2014 换热管中心距 ≥1.25d · 法兰安装扳手操作间隙 ≥25mm
          </span>
          <div className="flex items-center gap-2">
            {report.issues.length > 0 ? (
              <button
                type="button"
                onClick={onAutoFix}
                className="px-3.5 h-[25px] flex items-center gap-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-medium rounded-[2px]"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>一键修正管束/避让</span>
              </button>
            ) : (
              onOpen2DDrawing && (
                <button
                  type="button"
                  onClick={onOpen2DDrawing}
                  className="px-3.5 h-[25px] flex items-center gap-1 bg-[#0f766e] hover:bg-[#115e59] text-white font-medium rounded-[2px]"
                >
                  <span>一键生成2D工程图</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-[25px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
