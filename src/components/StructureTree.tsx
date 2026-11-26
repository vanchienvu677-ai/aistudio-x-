import React, { useState } from 'react';
import { ChevronDown, ChevronRight, PlusCircle, Eye, EyeOff, LayoutGrid, Undo2 } from 'lucide-react';
import type { AssemblyPoint, VesselComponent } from '../types/vessel';

interface StructureTreeProps {
  assemblies: AssemblyPoint[];
  selectedAssemblyId: string;
  selectedComponentId: string | null;
  selectedSubNode?: string | null;
  onSelectAssembly: (assemblyId: string) => void;
  onSelectComponent: (assemblyId: string, componentId: string) => void;
  onSelectSubNode?: (assemblyId: string, componentId: string, subNode: string) => void;
  onToggleComponentVisibility?: (componentId: string) => void;
  onAddAssemblyPoint: () => void;
  onAutoArrange: () => void;
  onUndoArrange: () => void;
  canUndoArrange: boolean;
  undoCount?: number;
  onDoubleClickComponent: (component: VesselComponent) => void;
}

export const StructureTree: React.FC<StructureTreeProps> = ({
  assemblies,
  selectedAssemblyId,
  selectedComponentId,
  selectedSubNode = null,
  onSelectAssembly,
  onSelectComponent,
  onSelectSubNode,
  onToggleComponentVisibility,
  onAddAssemblyPoint,
  onAutoArrange,
  onUndoArrange,
  canUndoArrange,
  undoCount = 0,
  onDoubleClickComponent,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const totalCompCount = assemblies.reduce((s, a) => s + a.components.length, 0);
  const hiddenCompCount = assemblies.reduce(
    (s, a) => s + a.components.filter((c) => !c.visible).length,
    0
  );

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
      aria-label="模型结构树"
      className="w-[216px] shrink-0 h-full flex flex-col bg-white border-r border-[#cbd5e1] select-none"
    >
      {/* Header */}
      <div className="h-[22px] px-2 flex items-center justify-between bg-[#f1f4f8] border-b border-[#d5dbe3] text-[11px] font-medium text-[#334155]">
        <span>结构树</span>
        <span className="text-[10px] text-[#64748b] tabular-nums flex items-center gap-1">
          <span>
            {assemblies.length} 装配点 · {totalCompCount} 项
          </span>
          {hiddenCompCount > 0 && (
            <span
              title={`当前有 ${hiddenCompCount} 个元件处于隐藏状态，可点击节点右侧眼睛图标恢复显示`}
              className="px-1 bg-[#fef3c7] text-[#b45309] border border-[#fde68a] rounded-[2px] text-[9.5px]"
            >
              隐{hiddenCompCount}
            </span>
          )}
        </span>
      </div>

      {/* Assembly Point Action Bar (Add + Auto Arrange + Undo) */}
      <div className="px-2 py-1.5 border-b border-[#e5e7eb] flex flex-col gap-1 bg-white">
        <button
          type="button"
          onClick={onAddAssemblyPoint}
          className="w-full h-[24px] flex items-center justify-center gap-1.5 text-[11.5px] text-[#1e293b] bg-[#f8fafc] hover:bg-[#e8f1fb] border border-[#cbd5e1] hover:border-[#60a5fa] rounded-[2px] transition-colors cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#334155]" />
          <span>加装配点</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAutoArrange}
            disabled={assemblies.length === 0}
            title="根据设备外径、长度与安全间距一键优化装配点空间坐标及内部组件顺序"
            className="flex-1 h-[24px] px-1.5 flex items-center justify-center gap-1 text-[11px] font-medium text-[#1d4ed8] bg-[#eff6ff] hover:bg-[#dbeafe] disabled:opacity-45 disabled:cursor-not-allowed border border-[#bfdbfe] hover:border-[#60a5fa] rounded-[2px] transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">自动重排</span>
          </button>

          <button
            type="button"
            onClick={onUndoArrange}
            disabled={!canUndoArrange}
            aria-label={undoCount > 1 ? `撤销重排（剩余 ${undoCount} 步）` : '撤销重排'}
            title={canUndoArrange ? `撤销上一次自动重排 (Ctrl+Z，可撤销 ${undoCount} 步)` : '暂无可撤销的重排记录'}
            className="h-[24px] px-2 shrink-0 flex items-center justify-center gap-1 text-[11px] text-[#334155] bg-[#f8fafc] hover:bg-[#e8f1fb] hover:text-[#0f172a] disabled:opacity-40 disabled:hover:bg-[#f8fafc] disabled:cursor-not-allowed border border-[#cbd5e1] hover:border-[#60a5fa] rounded-[2px] transition-colors cursor-pointer"
          >
            <Undo2 className="w-3 h-3 shrink-0" />
            <span>撤销{undoCount > 1 ? `(${undoCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Hierarchical Tree Body */}
      <div className="flex-1 overflow-y-auto px-1 py-1 text-[11.5px] leading-[20px]">
        {assemblies.map((ap) => {
          const apCollapsed = !!collapsedNodes[ap.id];
          const orientLabel = ap.orientation === 'horizontal' ? '卧' : '立';
          const mainComponents = ap.components.filter((c) => c.category === 'main');
          const attachments = ap.components.filter((c) => c.category === 'attachment');
          const mainIds = new Set(mainComponents.map((m) => m.id));
          const orphanAttachments = attachments.filter((a) => !a.parentId || !mainIds.has(a.parentId));
          const isApSelected = selectedAssemblyId === ap.id && !selectedComponentId;

          const renderAttachmentNode = (att: VesselComponent) => {
            const attSelected = selectedComponentId === att.id;
            const attHasSub = !!(att.subNodes && att.subNodes.length > 0);
            const attExpanded =
              collapsedNodes[att.id] === false ||
              (collapsedNodes[att.id] === undefined && attSelected && !!selectedSubNode);

            return (
              <div key={att.id}>
                <div
                  className={`group flex items-center gap-0.5 px-1 py-[1px] rounded-[2px] ${
                    attSelected
                      ? 'bg-[#cce4ff] text-[#0f172a] font-medium'
                      : 'hover:bg-[#f1f5f9] text-[#1f2937]'
                  } ${!att.visible ? 'opacity-50 line-through' : ''}`}
                >
                  {attHasSub ? (
                    <button
                      type="button"
                      aria-label={`展开或折叠${att.name}`}
                      aria-expanded={attExpanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapsedNodes((prev) => ({
                          ...prev,
                          [att.id]: prev[att.id] === false ? true : false,
                        }));
                      }}
                      className="p-0.5 text-[#64748b] hover:text-[#0f172a] shrink-0"
                    >
                      {attExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 inline-block shrink-0" />
                  )}
                  <button
                    type="button"
                    title={`${att.name}${!att.visible ? '（已隐藏）' : ''} — 双击打开详细参数`}
                    onClick={() => onSelectComponent(ap.id, att.id)}
                    onDoubleClick={() => onDoubleClickComponent(att)}
                    className="flex-1 min-w-0 text-left truncate cursor-pointer flex items-center gap-1"
                  >
                    <span className="truncate flex-1">{att.name}</span>
                  </button>
                  {onToggleComponentVisibility ? (
                    <button
                      type="button"
                      aria-label={`${att.visible ? '隐藏' : '显示'}${att.name}`}
                      title={att.visible ? '在三维视口中隐藏' : '恢复在三维视口中显示'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComponentVisibility(att.id);
                      }}
                      className={`p-0.5 rounded-[2px] shrink-0 transition-opacity ${
                        att.visible
                          ? 'opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#0f172a]'
                          : 'opacity-100 text-[#d97706] hover:text-[#b45309]'
                      }`}
                    >
                      {att.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  ) : (
                    !att.visible && <EyeOff className="w-3 h-3 text-[#94a3b8] shrink-0" />
                  )}
                </div>

                {attExpanded && att.subNodes && (
                  <div className="pl-5">
                    {att.subNodes.map((sn, idx) => {
                      const snSelected = attSelected && selectedSubNode === sn;
                      return (
                        <button
                          key={`${att.id}-sn-${idx}`}
                          type="button"
                          onClick={() =>
                            onSelectSubNode
                              ? onSelectSubNode(ap.id, att.id, sn)
                              : onSelectComponent(ap.id, att.id)
                          }
                          onDoubleClick={() => onDoubleClickComponent(att)}
                          className={`w-full text-left px-1.5 py-[0.5px] text-[10.5px] cursor-pointer truncate block rounded-[2px] ${
                            snSelected
                              ? 'bg-[#d8dce2] text-[#0f172a] font-semibold'
                              : 'text-[#64748b] hover:bg-[#f1f5f9]'
                          }`}
                        >
                          {sn}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };

          return (
            <div key={ap.id} className="mb-1">
              {/* Assembly Point Root */}
              <div
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded-[2px] ${
                  isApSelected ? 'bg-[#cce4ff] text-[#0f172a] font-medium' : 'hover:bg-[#f1f5f9] text-[#1e293b]'
                }`}
              >
                <button
                  type="button"
                  aria-label={`展开或折叠${ap.name}`}
                  aria-expanded={!apCollapsed}
                  onClick={(e) => toggleNode(ap.id, e)}
                  className="p-0.5 text-[#64748b] hover:text-[#0f172a] shrink-0"
                >
                  {apCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  title={`${ap.name} — 坐标 X:${ap.x} Y:${ap.y || 0} Z:${ap.z} mm，${ap.orientation === 'horizontal' ? '卧式' : '立式'}，主构件 ${mainComponents.length} 项 / 附属件 ${attachments.length} 项`}
                  onClick={() => onSelectAssembly(ap.id)}
                  className="flex-1 min-w-0 text-left truncate font-medium cursor-pointer"
                >
                  {ap.name}(X:{ap.x}
                  {ap.y ? ` Y:${ap.y}` : ''} Z:{ap.z} {orientLabel})
                </button>
              </div>

              {!apCollapsed && (
                <div className="pl-3.5">
                  {mainComponents.length === 0 && orphanAttachments.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] text-[#94a3b8]">(点击上方主构件添加)</div>
                  ) : (
                    <>
                      {mainComponents.map((mainComp) => {
                        const childAttachments = attachments.filter((a) => a.parentId === mainComp.id);
                        const hasChildren =
                          childAttachments.length > 0 || (mainComp.subNodes && mainComp.subNodes.length > 0);
                        const isCollapsed = !!collapsedNodes[mainComp.id];
                        const isSelected = selectedComponentId === mainComp.id;

                        return (
                          <div key={mainComp.id}>
                            <div
                              className={`group flex items-center gap-0.5 px-1 py-[1px] rounded-[2px] ${
                                isSelected
                                  ? 'bg-[#cce4ff] text-[#0f172a] font-medium'
                                  : 'hover:bg-[#f1f5f9] text-[#1f2937]'
                              } ${!mainComp.visible ? 'opacity-50 line-through' : ''}`}
                            >
                              {hasChildren ? (
                                <button
                                  type="button"
                                  aria-label={`展开或折叠${mainComp.name}`}
                                  aria-expanded={!isCollapsed}
                                  onClick={(e) => toggleNode(mainComp.id, e)}
                                  className="p-0.5 text-[#64748b] hover:text-[#0f172a] shrink-0"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4 inline-block shrink-0" />
                              )}
                              <button
                                type="button"
                                title={`${mainComp.name}${!mainComp.visible ? '（已隐藏）' : ''} — 双击打开详细参数`}
                                onClick={() => onSelectComponent(ap.id, mainComp.id)}
                                onDoubleClick={() => onDoubleClickComponent(mainComp)}
                                className="flex-1 min-w-0 text-left truncate cursor-pointer flex items-center gap-1"
                              >
                                <span className="truncate flex-1">{mainComp.name}</span>
                              </button>
                              {onToggleComponentVisibility ? (
                                <button
                                  type="button"
                                  aria-label={`${mainComp.visible ? '隐藏' : '显示'}${mainComp.name}`}
                                  title={mainComp.visible ? '在三维视口中隐藏' : '恢复在三维视口中显示'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleComponentVisibility(mainComp.id);
                                  }}
                                  className={`p-0.5 rounded-[2px] shrink-0 transition-opacity ${
                                    mainComp.visible
                                      ? 'opacity-0 group-hover:opacity-100 text-[#64748b] hover:text-[#0f172a]'
                                      : 'opacity-100 text-[#d97706] hover:text-[#b45309]'
                                  }`}
                                >
                                  {mainComp.visible ? (
                                    <Eye className="w-3 h-3" />
                                  ) : (
                                    <EyeOff className="w-3 h-3" />
                                  )}
                                </button>
                              ) : (
                                !mainComp.visible && <EyeOff className="w-3 h-3 text-[#94a3b8] shrink-0" />
                              )}
                            </div>

                            {!isCollapsed && hasChildren && (
                              <div className="pl-4">
                                {/* Main component's own sub-nodes (clickable with structured engineering details) */}
                                {mainComp.subNodes?.map((sub, i) => {
                                  const subSelected = isSelected && selectedSubNode === sub;
                                  return (
                                    <button
                                      key={`${mainComp.id}-sub-${i}`}
                                      type="button"
                                      onClick={() =>
                                        onSelectSubNode
                                          ? onSelectSubNode(ap.id, mainComp.id, sub)
                                          : onSelectComponent(ap.id, mainComp.id)
                                      }
                                      onDoubleClick={() => onDoubleClickComponent(mainComp)}
                                      className={`w-full text-left px-2 py-[0.5px] text-[10.5px] cursor-pointer truncate block rounded-[2px] ${
                                        subSelected
                                          ? 'bg-[#d8dce2] text-[#0f172a] font-semibold'
                                          : 'text-[#475569] hover:bg-[#f1f5f9]'
                                      }`}
                                    >
                                      {sub}
                                    </button>
                                  );
                                })}

                                {/* Child Attachments */}
                                {childAttachments.map((att) => renderAttachmentNode(att))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Fallback group for any orphan/unmounted attachments so imported items are never silently hidden */}
                      {orphanAttachments.length > 0 && (
                        <div className="mt-1">
                          <div className="px-1.5 py-0.5 text-[10.5px] font-medium text-[#b45309] bg-[#fffbeb] border border-[#fde68a] rounded-[2px]">
                            未挂载附属件 ({orphanAttachments.length})
                          </div>
                          <div className="pl-2 mt-0.5">
                            {orphanAttachments.map((att) => renderAttachmentNode(att))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
