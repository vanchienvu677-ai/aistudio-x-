import React, { useMemo, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Activity,
  ClipboardList,
  Plus,
  Trash2,
  Download,
} from 'lucide-react';
import type { AssemblyPoint, TechnicalSpec } from '../../types/vessel';
import {
  computeLifecycleAssessment,
  exportLifecycleDossierCsv,
  LIFECYCLE_STAGES,
  type LifecycleInspectionRecord,
  type LifecycleStageKey,
  type LifecycleState,
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

interface LifecycleDialogProps {
  spec: TechnicalSpec;
  assemblies: AssemblyPoint[];
  state: LifecycleState;
  onChangeState: (next: LifecycleState) => void;
  onClose: () => void;
}

export const LifecycleDialog: React.FC<LifecycleDialogProps> = ({
  spec,
  assemblies,
  state,
  onChangeState,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'dossier' | 'thickness' | 'records'>('dossier');
  const [newRecDate, setNewRecDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newRecType, setNewRecType] = useState<LifecycleInspectionRecord['recordType']>('定期检验(TSG 21)');
  const [newRecInspector, setNewRecInspector] = useState<string>('特检院检验员');
  const [newRecConclusion, setNewRecConclusion] = useState<LifecycleInspectionRecord['conclusion']>('合格');
  const [newRecNotes, setNewRecNotes] = useState<string>('');

  const summary = useMemo(
    () => computeLifecycleAssessment(spec, assemblies, state),
    [spec, assemblies, state]
  );

  const toggleMilestone = (msId: string) => {
    const exists = state.completedMilestones.includes(msId);
    const completedMilestones = exists
      ? state.completedMilestones.filter((id) => id !== msId)
      : [...state.completedMilestones, msId];
    onChangeState({ ...state, completedMilestones });
  };

  const handleMeasuredChange = (compId: string, val: number) => {
    onChangeState({
      ...state,
      measuredThicknessByCompId: {
        ...state.measuredThicknessByCompId,
        [compId]: Math.max(0, Number.isFinite(val) ? val : 0),
      },
    });
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecNotes.trim()) return;
    const rec: LifecycleInspectionRecord = {
      id: `rec-${Date.now()}`,
      date: newRecDate || new Date().toISOString().slice(0, 10),
      stage: state.currentStage,
      recordType: newRecType,
      inspector: newRecInspector.trim() || '设备工程师',
      conclusion: newRecConclusion,
      notes: newRecNotes.trim(),
    };
    onChangeState({ ...state, records: [rec, ...state.records] });
    setNewRecNotes('');
  };

  const handleExportCsv = () => {
    const csv = exportLifecycleDossierCsv(spec, state, summary);
    triggerDownload(`${spec.vesselTag}_全生命周期档案.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      standard: 'TSG 21-2016 / GB/T 150-2024 压力容器数字化交付档案',
      spec,
      lifecycle: state,
      assessment: summary,
    };
    triggerDownload(
      `${spec.vesselTag}_数字化全生命周期包.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="压力容器全生命周期管理"
        className="w-[960px] max-w-[96vw] h-[80vh] flex flex-col bg-[#f3f4f6] border border-[#64748b] shadow-2xl rounded-[3px] overflow-hidden"
      >
        {/* Title Bar */}
        <div className="h-[28px] px-3 flex items-center justify-between bg-gradient-to-b from-white to-[#e5e9f0] border-b border-[#cbd5e1] shrink-0">
          <span className="text-[12px] font-semibold text-[#1e293b]">
            全生命周期设备管理 — {spec.vesselTag} {spec.vesselName} ({state.assetCode})
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭全生命周期管理"
            className="p-0.5 hover:bg-[#fee2e2] hover:text-[#dc2626] rounded-[2px]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* KPI Strip */}
        <div className="px-3 py-2 bg-white border-b border-[#cbd5e1] grid grid-cols-5 gap-2 text-[11px] shrink-0 tabular-nums">
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px]">
            <div className="text-[10px] text-[#64748b]">交付档案完整度</div>
            <div className="text-[13px] font-bold text-[#1d4ed8]">{summary.completionPercent}%</div>
          </div>
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px]">
            <div className="text-[10px] text-[#64748b]">安全状况等级 (TSG 21)</div>
            <div className="text-[13px] font-bold text-[#0f766e]">{state.safetyGrade}</div>
          </div>
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px]">
            <div className="text-[10px] text-[#64748b]">下次定期检验</div>
            <div className="text-[13px] font-bold text-[#0f172a]">{summary.nextInspectionDate}</div>
          </div>
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px]">
            <div className="text-[10px] text-[#64748b]">最短预测余寿</div>
            <div
              className={`text-[13px] font-bold ${
                summary.minRemainingLifeYears < 3
                  ? 'text-[#dc2626]'
                  : summary.minRemainingLifeYears < 6
                  ? 'text-[#d97706]'
                  : 'text-[#15803d]'
              }`}
            >
              {summary.minRemainingLifeYears >= 50 ? '>50 年' : `${summary.minRemainingLifeYears.toFixed(1)} 年`}
            </div>
          </div>
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px]">
            <div className="text-[10px] text-[#64748b]">壁厚告警元件</div>
            <div
              className={`text-[13px] font-bold ${
                summary.alertCount > 0
                  ? 'text-[#dc2626]'
                  : summary.attentionCount > 0
                  ? 'text-[#d97706]'
                  : 'text-[#15803d]'
              }`}
            >
              {summary.alertCount > 0
                ? `${summary.alertCount} 项预警`
                : summary.attentionCount > 0
                ? `${summary.attentionCount} 项关注`
                : '全部正常'}
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="px-3 pt-1.5 bg-[#eef1f5] border-b border-[#cbd5e1] flex items-center gap-1 shrink-0 text-[11.5px]">
          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`px-3 h-[26px] flex items-center gap-1.5 rounded-t-[2px] border-t border-x ${
              activeTab === 'dossier'
                ? 'bg-white text-[#1d4ed8] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'bg-transparent text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>阶段档案与数字铭牌</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('thickness')}
            className={`px-3 h-[26px] flex items-center gap-1.5 rounded-t-[2px] border-t border-x ${
              activeTab === 'thickness'
                ? 'bg-white text-[#1d4ed8] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'bg-transparent text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>壁厚测厚与余寿评估 ({summary.totalPressureComponents})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-3 h-[26px] flex items-center gap-1.5 rounded-t-[2px] border-t border-x ${
              activeTab === 'records'
                ? 'bg-white text-[#1d4ed8] font-semibold border-[#cbd5e1] -mb-[1px]'
                : 'bg-transparent text-[#475569] border-transparent hover:bg-[#e2e8f0]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>检验与检维修台账 ({state.records.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto bg-white p-3 text-[11.5px]">
          {activeTab === 'dossier' && (
            <div className="space-y-3">
              {/* 5-Stage Lifecycle Stepper */}
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px]">
                <div className="text-[11px] font-semibold text-[#334155] mb-2">
                  当前所处生命周期阶段（点击切换）
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {LIFECYCLE_STAGES.map((st, idx) => {
                    const active = state.currentStage === st.key;
                    const doneInStage = st.milestones.filter((m) =>
                      state.completedMilestones.includes(m.id)
                    ).length;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() =>
                          onChangeState({ ...state, currentStage: st.key as LifecycleStageKey })
                        }
                        className={`p-2 text-left rounded-[2px] border transition-colors ${
                          active
                            ? 'bg-[#eff6ff] border-[#2563eb] text-[#1e3a8a]'
                            : 'bg-white border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {idx + 1}. {st.label}
                          </span>
                          <span className="text-[10px] text-[#64748b] tabular-nums">
                            {doneInStage}/{st.milestones.length}
                          </span>
                        </div>
                        <div className="mt-1 h-1 bg-[#e2e8f0] rounded overflow-hidden">
                          <div
                            className="h-full bg-[#2563eb]"
                            style={{
                              width: `${Math.round((doneInStage / st.milestones.length) * 100)}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Asset Metadata & Digital Nameplate */}
              <div className="grid grid-cols-3 gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">数字化资产编码</span>
                  <input
                    type="text"
                    value={state.assetCode}
                    onChange={(e) => onChangeState({ ...state, assetCode: e.target.value })}
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">制造/交付单位</span>
                  <input
                    type="text"
                    value={state.manufacturer}
                    onChange={(e) => onChangeState({ ...state, manufacturer: e.target.value })}
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">投用日期</span>
                  <input
                    type="date"
                    value={state.commissionDate}
                    onChange={(e) => onChangeState({ ...state, commissionDate: e.target.value })}
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">已服役年限 (年)</span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={state.serviceYears}
                    onChange={(e) =>
                      onChangeState({
                        ...state,
                        serviceYears: Math.max(0.5, Number(e.target.value) || 1),
                      })
                    }
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px] tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">定检周期 (年, TSG 21)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={state.inspectionCycleYears}
                    onChange={(e) =>
                      onChangeState({
                        ...state,
                        inspectionCycleYears: Math.max(1, Number(e.target.value) || 6),
                      })
                    }
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px] tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[#475569]">安全状况等级</span>
                  <select
                    value={state.safetyGrade}
                    onChange={(e) =>
                      onChangeState({
                        ...state,
                        safetyGrade: e.target.value as LifecycleState['safetyGrade'],
                      })
                    }
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px] bg-white"
                  >
                    <option value="1级">1级 (最高安全等级)</option>
                    <option value="2级">2级 (良好，6年定检)</option>
                    <option value="3级">3级 (监控使用，3~6年定检)</option>
                    <option value="4级">4级 (限期监控整改)</option>
                  </select>
                </label>
              </div>

              {/* Stage Milestones Checklist */}
              <div className="grid grid-cols-2 gap-2.5">
                {LIFECYCLE_STAGES.map((st) => (
                  <div
                    key={st.key}
                    className="p-2 border border-[#e2e8f0] rounded-[2px] bg-[#f8fafc]"
                  >
                    <div className="font-semibold text-[#1e293b] mb-1.5 text-[11px]">
                      {st.label} · 关键交付节点
                    </div>
                    <div className="space-y-1">
                      {st.milestones.map((ms) => {
                        const checked = state.completedMilestones.includes(ms.id);
                        return (
                          <label
                            key={ms.id}
                            className="flex items-center gap-1.5 text-[11px] text-[#334155] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMilestone(ms.id)}
                            />
                            <span className={checked ? 'line-through text-[#64748b]' : ''}>
                              {ms.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'thickness' && (
            <div className="space-y-2">
              <div className="text-[11px] text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1.5 rounded-[2px]">
                自动关联当前 3D 模型全部主体受压元件（名义壁厚与腐蚀裕量 {spec.corrosionAllowance} mm）。修改「实测壁厚」即实时重算年腐蚀速率、剩余裕量与预测余寿。
              </div>
              <table className="w-full border-collapse text-[11px] tabular-nums">
                <thead className="bg-[#eef2f6] text-[#1e293b]">
                  <tr>
                    {[
                      '受压元件',
                      '所属装配点',
                      '材质',
                      '名义壁厚(mm)',
                      '最小需用(mm)',
                      '实测壁厚(mm)',
                      '腐蚀速率(mm/a)',
                      '剩余裕量(mm)',
                      '预测余寿',
                      '健康状态',
                    ].map((h) => (
                      <th key={h} className="border border-[#cbd5e1] px-2 py-1 font-medium text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.components.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="border border-[#e2e8f0] py-6 text-center text-[#64748b]">
                        当前设备暂无主体受压元件（筒体/封头/锥壳/球壳）
                      </td>
                    </tr>
                  ) : (
                    summary.components.map((row, i) => (
                      <tr key={row.componentId} className={i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}>
                        <td className="border border-[#e2e8f0] px-2 py-1 font-medium text-[#0f172a]">
                          {row.componentName}
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-center">{row.assemblyName}</td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-center">{row.material}</td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                          {row.nominalThicknessMm.toFixed(1)}
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                          {row.minRequiredThicknessMm.toFixed(1)}
                        </td>
                        <td className="border border-[#e2e8f0] p-0.5 w-[90px]">
                          <input
                            type="number"
                            step={0.1}
                            min={0}
                            aria-label={`${row.componentName} 实测壁厚`}
                            value={row.measuredThicknessMm}
                            onChange={(e) =>
                              handleMeasuredChange(row.componentId, Number(e.target.value))
                            }
                            className="w-full h-[22px] px-1.5 text-right border border-[#cbd5e1] rounded-[2px] focus:border-[#2563eb] focus:outline-none"
                          />
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                          {row.corrosionRateMmPerYr.toFixed(3)}
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-right">
                          {row.remainingAllowanceMm.toFixed(2)}
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-right font-medium">
                          {row.remainingLifeYears >= 50 ? '>50 年' : `${row.remainingLifeYears.toFixed(1)} 年`}
                        </td>
                        <td className="border border-[#e2e8f0] px-2 py-1 text-center">
                          {row.status === 'alert' ? (
                            <span className="inline-flex items-center gap-0.5 text-[#dc2626] font-semibold">
                              <AlertTriangle className="w-3 h-3" /> 预警
                            </span>
                          ) : row.status === 'attention' ? (
                            <span className="inline-flex items-center gap-0.5 text-[#d97706] font-semibold">
                              <AlertTriangle className="w-3 h-3" /> 关注
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[#15803d]">
                              <CheckCircle2 className="w-3 h-3" /> 正常
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'records' && (
            <div className="space-y-3">
              {/* Add Inspection / Maintenance Record Form */}
              <form
                onSubmit={handleAddRecord}
                className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-[2px] grid grid-cols-[120px_135px_130px_90px_1fr_auto] gap-1.5 items-end"
              >
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#475569]">日期</span>
                  <input
                    type="date"
                    value={newRecDate}
                    onChange={(e) => setNewRecDate(e.target.value)}
                    className="h-[24px] px-1.5 border border-[#cbd5e1] rounded-[2px] bg-white"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#475569]">记录类型</span>
                  <select
                    value={newRecType}
                    onChange={(e) =>
                      setNewRecType(e.target.value as LifecycleInspectionRecord['recordType'])
                    }
                    className="h-[24px] px-1 border border-[#cbd5e1] rounded-[2px] bg-white"
                  >
                    <option value="定期检验(TSG 21)">定期检验(TSG 21)</option>
                    <option value="壁厚测厚">壁厚测厚</option>
                    <option value="无损检测(NDT)">无损检测(NDT)</option>
                    <option value="水压试验">水压试验</option>
                    <option value="检维修记录">检维修记录</option>
                    <option value="安装验收">安装验收</option>
                    <option value="设计评审">设计评审</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#475569]">检验/责任人</span>
                  <input
                    type="text"
                    value={newRecInspector}
                    onChange={(e) => setNewRecInspector(e.target.value)}
                    className="h-[24px] px-1.5 border border-[#cbd5e1] rounded-[2px] bg-white"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#475569]">结论</span>
                  <select
                    value={newRecConclusion}
                    onChange={(e) =>
                      setNewRecConclusion(e.target.value as LifecycleInspectionRecord['conclusion'])
                    }
                    className="h-[24px] px-1 border border-[#cbd5e1] rounded-[2px] bg-white"
                  >
                    <option value="合格">合格</option>
                    <option value="监控使用">监控使用</option>
                    <option value="待整改">待整改</option>
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#475569]">检验/维修内容摘要</span>
                  <input
                    type="text"
                    placeholder="如：更换管箱法兰缠绕垫片并完成气密性复验"
                    value={newRecNotes}
                    onChange={(e) => setNewRecNotes(e.target.value)}
                    className="h-[24px] px-2 border border-[#cbd5e1] rounded-[2px] bg-white"
                  />
                </label>
                <button
                  type="submit"
                  className="h-[24px] px-3 flex items-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增记录</span>
                </button>
              </form>

              <table className="w-full border-collapse text-[11px]">
                <thead className="bg-[#eef2f6] text-[#1e293b]">
                  <tr>
                    <th className="border border-[#cbd5e1] px-2 py-1 w-[92px]">日期</th>
                    <th className="border border-[#cbd5e1] px-2 py-1 w-[125px]">记录类型</th>
                    <th className="border border-[#cbd5e1] px-2 py-1 w-[120px]">责任人/机构</th>
                    <th className="border border-[#cbd5e1] px-2 py-1 w-[74px]">结论</th>
                    <th className="border border-[#cbd5e1] px-2 py-1 text-left">内容摘要</th>
                    <th className="border border-[#cbd5e1] px-2 py-1 w-[42px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.records.map((rec, i) => (
                    <tr key={rec.id} className={i % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'}>
                      <td className="border border-[#e2e8f0] px-2 py-1 text-center tabular-nums">
                        {rec.date}
                      </td>
                      <td className="border border-[#e2e8f0] px-2 py-1 text-center font-medium">
                        {rec.recordType}
                      </td>
                      <td className="border border-[#e2e8f0] px-2 py-1 text-center">{rec.inspector}</td>
                      <td className="border border-[#e2e8f0] px-2 py-1 text-center">
                        <span
                          className={
                            rec.conclusion === '待整改'
                              ? 'text-[#dc2626] font-semibold'
                              : rec.conclusion === '监控使用'
                              ? 'text-[#d97706] font-semibold'
                              : 'text-[#15803d]'
                          }
                        >
                          {rec.conclusion}
                        </span>
                      </td>
                      <td className="border border-[#e2e8f0] px-2 py-1 text-[#334155]">{rec.notes}</td>
                      <td className="border border-[#e2e8f0] px-1 py-1 text-center">
                        <button
                          type="button"
                          aria-label={`删除记录 ${rec.recordType}`}
                          onClick={() =>
                            onChangeState({
                              ...state,
                              records: state.records.filter((r) => r.id !== rec.id),
                            })
                          }
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
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-[#eaeef3] border-t border-[#cbd5e1] flex items-center justify-between shrink-0 text-[11.5px]">
          <span className="text-[10.5px] text-[#475569]">
            依据 TSG 21-2016《固定式压力容器安全技术监察规程》与数字化交付规范归档
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 h-[25px] flex items-center gap-1 bg-[#15803d] hover:bg-[#166534] text-white rounded-[2px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出档案 (.csv)</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 h-[25px] flex items-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[2px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出数字交付包 (.json)</span>
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
    </div>
  );
};
