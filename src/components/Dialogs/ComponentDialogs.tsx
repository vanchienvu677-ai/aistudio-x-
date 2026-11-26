import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
  ComponentParams,
  ConeParams,
  EllipticalHeadParams,
  EquipmentFlangeParams,
  NozzleManholeParams,
  SaddleParams,
  ShellParams,
  TechnicalSpec,
  TubeLayoutParams,
  VesselComponent,
} from '../../types/vessel';
import {
  calculateEllipticalHeadMetrics,
  calculateShellMetrics,
  computeComponentMetrics,
  computeTubeLayout,
  getComponentTypeLabel,
} from '../../core/vesselMath';
import { ComponentSchematicSvg, getContextualFieldLabels } from './ComponentSchematicSvg';

interface ComponentDialogProps {
  component: VesselComponent;
  isNew: boolean;
  onConfirm: (updated: VesselComponent) => void;
  onCancel: () => void;
}

const MATERIALS = [
  { name: 'Q345R', density: 7.85 },
  { name: 'Q245R', density: 7.85 },
  { name: '16MnIII', density: 7.85 },
  { name: '16MnII', density: 7.85 },
  { name: '20', density: 7.85 },
  { name: 'Q235B', density: 7.85 },
  { name: 'S30408', density: 7.93 },
  { name: 'S31603', density: 7.98 },
  { name: 'PTFE', density: 2.2 },
];

export const ComponentDialog: React.FC<ComponentDialogProps> = ({
  component,
  isNew,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState(component.name);
  const [params, setParams] = useState<ComponentParams>(() => ({ ...component.params }));
  const [queryResult, setQueryResult] = useState<Record<string, string> | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [nozzleTab, setNozzleTab] = useState<'flange' | 'geo' | 'material'>(() =>
    component.type === 'nozzle_manhole' && (component.params as NozzleManholeParams).hasElbow
      ? 'geo'
      : 'flange'
  );

  const updateField = (key: string, value: string | number | boolean) => {
    setValidationError(null);
    setParams((prev) => ({ ...prev, [key]: value }) as ComponentParams);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawName =
      component.type === 'nozzle_manhole'
        ? (params as NozzleManholeParams).tag || name
        : name;
    const updatedName = rawName.trim();
    if (!updatedName) {
      setValidationError('零件名称或管口符号不能为空。');
      return;
    }

    // Validate positive engineering dimensions
    const pRec = params as unknown as Record<string, unknown>;
    const positiveKeys: Array<[string, string]> = [
      ['diameter', '直径'],
      ['smallDiameter', '小端内径'],
      ['largeDiameter', '大端内径'],
      ['thickness', '厚度'],
      ['nominalThickness', '名义厚度'],
      ['length', '长度'],
      ['totalLength', '总长'],
      ['dn', '公称直径'],
      ['tubeOD', '换热管外径'],
      ['tubePitch', '管中心距'],
      ['tubeLength', '换热管长度'],
      ['centerHeight', '鞍座高度'],
      ['sizeA', '结构主尺寸'],
      ['sizeB', '结构辅尺寸'],
      ['outerDiameter', '外径'],
      ['topDiameter', '顶部直径'],
      ['bottomDiameter', '底部直径'],
      ['height', '高度'],
      ['width', '宽度'],
      ['widthMm', '平台宽度'],
      ['ladderHeightMm', '爬梯高度'],
    ];
    for (const [k, label] of positiveKeys) {
      if (k in pRec && typeof pRec[k] === 'number') {
        const num = pRec[k] as number;
        if (!Number.isFinite(num) || num <= 0) {
          setValidationError(`${label} 必须为大于 0 的有效数值。`);
          return;
        }
      }
    }
    if (component.type === 'tube_layout') {
      const tp = params as TubeLayoutParams;
      if (tp.tubePitch <= tp.tubeOD) {
        setValidationError('管中心距 S 必须大于换热管外径 d。');
        return;
      }
    }

    onConfirm({
      ...component,
      name: updatedName,
      params,
    });
  };

  const title =
    component.type === 'shell' || component.type === 'boot_shell'
      ? 'Dlg_Shell - 筒体参数'
      : component.type === 'elliptical_head'
      ? '椭圆封头'
      : component.type === 'cone'
      ? '锥壳属性'
      : component.type === 'equipment_flange'
      ? '设备法兰'
      : component.type === 'saddle'
      ? '鞍座 (NB/T 47065.1-2018)'
      : component.type === 'nozzle_manhole'
      ? '管法兰 / 人孔'
      : component.type === 'tube_layout'
      ? 'Dlg_TubeLayout - 管排布管'
      : `${getComponentTypeLabel(component.type)} 参数设置`;

  const renderContent = () => {
    if (component.type === 'elliptical_head') {
      const p = params as EllipticalHeadParams;
      const calc = calculateEllipticalHeadMetrics(p);
      return (
        <div className="grid grid-cols-[292px_1fr] gap-3">
          <div className="space-y-1.5 text-[11.5px] min-w-0">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">封头类型</label>
              <select
                value={p.headType}
                onChange={(e) => updateField('headType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="EHA">EHA (内径基准)</option>
                <option value="EHB">EHB (外径基准)</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={p.flipped}
                onChange={(e) => updateField('flipped', e.target.checked)}
              />
              <span>上下翻转 (左/下封头 ↔ 右/上封头)</span>
            </label>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">封头标准</label>
              <input
                type="text"
                value={p.standard}
                onChange={(e) => updateField('standard', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">封头直径 Di(mm)</label>
              <input
                type="number"
                min={50}
                value={p.diameter}
                onChange={(e) => updateField('diameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">直边高度 h(mm)</label>
              <input
                type="number"
                min={5}
                value={p.straightHeight}
                onChange={(e) => updateField('straightHeight', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">名义厚度 δn(mm)</label>
              <input
                type="number"
                min={2}
                value={p.nominalThickness}
                onChange={(e) => updateField('nominalThickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-1.5">
              <label className="truncate">投料厚度(mm)</label>
              <input
                type="number"
                min={2}
                value={p.blankThickness}
                onChange={(e) => updateField('blankThickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
              <button
                type="button"
                onClick={() => updateField('minThickness', calc.minFormedThicknessMm)}
                className="h-[22px] px-2.5 shrink-0 bg-[#e2e8f0] hover:bg-[#dbeafe] border border-[#cbd5e1] rounded-[2px]"
              >
                计算
              </button>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">最小成形厚度</label>
              <input
                type="number"
                step="0.1"
                value={p.minThickness}
                onChange={(e) => updateField('minThickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-[#f8fafc] rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">成型方法</label>
              <select
                value={p.formingMethod}
                onChange={(e) => updateField('formingMethod', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="冷冲压法">冷冲压法</option>
                <option value="冷旋压法">冷旋压法</option>
                <option value="热冲压法">热冲压法</option>
              </select>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">厚度减薄率%</label>
              <input
                type="number"
                min={0}
                max={40}
                value={p.thinningRate}
                onChange={(e) => updateField('thinningRate', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">材料</label>
              <select
                value={p.material}
                onChange={(e) => {
                  const found = MATERIALS.find((m) => m.name === e.target.value);
                  updateField('material', e.target.value);
                  if (found) updateField('density', found.density);
                }}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                {MATERIALS.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Technical Schematic + Query Results (Page 9 exact style) */}
          <div className="flex flex-col justify-between">
            <div className="bg-white border border-[#cbd5e1] p-2 flex flex-col items-center">
              <span className="self-start text-[11px] text-[#475569] mb-1">图示</span>
              <svg viewBox="0 0 260 135" className="w-full max-w-[260px] h-[135px]">
                {/* 2:1 elliptical head cross-section */}
                <path
                  d="M35,100 L35,84 C35,34 85,22 130,22 C175,22 225,34 225,84 L225,100 L216,100 L216,84 C216,42 170,31 130,31 C90,31 44,42 44,84 L44,100 Z"
                  fill="#93c5fd"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />
                <line x1="25" y1="84" x2="238" y2="84" stroke="#334155" strokeDasharray="4,3" strokeWidth="1" />
                <text x="190" y="80" fontSize="11" fill="#0f172a" fontWeight="600">T.L.</text>
                <line x1="44" y1="114" x2="216" y2="114" stroke="#0f172a" strokeWidth="1" />
                <text x="123" y="128" fontSize="12" fill="#0f172a" fontWeight="600">Di</text>
                <text x="234" y="96" fontSize="12" fill="#0f172a" fontWeight="600">h</text>
                <text x="40" y="34" fontSize="12" fill="#0f172a" fontWeight="600">δn</text>
              </svg>
            </div>

            <div className="mt-2 bg-[#f8fafc] border border-[#cbd5e1] p-2 text-[11px] tabular-nums">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-[#334155]">查询结果 (GB/T 25198-2023)</span>
                <button
                  type="button"
                  onClick={() =>
                    setQueryResult({
                      封头容积: `${calc.internalVolumeM3.toFixed(4)} m³`,
                      封头重量: `${calc.weightKg.toFixed(2)} kg`,
                      曲面高度: `${calc.crownHeightMm} mm`,
                      总深度: `${calc.totalDepthMm} mm`,
                      内表面积: `${calc.innerAreaM2.toFixed(4)} m²`,
                      外表面积: `${calc.outerAreaM2.toFixed(4)} m²`,
                      展开尺寸: `${calc.blankDiameterMm} mm`,
                    })
                  }
                  className="px-3 h-[21px] bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px] text-[#0f172a]"
                >
                  查询
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[#334155]">
                <div>封头容积: {(queryResult?.['封头容积'] ?? `${calc.internalVolumeM3.toFixed(4)} m³`)}</div>
                <div>封头重量: {(queryResult?.['封头重量'] ?? `${calc.weightKg.toFixed(2)} kg`)}</div>
                <div>曲面高度: {calc.crownHeightMm} mm</div>
                <div>总深度: {calc.totalDepthMm} mm</div>
                <div>内表面积: {calc.innerAreaM2.toFixed(4)} m²</div>
                <div>外表面积: {calc.outerAreaM2.toFixed(4)} m²</div>
                <div>展开尺寸: {calc.blankDiameterMm} mm</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (component.type === 'shell' || component.type === 'boot_shell') {
      const p = params as ShellParams;
      const m = calculateShellMetrics(p);
      return (
        <div className="grid grid-cols-[265px_1fr] gap-3">
          <div className="space-y-2 text-[11.5px] min-w-0">
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">筒体类型</label>
              <select
                value={p.shellKind}
                onChange={(e) => updateField('shellKind', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="筒体">筒体</option>
                <option value="变壁厚筒体">变壁厚筒体</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">筒体内径(Di)</label>
              <input
                type="number"
                min={50}
                value={p.diameter}
                onChange={(e) => updateField('diameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">筒体厚度(δn)</label>
              <input
                type="number"
                min={2}
                value={p.thickness}
                onChange={(e) => updateField('thickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">筒体长度(L)</label>
              <input
                type="number"
                min={50}
                value={p.length}
                onChange={(e) => updateField('length', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">材料</label>
              <select
                value={p.material}
                onChange={(e) => {
                  const found = MATERIALS.find((x) => x.name === e.target.value);
                  updateField('material', e.target.value);
                  if (found) updateField('density', found.density);
                }}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                {MATERIALS.map((mat) => (
                  <option key={mat.name} value={mat.name}>{mat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div className="bg-white border border-[#cbd5e1] p-2 flex flex-col items-center">
              <span className="self-start text-[11px] text-[#475569] mb-1">图示</span>
              <svg viewBox="0 0 220 130" className="w-[220px] h-[130px]">
                <rect x="45" y="15" width="12" height="100" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
                <rect x="155" y="15" width="12" height="100" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
                <line x1="106" y1="8" x2="106" y2="122" stroke="#dc2626" strokeDasharray="6,3,2,3" strokeWidth="1" />
                <line x1="57" y1="68" x2="155" y2="68" stroke="#0f172a" strokeWidth="1" />
                <text x="98" y="63" fontSize="12" fill="#0f172a" fontWeight="600">Di</text>
                <line x1="185" y1="15" x2="185" y2="115" stroke="#0f172a" strokeWidth="1" />
                <text x="190" y="68" fontSize="12" fill="#0f172a" fontWeight="600">L</text>
                <text x="169" y="108" fontSize="11" fill="#0f172a">δn</text>
              </svg>
            </div>
            <div className="mt-2 bg-[#f8fafc] border border-[#cbd5e1] p-2 text-[11px] tabular-nums">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-[#334155]">查询</span>
                <button
                  type="button"
                  onClick={() => setQueryResult({ ok: '1' })}
                  className="px-3 h-[21px] bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px]"
                >
                  查询
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[#334155]">
                <div>重量(kg): {m.weightKg.toFixed(1)}</div>
                <div>外表面积(m²): {m.outerAreaM2.toFixed(4)}</div>
                <div>容积(m³): {m.internalVolumeM3.toFixed(4)}</div>
                <div>内表面积(m²): {m.innerAreaM2.toFixed(4)}</div>
                <div>展开长度(mm): {m.unrolledLengthMm}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (component.type === 'nozzle_manhole') {
      const p = params as NozzleManholeParams;
      const elbowType = p.elbowType ?? '长半径';
      const elbowRadius = p.elbowRadius ?? Math.round((elbowType === '短半径' ? 1.0 : 1.5) * p.dn);
      const elbowRunLength = p.elbowRunLength ?? Math.max(350, Math.round(p.dn * 3.5));
      const elbowStandard = p.elbowStandard ?? 'GB/T 12459-2017';
      const elbowModel = p.elbowModel ?? `DN${p.dn}-90E(${elbowType === '短半径' ? 'S' : 'L'})`;
      const elbowMaterial = p.elbowMaterial ?? (p.pipeMaterial || '20');
      const elbowDensity = p.elbowDensity ?? p.density ?? 7.85;
      const tiltAngleDeg = p.tiltAngleDeg ?? 90;
      const positionType = p.positionType ?? '径向';
      const headRegion = p.headRegion ?? '下半球';
      const eccentricOffset = p.eccentricOffset ?? 0;
      const offsetL4 = p.offsetL4 ?? 0;
      const padOD = p.padOD ?? Math.round(p.pipeOD * 1.65);
      const padThickness = p.padThickness ?? Math.max(10, p.pipeThickness + 4);
      const padMaterial = p.padMaterial ?? 'Q345R';

      return (
        <div className="space-y-2 text-[11.5px]">
          {/* Classic GHPV 3-Tab Strip: 法兰和接管 | 几何定位/弯头 | 材料/开孔补强 */}
          <div className="flex items-end border-b border-[#cbd5e1] gap-1 -mt-1">
            {(
              [
                ['flange', '法兰和接管'],
                ['geo', '几何定位/弯头'],
                ['material', '材料/开孔补强'],
              ] as Array<['flange' | 'geo' | 'material', string]>
            ).map(([k, lbl]) => {
              const active = nozzleTab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNozzleTab(k)}
                  className={`px-3 h-[24px] text-[11.5px] rounded-t-[2px] border-t border-x transition-colors ${
                    active
                      ? 'bg-white text-[#0f172a] font-semibold border-[#94a3b8] -mb-[1px] pb-[1px]'
                      : 'bg-[#e8edf3] text-[#475569] border-[#cbd5e1] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* TAB 1: 法兰和接管 */}
          {nozzleTab === 'flange' && (
            <div className="grid grid-cols-[310px_1fr] gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">管口符号</label>
                  <input
                    type="text"
                    value={p.tag}
                    onChange={(e) => {
                      updateField('tag', e.target.value);
                      setName(e.target.value);
                    }}
                    className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer py-0.5 font-medium text-[#1d4ed8]">
                  <input
                    type="checkbox"
                    checked={p.isManhole}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateField('isManhole', checked);
                      if (checked) {
                        updateField('dn', 500);
                        updateField('pipeOD', 530);
                        updateField('flangeOD', 670);
                        updateField('hasBlindCover', true);
                        updateField('purpose', '人孔');
                      }
                    }}
                  />
                  <span>是否为人/手孔 (HG/T 21524-2014)</span>
                </label>
                {p.isManhole && (
                  <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                    <label className="truncate">人孔型式</label>
                    <select
                      value={p.manholeType}
                      onChange={(e) => updateField('manholeType', e.target.value)}
                      className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                    >
                      <option value="水平吊盖带颈对焊法兰人孔">水平吊盖带颈对焊法兰人孔</option>
                      <option value="垂直吊盖带颈对焊法兰人孔">垂直吊盖带颈对焊法兰人孔</option>
                      <option value="回转盖人孔">回转盖人孔</option>
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">管口用途</label>
                  <input
                    type="text"
                    value={p.purpose}
                    onChange={(e) => updateField('purpose', e.target.value)}
                    className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
                  />
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">法兰标准</label>
                  <select
                    value={p.flangeStandard}
                    onChange={(e) => {
                      const std = e.target.value;
                      updateField('flangeStandard', std);
                      updateField(
                        'flangeSpec',
                        std === 'HG美标法兰' ? 'HG/T 20615-2009' : 'HG/T 20592-2009'
                      );
                    }}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    <option value="HG美标法兰">HG美标法兰 (HG/T 20615)</option>
                    <option value="HG欧标法兰">HG欧标法兰 (HG/T 20592)</option>
                  </select>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">法兰型式</label>
                  <select
                    value={p.flangeType}
                    onChange={(e) => updateField('flangeType', e.target.value)}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    <option value="WN-RF">WN-RF (带颈对焊突面)</option>
                    <option value="SO-RF">SO-RF (带颈平焊突面)</option>
                    <option value="LWN-RF">LWN-RF (长高颈突面)</option>
                    <option value="PL-RF">PL-RF (板式平焊突面)</option>
                  </select>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">公称直径 / PN</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      min={15}
                      title="公称直径 DN"
                      value={p.dn}
                      onChange={(e) => {
                        const dn = Number(e.target.value);
                        updateField('dn', dn);
                        updateField('pipeOD', Math.round(dn * 1.08));
                        updateField('flangeOD', Math.round(dn * 1.45 + 65));
                        const rMult = elbowType === '短半径' ? 1.0 : 1.5;
                        updateField('elbowRadius', Math.round(dn * rMult));
                        updateField(
                          'elbowModel',
                          `DN${dn}-90E(${elbowType === '短半径' ? 'S' : 'L'})`
                        );
                      }}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                    <input
                      type="text"
                      title="公称压力 PN / Class"
                      value={p.pn}
                      onChange={(e) => updateField('pn', e.target.value)}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">管外径 / 壁厚</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      min={18}
                      step="0.1"
                      title="接管外径 mm"
                      value={p.pipeOD}
                      onChange={(e) => updateField('pipeOD', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                    <input
                      type="number"
                      min={2}
                      step="0.5"
                      title="接管壁厚 mm"
                      value={p.pipeThickness}
                      onChange={(e) => updateField('pipeThickness', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">法兰外径 / 厚</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      min={60}
                      title="法兰外径 mm"
                      value={p.flangeOD}
                      onChange={(e) => updateField('flangeOD', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                    <input
                      type="number"
                      min={10}
                      step="0.5"
                      title="法兰厚度 mm"
                      value={p.flangeThickness}
                      onChange={(e) => updateField('flangeThickness', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">螺栓数量</label>
                  <input
                    type="number"
                    min={4}
                    value={p.boltCount}
                    onChange={(e) => updateField('boltCount', Number(e.target.value))}
                    className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-between gap-2">
                <div className="bg-white border border-[#cbd5e1] p-2 flex flex-col items-center">
                  <span className="self-start text-[11px] text-[#475569]">法兰与接管结构示意</span>
                  <svg viewBox="0 0 240 148" className="w-[240px] h-[148px]">
                    <circle cx="120" cy="88" r="44" fill="#f8fafc" stroke="#334155" strokeWidth="1.4" />
                    <line x1="120" y1="18" x2="120" y2="142" stroke="#dc2626" strokeDasharray="4,2" strokeWidth="0.9" />
                    <line x1="56" y1="88" x2="184" y2="88" stroke="#dc2626" strokeDasharray="4,2" strokeWidth="0.9" />
                    <text x="116" y="14" fontSize="10" fill="#334155">0°</text>
                    <text x="188" y="91" fontSize="10" fill="#334155">90°</text>
                    <text x="26" y="91" fontSize="10" fill="#334155">270°</text>
                    <g transform={`rotate(${p.angleDeg}, 120, 88)`}>
                      <rect x="111" y="24" width="18" height="24" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
                      <rect x="102" y="19" width="36" height="6" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1" />
                      {p.hasBlindCover && (
                        <rect x="102" y="12" width="36" height="5" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="1" />
                      )}
                    </g>
                    <text x="8" y="142" fontSize="9.5" fill="#475569">
                      DN{p.dn} · Ø{p.pipeOD}×{p.pipeThickness} · PN{p.pn}
                    </text>
                  </svg>
                </div>
                <div className="space-y-1.5 bg-[#f8fafc] border border-[#cbd5e1] p-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.hasBlindCover}
                      onChange={(e) => updateField('hasBlindCover', e.target.checked)}
                    />
                    <span>配有配对法兰盖 / 盲板</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.hasElbow}
                      onChange={(e) => {
                        updateField('hasElbow', e.target.checked);
                        if (e.target.checked) setNozzleTab('geo');
                      }}
                    />
                    <span>带 90° 弯头引出管 (切换至「几何定位/弯头」详设)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 几何定位/弯头 (1:1 Match of Real GHPV Screenshot) */}
          {nozzleTab === 'geo' && (
            <div className="space-y-2">
              {/* Top CAD Multi-View Schematic Box (图示) */}
              <div className="bg-white border border-[#cbd5e1] rounded-[2px] p-1.5">
                <div className="text-[10.5px] text-[#475569] mb-0.5">图示 (接管定位与 90° 弯头引出管几何尺寸定义)</div>
                <svg viewBox="0 0 660 198" className="w-full h-[182px] bg-white">
                  {/* Divider lines */}
                  <line x1="220" y1="6" x2="220" y2="192" stroke="#e2e8f0" strokeWidth="0.9" />
                  <line x1="452" y1="6" x2="452" y2="192" stroke="#e2e8f0" strokeWidth="0.9" />

                  {/* 1. Shell & Side Elbow Elevation (Left) */}
                  <g transform="translate(10, 8)">
                    <path d="M108,16 L108,110 C108,128 136,136 168,136 L168,16" fill="none" stroke="#1e293b" strokeWidth="1.2" />
                    <path d="M114,16 L114,110 C114,124 138,130 168,130" fill="none" stroke="#64748b" strokeWidth="0.8" />
                    {/* Upper bent nozzle */}
                    <path d="M114,48 L72,48 Q58,48 58,34 L58,20" fill="none" stroke="#1d4ed8" strokeWidth="7" />
                    <path d="M114,48 L72,48 Q58,48 58,34 L58,20" fill="none" stroke="#ffffff" strokeWidth="4.2" />
                    <line x1="48" y1="20" x2="68" y2="20" stroke="#1d4ed8" strokeWidth="2.5" />
                    {/* Lower bent nozzle */}
                    <path d="M114,96 L72,96 Q58,96 58,110 L58,124" fill="none" stroke="#1d4ed8" strokeWidth="7" />
                    <path d="M114,96 L72,96 Q58,96 58,110 L58,124" fill="none" stroke="#ffffff" strokeWidth="4.2" />
                    <line x1="48" y1="124" x2="68" y2="124" stroke="#1d4ed8" strokeWidth="2.5" />
                    {/* Dimensions */}
                    <line x1="58" y1="10" x2="114" y2="10" stroke="#0f172a" strokeWidth="0.8" />
                    <text x="80" y="8" fontSize="9.5" fill="#0f172a" fontWeight="600">L1={p.protrusion}</text>
                    <line x1="36" y1="20" x2="36" y2="48" stroke="#0f172a" strokeWidth="0.8" />
                    <text x="14" y="38" fontSize="9.5" fill="#0f172a" fontWeight="600">L3</text>
                    <text x="92" y="64" fontSize="9" fill="#0f172a">L2={p.innerProtrusion}</text>
                    <text x="64" y="84" fontSize="9" fill="#dc2626">R={elbowRadius}</text>
                    <text x="122" y="76" fontSize="9" fill="#475569">筒体侧引出</text>
                    <text x="14" y="168" fontSize="9" fill="#334155">偏心距 E={eccentricOffset} · 夹角 {tiltAngleDeg}°</text>
                  </g>

                  {/* 2. Bottom/Top Head Draw-Off Pipe (Center, matching N4 in tower drawing!) */}
                  <g transform="translate(230, 8)">
                    {/* Bottom elliptical head */}
                    <path d="M36,24 L36,36 C36,68 78,78 106,78 C134,78 176,68 176,36 L176,24" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.4" />
                    <line x1="24" y1="36" x2="188" y2="36" stroke="#dc2626" strokeDasharray="5,2,1,2" strokeWidth="0.9" />
                    <text x="176" y="33" fontSize="9" fill="#dc2626" fontWeight="600">T.L.</text>
                    {/* Centerline */}
                    <line x1="106" y1="12" x2="106" y2="152" stroke="#dc2626" strokeDasharray="6,2,1,2" strokeWidth="0.8" />
                    {/* Draw-off pipe descending from head apex & bending 90 deg */}
                    <path d="M106,76 L106,120 Q106,136 122,136 L172,136" fill="none" stroke="#1d4ed8" strokeWidth="8.5" />
                    <path d="M106,76 L106,120 Q106,136 122,136 L172,136" fill="none" stroke="#ffffff" strokeWidth="5.2" />
                    <line x1="172" y1="124" x2="172" y2="148" stroke="#1d4ed8" strokeWidth="3" />
                    {/* Dimension callouts */}
                    <line x1="186" y1="36" x2="186" y2="136" stroke="#0f172a" strokeWidth="0.8" />
                    <text x="189" y="92" fontSize="9.5" fill="#0f172a" fontWeight="600">L1</text>
                    <line x1="106" y1="154" x2="172" y2="154" stroke="#0f172a" strokeWidth="0.8" />
                    <text x="120" y="165" fontSize="9.5" fill="#1d4ed8" fontWeight="700">L3={elbowRunLength}</text>
                    <text x="114" y="122" fontSize="9" fill="#dc2626" fontWeight="600">R={elbowRadius}</text>
                    <text x="12" y="178" fontSize="8.5" fill="#475569">当L2&gt;0时，接管下端部齐平；当L2=0时，接管与内壁齐平</text>
                  </g>

                  {/* 3. Orientation & Elbow Azimuth Circle (Right) */}
                  <g transform="translate(556, 98)">
                    <circle cx="0" cy="0" r="52" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.3" />
                    <line x1="-68" y1="0" x2="68" y2="0" stroke="#dc2626" strokeDasharray="5,2,1,2" strokeWidth="0.8" />
                    <line x1="0" y1="-68" x2="0" y2="68" stroke="#dc2626" strokeDasharray="5,2,1,2" strokeWidth="0.8" />
                    <text x="-5" y="-73" fontSize="9.5" fill="#0f172a" fontWeight="600">0°</text>
                    <text x="71" y="3" fontSize="9.5" fill="#0f172a" fontWeight="600">90°</text>
                    <text x="-10" y="79" fontSize="9.5" fill="#0f172a" fontWeight="600">180°</text>
                    <text x="-90" y="3" fontSize="9.5" fill="#0f172a" fontWeight="600">270°</text>
                    {/* Nozzle direction arrow at angleDeg */}
                    <g transform={`rotate(${p.angleDeg}, 0, 0)`}>
                      <line x1="0" y1="-52" x2="0" y2="-66" stroke="#1d4ed8" strokeWidth="5" />
                      <line x1="-10" y1="-66" x2="10" y2="-66" stroke="#1d4ed8" strokeWidth="2.5" />
                      {p.hasElbow && (
                        <g transform={`translate(0, -60) rotate(${p.elbowDirDeg})`}>
                          <line x1="0" y1="0" x2="22" y2="0" stroke="#dc2626" strokeWidth="3" />
                          <polygon points="22,-4 30,0 22,4" fill="#dc2626" />
                        </g>
                      )}
                    </g>
                    <text x="-88" y="88" fontSize="8.8" fill="#334155">
                      方位 θ={p.angleDeg}° · 弯头角 β={p.elbowDirDeg}°
                    </text>
                  </g>
                </svg>
              </div>

              {/* Bottom 2-Column Fieldsets: 定位 (Left) | ☑ 带弯头 (Right) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Left Group: 定位 */}
                <fieldset className="border border-[#cbd5e1] rounded-[2px] p-2 bg-[#f8fafc] space-y-1.5">
                  <legend className="px-1 text-[11px] font-semibold text-[#1e293b]">定位</legend>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">与中心线夹角</label>
                      <input
                        type="number"
                        value={tiltAngleDeg}
                        onChange={(e) => updateField('tiltAngleDeg', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-1">
                      <label className="truncate">外伸长度L1</label>
                      <input
                        type="number"
                        min={50}
                        value={p.protrusion}
                        onChange={(e) => updateField('protrusion', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => updateField('protrusion', Math.max(200, Math.round(p.dn * 1.6 + 80)))}
                        className="h-[21px] px-1.5 text-[10px] bg-white hover:bg-[#dbeafe] border border-[#94a3b8] rounded-[2px]"
                      >
                        推荐
                      </button>
                    </div>
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">起始位置距离</label>
                      <input
                        type="number"
                        value={p.axialOffset}
                        onChange={(e) => updateField('axialOffset', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">内伸长度L2</label>
                      <input
                        type="number"
                        min={0}
                        value={p.innerProtrusion}
                        onChange={(e) => updateField('innerProtrusion', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">定位类型</label>
                      <select
                        value={positionType}
                        onChange={(e) => updateField('positionType', e.target.value)}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      >
                        <option value="径向">径向</option>
                        <option value="平行">平行</option>
                        <option value="切向">切向</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">管口方位 θ</label>
                      <input
                        type="number"
                        value={p.angleDeg}
                        onChange={(e) => updateField('angleDeg', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">封头位置</label>
                      <select
                        value={headRegion}
                        onChange={(e) => updateField('headRegion', e.target.value)}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      >
                        <option value="下半球">下半球</option>
                        <option value="上半球">上半球</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">偏心距 E</label>
                      <input
                        type="number"
                        value={eccentricOffset}
                        onChange={(e) => updateField('eccentricOffset', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">距离 L4</label>
                      <input
                        type="number"
                        value={offsetL4}
                        onChange={(e) => updateField('offsetL4', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Right Group: ☑ 带弯头 (Exact 1:1 GHPV Fields) */}
                <fieldset className="border border-[#cbd5e1] rounded-[2px] p-2 bg-[#f8fafc] space-y-1.5">
                  <legend className="px-1 text-[11px] font-semibold text-[#1e293b]">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.hasElbow}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateField('hasElbow', checked);
                          if (checked) {
                            if (!p.elbowType) updateField('elbowType', '长半径');
                            if (!p.elbowStandard) updateField('elbowStandard', 'GB/T 12459-2017');
                            if (!p.elbowRadius) updateField('elbowRadius', Math.round(p.dn * 1.5));
                            if (!p.elbowRunLength) updateField('elbowRunLength', Math.max(450, Math.round(p.dn * 4)));
                            if (!p.elbowModel) updateField('elbowModel', `DN${p.dn}-90E(L)`);
                          }
                        }}
                      />
                      <span>带弯头</span>
                    </label>
                  </legend>
                  <div
                    className={`grid grid-cols-2 gap-x-2 gap-y-1.5 ${
                      !p.hasElbow ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头类型</label>
                      <select
                        value={elbowType}
                        onChange={(e) => {
                          const t = e.target.value as '长半径' | '短半径';
                          updateField('elbowType', t);
                          updateField('elbowRadius', Math.round(p.dn * (t === '短半径' ? 1.0 : 1.5)));
                          updateField('elbowModel', `DN${p.dn}-90E(${t === '短半径' ? 'S' : 'L'})`);
                        }}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      >
                        <option value="长半径">长半径 (1.5D)</option>
                        <option value="短半径">短半径 (1.0D)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头密度</label>
                      <input
                        type="number"
                        step="0.01"
                        value={elbowDensity}
                        onChange={(e) => updateField('elbowDensity', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头标准</label>
                      <input
                        type="text"
                        value={elbowStandard}
                        onChange={(e) => updateField('elbowStandard', e.target.value)}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      />
                    </div>
                    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">至接管中心L3</label>
                      <input
                        type="number"
                        min={120}
                        value={elbowRunLength}
                        onChange={(e) => updateField('elbowRunLength', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头型号</label>
                      <input
                        type="text"
                        value={elbowModel}
                        onChange={(e) => updateField('elbowModel', e.target.value)}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      />
                    </div>
                    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯曲半径 R</label>
                      <input
                        type="number"
                        min={40}
                        value={elbowRadius}
                        onChange={(e) => updateField('elbowRadius', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头材料</label>
                      <select
                        value={elbowMaterial}
                        onChange={(e) => {
                          const found = MATERIALS.find((m) => m.name === e.target.value);
                          updateField('elbowMaterial', e.target.value);
                          if (found) updateField('elbowDensity', found.density);
                        }}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                      >
                        {MATERIALS.map((m) => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-1">
                      <label className="truncate">弯头方位 β</label>
                      <input
                        type="number"
                        value={p.elbowDirDeg}
                        onChange={(e) => updateField('elbowDirDeg', Number(e.target.value))}
                        className="w-full min-w-0 h-[21px] px-1 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                      />
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {/* TAB 3: 材料/开孔补强 */}
          {nozzleTab === 'material' && (
            <div className="grid grid-cols-2 gap-3">
              <fieldset className="border border-[#cbd5e1] rounded-[2px] p-2.5 bg-[#f8fafc] space-y-2">
                <legend className="px-1 text-[11px] font-semibold text-[#1e293b]">法兰与接管材料</legend>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">法兰材料</label>
                  <select
                    value={p.material}
                    onChange={(e) => {
                      const found = MATERIALS.find((m) => m.name === e.target.value);
                      updateField('material', e.target.value);
                      if (found) updateField('density', found.density);
                    }}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">接管材料</label>
                  <select
                    value={p.pipeMaterial}
                    onChange={(e) => updateField('pipeMaterial', e.target.value)}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    {MATERIALS.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate">材料密度</label>
                  <input
                    type="number"
                    step="0.01"
                    value={p.density}
                    onChange={(e) => updateField('density', Number(e.target.value))}
                    className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={p.hasBlindCover}
                    onChange={(e) => updateField('hasBlindCover', e.target.checked)}
                  />
                  <span>配有配对法兰盖 / 盲板</span>
                </label>
              </fieldset>

              <fieldset className="border border-[#cbd5e1] rounded-[2px] p-2.5 bg-[#f8fafc] space-y-2">
                <legend className="px-1 text-[11px] font-semibold text-[#1e293b]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.hasPad}
                      onChange={(e) => updateField('hasPad', e.target.checked)}
                    />
                    <span>开孔补强圈 (NB/T 11025-2022)</span>
                  </label>
                </legend>
                <div className={`space-y-2 ${!p.hasPad ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
                    <label className="truncate">补强圈外径(mm)</label>
                    <input
                      type="number"
                      min={50}
                      value={padOD}
                      onChange={(e) => updateField('padOD', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                  </div>
                  <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
                    <label className="truncate">补强圈厚度(mm)</label>
                    <input
                      type="number"
                      min={4}
                      value={padThickness}
                      onChange={(e) => updateField('padThickness', Number(e.target.value))}
                      className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                    />
                  </div>
                  <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
                    <label className="truncate">补强圈材质</label>
                    <select
                      value={padMaterial}
                      onChange={(e) => updateField('padMaterial', e.target.value)}
                      className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                    >
                      {MATERIALS.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}
        </div>
      );
    }

    if (component.type === 'saddle') {
      const p = params as SaddleParams;
      return (
        <div className="grid grid-cols-[280px_1fr] gap-3 text-[11.5px]">
          <div className="space-y-1.5 min-w-0">
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">鞍座型式</label>
              <select
                value={p.saddleType}
                onChange={(e) => updateField('saddleType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="A型">A型 (轻型)</option>
                <option value="BI型">BI型 (重型带垫板)</option>
                <option value="BII型">BII型 (重型)</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">固定/滑动</label>
              <select
                value={p.fixType}
                onChange={(e) => updateField('fixType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="固定(F)">固定端 (F)</option>
                <option value="滑动(S)">滑动端 (S)</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">鞍座高度 H</label>
              <input
                type="number"
                min={200}
                value={p.centerHeight}
                onChange={(e) => updateField('centerHeight', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">轴向定位(mm)</label>
              <input
                type="number"
                value={p.axialOffset}
                onChange={(e) => updateField('axialOffset', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">包角(°)</label>
              <input
                type="number"
                min={90}
                max={150}
                value={p.wrapAngleDeg}
                onChange={(e) => updateField('wrapAngleDeg', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">底板长度 L1</label>
              <input
                type="number"
                min={200}
                value={p.baseLength}
                onChange={(e) => updateField('baseLength', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">底板宽度 B1</label>
              <input
                type="number"
                min={100}
                value={p.baseWidth}
                onChange={(e) => updateField('baseWidth', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">筋板数量</label>
              <input
                type="number"
                min={3}
                max={7}
                value={p.ribCount}
                onChange={(e) => updateField('ribCount', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">腹板 / 垫板厚</label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  min={6}
                  title="腹板厚度 mm"
                  value={p.webThickness}
                  onChange={(e) => updateField('webThickness', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  title="垫板厚度 mm"
                  value={p.padThickness}
                  onChange={(e) => updateField('padThickness', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">材料</label>
              <select
                value={p.material}
                onChange={(e) => {
                  const found = MATERIALS.find((m) => m.name === e.target.value);
                  updateField('material', e.target.value);
                  if (found) updateField('density', found.density);
                }}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                {MATERIALS.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-[#cbd5e1] p-2 flex flex-col items-center justify-center">
            <svg viewBox="0 0 220 150" className="w-[220px] h-[150px]">
              <circle cx="110" cy="60" r="46" fill="none" stroke="#64748b" strokeDasharray="4,3" strokeWidth="1.2" />
              <path
                d="M70,83 A46,46 0 0,0 150,83 L156,130 L64,130 Z"
                fill="#bfdbfe"
                stroke="#1d4ed8"
                strokeWidth="1.5"
              />
              <rect x="56" y="130" width="108" height="8" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1" />
              <line x1="110" y1="60" x2="110" y2="138" stroke="#dc2626" strokeDasharray="3,2" />
              <text x="115" y="116" fontSize="11" fill="#0f172a">H={p.centerHeight}</text>
              <text x="95" y="148" fontSize="10" fill="#0f172a">L1={p.baseLength}</text>
            </svg>
          </div>
        </div>
      );
    }

    if (component.type === 'tube_layout') {
      const p = params as TubeLayoutParams;
      const layout = computeTubeLayout(p);
      const R = p.shellDiameter / 2;
      const scale = 95 / Math.max(100, R);

      return (
        <div className="grid grid-cols-[276px_1fr] gap-3 text-[11.5px]">
          <div className="space-y-1.5 min-w-0">
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">设备内径(mm)</label>
              <input
                type="number"
                min={200}
                value={p.shellDiameter}
                onChange={(e) => updateField('shellDiameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">换热管外径 d</label>
              <input
                type="number"
                min={10}
                value={p.tubeOD}
                onChange={(e) => updateField('tubeOD', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">管中心距 S</label>
              <input
                type="number"
                min={14}
                value={p.tubePitch}
                onChange={(e) => updateField('tubePitch', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">布管限定圆 DL</label>
              <input
                type="number"
                min={150}
                value={p.outerLimitDiameter}
                onChange={(e) => updateField('outerLimitDiameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">布管排列形式</label>
              <select
                value={p.pattern}
                onChange={(e) => updateField('pattern', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="正三角形">正三角形 (30°)</option>
                <option value="转角正三角形">转角正三角形 (60°)</option>
                <option value="正方形">正方形 (90°)</option>
                <option value="转角正方形">转角正方形 (45°)</option>
              </select>
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">换热管程数</label>
              <select
                value={p.passes}
                onChange={(e) => updateField('passes', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value={1}>1 管程</option>
                <option value={2}>2 管程</option>
                <option value={4}>4 管程</option>
              </select>
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">换热管长度(mm)</label>
              <input
                type="number"
                min={500}
                value={p.tubeLength}
                onChange={(e) => updateField('tubeLength', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">换热管型式</label>
              <select
                value={p.tubeType}
                onChange={(e) => updateField('tubeType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="直管">直管 (固定管板)</option>
                <option value="U形管">U形管 (U型弯管束)</option>
              </select>
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">折流板 / 下偏</label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  min={2}
                  max={14}
                  title="折流板数量"
                  value={p.baffleCount}
                  onChange={(e) => updateField('baffleCount', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
                <input
                  type="number"
                  title="管束下偏距离 mm (BKU)"
                  value={p.verticalOffsetMm ?? 0}
                  onChange={(e) => updateField('verticalOffsetMm', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-[95px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">壁厚 / 材料</label>
              <div className="grid grid-cols-[62px_1fr] gap-1">
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  title="换热管壁厚 mm"
                  value={p.tubeThickness}
                  onChange={(e) => updateField('tubeThickness', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
                <select
                  value={p.material}
                  onChange={(e) => {
                    const found = MATERIALS.find((m) => m.name === e.target.value);
                    updateField('material', e.target.value);
                    if (found) updateField('density', found.density);
                  }}
                  className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                >
                  {MATERIALS.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Tube Sheet Preview matching GHPV Page 25 */}
          <div className="bg-white border border-[#cbd5e1] p-2 flex flex-col items-center">
            <div className="w-full flex justify-between text-[11px] text-[#334155] mb-1 tabular-nums">
              <span className="font-semibold text-[#1d4ed8]">布管 {layout.totalCount} Tubes</span>
              <span>DL={p.outerLimitDiameter} mm</span>
            </div>
            <svg viewBox="-110 -110 220 220" className="w-[215px] h-[215px]">
              <circle cx="0" cy="0" r="102" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
              <circle
                cx="0"
                cy="0"
                r={(p.outerLimitDiameter / 2) * scale}
                fill="none"
                stroke="#ef4444"
                strokeDasharray="3,2"
                strokeWidth="0.9"
              />
              <line x1="-106" y1="0" x2="106" y2="0" stroke="#94a3b8" strokeWidth="0.7" />
              <line x1="0" y1="-106" x2="0" y2="106" stroke="#94a3b8" strokeWidth="0.7" />
              {layout.tubes.map((t) => (
                <circle
                  key={t.id}
                  cx={t.x * scale}
                  cy={t.y * scale}
                  r={Math.max(1.2, t.r * scale * 0.88)}
                  fill="#a5b4fc"
                  stroke="#3730a3"
                  strokeWidth="0.45"
                />
              ))}
            </svg>
          </div>
        </div>
      );
    }

    if (component.type === 'cone') {
      const p = params as ConeParams;
      return (
        <div className="grid grid-cols-[276px_1fr] gap-3 text-[11.5px]">
          <div className="space-y-1.5 min-w-0">
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">锥壳型式</label>
              <select
                value={p.coneType}
                onChange={(e) => updateField('coneType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="正锥">正锥 (同心变径)</option>
                <option value="偏心锥">偏心锥 (下平顶扩)</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">折边形式</label>
              <select
                value={p.edgeStyle}
                onChange={(e) => updateField('edgeStyle', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="无折边">无折边</option>
                <option value="单折边">单折边</option>
                <option value="双折边">双折边</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">小端内径 d</label>
              <input
                type="number"
                min={50}
                value={p.smallDiameter}
                onChange={(e) => updateField('smallDiameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">大端内径 D</label>
              <input
                type="number"
                min={50}
                value={p.largeDiameter}
                onChange={(e) => updateField('largeDiameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">板厚度 t</label>
              <input
                type="number"
                min={2}
                value={p.thickness}
                onChange={(e) => updateField('thickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">锥体总长 H</label>
              <input
                type="number"
                min={50}
                value={p.totalLength}
                onChange={(e) => updateField('totalLength', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">材料</label>
              <select
                value={p.material}
                onChange={(e) => {
                  const found = MATERIALS.find((m) => m.name === e.target.value);
                  updateField('material', e.target.value);
                  if (found) updateField('density', found.density);
                }}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                {MATERIALS.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={p.flipped}
                onChange={(e) => updateField('flipped', e.target.checked)}
              />
              <span>上下翻转 (小端在下 / 大端在上)</span>
            </label>
          </div>
          <div className="bg-white border border-[#cbd5e1] p-2 flex items-center justify-center">
            <svg viewBox="0 0 180 120" className="w-[180px] h-[120px]">
              <path d="M55,20 L125,20 L155,95 L25,95 Z" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.5" />
              <text x="86" y="15" fontSize="11" fill="#0f172a">d={p.smallDiameter}</text>
              <text x="80" y="110" fontSize="11" fill="#0f172a">D={p.largeDiameter}</text>
              <text x="158" y="60" fontSize="11" fill="#0f172a">H</text>
            </svg>
          </div>
        </div>
      );
    }

    if (component.type === 'equipment_flange') {
      const p = params as EquipmentFlangeParams;
      return (
        <div className="grid grid-cols-[276px_1fr] gap-3 text-[11.5px]">
          <div className="space-y-1.5 min-w-0">
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">法兰类型</label>
              <select
                value={p.flangeType}
                onChange={(e) => updateField('flangeType', e.target.value)}
                className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
              >
                <option value="甲型">甲型平焊</option>
                <option value="乙型">乙型平焊</option>
                <option value="长颈对焊(WN)">长颈对焊(WN)</option>
                <option value="法兰盖(BL)">法兰盖(BL)</option>
              </select>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">公称直径 DN</label>
              <input
                type="number"
                min={50}
                value={p.dn}
                onChange={(e) => {
                  const dn = Number(e.target.value);
                  updateField('dn', dn);
                  updateField('outerDiameter', dn + 140);
                  updateField('boltCircle', dn + 100);
                }}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">法兰厚度 δ</label>
              <input
                type="number"
                min={10}
                value={p.thickness}
                onChange={(e) => updateField('thickness', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">法兰外径 OD</label>
              <input
                type="number"
                min={100}
                value={p.outerDiameter}
                onChange={(e) => updateField('outerDiameter', Number(e.target.value))}
                className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
              />
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">螺栓数量 / 总高</label>
              <div className="grid grid-cols-2 gap-1">
                <input
                  type="number"
                  min={4}
                  title="螺栓数量"
                  value={p.boltCount}
                  onChange={(e) => updateField('boltCount', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
                <input
                  type="number"
                  min={20}
                  title="法兰总高 mm"
                  value={p.height}
                  onChange={(e) => updateField('height', Number(e.target.value))}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
              <label className="truncate">密封面 / 材料</label>
              <div className="grid grid-cols-[62px_1fr] gap-1">
                <select
                  value={p.facing}
                  onChange={(e) => updateField('facing', e.target.value)}
                  className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                >
                  <option value="RF">RF</option>
                  <option value="MF">MF</option>
                  <option value="TG">TG</option>
                </select>
                <select
                  value={p.material}
                  onChange={(e) => {
                    const found = MATERIALS.find((m) => m.name === e.target.value);
                    updateField('material', e.target.value);
                    if (found) updateField('density', found.density);
                  }}
                  className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                >
                  {MATERIALS.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={p.flipped}
                onChange={(e) => updateField('flipped', e.target.checked)}
              />
              <span>上下翻转 (配对法兰)</span>
            </label>
          </div>
          <div className="bg-white border border-[#cbd5e1] p-2 flex items-center justify-center">
            <svg viewBox="0 0 180 120" className="w-[180px] h-[120px]">
              <path d="M25,25 L155,25 L155,48 L125,48 L120,100 L110,100 L110,48 L70,48 L70,100 L60,100 L55,48 L25,48 Z" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.4" />
              <text x="68" y="18" fontSize="11" fill="#0f172a">OD={p.outerDiameter}</text>
              <text x="72" y="85" fontSize="11" fill="#0f172a">DN={p.dn}</text>
            </svg>
          </div>
        </div>
      );
    }

    // Dedicated GHPV 1:1 parametric engineering dialog with live CAD blueprint SVG & real-time BOM metrics
    const paramsRec = params as unknown as Record<string, unknown>;
    const entries = Object.entries(paramsRec).filter(([k]) => k !== 'density');
    const contextualLabels = getContextualFieldLabels(component.type);
    const liveMetrics = computeComponentMetrics({
      ...component,
      name: name.trim() || component.name,
      params,
    });

    const labelMap: Record<string, string> = {
      diameter: '内径(mm)',
      innerDiameter: '内径(mm)',
      outerDiameter: '外径(mm)',
      topDiameter: '顶部直径(mm)',
      bottomDiameter: '底部直径(mm)',
      thickness: '厚度(mm)',
      height: '高度(mm)',
      length: '长度(mm)',
      totalLength: '总长(mm)',
      axialOffset: '轴向定位(mm)',
      startOffset: '起始高度(mm)',
      angleDeg: '方位角(°)',
      startAngleDeg: '起始角度(°)',
      count: '数量',
      spacing: '间距(mm)',
      bcd: '螺栓中心圆(mm)',
      boltCount: '螺栓数量',
      boltSpec: '螺栓规格',
      tubeCount: '管孔数量',
      tubeOD: '换热管外径(mm)',
      baseRingOD: '基础环外径(mm)',
      baseRingID: '基础环内径(mm)',
      baseRingThickness: '基础环厚(mm)',
      gussetHeight: '筋板高度(mm)',
      standard: '执行标准',
      material: '材料',
      dn: '公称直径 DN',
      pn: '公称压力 PN',
      waveCount: '波数',
      waveHeight: '波高(mm)',
      wavePitch: '波距(mm)',
      width: '宽度(mm)',
      baseWidth: '底板宽(mm)',
      baseLength: '底板长(mm)',
      basePlateSize: '底板边长(mm)',
      basePlateThickness: '底板厚度(mm)',
      legSectionWidth: '角钢边宽(mm)',
      skirtType: '裙座类型',
      legType: '支腿类型',
      lugType: '耳座类型',
      trayType: '塔盘类型',
      packingType: '填料类型',
      profileType: '型钢类型',
      position: '位置',
      spec: '规格型号',
      label: '构件说明',
      sizeA: '特征宽度(mm)',
      sizeB: '特征高度(mm)',
      capacityKg: '吊重(kg)',
      armLength: '吊臂长(mm)',
      poleHeight: '吊柱高(mm)',
      pipeOD: '管外径(mm)',
      trunnionOD: '轴耳外径(mm)',
      installType: '安装方式',
      grooveType: '坡口类型',
      flipped: '上下翻转',
      hasInspectionHole: '带检查孔',
      isRingLug: '刚性环结构',
      zoneStyle: '球壳分带型式',
      equatorPetals: '赤道带瓣数',
      temperatePetals: '温带瓣数',
      pipeThickness: '管壁厚(mm)',
      clearanceMm: '球底净空(mm)',
      hasTieRods: '交叉拉杆',
      tieRodOD: '拉杆外径(mm)',
      platformType: '平台型式',
      elevationMm: '平台标高(mm)',
      widthMm: '平台宽度(mm)',
      angleSpanDeg: '平台包角(°)',
      ladderHeightMm: '爬梯高度(mm)',
      hasCage: '带安全护笼',
      ...contextualLabels,
    };

    const enumOptions: Record<string, string[]> = {
      skirtType: ['圆筒形裙座', '圆锥形裙座', '中间裙座'],
      legType: ['A型', 'B型', 'C型'],
      lugType: ['A型', 'B型', 'C型'],
      trayType: ['浮阀塔盘', '筛板塔盘', '泡罩塔盘'],
      packingType: ['金属波纹规整填料', '拉西环散堆填料'],
      profileType: ['扁钢', '角钢', '工字钢'],
      position: ['筒体外侧', '筒体内侧'],
      installType: ['上装式', '下装式'],
      grooveType: ['单V型坡口', '双V型坡口', 'U型坡口'],
      zoneStyle: ['混合式五带', '橘瓣式三带', '橘瓣式四带'],
      platformType: ['圆形操作平台', '弧形检修平台'],
    };

    return (
      <div className="grid grid-cols-[1fr_228px] gap-3 items-start">
        <div className="grid grid-cols-1 gap-y-1.5 text-[11.5px] min-w-0">
          {entries.map(([key, val]) => {
            const label = labelMap[key] || key;
            if (typeof val === 'boolean') {
              return (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer py-0.5 pl-[106px]">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => updateField(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              );
            }
            if (key === 'material') {
              return (
                <div key={key} className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate text-[#334155]">{label}</label>
                  <select
                    value={String(val)}
                    onChange={(e) => {
                      const found = MATERIALS.find((m) => m.name === e.target.value);
                      updateField('material', e.target.value);
                      if (found) updateField('density', found.density);
                    }}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    {!MATERIALS.some((m) => m.name === String(val)) && (
                      <option value={String(val)}>{String(val)}</option>
                    )}
                    {MATERIALS.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              );
            }
            if (key in enumOptions) {
              const opts = enumOptions[key];
              return (
                <div key={key} className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate text-[#334155]">{label}</label>
                  <select
                    value={String(val)}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="w-full min-w-0 h-[22px] px-1 border border-[#cbd5e1] bg-white rounded-[2px]"
                  >
                    {opts.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }
            if (typeof val === 'number') {
              return (
                <div key={key} className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-1.5">
                  <label className="truncate text-[#334155]">{label}</label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => updateField(key, Number(e.target.value))}
                    className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                  />
                </div>
              );
            }
            return (
              <div key={key} className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-1.5">
                <label className="truncate text-[#334155]">{label}</label>
                <input
                  type="text"
                  value={String(val)}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
                />
              </div>
            );
          })}
        </div>

        {/* Right: Dedicated CAD Blueprint Schematic + Live Calculated Engineering Metrics */}
        <div className="space-y-2">
          <div className="bg-white border border-[#cbd5e1] rounded-[2px] p-1.5">
            <div className="text-[10.5px] font-medium text-[#475569] mb-1 flex items-center justify-between">
              <span>工程示意简图 (1:1)</span>
              <span className="text-[10px] text-[#2563eb]">{liveMetrics.standardText}</span>
            </div>
            <ComponentSchematicSvg type={component.type} params={paramsRec} />
          </div>

          <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] p-2 text-[11px] space-y-1">
            <div className="font-semibold text-[#1e293b] border-b border-[#e2e8f0] pb-0.5">
              实时工程计算
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">估算净重:</span>
              <span className="font-semibold text-[#0f172a] tabular-nums">{liveMetrics.weightKg} kg</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">外表面积:</span>
              <span className="text-[#0f172a] tabular-nums">{liveMetrics.outerAreaM2} m²</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">金属体积:</span>
              <span className="text-[#0f172a] tabular-nums">{liveMetrics.volumeM3} m³</span>
            </div>
            <div className="pt-0.5 text-[10.5px] text-[#475569] truncate" title={liveMetrics.specText}>
              规格: {liveMetrics.specText}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${
          component.type === 'nozzle_manhole' ? 'w-[740px]' : 'w-[640px]'
        } max-w-[94vw] bg-[#f3f4f6] border border-[#64748b] shadow-xl rounded-[3px] overflow-hidden`}
      >
        {/* Window Title Bar */}
        <div className="h-[28px] px-2.5 flex items-center justify-between bg-gradient-to-b from-[#ffffff] to-[#e5e9f0] border-b border-[#cbd5e1]">
          <span className="text-[12px] font-medium text-[#1e293b]">{title}</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭对话框"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Component Name Strip */}
          <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 border-b border-[#e2e8f0] text-[11.5px]">
            <label htmlFor="comp-name-input" className="text-[#475569] whitespace-nowrap">
              零件名称:
            </label>
            <input
              id="comp-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setValidationError(null);
                setName(e.target.value);
              }}
              className="w-[210px] min-w-0 h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px]"
            />
            <span className="text-[#64748b] ml-auto text-[11px]">
              {isNew ? '新建装配元件' : '编辑当前元件'}
            </span>
          </div>

          {validationError && (
            <div
              role="alert"
              className="mx-3 mt-2 px-2.5 py-1.5 bg-[#fef2f2] border border-[#fca5a5] text-[#b91c1c] text-[11.5px] rounded-[2px]"
            >
              {validationError}
            </div>
          )}

          <div className="p-3 max-h-[68vh] overflow-y-auto">{renderContent()}</div>

          {/* Footer Buttons */}
          <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 h-[25px] text-[11.5px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px] font-medium"
            >
              确定
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 h-[25px] text-[11.5px] bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#94a3b8] rounded-[2px]"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TechSpecDialogProps {
  spec: TechnicalSpec;
  onSave: (spec: TechnicalSpec) => void;
  onClose: () => void;
}

export const TechSpecDialog: React.FC<TechSpecDialogProps> = ({ spec, onSave, onClose }) => {
  const [form, setForm] = useState<TechnicalSpec>({ ...spec });

  const fields: Array<{ key: keyof TechnicalSpec; label: string; type?: 'number' | 'text' }> = [
    { key: 'vesselTag', label: '设备位号' },
    { key: 'vesselName', label: '设备名称' },
    { key: 'designCode', label: '设计标准' },
    { key: 'vesselClass', label: '容器类别' },
    { key: 'designPressure', label: '设计压力 (MPa)', type: 'number' },
    { key: 'workPressure', label: '工作压力 (MPa)', type: 'number' },
    { key: 'testPressure', label: '耐压试验压力 (MPa)', type: 'number' },
    { key: 'designTemp', label: '设计温度 (°C)', type: 'number' },
    { key: 'workTemp', label: '工作温度 (°C)', type: 'number' },
    { key: 'medium', label: '工作介质' },
    { key: 'corrosionAllowance', label: '腐蚀裕量 (mm)', type: 'number' },
    { key: 'weldEfficiency', label: '焊接接头系数', type: 'number' },
    { key: 'ndtMethod', label: '无损检测比例/方法' },
    { key: 'heatTreatment', label: '焊后热处理' },
    { key: 'companyName', label: '设计单位' },
    { key: 'projectName', label: '项目名称' },
    { key: 'drawingNo', label: '图纸编号' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="技术特性表"
        className="w-[560px] max-w-[94vw] bg-[#f3f4f6] border border-[#64748b] shadow-xl rounded-[3px] overflow-hidden"
      >
        <div className="h-[28px] px-2.5 flex items-center justify-between bg-gradient-to-b from-[#ffffff] to-[#e5e9f0] border-b border-[#cbd5e1]">
          <span className="text-[12px] font-medium text-[#1e293b]">技术特性表</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭技术特性表"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px] max-h-[65vh] overflow-y-auto">
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-[105px_1fr] items-center gap-1">
                <label className="text-[#334155] truncate">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  step="any"
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                    }))
                  }
                  className="h-[22px] px-1.5 border border-[#cbd5e1] bg-white rounded-[2px] tabular-nums"
                />
              </div>
            ))}
          </div>
          <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 h-[25px] text-[11.5px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px]"
            >
              确定
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-[25px] text-[11.5px] bg-white hover:bg-[#f1f5f9] border border-[#94a3b8] rounded-[2px]"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
