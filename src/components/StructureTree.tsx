import React, { useState } from 'react';
import { ChevronDown, ChevronRight, PlusCircle, EyeOff } from 'lucide-react';
import type { AssemblyPoint, VesselComponent } from '../types/vessel';

interface StructureTreeProps {
  assemblies: AssemblyPoint[];
  selectedAssemblyId: string;
  selectedComponentId: string | null;
  selectedSubNode?: string | null;
  onSelectAssembly: (assemblyId: string) => void;
  onSelectComponent: (assemblyId: string, componentId: string) => void;
  onSelectSubNode?: (assemblyId: string, componentId: string, subNode: string) => void;
  onAddAssemblyPoint: () => void;
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
  onAddAssemblyPoint,
  onDoubleClickComponent,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

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
      <div className="h-[22px] px-2 flex items-center bg-[#f1f4f8] border-b border-[#d5dbe3] text-[11px] font-medium text-[#334155]">
        结构树
      </div>

      {/* Add Assembly Point Button (exact GHPV style) */}
      <div className="px-2 py-1.5 border-b border-[#e5e7eb] flex justify-center bg-white">
        <button
          type="button"
          onClick={onAddAssemblyPoint}
          className="w-full h-[24px] flex items-center justify-center gap-1.5 text-[11.5px] text-[#1e293b] bg-[#f8fafc] hover:bg-[#e8f1fb] border border-[#cbd5e1] hover:border-[#60a5fa] rounded-[2px] transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#334155]" />
          <span>加装配点</span>
        </button>
      </div>

      {/* Hierarchical Tree Body */}
      <div className="flex-1 overflow-y-auto px-1 py-1 text-[11.5px] leading-[20px]">
        {assemblies.map((ap) => {
          const apCollapsed = !!collapsedNodes[ap.id];
          const orientLabel = ap.orientation === 'horizontal' ? '卧' : '立';
          const mainComponents = ap.components.filter((c) => c.category === 'main');
          const attachments = ap.components.filter((c) => c.category === 'attachment');
          const isApSelected = selectedAssemblyId === ap.id && !selectedComponentId;

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
                  onClick={() => onSelectAssembly(ap.id)}
                  className="flex-1 min-w-0 text-left truncate font-medium cursor-pointer"
                >
                  {ap.name}(X:{ap.x} Z:{ap.z} {orientLabel})
                </button>
              </div>

              {!apCollapsed && (
                <div className="pl-3.5">
                  {mainComponents.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] text-[#94a3b8]">(点击上方主构件添加)</div>
                  ) : (
                    mainComponents.map((mainComp) => {
                      const childAttachments = attachments.filter((a) => a.parentId === mainComp.id);
                      const hasChildren =
                        childAttachments.length > 0 || (mainComp.subNodes && mainComp.subNodes.length > 0);
                      const isCollapsed = !!collapsedNodes[mainComp.id];
                      const isSelected = selectedComponentId === mainComp.id;

                      return (
                        <div key={mainComp.id}>
                          <div
                            className={`flex items-center gap-0.5 px-1 py-[1px] rounded-[2px] ${
                              isSelected
                                ? 'bg-[#cce4ff] text-[#0f172a] font-medium'
                                : 'hover:bg-[#f1f5f9] text-[#1f2937]'
                            } ${!mainComp.visible ? 'opacity-45 line-through' : ''}`}
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
                              onClick={() => onSelectComponent(ap.id, mainComp.id)}
                              onDoubleClick={() => onDoubleClickComponent(mainComp)}
                              className="flex-1 min-w-0 text-left truncate cursor-pointer flex items-center gap-1"
                            >
                              <span className="truncate flex-1">{mainComp.name}</span>
                              {!mainComp.visible && <EyeOff className="w-3 h-3 text-[#94a3b8] shrink-0" />}
                            </button>
                          </div>

                          {!isCollapsed && hasChildren && (
                            <div className="pl-4">
                              {/* Main component's own sub-nodes (matching GHPV tree) */}
                              {mainComp.subNodes?.map((sub, i) => (
                                <button
                                  key={`${mainComp.id}-sub-${i}`}
                                  type="button"
                                  onClick={() => onSelectComponent(ap.id, mainComp.id)}
                                  onDoubleClick={() => onDoubleClickComponent(mainComp)}
                                  className="w-full text-left px-2 py-[0.5px] text-[11px] text-[#475569] hover:bg-[#f8fafc] cursor-pointer truncate block"
                                >
                                  {sub}
                                </button>
                              ))}

                              {/* Child Attachments */}
                              {childAttachments.map((att) => {
                                const attSelected = selectedComponentId === att.id;
                                const attHasSub = !!(att.subNodes && att.subNodes.length > 0);
                                const attExpanded =
                                  collapsedNodes[att.id] === false ||
                                  (collapsedNodes[att.id] === undefined && attSelected && !!selectedSubNode);

                                return (
                                  <div key={att.id}>
                                    <div
                                      className={`flex items-center gap-0.5 px-1 py-[1px] rounded-[2px] ${
                                        attSelected
                                          ? 'bg-[#cce4ff] text-[#0f172a] font-medium'
                                          : 'hover:bg-[#f1f5f9] text-[#1f2937]'
                                      } ${!att.visible ? 'opacity-45 line-through' : ''}`}
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
                                        onClick={() => onSelectComponent(ap.id, att.id)}
                                        onDoubleClick={() => onDoubleClickComponent(att)}
                                        className="flex-1 min-w-0 text-left truncate cursor-pointer flex items-center gap-1"
                                      >
                                        <span className="truncate flex-1">{att.name}</span>
                                        {!att.visible && <EyeOff className="w-3 h-3 text-[#94a3b8] shrink-0" />}
                                      </button>
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
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
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
