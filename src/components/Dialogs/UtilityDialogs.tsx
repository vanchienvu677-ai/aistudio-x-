import React, { useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import type {
  AssemblyPoint,
  ConeParams,
  NozzleManholeParams,
  SectionPlaneState,
  TechnicalSpec,
  TubeLayoutParams,
  ViewportBackgroundConfig,
} from '../../types/vessel';
import {
  bomToCsv,
  computeShellUnrollData,
  computeTubeLayout,
  generateBOM,
  generateShellUnrollDxf,
  layoutAssemblyMainComponents,
} from '../../core/vesselMath';
import { generateAssemblyDrawingDxf } from '../../core/douyinDeliveryTools';

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
 * 1. 材料表 Bill of Material Modal (Matches PDF Pages 13, 14, 23)
 * ============================================================================ */
export const BomDialog: React.FC<{
  assemblies: AssemblyPoint[];
  spec: TechnicalSpec;
  onClose: () => void;
}> = ({ assemblies, spec, onClose }) => {
  const bom = generateBOM(assemblies);

  const handleExportCsv = () => {
    const csv = bomToCsv(bom.rows, bom);
    triggerDownload(`${spec.vesselTag}_材料表_BOM.csv`, csv, 'text/csv;charset=utf-8;');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="材料表 Bill of Material"
        className="w-[980px] max-w-[95vw] h-[76vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-medium text-[#1e293b]">
            材料表 Bill of Material — {spec.vesselTag} {spec.vesselName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭材料表"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Excel-style Header Metadata (Page 14) */}
        <div className="px-3 py-2 bg-white border-b border-[#cbd5e1] grid grid-cols-4 gap-2 text-[11px] text-[#334155]">
          <div>设计单位: <span className="font-medium text-[#0f172a]">{spec.companyName}</span></div>
          <div>项目名称: <span className="font-medium text-[#0f172a]">{spec.projectName}</span></div>
          <div>设备位号: <span className="font-medium text-[#0f172a]">{spec.vesselTag}</span></div>
          <div>图纸编号: <span className="font-medium text-[#0f172a]">{spec.drawingNo}</span></div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-[#eef2f6] text-[#1e293b] z-10">
              <tr>
                {[
                  '序号\nNo.',
                  '标准号\nStandard Number',
                  '零件名称\nPart Name',
                  '材质\nMaterial',
                  '规格\nSize',
                  '工艺下料尺寸\nProcess Cutting Size',
                  '单台数量\nUnit QTY.',
                  '备件数量\nSpare QTY.',
                  '单重(kg)\nNet WT.',
                  '总重(kg)\nToT. WT.',
                  '内表面积\n(m²)-衬里',
                  '外表面积\n(m²)-油漆',
                  '容积\n(m³)',
                ].map((h) => (
                  <th
                    key={h}
                    className="border border-[#cbd5e1] px-2 py-1.5 font-medium whitespace-pre-line text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bom.rows.map((r, i) => (
                <tr key={r.index} className={i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-center">{r.tag}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1">{r.standard}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 font-medium text-[#0f172a]">{r.partName}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-center">{r.material}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1">{r.spec}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1">{r.cuttingSize}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-center">{r.unitQty}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-center">{r.spareQty}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">{r.unitWeightKg.toFixed(2)}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right font-medium">{r.totalWeightKg.toFixed(2)}</td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                    {r.innerAreaM2 > 0 ? r.innerAreaM2.toFixed(4) : ''}
                  </td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                    {r.outerAreaM2 > 0 ? r.outerAreaM2.toFixed(4) : ''}
                  </td>
                  <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                    {r.internalVolumeM3 > 0 ? r.internalVolumeM3.toFixed(4) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#eff6ff] font-semibold text-[#0f172a]">
              <tr>
                <td colSpan={9} className="border border-[#cbd5e1] px-2 py-1.5 text-right">
                  设备汇总合计 (Total):
                </td>
                <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{bom.totalWeightKg.toFixed(2)}</td>
                <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{bom.totalInnerAreaM2.toFixed(4)}</td>
                <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{bom.totalOuterAreaM2.toFixed(4)}</td>
                <td className="border border-[#cbd5e1] px-2 py-1.5 text-right">{bom.totalInternalVolumeM3.toFixed(4)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#475569] tabular-nums">
            共 {bom.rows.length} 项零部件 · 设备净重 {bom.totalWeightKg.toFixed(1)} kg · 总容积 {bom.totalInternalVolumeM3.toFixed(3)} m³
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 h-[26px] flex items-center gap-1.5 text-[11.5px] bg-[#15803d] hover:bg-[#166534] text-white rounded-[2px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出 Excel (CSV)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-[26px] text-[11.5px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. 三维模型转 2D 图纸 (GH2V2D) Modal (Matches PDF Pages 27-31)
 * ============================================================================ */
export const Drawing2DDialog: React.FC<{
  assemblies: AssemblyPoint[];
  spec: TechnicalSpec;
  initialSheetMode?: 'assembly' | 'quad_overview' | 'unroll';
  onClose: () => void;
}> = ({ assemblies, spec, initialSheetMode = 'assembly', onClose }) => {
  const [cadDarkTheme, setCadDarkTheme] = useState(true);
  const [sheetMode, setSheetMode] = useState<'assembly' | 'quad_overview' | 'unroll'>(initialSheetMode);
  const unrollSheets = React.useMemo(() => computeShellUnrollData(assemblies), [assemblies]);
  const [selectedShellId, setSelectedShellId] = useState<string>(() => unrollSheets[0]?.shellId ?? '');
  const activeUnrollSheet =
    unrollSheets.find((s) => s.shellId === selectedShellId) ?? unrollSheets[0] ?? null;

  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>(() => assemblies[0]?.id ?? '');
  const ap = assemblies.find((a) => a.id === selectedAssemblyId) || assemblies[0];
  const placedMains = ap ? layoutAssemblyMainComponents(ap) : [];
  const bom = generateBOM(assemblies);
  const nozzles = (ap?.components || []).filter((c) => c.type === 'nozzle_manhole');
  const tubeComp = (ap?.components || []).find((c) => c.type === 'tube_layout');
  const tubeLayoutData = tubeComp ? computeTubeLayout(tubeComp.params as TubeLayoutParams) : null;

  const totalLenMm =
    placedMains.length > 0 ? placedMains[placedMains.length - 1].endPosMm : 3600;
  const maxRadMm =
    placedMains.length > 0
      ? Math.max(...placedMains.map((p) => p.outerRadiusMm))
      : 600;

  const isHorizontal = ap?.orientation !== 'vertical';
  const strokeMain = cadDarkTheme ? '#f8fafc' : '#111827';
  const strokeDim = cadDarkTheme ? '#4ade80' : '#2563eb';
  const strokeCenter = cadDarkTheme ? '#ef4444' : '#dc2626';
  const strokeFrame = cadDarkTheme ? '#38bdf8' : '#1e293b';
  const bgFill = cadDarkTheme ? '#0f172a' : '#ffffff';
  const textFill = cadDarkTheme ? '#e2e8f0' : '#111827';

  // Fit vessel drawing cleanly in the left drawing area (x: 40..660, y: 50..360)
  const scale = isHorizontal
    ? Math.min(440 / Math.max(1000, totalLenMm), 115 / Math.max(300, maxRadMm * 2))
    : Math.min(270 / Math.max(1000, totalLenMm), 130 / Math.max(300, maxRadMm * 2));

  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const raw = new XMLSerializer().serializeToString(svgRef.current);
    const suffix =
      sheetMode === 'unroll' && activeUnrollSheet
        ? `${activeUnrollSheet.shellName}_展开下料图.svg`
        : '2D工程总图.svg';
    triggerDownload(`${spec.drawingNo}_${suffix}`, raw, 'image/svg+xml;charset=utf-8');
  };

  const handleExportDxf = () => {
    if (sheetMode === 'unroll') {
      if (!activeUnrollSheet) return;
      const dxf = generateShellUnrollDxf(activeUnrollSheet, spec);
      triggerDownload(
        `${spec.drawingNo}_${activeUnrollSheet.shellName}_筒体展开图.dxf`,
        dxf,
        'application/dxf;charset=utf-8'
      );
      return;
    }
    if (!ap) return;
    const dxf = generateAssemblyDrawingDxf(ap, spec, assemblies);
    triggerDownload(
      `${spec.drawingNo}_${ap.name}_2D工程总图.dxf`,
      dxf,
      'application/dxf;charset=utf-8'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="三维模型转 2D 工程图纸 (GH2V2D)"
        className="w-[1060px] max-w-[96vw] h-[84vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-medium text-[#1e293b]">
            GH2V2D — 压力容器二维工程总装配图 ({spec.drawingNo})
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭2D图纸"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drawing Toolbar */}
        <div className="px-3 py-1.5 bg-[#eef1f5] border-b border-[#cbd5e1] flex items-center justify-between gap-2 text-[11px] shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[#334155] whitespace-nowrap">图幅:</span>
            <button
              type="button"
              onClick={() => setSheetMode('assembly')}
              className={`px-2 h-[24px] whitespace-nowrap rounded-[2px] border ${
                sheetMode === 'assembly'
                  ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                  : 'bg-white text-[#334155] border-[#cbd5e1]'
              }`}
            >
              总装配图 (A1)
            </button>
            <button
              type="button"
              onClick={() => setSheetMode('quad_overview')}
              className={`px-2 h-[24px] whitespace-nowrap rounded-[2px] border ${
                sheetMode === 'quad_overview'
                  ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                  : 'bg-white text-[#334155] border-[#cbd5e1]'
              }`}
            >
              多图幅 (4图)
            </button>
            <button
              type="button"
              onClick={() => setSheetMode('unroll')}
              className={`px-2 h-[24px] whitespace-nowrap rounded-[2px] border ${
                sheetMode === 'unroll'
                  ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                  : 'bg-white text-[#334155] border-[#cbd5e1]'
              }`}
            >
              筒体展开图
            </button>
            {sheetMode !== 'unroll' && assemblies.length > 1 && (
              <select
                aria-label="选择出图装配点"
                value={ap?.id ?? ''}
                onChange={(e) => setSelectedAssemblyId(e.target.value)}
                className="h-[24px] max-w-[160px] px-1.5 text-[11px] bg-white border border-[#94a3b8] rounded-[2px] text-[#0f172a]"
              >
                {assemblies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.orientation === 'horizontal' ? '卧' : '立'})
                  </option>
                ))}
              </select>
            )}
            {sheetMode === 'unroll' && unrollSheets.length > 1 && (
              <select
                aria-label="选择展开筒节"
                value={activeUnrollSheet?.shellId ?? ''}
                onChange={(e) => setSelectedShellId(e.target.value)}
                className="h-[24px] max-w-[185px] px-1.5 text-[11px] bg-white border border-[#94a3b8] rounded-[2px] text-[#0f172a]"
              >
                {unrollSheets.map((s) => (
                  <option key={s.shellId} value={s.shellId}>
                    {s.shellName} (DN{s.innerDiameterMm}×{s.thicknessMm})
                  </option>
                ))}
              </select>
            )}
            <span className="text-[#cbd5e1] mx-0.5">|</span>
            <button
              type="button"
              onClick={() => setCadDarkTheme(true)}
              className={`px-2 h-[24px] whitespace-nowrap rounded-[2px] border ${
                cadDarkTheme
                  ? 'bg-[#0f172a] text-[#38bdf8] border-[#38bdf8]'
                  : 'bg-white text-[#334155] border-[#cbd5e1]'
              }`}
            >
              CAD黑底
            </button>
            <button
              type="button"
              onClick={() => setCadDarkTheme(false)}
              className={`px-2 h-[24px] whitespace-nowrap rounded-[2px] border ${
                !cadDarkTheme
                  ? 'bg-[#2563eb] text-white border-[#1d4ed8]'
                  : 'bg-white text-[#334155] border-[#cbd5e1]'
              }`}
            >
              白底蓝图
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(sheetMode !== 'unroll' || activeUnrollSheet) && (
              <button
                type="button"
                onClick={handleExportDxf}
                title="导出标准分层 DXF 图纸，可直接用 AutoCAD / 中望CAD / 浩辰CAD 打开编辑"
                className="px-2.5 h-[24px] whitespace-nowrap flex items-center gap-1 bg-[#15803d] hover:bg-[#166534] text-white rounded-[2px]"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{sheetMode === 'unroll' ? '导出展开 DXF' : '导出总图 DXF'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportSvg}
              className="px-2.5 h-[24px] whitespace-nowrap flex items-center gap-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-[2px]"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>导出 SVG</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-2.5 h-[24px] whitespace-nowrap flex items-center gap-1 bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>打印</span>
            </button>
          </div>
        </div>

        {/* Dynamic Engineering Blueprint SVG (A1 Standard Sheet Layout matching Pages 28-31) */}
        <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-[#cbd5e1]">
          <svg
            ref={svgRef}
            viewBox="0 0 1120 720"
            className="w-full h-full max-h-[680px] shadow-md"
            style={{ background: bgFill }}
          >
            {/* Outer & Inner Standard CAD Sheet Border */}
            <rect x="10" y="10" width="1100" height="700" fill={bgFill} stroke={strokeFrame} strokeWidth="1.5" />
            <rect x="26" y="18" width="1076" height="684" fill="none" stroke={strokeFrame} strokeWidth="2" />

            {/* ================= FRONT ELEVATION VIEW ================= */}
            <g>
              <text x="45" y="42" fontSize="13" fontWeight="700" fill={textFill}>
                主视图 (Front Elevation) — 比例 1:{Math.round(1 / scale)}
              </text>

              {isHorizontal ? (
                <g transform="translate(80, 210)">
                  {/* Centerline */}
                  <line
                    x1="-20"
                    y1="0"
                    x2={totalLenMm * scale + 25}
                    y2="0"
                    stroke={strokeCenter}
                    strokeDasharray="12,4,2,4"
                    strokeWidth="0.9"
                  />
                  {/* Main components (supports eccentric cones & radial shifts for BKU) */}
                  {placedMains.map((pm) => {
                    const x0 = pm.startPosMm * scale;
                    const len = pm.axialLengthMm * scale;
                    const r = pm.outerRadiusMm * scale;
                    const cy = -(pm.eccentricOffsetMm || 0) * scale;
                    if (pm.component.type === 'elliptical_head') {
                      const flipped = (pm.component.params as { flipped?: boolean }).flipped;
                      return (
                        <path
                          key={pm.component.id}
                          d={
                            flipped
                              ? `M${x0},${cy - r} Q${x0 + len * 1.1},${cy - r} ${x0 + len},${cy} Q${x0 + len * 1.1},${cy + r} ${x0},${cy + r} Z`
                              : `M${x0 + len},${cy - r} Q${x0 - len * 0.1},${cy - r} ${x0},${cy} Q${x0 - len * 0.1},${cy + r} ${x0 + len},${cy + r} Z`
                          }
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.8"
                        />
                      );
                    }
                    if (pm.component.type === 'cone') {
                      const cp = pm.component.params as ConeParams;
                      const rStart = ((cp.flipped ? cp.smallDiameter : cp.largeDiameter) / 2 + cp.thickness) * scale;
                      const rEnd = ((cp.flipped ? cp.largeDiameter : cp.smallDiameter) / 2 + cp.thickness) * scale;
                      const cyEnd =
                        cp.coneType === '偏心锥'
                          ? cy - (cp.flipped ? Math.abs(cp.largeDiameter - cp.smallDiameter) / 2 : -Math.abs(cp.largeDiameter - cp.smallDiameter) / 2) * scale
                          : cy;
                      return (
                        <path
                          key={pm.component.id}
                          d={`M${x0},${cy - rStart} L${x0 + len},${cyEnd - rEnd} L${x0 + len},${cyEnd + rEnd} L${x0},${cy + rStart} Z`}
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.8"
                        />
                      );
                    }
                    return (
                      <rect
                        key={pm.component.id}
                        x={x0}
                        y={cy - r}
                        width={len}
                        height={r * 2}
                        fill="none"
                        stroke={strokeMain}
                        strokeWidth="1.8"
                      />
                    );
                  })}

                  {/* Saddles in elevation */}
                  {ap?.components
                    .filter((c) => c.type === 'saddle')
                    .map((s) => {
                      const parent = placedMains.find((m) => m.component.id === s.parentId) || placedMains[0];
                      const sp = s.params as { axialOffset: number; centerHeight: number; baseWidth: number };
                      const cx = ((parent?.startPosMm || 0) + sp.axialOffset) * scale;
                      const h = sp.centerHeight * scale;
                      const w = sp.baseWidth * scale;
                      const r = (parent?.outerRadiusMm || 500) * scale;
                      return (
                        <g key={s.id}>
                          <rect x={cx - w / 2} y={r} width={w} height={Math.max(12, h - r)} fill="none" stroke={strokeMain} strokeWidth="1.5" />
                          <line x1={cx - w * 0.7} y1={h} x2={cx + w * 0.7} y2={h} stroke={strokeMain} strokeWidth="2" />
                        </g>
                      );
                    })}

                  {/* Nozzles in elevation */}
                  {nozzles.map((n) => {
                    const p = n.params as NozzleManholeParams;
                    const parent = placedMains.find((m) => m.component.id === n.parentId) || placedMains[0];
                    const r = (parent?.outerRadiusMm || 500) * scale;
                    const nw = Math.max(8, p.pipeOD * scale);
                    const nh = Math.max(16, p.protrusion * scale);
                    const isOnHead =
                      parent?.component.type === 'elliptical_head' ||
                      parent?.component.type === 'spherical_head';

                    if (isOnHead && parent) {
                      const flipped = (parent.component.params as { flipped?: boolean }).flipped;
                      const xBase = flipped ? parent.endPosMm * scale : parent.startPosMm * scale;
                      const xTip = flipped ? xBase + nh : xBase - nh;
                      return (
                        <g key={n.id}>
                          <rect
                            x={Math.min(xBase, xTip)}
                            y={-nw / 2}
                            width={nh}
                            height={nw}
                            fill="none"
                            stroke={strokeMain}
                            strokeWidth="1.5"
                          />
                          <line
                            x1={xTip}
                            y1={-nw * 0.85}
                            x2={xTip}
                            y2={nw * 0.85}
                            stroke={strokeMain}
                            strokeWidth="2.4"
                          />
                          <circle cx={xTip + (flipped ? 18 : -18)} cy={0} r="10" fill="none" stroke={strokeDim} strokeWidth="1" />
                          <text
                            x={xTip + (flipped ? 18 : -18)}
                            y={3.5}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill={strokeDim}
                            fontWeight="700"
                          >
                            {p.tag}
                          </text>
                        </g>
                      );
                    }

                    const nx = ((parent?.startPosMm || 0) + p.axialOffset) * scale;
                    const isBottom = Math.abs(p.angleDeg - 180) < 45;
                    const yBase = isBottom ? r : -r;
                    const yTip = isBottom ? r + nh : -r - nh;
                    return (
                      <g key={n.id}>
                        <rect
                          x={nx - nw / 2}
                          y={Math.min(yBase, yTip)}
                          width={nw}
                          height={nh}
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.5"
                        />
                        <line
                          x1={nx - nw * 0.85}
                          y1={yTip}
                          x2={nx + nw * 0.85}
                          y2={yTip}
                          stroke={strokeMain}
                          strokeWidth="2.4"
                        />
                        <circle
                          cx={isBottom ? nx + nw * 0.5 + 16 : nx}
                          cy={isBottom ? yTip - 4 : yTip - 16}
                          r="10"
                          fill="none"
                          stroke={strokeDim}
                          strokeWidth="1"
                        />
                        <text
                          x={isBottom ? nx + nw * 0.5 + 16 : nx}
                          y={isBottom ? yTip : yTip - 12}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill={strokeDim}
                          fontWeight="700"
                        >
                          {p.tag}
                        </text>
                      </g>
                    );
                  })}

                  {/* Overall Length Dimension Line */}
                  <line x1="0" y1={maxRadMm * scale + 68} x2={totalLenMm * scale} y2={maxRadMm * scale + 68} stroke={strokeDim} strokeWidth="1" />
                  <line x1="0" y1={maxRadMm * scale + 25} x2="0" y2={maxRadMm * scale + 75} stroke={strokeDim} strokeWidth="0.8" />
                  <line x1={totalLenMm * scale} y1={maxRadMm * scale + 25} x2={totalLenMm * scale} y2={maxRadMm * scale + 75} stroke={strokeDim} strokeWidth="0.8" />
                  <text
                    x={(totalLenMm * scale) / 2}
                    y={maxRadMm * scale + 63}
                    textAnchor="middle"
                    fontSize="11"
                    fill={strokeDim}
                  >
                    总长 L = {Math.round(totalLenMm)} mm
                  </text>
                </g>
              ) : (
                /* Vertical Vessel Front Elevation */
                <g transform="translate(260, 355)">
                  <line
                    x1="0"
                    y1={-(totalLenMm * scale) - 22}
                    x2="0"
                    y2="25"
                    stroke={strokeCenter}
                    strokeDasharray="12,4,2,4"
                    strokeWidth="0.9"
                  />
                  {placedMains.map((pm) => {
                    const yBot = -pm.startPosMm * scale;
                    const h = pm.axialLengthMm * scale;
                    const r = pm.outerRadiusMm * scale;
                    if (pm.component.type === 'elliptical_head') {
                      const flipped = (pm.component.params as { flipped?: boolean }).flipped;
                      return (
                        <path
                          key={pm.component.id}
                          d={
                            flipped
                              ? `M${-r},${yBot} Q${-r},${yBot - h * 1.1} 0,${yBot - h} Q${r},${yBot - h * 1.1} ${r},${yBot} Z`
                              : `M${-r},${yBot - h} Q${-r},${yBot + h * 0.1} 0,${yBot} Q${r},${yBot + h * 0.1} ${r},${yBot - h} Z`
                          }
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.8"
                        />
                      );
                    }
                    if (pm.component.type === 'cone') {
                      const cp = pm.component.params as { smallDiameter: number; largeDiameter: number; flipped: boolean };
                      const rBot = ((cp.flipped ? cp.smallDiameter : cp.largeDiameter) / 2) * scale;
                      const rTop = ((cp.flipped ? cp.largeDiameter : cp.smallDiameter) / 2) * scale;
                      return (
                        <path
                          key={pm.component.id}
                          d={`M${-rBot},${yBot} L${rBot},${yBot} L${rTop},${yBot - h} L${-rTop},${yBot - h} Z`}
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.8"
                        />
                      );
                    }
                    if (pm.component.type === 'spherical_tank') {
                      const cy = yBot - r;
                      return (
                        <g key={pm.component.id}>
                          <circle cx={0} cy={cy} r={r} fill="none" stroke={strokeMain} strokeWidth="2" />
                          {/* 5-zone orange-peel latitude & meridian dashed lines */}
                          <line x1={-r * 0.94} y1={cy - r * 0.34} x2={r * 0.94} y2={cy - r * 0.34} stroke={strokeMain} strokeWidth="0.9" strokeDasharray="4,2" />
                          <line x1={-r * 0.94} y1={cy + r * 0.34} x2={r * 0.94} y2={cy + r * 0.34} stroke={strokeMain} strokeWidth="0.9" strokeDasharray="4,2" />
                          <ellipse cx={0} cy={cy} rx={r * 0.48} ry={r} fill="none" stroke={strokeMain} strokeWidth="0.85" strokeDasharray="4,2" />
                          {/* Equatorial columns */}
                          {[-0.95, -0.58, 0.58, 0.95].map((f, ci) => (
                            <line
                              key={ci}
                              x1={r * f}
                              y1={cy}
                              x2={r * f}
                              y2={yBot + 36}
                              stroke={strokeMain}
                              strokeWidth="2.2"
                            />
                          ))}
                          <line x1={-r * 1.05} y1={yBot + 36} x2={r * 1.05} y2={yBot + 36} stroke={strokeMain} strokeWidth="1.5" />
                        </g>
                      );
                    }
                    return (
                      <rect
                        key={pm.component.id}
                        x={-r}
                        y={yBot - h}
                        width={r * 2}
                        height={h}
                        fill="none"
                        stroke={strokeMain}
                        strokeWidth="1.8"
                      />
                    );
                  })}
                  {/* Vertical nozzles in elevation */}
                  {nozzles.map((n) => {
                    const p = n.params as NozzleManholeParams;
                    const parent = placedMains.find((m) => m.component.id === n.parentId) || placedMains[0];
                    const r = (parent?.outerRadiusMm || 400) * scale;
                    const ny = -((parent?.startPosMm || 0) + p.axialOffset) * scale;
                    const nw = Math.max(7, p.pipeOD * scale);
                    const nh = Math.max(16, p.protrusion * scale);
                    const isLeft = p.angleDeg >= 135 && p.angleDeg <= 270;
                    const xBase = isLeft ? -r : r;
                    const xTip = isLeft ? -r - nh : r + nh;
                    return (
                      <g key={`vn-${n.id}`}>
                        <rect
                          x={Math.min(xBase, xTip)}
                          y={ny - nw / 2}
                          width={nh}
                          height={nw}
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.4"
                        />
                        <line
                          x1={xTip}
                          y1={ny - nw * 0.85}
                          x2={xTip}
                          y2={ny + nw * 0.85}
                          stroke={strokeMain}
                          strokeWidth="2.2"
                        />
                        <text
                          x={xTip + (isLeft ? -16 : 16)}
                          y={ny + 3}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill={strokeDim}
                          fontWeight="700"
                        >
                          {p.tag}
                        </text>
                      </g>
                    );
                  })}
                  <line x1={maxRadMm * scale + 45} y1="0" x2={maxRadMm * scale + 45} y2={-totalLenMm * scale} stroke={strokeDim} strokeWidth="1" />
                  <text x={maxRadMm * scale + 53} y={(-totalLenMm * scale) / 2} fontSize="11" fill={strokeDim}>
                    总高 H = {Math.round(totalLenMm)} mm
                  </text>
                </g>
              )}
            </g>

            {/* ================= END / NOZZLE ORIENTATION VIEW ================= */}
            <g transform="translate(650, 210)">
              <text x="-65" y="-128" fontSize="12" fontWeight="700" fill={textFill}>
                管口方位图 (Nozzle Orientation)
              </text>
              <circle cx="0" cy="0" r="64" fill="none" stroke={strokeMain} strokeWidth="1.8" />
              <line x1="-82" y1="0" x2="82" y2="0" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.9" />
              <line x1="0" y1="-82" x2="0" y2="82" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.9" />
              {/* Subtle interior cardinal angle labels so exterior nozzle callouts never overlap */}
              <text x="6" y="-48" fontSize="9" fill="#64748b">0°</text>
              <text x="44" y="-5" fontSize="9" fill="#64748b">90°</text>
              <text x="6" y="56" fontSize="9" fill="#64748b">180°</text>
              <text x="-58" y="-5" fontSize="9" fill="#64748b">270°</text>
              {Array.from(
                nozzles.reduce((acc, n) => {
                  const p = n.params as NozzleManholeParams;
                  const deg = ((p.angleDeg % 360) + 360) % 360;
                  const prev = acc.get(deg) || [];
                  prev.push(p.tag);
                  acc.set(deg, prev);
                  return acc;
                }, new Map<number, string[]>())
              ).map(([deg, tags]) => {
                const rad = ((deg - 90) * Math.PI) / 180;
                const x1 = Math.cos(rad) * 64;
                const y1 = Math.sin(rad) * 64;
                const x2 = Math.cos(rad) * 82;
                const y2 = Math.sin(rad) * 82;
                const tx = Math.cos(rad) * 98;
                const ty = Math.sin(rad) * 98 + 3;
                return (
                  <g key={`ang-${deg}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={strokeMain} strokeWidth="2.5" />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill={strokeDim}
                      fontWeight="700"
                    >
                      {tags.join(', ')} ({deg}°)
                    </text>
                  </g>
                );
              })}
            </g>

            {/* ================= DESIGN DATA TABLE (Top Right, Page 28-29) ================= */}
            <g transform="translate(800, 26)">
              <rect x="0" y="0" width="296" height="235" fill="none" stroke={strokeFrame} strokeWidth="1.4" />
              <rect x="0" y="0" width="296" height="22" fill="none" stroke={strokeFrame} strokeWidth="1" />
              <text x="148" y="15" textAnchor="middle" fontSize="11.5" fontWeight="700" fill={textFill}>
                设计数据表 DESIGN SPECIFICATION
              </text>
              {[
                ['设计标准', spec.designCode],
                ['容器类别', spec.vesselClass],
                ['设计压力 / 工作压力', `${spec.designPressure} / ${spec.workPressure} MPa`],
                ['耐压试验压力', `${spec.testPressure} MPa`],
                ['设计温度 / 工作温度', `${spec.designTemp} / ${spec.workTemp} °C`],
                ['工作介质', spec.medium],
                ['腐蚀裕量 / 焊缝系数', `${spec.corrosionAllowance} mm / ${spec.weldEfficiency}`],
                ['无损检测', spec.ndtMethod],
                ['设备总容积', `${bom.totalInternalVolumeM3.toFixed(3)} m³`],
                ['设备净重', `${bom.totalWeightKg.toFixed(1)} kg`],
              ].map(([k, v], i) => (
                <g key={k} transform={`translate(0, ${22 + i * 21})`}>
                  <line x1="0" y1="21" x2="296" y2="21" stroke={strokeFrame} strokeWidth="0.7" />
                  <line x1="125" y1="0" x2="125" y2="21" stroke={strokeFrame} strokeWidth="0.7" />
                  <text x="6" y="14" fontSize="9.5" fill={textFill}>{k}</text>
                  <text x="131" y="14" fontSize="9.5" fill={textFill}>{v}</text>
                </g>
              ))}
            </g>

            {/* ================= NOZZLE LIST TABLE (Mid Right) ================= */}
            <g transform="translate(800, 272)">
              <rect x="0" y="0" width="296" height="190" fill="none" stroke={strokeFrame} strokeWidth="1.4" />
              <text x="148" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill={textFill}>
                管口表 LIST OF NOZZLE
              </text>
              <line x1="0" y1="22" x2="296" y2="22" stroke={strokeFrame} strokeWidth="1" />
              <text x="8" y="35" fontSize="9" fontWeight="700" fill={textFill}>符号</text>
              <text x="48" y="35" fontSize="9" fontWeight="700" fill={textFill}>公称尺寸</text>
              <text x="108" y="35" fontSize="9" fontWeight="700" fill={textFill}>压力/密封面</text>
              <text x="182" y="35" fontSize="9" fontWeight="700" fill={textFill}>用途</text>
              <text x="255" y="35" fontSize="9" fontWeight="700" fill={textFill}>方位</text>
              <line x1="0" y1="40" x2="296" y2="40" stroke={strokeFrame} strokeWidth="0.8" />
              {nozzles.slice(0, 7).map((n, i) => {
                const p = n.params as NozzleManholeParams;
                return (
                  <g key={`nl-${n.id}`} transform={`translate(0, ${40 + i * 20})`}>
                    <line x1="0" y1="20" x2="296" y2="20" stroke={strokeFrame} strokeWidth="0.6" />
                    <text x="8" y="13" fontSize="9" fill={textFill}>{p.tag}</text>
                    <text x="48" y="13" fontSize="9" fill={textFill}>DN{p.dn}</text>
                    <text x="108" y="13" fontSize="9" fill={textFill}>PN{p.pn} RF</text>
                    <text x="182" y="13" fontSize="9" fill={textFill}>{p.purpose}</text>
                    <text x="255" y="13" fontSize="9" fill={textFill}>{p.angleDeg}°</text>
                  </g>
                );
              })}
            </g>

            {/* ================= BOM TABLE (Bottom Left, Page 28) ================= */}
            <g transform="translate(36, 480)">
              <rect x="0" y="0" width="750" height="212" fill="none" stroke={strokeFrame} strokeWidth="1.4" />
              <text x="375" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill={textFill}>
                零部件明细表 BILL OF MATERIAL
              </text>
              <line x1="0" y1="22" x2="750" y2="22" stroke={strokeFrame} strokeWidth="1" />
              <text x="10" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>序号</text>
              <text x="55" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>标准号</text>
              <text x="185" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>零件名称</text>
              <text x="295" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>规格</text>
              <text x="515" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>材质</text>
              <text x="595" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>数量</text>
              <text x="665" y="36" fontSize="9.5" fontWeight="700" fill={textFill}>单重(kg)</text>
              <line x1="0" y1="42" x2="750" y2="42" stroke={strokeFrame} strokeWidth="0.9" />
              {bom.rows.slice(0, 8).map((r, i) => (
                <g key={`b-${r.index}`} transform={`translate(0, ${42 + i * 20})`}>
                  <line x1="0" y1="20" x2="750" y2="20" stroke={strokeFrame} strokeWidth="0.5" />
                  <text x="14" y="13" fontSize="9" fill={textFill}>{r.tag}</text>
                  <text x="55" y="13" fontSize="9" fill={textFill}>{r.standard}</text>
                  <text x="185" y="13" fontSize="9" fill={textFill}>{r.partName}</text>
                  <text x="295" y="13" fontSize="9" fill={textFill}>{r.spec}</text>
                  <text x="515" y="13" fontSize="9" fill={textFill}>{r.material}</text>
                  <text x="602" y="13" fontSize="9" fill={textFill}>{r.unitQty}</text>
                  <text x="670" y="13" fontSize="9" fill={textFill}>{r.unitWeightKg.toFixed(1)}</text>
                </g>
              ))}
            </g>

            {/* ================= STANDARD ENGINEERING TITLE BLOCK (Bottom Right) ================= */}
            <g transform="translate(800, 565)">
              <rect x="0" y="0" width="296" height="127" fill="none" stroke={strokeFrame} strokeWidth="1.8" />
              <line x1="0" y1="32" x2="296" y2="32" stroke={strokeFrame} strokeWidth="1" />
              <line x1="0" y1="68" x2="296" y2="68" stroke={strokeFrame} strokeWidth="1" />
              <line x1="0" y1="98" x2="296" y2="98" stroke={strokeFrame} strokeWidth="1" />
              <text x="148" y="21" textAnchor="middle" fontSize="13" fontWeight="700" fill={textFill}>
                {spec.companyName}
              </text>
              <text x="148" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill={textFill}>
                {spec.vesselTag} {spec.vesselName}
              </text>
              <text x="10" y="87" fontSize="10" fill={textFill}>图号: {spec.drawingNo}</text>
              <text x="190" y="87" fontSize="10" fill={textFill}>版次: A/0</text>
              <text x="10" y="116" fontSize="9.5" fill={textFill}>设计: GHPV V2.1</text>
              <text x="165" y="116" fontSize="9.5" fill={textFill}>总重: {bom.totalWeightKg.toFixed(1)} kg</text>
            </g>

            {/* ================= QUAD OVERVIEW OVERLAY (VCAD 4-SHEET AUTOMATIC DRAWING MODE, Ep 14) ================= */}
            {sheetMode === 'quad_overview' && (
              <g>
                <rect x="0" y="0" width="1120" height="720" fill={bgFill} />
                {/* Sheet 1: Top-Left Assembly Elevation */}
                <g transform="translate(16, 16)">
                  <rect x="0" y="0" width="536" height="336" fill="none" stroke={strokeFrame} strokeWidth="1.8" />
                  <rect x="6" y="6" width="524" height="324" fill="none" stroke={strokeFrame} strokeWidth="0.9" />
                  <text x="16" y="24" fontSize="11" fontWeight="700" fill={strokeDim}>
                    图幅 1/4 — 总装配主视图 ({spec.vesselTag} · {spec.drawingNo}-01)
                  </text>
                  <g transform={isHorizontal ? 'translate(55, 175) scale(0.88)' : 'translate(260, 295) scale(0.75)'}>
                    <line
                      x1={isHorizontal ? -15 : 0}
                      y1={isHorizontal ? 0 : -(totalLenMm * scale) - 18}
                      x2={isHorizontal ? totalLenMm * scale + 20 : 0}
                      y2={isHorizontal ? 0 : 18}
                      stroke={strokeCenter}
                      strokeDasharray="10,4,2,4"
                      strokeWidth="0.9"
                    />
                    {placedMains.map((pm) => {
                      const len = pm.axialLengthMm * scale;
                      const r = pm.outerRadiusMm * scale;
                      if (isHorizontal) {
                        const x0 = pm.startPosMm * scale;
                        const cy = -(pm.eccentricOffsetMm || 0) * scale;
                        if (pm.component.type === 'elliptical_head') {
                          const flipped = (pm.component.params as { flipped?: boolean }).flipped;
                          return (
                            <path
                              key={`q1-${pm.component.id}`}
                              d={
                                flipped
                                  ? `M${x0},${cy - r} Q${x0 + len * 1.1},${cy - r} ${x0 + len},${cy} Q${x0 + len * 1.1},${cy + r} ${x0},${cy + r} Z`
                                  : `M${x0 + len},${cy - r} Q${x0 - len * 0.1},${cy - r} ${x0},${cy} Q${x0 - len * 0.1},${cy + r} ${x0 + len},${cy + r} Z`
                              }
                              fill="none"
                              stroke={strokeMain}
                              strokeWidth="1.6"
                            />
                          );
                        }
                        if (pm.component.type === 'cone') {
                          const cp = pm.component.params as ConeParams;
                          const rStart = ((cp.flipped ? cp.smallDiameter : cp.largeDiameter) / 2 + cp.thickness) * scale;
                          const rEnd = ((cp.flipped ? cp.largeDiameter : cp.smallDiameter) / 2 + cp.thickness) * scale;
                          const cyEnd =
                            cp.coneType === '偏心锥'
                              ? cy - (cp.flipped ? Math.abs(cp.largeDiameter - cp.smallDiameter) / 2 : -Math.abs(cp.largeDiameter - cp.smallDiameter) / 2) * scale
                              : cy;
                          return (
                            <path
                              key={`q1-${pm.component.id}`}
                              d={`M${x0},${cy - rStart} L${x0 + len},${cyEnd - rEnd} L${x0 + len},${cyEnd + rEnd} L${x0},${cy + rStart} Z`}
                              fill="none"
                              stroke={strokeMain}
                              strokeWidth="1.6"
                            />
                          );
                        }
                        return (
                          <rect
                            key={`q1-${pm.component.id}`}
                            x={x0}
                            y={cy - r}
                            width={len}
                            height={r * 2}
                            fill="none"
                            stroke={strokeMain}
                            strokeWidth="1.6"
                          />
                        );
                      }
                      const yBot = -pm.startPosMm * scale;
                      return (
                        <rect
                          key={`q1-${pm.component.id}`}
                          x={-r}
                          y={yBot - len}
                          width={r * 2}
                          height={len}
                          fill="none"
                          stroke={strokeMain}
                          strokeWidth="1.6"
                        />
                      );
                    })}
                  </g>
                  <rect x="240" y="286" width="290" height="44" fill={bgFill} stroke={strokeFrame} strokeWidth="1" />
                  <text x="248" y="303" fontSize="9.2" fill={textFill}>
                    {`${spec.vesselTag} ${spec.vesselName}`.slice(0, 32)}
                  </text>
                  <text x="248" y="320" fontSize="9" fill={strokeDim}>总长/高: {Math.round(totalLenMm)} mm · 比例 1:{Math.round(1 / scale)}</text>
                </g>

                {/* Sheet 2: Top-Right Nozzle Orientation & Tube Layout Sheet */}
                <g transform="translate(568, 16)">
                  <rect x="0" y="0" width="536" height="336" fill="none" stroke={strokeFrame} strokeWidth="1.8" />
                  <rect x="6" y="6" width="524" height="324" fill="none" stroke={strokeFrame} strokeWidth="0.9" />
                  <text x="16" y="24" fontSize="11" fontWeight="700" fill={strokeDim}>
                    图幅 2/4 — 管口方位图 & {tubeLayoutData ? `管板排管图 (${tubeLayoutData.totalCount}孔)` : '剖面详图'} ({spec.drawingNo}-02)
                  </text>
                  {/* Left half: Nozzle Orientation (grouped by angle to avoid overlap) */}
                  <g transform="translate(142, 180)">
                    <circle cx="0" cy="0" r="68" fill="none" stroke={strokeMain} strokeWidth="1.6" />
                    <line x1="-88" y1="0" x2="88" y2="0" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.8" />
                    <line x1="0" y1="-88" x2="0" y2="88" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.8" />
                    {Array.from(
                      nozzles.reduce((acc, n) => {
                        const p = n.params as NozzleManholeParams;
                        const deg = ((p.angleDeg % 360) + 360) % 360;
                        const prev = acc.get(deg) || [];
                        prev.push(p.tag);
                        acc.set(deg, prev);
                        return acc;
                      }, new Map<number, string[]>())
                    ).map(([deg, tags]) => {
                      const rad = ((deg - 90) * Math.PI) / 180;
                      return (
                        <g key={`q2n-${deg}`}>
                          <line x1={Math.cos(rad) * 68} y1={Math.sin(rad) * 68} x2={Math.cos(rad) * 86} y2={Math.sin(rad) * 86} stroke={strokeMain} strokeWidth="2.2" />
                          <text x={Math.cos(rad) * 100} y={Math.sin(rad) * 100 + 3} textAnchor="middle" fontSize="8.5" fill={strokeDim} fontWeight="700">
                            {tags.join(', ')} ({deg}°)
                          </text>
                        </g>
                      );
                    })}
                    <text x="0" y="124" textAnchor="middle" fontSize="9.5" fill={textFill}>管口方位图 (0°~360°)</text>
                  </g>
                  {/* Right half: Complete Tube Sheet Layout or Flange Detail */}
                  <g transform="translate(392, 180)">
                    <circle cx="0" cy="0" r="82" fill="none" stroke={strokeMain} strokeWidth="1.6" />
                    <circle cx="0" cy="0" r="74" fill="none" stroke={strokeDim} strokeDasharray="4,3" strokeWidth="0.9" />
                    {tubeLayoutData && tubeComp ? (
                      <>
                        {tubeLayoutData.tubes.map((t) => {
                          const tbScale = 70 / Math.max(100, (tubeComp.params as TubeLayoutParams).shellDiameter / 2);
                          return (
                            <circle
                              key={`q2t-${t.id}`}
                              cx={t.x * tbScale}
                              cy={t.y * tbScale}
                              r={Math.max(1.5, t.r * tbScale * 0.85)}
                              fill="none"
                              stroke={strokeMain}
                              strokeWidth="0.75"
                            />
                          );
                        })}
                        <text x="0" y="124" textAnchor="middle" fontSize="9.5" fill={textFill}>
                          排管图 ({tubeLayoutData.totalCount} 根 · {(tubeComp.params as TubeLayoutParams).pattern})
                        </text>
                      </>
                    ) : (
                      <>
                        <circle cx="0" cy="0" r="52" fill="none" stroke={strokeMain} strokeWidth="1.2" />
                        <line x1="-90" y1="0" x2="90" y2="0" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.8" />
                        <line x1="0" y1="-90" x2="0" y2="90" stroke={strokeCenter} strokeDasharray="8,3,2,3" strokeWidth="0.8" />
                        <text x="0" y="118" textAnchor="middle" fontSize="9.5" fill={textFill}>端面法兰与螺栓孔分布</text>
                      </>
                    )}
                  </g>
                </g>

                {/* Sheet 3: Bottom-Left Design Spec & Nozzle Schedule */}
                <g transform="translate(16, 368)">
                  <rect x="0" y="0" width="536" height="336" fill="none" stroke={strokeFrame} strokeWidth="1.8" />
                  <rect x="6" y="6" width="524" height="324" fill="none" stroke={strokeFrame} strokeWidth="0.9" />
                  <text x="16" y="24" fontSize="11" fontWeight="700" fill={strokeDim}>
                    图幅 3/4 — 技术特性表与接管表 ({spec.drawingNo}-03)
                  </text>
                  {[
                    ['设计规范 / 容器类别', `${spec.designCode} · ${spec.vesselClass}`],
                    ['设计压力 / 工作压力', `${spec.designPressure} MPa / ${spec.workPressure} MPa`],
                    ['耐压试验压力', `${spec.testPressure} MPa`],
                    ['设计温度 / 工作温度', `${spec.designTemp} °C / ${spec.workTemp} °C`],
                    ['工作介质 / 腐蚀裕量', `${spec.medium} / ${spec.corrosionAllowance} mm`],
                    ['无损检测 / 热处理', `${spec.ndtMethod} / ${spec.heatTreatment}`],
                  ].map(([k, v], idx) => (
                    <g key={`q3s-${idx}`} transform={`translate(16, ${36 + idx * 21})`}>
                      <rect x="0" y="0" width="504" height="21" fill="none" stroke={strokeFrame} strokeWidth="0.6" />
                      <line x1="160" y1="0" x2="160" y2="21" stroke={strokeFrame} strokeWidth="0.6" />
                      <text x="8" y="14" fontSize="9" fill={strokeDim}>{k}</text>
                      <text x="168" y="14" fontSize="9" fill={textFill}>{v}</text>
                    </g>
                  ))}
                  <text x="16" y="182" fontSize="10" fontWeight="700" fill={strokeDim}>管口表 NOZZLE SCHEDULE</text>
                  {nozzles.slice(0, 6).map((n, idx) => {
                    const p = n.params as NozzleManholeParams;
                    return (
                      <g key={`q3n-${n.id}`} transform={`translate(16, ${192 + idx * 21})`}>
                        <rect x="0" y="0" width="504" height="21" fill="none" stroke={strokeFrame} strokeWidth="0.6" />
                        <text x="8" y="14" fontSize="9" fontWeight="700" fill={strokeDim}>{p.tag}</text>
                        <text x="58" y="14" fontSize="9" fill={textFill}>DN{p.dn}</text>
                        <text x="128" y="14" fontSize="9" fill={textFill}>PN{p.pn} {p.flangeType}</text>
                        <text x="248" y="14" fontSize="9" fill={textFill}>{p.purpose}</text>
                        <text x="430" y="14" fontSize="9" fill={textFill}>{p.angleDeg}°</text>
                      </g>
                    );
                  })}
                </g>

                {/* Sheet 4: Bottom-Right BOM & Engineering Title Block */}
                <g transform="translate(568, 368)">
                  <rect x="0" y="0" width="536" height="336" fill="none" stroke={strokeFrame} strokeWidth="1.8" />
                  <rect x="6" y="6" width="524" height="324" fill="none" stroke={strokeFrame} strokeWidth="0.9" />
                  <text x="16" y="24" fontSize="11" fontWeight="700" fill={strokeDim}>
                    图幅 4/4 — 零部件明细表 (BOM) 与工程签字栏 ({spec.drawingNo}-04)
                  </text>
                  {bom.rows.slice(0, 9).map((r, idx) => (
                    <g key={`q4b-${r.index}`} transform={`translate(16, ${36 + idx * 21})`}>
                      <rect x="0" y="0" width="504" height="21" fill="none" stroke={strokeFrame} strokeWidth="0.6" />
                      <text x="8" y="14" fontSize="8.8" fill={strokeDim}>{r.tag}</text>
                      <text x="48" y="14" fontSize="8.8" fill={textFill}>{r.partName}</text>
                      <text x="175" y="14" fontSize="8.8" fill={textFill}>{r.spec.slice(0, 26)}</text>
                      <text x="368" y="14" fontSize="8.8" fill={textFill}>{r.material}</text>
                      <text x="442" y="14" fontSize="8.8" fill={textFill}>{r.unitWeightKg.toFixed(1)}kg</text>
                    </g>
                  ))}
                  <rect x="16" y="242" width="504" height="78" fill="none" stroke={strokeFrame} strokeWidth="1.4" />
                  <line x1="16" y1="268" x2="520" y2="268" stroke={strokeFrame} strokeWidth="0.8" />
                  <line x1="16" y1="294" x2="520" y2="294" stroke={strokeFrame} strokeWidth="0.8" />
                  <text x="268" y="260" textAnchor="middle" fontSize="11.5" fontWeight="700" fill={textFill}>
                    {spec.companyName} — {spec.projectName}
                  </text>
                  <text x="26" y="285" fontSize="10" fill={textFill}>
                    设备: {spec.vesselTag} {spec.vesselName}
                  </text>
                  <text x="380" y="285" fontSize="10" fill={strokeDim}>图号: {spec.drawingNo}</text>
                  <text x="26" y="311" fontSize="9.5" fill={textFill}>
                    总净重: {bom.totalWeightKg.toFixed(1)} kg · 总容积: {bom.totalInternalVolumeM3.toFixed(3)} m³
                  </text>
                  <text x="380" y="311" fontSize="9.5" fill={strokeDim}>GHPV V2.1 自动出图</text>
                </g>
              </g>
            )}

            {/* ================= SHELL UNROLL / OPENING DEVELOPMENT SHEET (筒体展开下料图, Ep 10) ================= */}
            {sheetMode === 'unroll' && (
              <g>
                <rect x="0" y="0" width="1120" height="720" fill={bgFill} />
                <rect x="10" y="10" width="1100" height="700" fill="none" stroke={strokeFrame} strokeWidth="1.5" />
                <rect x="26" y="18" width="1076" height="684" fill="none" stroke={strokeFrame} strokeWidth="2" />

                {activeUnrollSheet ? (() => {
                  const s = activeUnrollSheet;
                  const maxDrawW = 550;
                  const maxDrawH = 420;
                  const unrollScale = Math.min(
                    maxDrawW / Math.max(500, s.developedWidthMm),
                    maxDrawH / Math.max(400, s.lengthMm)
                  );
                  const plateW = s.developedWidthMm * unrollScale;
                  const plateH = s.lengthMm * unrollScale;
                  const originX = 95 + (maxDrawW - plateW) / 2;
                  const originY = 128 + (maxDrawH - plateH) / 2;
                  const strokeWarn = cadDarkTheme ? '#f59e0b' : '#d97706';
                  const strokePad = cadDarkTheme ? '#a78bfa' : '#7c3aed';

                  return (
                    <>
                      {/* Header */}
                      <text x="44" y="44" fontSize="13.5" fontWeight="700" fill={textFill}>
                        筒体展开与开孔排板下料图 — {s.shellName} (DN{s.innerDiameterMm} × δ{s.thicknessMm} · L={s.lengthMm} mm)
                      </text>
                      <text x="44" y="63" fontSize="10.5" fill={strokeDim}>
                        中性层展开宽 W = π×(Di+δ) = {s.developedWidthMm.toFixed(1)} mm · 比例 1:{Math.max(1, Math.round(1 / unrollScale))} · 共 {s.openings.length} 处开孔
                        {s.weldWarningCount > 0 ? ` · ⚠ ${s.weldWarningCount} 处距纵焊缝 < 50mm` : ' · 纵焊缝净距校验合格'}
                      </text>

                      {/* Top Dimension Line: Developed Width W */}
                      <line x1={originX} y1={originY - 32} x2={originX} y2={originY - 4} stroke={strokeDim} strokeWidth="0.9" />
                      <line x1={originX + plateW} y1={originY - 32} x2={originX + plateW} y2={originY - 4} stroke={strokeDim} strokeWidth="0.9" />
                      <line x1={originX} y1={originY - 22} x2={originX + plateW} y2={originY - 22} stroke={strokeDim} strokeWidth="1.1" />
                      <text
                        x={originX + plateW / 2}
                        y={originY - 27}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="600"
                        fill={strokeDim}
                      >
                        W = π({s.innerDiameterMm}+{s.thicknessMm}) = {s.developedWidthMm.toFixed(1)} mm
                      </text>

                      {/* Left Dimension Line: Shell Length L */}
                      <line x1={originX - 36} y1={originY} x2={originX - 4} y2={originY} stroke={strokeDim} strokeWidth="0.9" />
                      <line x1={originX - 36} y1={originY + plateH} x2={originX - 4} y2={originY + plateH} stroke={strokeDim} strokeWidth="0.9" />
                      <line x1={originX - 24} y1={originY} x2={originX - 24} y2={originY + plateH} stroke={strokeDim} strokeWidth="1.1" />
                      <text
                        x={originX - 30}
                        y={originY + plateH / 2}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="600"
                        fill={strokeDim}
                        transform={`rotate(-90 ${originX - 30} ${originY + plateH / 2})`}
                      >
                        L = {s.lengthMm} mm
                      </text>

                      {/* Plate Blank Outline */}
                      <rect
                        x={originX}
                        y={originY}
                        width={plateW}
                        height={plateH}
                        fill={cadDarkTheme ? 'rgba(56,189,248,0.06)' : 'rgba(37,99,235,0.04)'}
                        stroke={strokeMain}
                        strokeWidth="2"
                      />

                      {/* Longitudinal Weld Seam Lines at 0° & 360° */}
                      <line
                        x1={originX}
                        y1={originY - 12}
                        x2={originX}
                        y2={originY + plateH + 14}
                        stroke={strokeCenter}
                        strokeWidth="1.8"
                        strokeDasharray="6,3"
                      />
                      <line
                        x1={originX + plateW}
                        y1={originY - 12}
                        x2={originX + plateW}
                        y2={originY + plateH + 14}
                        stroke={strokeCenter}
                        strokeWidth="1.8"
                        strokeDasharray="6,3"
                      />

                      {/* Azimuth Grid Lines (0°, 90°, 180°, 270°, 360°) */}
                      {[0, 90, 180, 270, 360].map((deg) => {
                        const gx = originX + (deg / 360) * plateW;
                        const isSeam = deg === 0 || deg === 360;
                        return (
                          <g key={`az-${deg}`}>
                            {!isSeam && (
                              <line
                                x1={gx}
                                y1={originY}
                                x2={gx}
                                y2={originY + plateH}
                                stroke={strokeFrame}
                                strokeWidth="0.7"
                                strokeDasharray="8,4,2,4"
                                opacity="0.65"
                              />
                            )}
                            <text
                              x={gx}
                              y={originY + plateH + 26}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight={isSeam ? '700' : '500'}
                              fill={isSeam ? strokeCenter : textFill}
                            >
                              {isSeam ? `纵缝 ${deg}°` : `${deg}°`}
                            </text>
                          </g>
                        );
                      })}

                      {/* Nozzle Opening Cutouts + Reinforcement Pad Rings */}
                      {s.openings.map((op) => {
                        const cx = originX + op.arcXMm * unrollScale;
                        const cy = originY + plateH - op.axialYMm * unrollScale;
                        const cutR = Math.max(3.2, (op.cutoutDiaMm / 2) * unrollScale);
                        const padR = op.padOuterDiaMm
                          ? Math.max(cutR + 2.5, (op.padOuterDiaMm / 2) * unrollScale)
                          : null;
                        const holeStroke = op.weldSeamWarning ? strokeWarn : strokeDim;

                        return (
                          <g key={`unroll-op-${op.id}`}>
                            {padR && (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={padR}
                                fill="none"
                                stroke={strokePad}
                                strokeWidth="1"
                                strokeDasharray="4,2.5"
                              />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={cutR}
                              fill={cadDarkTheme ? 'rgba(15,23,42,0.85)' : '#ffffff'}
                              stroke={holeStroke}
                              strokeWidth="1.6"
                            />
                            <line
                              x1={cx - cutR - 5}
                              y1={cy}
                              x2={cx + cutR + 5}
                              y2={cy}
                              stroke={strokeCenter}
                              strokeWidth="0.7"
                            />
                            <line
                              x1={cx}
                              y1={cy - cutR - 5}
                              x2={cx}
                              y2={cy + cutR + 5}
                              stroke={strokeCenter}
                              strokeWidth="0.7"
                            />
                            <text
                              x={cx + cutR + 5}
                              y={cy - 4}
                              fontSize="9.5"
                              fontWeight="700"
                              fill={holeStroke}
                            >
                              {op.tag} Ø{op.cutoutDiaMm}
                            </text>
                            <text
                              x={cx + cutR + 5}
                              y={cy + 8}
                              fontSize="8.2"
                              fill={textFill}
                            >
                              ({op.arcXMm.toFixed(0)}, {op.axialYMm.toFixed(0)})
                            </text>
                          </g>
                        );
                      })}

                      {/* Legend Bar below drawing */}
                      <g transform="translate(44, 646)">
                        <line x1="0" y1="0" x2="24" y2="0" stroke={strokeCenter} strokeWidth="1.8" strokeDasharray="6,3" />
                        <text x="30" y="4" fontSize="9.5" fill={textFill}>纵焊缝 (0°/360°)</text>
                        <circle cx="152" cy="0" r="5" fill="none" stroke={strokeDim} strokeWidth="1.6" />
                        <text x="163" y="4" fontSize="9.5" fill={textFill}>接管开孔 (OD+2mm)</text>
                        <circle cx="294" cy="0" r="5" fill="none" stroke={strokePad} strokeWidth="1.1" strokeDasharray="3,2" />
                        <text x="305" y="4" fontSize="9.5" fill={textFill}>补强圈外径</text>
                        <circle cx="388" cy="0" r="5" fill="none" stroke={strokeWarn} strokeWidth="1.6" />
                        <text x="399" y="4" fontSize="9.5" fill={strokeWarn}>距纵焊缝 &lt; 50mm 警示</text>
                      </g>

                      {/* Right Panel: Plate Blank Spec Table */}
                      <g transform="translate(696, 36)">
                        <rect x="0" y="0" width="388" height="198" fill="none" stroke={strokeFrame} strokeWidth="1.3" />
                        <rect x="0" y="0" width="388" height="24" fill={cadDarkTheme ? 'rgba(56,189,248,0.14)' : 'rgba(37,99,235,0.08)'} />
                        <text x="10" y="16" fontSize="10.5" fontWeight="700" fill={strokeDim}>
                          筒节下料技术参数 (SHELL BLANK SPEC)
                        </text>
                        {[
                          ['筒节名称 / 材质', `${s.shellName} / ${s.material}`],
                          ['公称内径 Di / 壁厚 δ', `Ø${s.innerDiameterMm} mm / ${s.thicknessMm} mm`],
                          ['中性层直径 (Di + δ)', `Ø${s.meanDiameterMm} mm`],
                          ['内周长 π·Di', `${s.innerCircumferenceMm.toFixed(1)} mm`],
                          ['下料展开宽 W = π(Di+δ)', `${s.developedWidthMm.toFixed(1)} mm`],
                          ['下料长度 L / 展开面积', `${s.lengthMm} mm / ${s.plateAreaM2.toFixed(3)} m²`],
                          ['钢板理论净重', `${s.plateWeightKg.toFixed(1)} kg`],
                        ].map(([k, v], idx) => (
                          <g key={`spec-row-${idx}`} transform={`translate(0, ${24 + idx * 24.8})`}>
                            <line x1="0" y1="0" x2="388" y2="0" stroke={strokeFrame} strokeWidth="0.6" />
                            <line x1="168" y1="0" x2="168" y2="24.8" stroke={strokeFrame} strokeWidth="0.6" />
                            <text x="8" y="16" fontSize="9.2" fill={strokeDim}>{k}</text>
                            <text x="176" y="16" fontSize="9.5" fontWeight="600" fill={textFill}>{v}</text>
                          </g>
                        ))}
                      </g>

                      {/* Right Panel: Opening Coordinate Schedule */}
                      <g transform="translate(696, 250)">
                        <rect x="0" y="0" width="388" height="334" fill="none" stroke={strokeFrame} strokeWidth="1.3" />
                        <rect x="0" y="0" width="388" height="24" fill={cadDarkTheme ? 'rgba(56,189,248,0.14)' : 'rgba(37,99,235,0.08)'} />
                        <text x="10" y="16" fontSize="10.5" fontWeight="700" fill={strokeDim}>
                          开孔下料坐标表 (CNC / 划线坐标, 单位: mm)
                        </text>
                        <g transform="translate(0, 24)">
                          <line x1="0" y1="0" x2="388" y2="0" stroke={strokeFrame} strokeWidth="0.8" />
                          <text x="6" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>位号</text>
                          <text x="48" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>DN</text>
                          <text x="90" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>开孔Ø</text>
                          <text x="142" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>方位</text>
                          <text x="186" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>X(弧长)</text>
                          <text x="248" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>Y(轴向)</text>
                          <text x="308" y="15" fontSize="8.8" fontWeight="700" fill={strokeDim}>纵缝校验</text>
                          <line x1="0" y1="21" x2="388" y2="21" stroke={strokeFrame} strokeWidth="0.8" />
                        </g>
                        {s.openings.length === 0 ? (
                          <text x="194" y="90" textAnchor="middle" fontSize="10" fill={textFill}>
                            该筒节当前无附属接管/人孔开孔
                          </text>
                        ) : (
                          s.openings.slice(0, 12).map((op, idx) => (
                            <g key={`op-row-${op.id}`} transform={`translate(0, ${45 + idx * 23})`}>
                              <text x="6" y="15" fontSize="9" fontWeight="700" fill={op.weldSeamWarning ? strokeWarn : strokeDim}>
                                {op.tag}
                              </text>
                              <text x="48" y="15" fontSize="8.8" fill={textFill}>{op.dn}</text>
                              <text x="90" y="15" fontSize="8.8" fill={textFill}>{op.cutoutDiaMm}</text>
                              <text x="142" y="15" fontSize="8.8" fill={textFill}>{op.angleDeg}°</text>
                              <text x="186" y="15" fontSize="8.8" fill={textFill}>{op.arcXMm.toFixed(1)}</text>
                              <text x="248" y="15" fontSize="8.8" fill={textFill}>{op.axialYMm.toFixed(1)}</text>
                              <text
                                x="308"
                                y="15"
                                fontSize="8.5"
                                fontWeight="600"
                                fill={op.weldSeamWarning ? strokeWarn : strokeDim}
                              >
                                {op.weldSeamWarning ? `⚠ ${op.weldSeamClearanceMm}mm` : '✓ 合格'}
                              </text>
                              <line x1="0" y1="23" x2="388" y2="23" stroke={strokeFrame} strokeWidth="0.45" opacity="0.5" />
                            </g>
                          ))
                        )}
                      </g>

                      {/* Bottom-Right Title Block */}
                      <g transform="translate(696, 600)">
                        <rect x="0" y="0" width="388" height="86" fill="none" stroke={strokeFrame} strokeWidth="1.5" />
                        <line x1="0" y1="28" x2="388" y2="28" stroke={strokeFrame} strokeWidth="0.8" />
                        <line x1="0" y1="57" x2="388" y2="57" stroke={strokeFrame} strokeWidth="0.8" />
                        <text x="194" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill={textFill}>
                          {spec.companyName} — {spec.vesselTag} {spec.vesselName}
                        </text>
                        <text x="10" y="46" fontSize="9.5" fill={textFill}>图名: {s.shellName}展开排板图</text>
                        <text x="230" y="46" fontSize="9.5" fill={strokeDim}>图号: {spec.drawingNo}-UNROLL</text>
                        <text x="10" y="75" fontSize="9" fill={textFill}>标准: GB/T 150 · NB/T 47015</text>
                        <text x="230" y="75" fontSize="9" fill={strokeDim}>支持 1:1 DXF 导出</text>
                      </g>
                    </>
                  );
                })() : (
                  <g>
                    <text x="560" y="340" textAnchor="middle" fontSize="15" fontWeight="700" fill={textFill}>
                      当前模型不含直筒体 (如纯球形储罐)
                    </text>
                    <text x="560" y="370" textAnchor="middle" fontSize="11.5" fill={strokeDim}>
                      请切换至塔器、换热器、平底锥壳立式容器或卧式容器，或向当前模型添加筒体后查看展开图
                    </text>
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. 剖视图 Floating Panel (Matches PDF Page 8 exact dialog)
 * ============================================================================ */
export const SectionPlaneDialog: React.FC<{
  state: SectionPlaneState;
  onChange: (next: SectionPlaneState) => void;
  onClose: () => void;
}> = ({ state, onChange, onClose }) => {
  return (
    <div
      role="dialog"
      aria-label="剖视图"
      className="fixed left-[230px] bottom-[34px] z-40 w-[300px] bg-[#f3f4f6] border border-[#64748b] shadow-xl rounded-[3px] select-none"
    >
      <div className="h-[26px] px-2 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1]">
        <span className="text-[11.5px] font-medium text-[#1e293b]">剖视图</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭剖视图"
          className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2.5 space-y-2.5 text-[11.5px]">
        {(
          [
            { label: 'X 平面', enKey: 'xEnabled', posKey: 'xPos', flipKey: 'xFlip' },
            { label: 'Y 平面', enKey: 'yEnabled', posKey: 'yPos', flipKey: 'yFlip' },
            { label: 'Z 平面', enKey: 'zEnabled', posKey: 'zPos', flipKey: 'zFlip' },
          ] as const
        ).map((axis) => (
          <div key={axis.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state[axis.enKey]}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      enabled: true,
                      [axis.enKey]: e.target.checked,
                    })
                  }
                />
                <span>{axis.label}</span>
              </label>
              <input
                type="number"
                step={50}
                value={state[axis.posKey]}
                onChange={(e) =>
                  onChange({
                    ...state,
                    enabled: true,
                    [axis.posKey]: Number(e.target.value),
                  })
                }
                className="w-[72px] h-[20px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
              <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={state[axis.flipKey]}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      [axis.flipKey]: e.target.checked,
                    })
                  }
                />
                <span>正向/反向</span>
              </label>
            </div>
            <input
              type="range"
              min={-2500}
              max={2500}
              step={25}
              value={state[axis.posKey]}
              disabled={!state[axis.enKey]}
              onChange={(e) =>
                onChange({
                  ...state,
                  enabled: true,
                  [axis.posKey]: Number(e.target.value),
                })
              }
              className="w-full h-1.5 accent-[#2563eb]"
            />
          </div>
        ))}

        <div className="pt-1.5 border-t border-[#d5dbe3] flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              onChange({
                enabled: false,
                xEnabled: false,
                xPos: 0,
                xFlip: false,
                yEnabled: false,
                yPos: 0,
                yFlip: false,
                zEnabled: false,
                zPos: 0,
                zFlip: false,
              })
            }
            className="px-2.5 h-[22px] text-[11px] bg-white hover:bg-[#fee2e2] border border-[#94a3b8] rounded-[2px]"
          >
            重置剖切
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-[22px] text-[11px] bg-[#2563eb] text-white rounded-[2px]"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. Dlg_Config 视口背景设置 (Matches PDF Page 7 exact dialog)
 * ============================================================================ */
export const ConfigDialog: React.FC<{
  config: ViewportBackgroundConfig;
  onChange: (cfg: ViewportBackgroundConfig) => void;
  onClose: () => void;
}> = ({ config, onChange, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dlg_Config 视口设置"
        className="w-[340px] bg-[#f3f4f6] border border-[#64748b] shadow-xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[26px] px-2.5 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1]">
          <span className="text-[11.5px] font-medium text-[#1e293b]">Dlg_Config</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 space-y-3 text-[11.5px]">
          <div className="font-medium text-[#334155]">视口背景</div>
          <div className="flex items-center gap-5">
            {(
              [
                ['solid', '纯色'],
                ['gradient', '渐变'],
                ['grid', '工程网格'],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="bgMode"
                  checked={config.mode === mode}
                  onChange={() => onChange({ ...config, mode })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-1.5">
              <span>顶部颜色</span>
              <input
                type="color"
                value={config.topColor}
                onChange={(e) => onChange({ ...config, topColor: e.target.value })}
                className="w-7 h-5 border border-[#94a3b8] cursor-pointer"
              />
              <span className="text-[10.5px] font-mono text-[#475569]">{config.topColor}</span>
            </label>
            <label className="flex items-center gap-1.5">
              <span>底部颜色</span>
              <input
                type="color"
                value={config.bottomColor}
                onChange={(e) => onChange({ ...config, bottomColor: e.target.value })}
                className="w-7 h-5 border border-[#94a3b8] cursor-pointer"
              />
              <span className="text-[10.5px] font-mono text-[#475569]">{config.bottomColor}</span>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onChange({ mode: 'gradient', topColor: '#ffffff', bottomColor: '#8ee4e4' })}
              className="px-2 py-1 text-[11px] bg-white border border-[#cbd5e1] hover:bg-[#e0f2fe] rounded-[2px]"
            >
              GHPV 默认青色渐变
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: 'solid', topColor: '#ffffff', bottomColor: '#ffffff' })}
              className="px-2 py-1 text-[11px] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-[2px]"
            >
              纯白 (线框推荐)
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[24px] text-[11.5px] bg-[#2563eb] text-white rounded-[2px]"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. 关于高惠PV压力容器数字化交付软件 (Matches PDF Page 3 exact dialog)
 * ============================================================================ */
export const AboutDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="关于高惠PV压力容器数字化交付软件"
      className="w-[440px] max-w-[92vw] bg-[#f3f4f6] border border-[#64748b] shadow-xl rounded-[3px] overflow-hidden"
    >
      <div className="h-[26px] px-2.5 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1]">
        <span className="text-[11.5px] font-medium text-[#1e293b]">高惠PV压力容器数字化交付软件</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭关于窗口"
          className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-2.5 text-[11.5px] text-[#1e293b]">
        <div className="text-[18px] font-bold tracking-wide text-[#0f172a]">
          高惠PV压力容器数字化交付软件
        </div>
        <div className="text-[#475569]">版本号: 2024.4.22.15 - beta</div>
        <div className="text-[10.5px] text-[#64748b]">Copyright 2024 (GHPV) All rights reserved</div>
        <div className="bg-white border border-[#cbd5e1] p-2.5 text-[11px] leading-relaxed text-[#334155] space-y-1.5">
          <p>
            上海高惠科技有限公司压力容器数字化交付专用软件，采用搭积木式参数化建模流程，内置立式容器、卧式容器、塔器与换热器完整元件库。
          </p>
          <p>
            支持实时三维全真渲染、实体/线框/投影线框切换、X/Y/Z 剖视图、两点距离测量、管口符号标示、材料清单 (BOM) 自动统计与导出、STL 三维模型导出以及 GH2V2D 二维工程总图自动生成。
          </p>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-5 h-[24px] text-[11.5px] bg-[#2563eb] text-white rounded-[2px]"
        >
          确定
        </button>
      </div>
    </div>
  </div>
);
