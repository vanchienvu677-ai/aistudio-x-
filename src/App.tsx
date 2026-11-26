import React, { useMemo, useRef, useState } from 'react';
import type {
  AssemblyPoint,
  CameraAngles,
  ComponentType,
  RenderMode,
  RgbaColor,
  SectionPlaneState,
  TechnicalSpec,
  VesselComponent,
  ViewportBackgroundConfig,
} from './types/vessel';
import { createDefaultComponent, VESSEL_PRESETS } from './data/presets';
import { autoFixInterferences, generateBOM } from './core/vesselMath';
import { RibbonToolbar, type RibbonTab } from './components/RibbonToolbar';
import { StructureTree } from './components/StructureTree';
import { PropertyPanel, type PropPanelTab } from './components/PropertyPanel';
import {
  Viewport3D,
  type ExternalMeshModel,
  type Viewport3DHandle,
} from './components/Viewport3D';
import { ComponentDialog, TechSpecDialog } from './components/Dialogs/ComponentDialogs';
import {
  AboutDialog,
  BomDialog,
  ConfigDialog,
  Drawing2DDialog,
  SectionPlaneDialog,
} from './components/Dialogs/UtilityDialogs';
import {
  BatchNozzleDialog,
  CostEstimateDialog,
  GuidedWizardDialog,
  InterferenceCheckDialog,
  MaterialLibraryDialog,
  PdmsExportDialog,
} from './components/Dialogs/V16Dialogs';
import { Export3DModelDialog, ImportModelDialog } from './components/Dialogs/IoDialogs';
import {
  loadExternal3DModelBuffer,
  type Export3DFormat,
  type SceneMeshStats,
} from './scene/cadExporters';
import type { GhpvImportResult } from './core/ghpvImporter';

function cloneAssemblies(list: AssemblyPoint[]): AssemblyPoint[] {
  return JSON.parse(JSON.stringify(list)) as AssemblyPoint[];
}

export default function App() {
  const initialPreset =
    VESSEL_PRESETS.find((p) => p.id === 'u_exchanger') || VESSEL_PRESETS[0];

  const [activeTab, setActiveTab] = useState<RibbonTab>('start');
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id);
  const [spec, setSpec] = useState<TechnicalSpec>({ ...initialPreset.spec });
  const [assemblies, setAssemblies] = useState<AssemblyPoint[]>(() =>
    cloneAssemblies(initialPreset.assemblies)
  );
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>(
    initialPreset.assemblies[0].id
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    initialPreset.assemblies[0].components.find((c) => c.type === 'shell')?.id ??
      initialPreset.assemblies[0].components[0]?.id ??
      null
  );
  const [selectedSubNode, setSelectedSubNode] = useState<string | null>(null);

  // Viewport visual controls
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [bgConfig, setBgConfig] = useState<ViewportBackgroundConfig>({
    mode: 'gradient',
    topColor: '#ffffff',
    bottomColor: '#8ee4e4',
  });
  const [sectionState, setSectionState] = useState<SectionPlaneState>({
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
  });
  const [explodeEnabled, setExplodeEnabled] = useState<boolean>(false);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [cameraAngles, setCameraAngles] = useState<CameraAngles>({
    azimuthDeg: 44,
    elevationDeg: 22,
    zoomPercent: 100,
  });
  const [showOrigin, setShowOrigin] = useState<boolean>(true);
  const [showNozzleTags, setShowNozzleTags] = useState<boolean>(false);
  const [measureMode, setMeasureMode] = useState<boolean>(false);

  // Dialog states
  const [editingDialog, setEditingDialog] = useState<{
    assemblyId: string;
    component: VesselComponent;
    isNew: boolean;
  } | null>(null);
  const [showTechSpec, setShowTechSpec] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [show2DCad, setShow2DCad] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showMaterialLib, setShowMaterialLib] = useState(false);
  const [showBatchNozzle, setShowBatchNozzle] = useState(false);
  const [showCostEstimate, setShowCostEstimate] = useState(false);
  const [showPdmsExport, setShowPdmsExport] = useState(false);
  const [showInterferenceCheck, setShowInterferenceCheck] = useState(false);
  const [showExport3D, setShowExport3D] = useState(false);
  const [showImportModel, setShowImportModel] = useState(false);
  const [exportMeshStats, setExportMeshStats] = useState<SceneMeshStats>({
    meshCount: 0,
    triangleCount: 0,
    sizeMm: [0, 0, 0],
  });
  const [externalMeshModel, setExternalMeshModel] = useState<ExternalMeshModel | null>(null);
  const [injectedAiDatasheet, setInjectedAiDatasheet] = useState<{ token: number; text: string } | null>(null);
  const [propTab, setPropTab] = useState<PropPanelTab>('property');

  const [statusMessage, setStatusMessage] = useState<string>(
    '就绪 — GHPV V2.1 高惠PV压力容器数字化交付系统'
  );

  const viewportRef = useRef<Viewport3DHandle | null>(null);

  const bomSummary = useMemo(() => generateBOM(assemblies), [assemblies]);

  const activeAssembly = useMemo(
    () => assemblies.find((a) => a.id === selectedAssemblyId) || assemblies[0],
    [assemblies, selectedAssemblyId]
  );

  const selectedComponent = useMemo<VesselComponent | null>(() => {
    if (!selectedComponentId) return null;
    for (const ap of assemblies) {
      const found = ap.components.find((c) => c.id === selectedComponentId);
      if (found) return found;
    }
    return null;
  }, [assemblies, selectedComponentId]);

  const handleSelectPreset = (presetId: string) => {
    const preset = VESSEL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setExternalMeshModel(null);
    const cloned = cloneAssemblies(preset.assemblies);
    setActivePresetId(preset.id);
    setSpec({ ...preset.spec });
    setAssemblies(cloned);
    setSelectedAssemblyId(cloned[0].id);
    const firstMain =
      cloned[0].components.find((c) => c.type === 'shell' || c.type === 'spherical_tank') ||
      cloned[0].components[0];
    if (preset.id === 'stacked_exchanger') {
      const bundle1 = cloned[0].components.find((c) => c.id === 'st-bundle-1') || firstMain;
      setSelectedComponentId(bundle1?.id ?? null);
      setSelectedSubNode('折流板8');
      setExplodeEnabled(true);
      setExplodeFactor(0.68);
      setSectionState((s) => ({ ...s, enabled: false, xEnabled: false, yEnabled: false, zEnabled: false }));
      setStatusMessage(`已加载 ${preset.label} — 已自动开启 GHPV 三维爆炸视图 (可拖动右下角滑块实时展开/复位)`);
      return;
    }
    setSelectedComponentId(firstMain?.id ?? null);
    setSelectedSubNode(null);
    setExplodeEnabled(false);
    setExplodeFactor(0);
    setSectionState((s) => ({ ...s, enabled: false, xEnabled: false, yEnabled: false, zEnabled: false }));
    setStatusMessage(`已加载示例模型: ${preset.label}`);
  };

  const handleApplyWizard = (
    presetId: string,
    nextSpec: TechnicalSpec,
    nextAssemblies: AssemblyPoint[]
  ) => {
    setExternalMeshModel(null);
    setActivePresetId(presetId);
    setSpec(nextSpec);
    setAssemblies(nextAssemblies);
    setSelectedAssemblyId(nextAssemblies[0].id);
    setSelectedComponentId(nextAssemblies[0].components[0]?.id ?? null);
    setSelectedSubNode(null);
    setExplodeEnabled(false);
    setExplodeFactor(0);
    setStatusMessage(`向导式建模完成: ${nextSpec.vesselTag} (${nextSpec.vesselName})`);
  };

  const handleApplyBatchNozzles = (assemblyId: string, updatedNozzles: VesselComponent[]) => {
    setAssemblies((prev) =>
      prev.map((ap) => {
        if (ap.id !== assemblyId) return ap;
        const nonNozzles = ap.components.filter((c) => c.type !== 'nozzle_manhole');
        return { ...ap, components: [...nonNozzles, ...updatedNozzles] };
      })
    );
    setStatusMessage(`已批量更新 ${updatedNozzles.length} 个管口模型`);
  };

  const handleApplyAiModel = (
    presetId: string,
    nextSpec: TechnicalSpec,
    nextAssemblies: AssemblyPoint[],
    notes: string
  ) => {
    setExternalMeshModel(null);
    setActivePresetId(presetId);
    setSpec(nextSpec);
    setAssemblies(nextAssemblies);
    setSelectedAssemblyId(nextAssemblies[0].id);
    const firstMain =
      nextAssemblies[0].components.find((c) => c.type === 'shell' || c.type === 'spherical_tank') ||
      nextAssemblies[0].components[0];
    setSelectedComponentId(firstMain?.id ?? null);
    setSelectedSubNode(null);
    setExplodeEnabled(false);
    setExplodeFactor(0);
    setStatusMessage(`AI 建模完成: ${nextSpec.vesselTag} (${notes || nextSpec.vesselName})`);
  };

  const handleAutoFixInterferences = () => {
    const res = autoFixInterferences(assemblies);
    if (res.fixedCount > 0) {
      setAssemblies(res.assemblies);
    }
    setStatusMessage(res.summary);
  };

  const handleNewDocument = () => {
    setExternalMeshModel(null);
    const newAp: AssemblyPoint = {
      id: `ap-${Date.now()}`,
      name: '装配点1',
      x: 0,
      z: 0,
      orientation: 'horizontal',
      components: [],
    };
    setAssemblies([newAp]);
    setSelectedAssemblyId(newAp.id);
    setSelectedComponentId(null);
    setSelectedSubNode(null);
    setExplodeEnabled(false);
    setExplodeFactor(0);
    setStatusMessage('已新建空白工程，请点击上方主构件或向导式建模开始设计');
  };

  const handleSaveDocument = () => {
    const payload = JSON.stringify({ version: 'GHPV-V2.1', spec, assemblies }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.vesselTag || 'vessel'}.ghpv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`已保存高惠工程文件: ${spec.vesselTag || 'vessel'}.ghpv`);
  };

  const handleOpenDocument = () => {
    setShowImportModel(true);
  };

  const handleOpenExport3D = () => {
    const stats = viewportRef.current?.getMeshStats() || {
      meshCount: 0,
      triangleCount: 0,
      sizeMm: [0, 0, 0],
    };
    setExportMeshStats(stats);
    setShowExport3D(true);
  };

  const triggerDownload = (fileName: string, data: string | ArrayBuffer, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return blob.size;
  };

  const handleExport3DFormat = async (format: Export3DFormat, unit: 'mm' | 'm') => {
    const vp = viewportRef.current;
    if (!vp) throw new Error('三维视口尚未就绪');
    const bundle = await vp.exportModel(format, spec.vesselTag || 'GHPV_Vessel', unit);
    const sizeBytes = triggerDownload(bundle.primary.fileName, bundle.primary.data, bundle.primary.mime);
    if (bundle.secondary) {
      triggerDownload(bundle.secondary.fileName, bundle.secondary.data, bundle.secondary.mime);
    }
    setStatusMessage(`已导出三维模型: ${bundle.primary.fileName} (单位: ${unit})`);
    return { fileName: bundle.primary.fileName, sizeBytes };
  };

  const handleImportGhpvResult = (result: GhpvImportResult) => {
    setExternalMeshModel(null);
    setSpec(result.spec);
    setAssemblies(result.assemblies);
    setSelectedAssemblyId(result.assemblies[0]?.id || '');
    const firstMain =
      result.assemblies[0]?.components.find((c) => c.type === 'shell' || c.type === 'spherical_tank') ||
      result.assemblies[0]?.components[0] ||
      null;
    setSelectedComponentId(firstMain?.id ?? null);
    setSelectedSubNode(null);
    setExplodeEnabled(false);
    setExplodeFactor(0);
    setStatusMessage(result.summary);
  };

  const handleImportExternal3DFile = async (fileName: string, buffer: ArrayBuffer) => {
    const loaded = await loadExternal3DModelBuffer(fileName, buffer);
    setExternalMeshModel(loaded);
    setStatusMessage(
      `已导入外部三维模型查看: ${loaded.name} (${loaded.stats.triangleCount.toLocaleString()} 面 · ${loaded.stats.sizeMm.join('×')} mm)`
    );
    return loaded.stats;
  };

  const handleAddAssemblyPoint = () => {
    const idx = assemblies.length + 1;
    const newAp: AssemblyPoint = {
      id: `ap-${Date.now()}`,
      name: `装配点${idx}`,
      x: (idx - 1) * 1600,
      z: 0,
      orientation: 'vertical',
      components: [],
    };
    setAssemblies((prev) => [...prev, newAp]);
    setSelectedAssemblyId(newAp.id);
    setSelectedComponentId(null);
    setStatusMessage(`已新建 ${newAp.name} (立式)`);
  };

  const handleOpenAddComponent = (type: ComponentType) => {
    const targetAp =
      assemblies.find((a) => a.id === selectedAssemblyId) || assemblies[0];
    if (!targetAp) return;

    let parentId: string | undefined;
    let refDiameter = 1200;
    const selectedInAp = targetAp.components.find((c) => c.id === selectedComponentId);
    if (selectedInAp && selectedInAp.category === 'main') {
      parentId = selectedInAp.id;
      const d = (selectedInAp.params as { diameter?: number }).diameter;
      if (d) refDiameter = d;
    } else {
      const firstMain =
        targetAp.components.find((c) => c.type === 'shell' || c.type === 'spherical_tank') ||
        targetAp.components.find((c) => c.category === 'main');
      if (firstMain) {
        parentId = firstMain.id;
        const d = (firstMain.params as { diameter?: number }).diameter;
        if (d) refDiameter = d;
      }
    }

    const sameTypeCount = targetAp.components.filter((c) => c.type === type).length;
    const draft = createDefaultComponent(type, sameTypeCount, parentId, refDiameter);

    if (draft.category === 'attachment' && !parentId) {
      setStatusMessage('提示：请先添加一个主构件（如筒体、球壳或封头），再添加附属件');
      return;
    }

    setEditingDialog({
      assemblyId: targetAp.id,
      component: draft,
      isNew: true,
    });
  };

  const handleConfirmComponent = (updated: VesselComponent) => {
    if (!editingDialog) return;
    const { assemblyId, isNew } = editingDialog;

    setAssemblies((prev) =>
      prev.map((ap) => {
        if (ap.id !== assemblyId) return ap;
        if (isNew) {
          return { ...ap, components: [...ap.components, updated] };
        }
        return {
          ...ap,
          components: ap.components.map((c) => (c.id === updated.id ? updated : c)),
        };
      })
    );

    setSelectedAssemblyId(assemblyId);
    setSelectedComponentId(updated.id);
    setEditingDialog(null);
    setStatusMessage(`${isNew ? '已添加' : '已更新'}元件: ${updated.name}`);
  };

  const handleSelectFromViewport = (compId: string | null) => {
    setSelectedComponentId(compId);
    if (compId) {
      for (const ap of assemblies) {
        const found = ap.components.find((c) => c.id === compId);
        if (found) {
          setSelectedAssemblyId(ap.id);
          setStatusMessage(`已选中: ${found.name}`);
          break;
        }
      }
    }
  };

  const handleUpdateName = (componentId: string, name: string) => {
    setAssemblies((prev) =>
      prev.map((ap) => ({
        ...ap,
        components: ap.components.map((c) => {
          if (c.id !== componentId) return c;
          const syncedSubNodes =
            c.subNodes && c.subNodes.length === 1 && c.subNodes[0] === c.name ? [name] : c.subNodes;
          if (c.type === 'nozzle_manhole') {
            return {
              ...c,
              name,
              subNodes: syncedSubNodes,
              params: { ...c.params, tag: name },
            };
          }
          return { ...c, name, subNodes: syncedSubNodes };
        }),
      }))
    );
  };

  const handleUpdateColor = (componentId: string, color: RgbaColor) => {
    setAssemblies((prev) =>
      prev.map((ap) => ({
        ...ap,
        components: ap.components.map((c) => (c.id === componentId ? { ...c, color } : c)),
      }))
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedComponentId) {
      setStatusMessage('请先选中需要删除的元件');
      return;
    }
    const deletedName = selectedComponent?.name || '元件';
    setAssemblies((prev) =>
      prev.map((ap) => ({
        ...ap,
        components: ap.components.filter(
          (c) => c.id !== selectedComponentId && c.parentId !== selectedComponentId
        ),
      }))
    );
    setSelectedComponentId(null);
    setStatusMessage(`已删除: ${deletedName}`);
  };

  const handleToggleOrientation = () => {
    setAssemblies((prev) =>
      prev.map((ap) =>
        ap.id === selectedAssemblyId
          ? { ...ap, orientation: ap.orientation === 'horizontal' ? 'vertical' : 'horizontal' }
          : ap
      )
    );
    setStatusMessage('已切换装配点立式 / 卧式方向');
  };

  const handleToggleVisibility = () => {
    if (!selectedComponentId) {
      setStatusMessage('请先选择一个元件以切换显示/隐藏');
      return;
    }
    setAssemblies((prev) =>
      prev.map((ap) => ({
        ...ap,
        components: ap.components.map((c) =>
          c.id === selectedComponentId ? { ...c, visible: !c.visible } : c
        ),
      }))
    );
  };

  const handleUpdateAssembly = (
    assemblyId: string,
    patch: Partial<Pick<AssemblyPoint, 'name' | 'x' | 'z' | 'orientation'>>
  ) => {
    setAssemblies((prev) =>
      prev.map((ap) => (ap.id === assemblyId ? { ...ap, ...patch } : ap))
    );
  };

  const handleCameraAnglesFromSlider = (next: CameraAngles) => {
    setCameraAngles(next);
    viewportRef.current?.setCameraAngles(next);
  };

  const activeExplodeFactor = explodeEnabled ? explodeFactor : 0;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#f0f2f5] text-[#1f2937]">
      {/* Top Desktop Title Bar + GHPV V2.1 8-Tab Component Ribbon */}
      <RibbonToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onNewDocument={handleNewDocument}
        onOpenDocument={handleOpenDocument}
        onSaveDocument={handleSaveDocument}
        onExportStl={handleOpenExport3D}
        onOpenAbout={() => setShowAboutDialog(true)}
        onOpenConfig={() => setShowConfigDialog(true)}
        onOpenTechSpec={() => setShowTechSpec(true)}
        onAddComponent={handleOpenAddComponent}
        onOpenBom={() => setShowBom(true)}
        onOpen2DCad={() => setShow2DCad(true)}
        onOpenWizard={() => setShowWizard(true)}
        onOpenMaterialLib={() => setShowMaterialLib(true)}
        onOpenBatchNozzle={() => setShowBatchNozzle(true)}
        onOpenCostEstimate={() => setShowCostEstimate(true)}
        onOpenPdmsExport={() => setShowPdmsExport(true)}
        onOpenInterferenceCheck={() => setShowInterferenceCheck(true)}
        onOpenAiModel={() => {
          setPropTab('aiModel');
          setStatusMessage('已打开右侧 GHPV V2.1 AI 建模面板 — 粘贴数据表或上传条件图即可自动生成 3D 设备');
        }}
      />

      {/* 3-Column CAD Workspace: Structure Tree | 3D Viewport | Property + Dock Panel */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        <StructureTree
          assemblies={assemblies}
          selectedAssemblyId={selectedAssemblyId}
          selectedComponentId={selectedComponentId}
          selectedSubNode={selectedSubNode}
          onSelectAssembly={(apId) => {
            setSelectedAssemblyId(apId);
            setSelectedComponentId(null);
            setSelectedSubNode(null);
          }}
          onSelectComponent={(apId, compId) => {
            setSelectedAssemblyId(apId);
            setSelectedComponentId(compId);
            setSelectedSubNode(null);
          }}
          onSelectSubNode={(apId, compId, subNode) => {
            setSelectedAssemblyId(apId);
            setSelectedComponentId(compId);
            setSelectedSubNode(subNode);
          }}
          onAddAssemblyPoint={handleAddAssemblyPoint}
          onDoubleClickComponent={(comp) => {
            const ownerAp =
              assemblies.find((a) => a.components.some((c) => c.id === comp.id))?.id ||
              selectedAssemblyId;
            setEditingDialog({ assemblyId: ownerAp, component: comp, isNew: false });
          }}
        />

        <Viewport3D
          ref={viewportRef}
          assemblies={assemblies}
          selectedComponentId={selectedComponentId}
          selectedSubNode={selectedSubNode}
          externalMeshModel={externalMeshModel}
          onClearExternalModel={() => {
            setExternalMeshModel(null);
            setStatusMessage(`已切换回参数化编辑模型 (${spec.vesselTag})`);
          }}
          renderMode={renderMode}
          bgConfig={bgConfig}
          sectionState={sectionState}
          explodeFactor={activeExplodeFactor}
          showOrigin={showOrigin}
          showNozzleTags={showNozzleTags}
          measureMode={measureMode}
          onSelectComponent={(compId) => {
            setSelectedSubNode(null);
            handleSelectFromViewport(compId);
          }}
          onCameraAnglesChange={setCameraAngles}
          onRenderModeChange={setRenderMode}
          onDeleteSelected={handleDeleteSelected}
          onToggleOrientation={handleToggleOrientation}
          onToggleSectionDialog={() => {
            setShowSectionDialog((prev) => {
              const next = !prev;
              if (next) {
                setSectionState((s) => ({
                  ...s,
                  enabled: true,
                  zEnabled: s.xEnabled || s.yEnabled || s.zEnabled ? s.zEnabled : true,
                }));
              }
              return next;
            });
          }}
          onToggleVisibility={handleToggleVisibility}
          onToggleMeasureMode={() => setMeasureMode((v) => !v)}
          onToggleOrigin={() => setShowOrigin((v) => !v)}
          onToggleNozzleTags={() => setShowNozzleTags((v) => !v)}
        />

        <PropertyPanel
          assembly={activeAssembly || null}
          component={selectedComponent}
          selectedSubNode={selectedSubNode}
          spec={spec}
          totalVesselWeightKg={bomSummary.totalWeightKg}
          totalVesselVolumeM3={bomSummary.totalInternalVolumeM3}
          explodeEnabled={explodeEnabled}
          explodeFactor={explodeFactor}
          cameraAngles={cameraAngles}
          activePropTab={propTab}
          onChangePropTab={setPropTab}
          onToggleExplode={(en) => {
            setExplodeEnabled(en);
            setStatusMessage(en ? '已开启三维爆炸视图' : '已恢复三维装配视图');
          }}
          onChangeExplodeFactor={(f) => {
            setExplodeFactor(f);
            setStatusMessage(`爆炸视图展开度: ${Math.round(f * 100)}%`);
          }}
          onChangeCameraAngles={handleCameraAnglesFromSlider}
          onUpdateAssembly={handleUpdateAssembly}
          onUpdateName={handleUpdateName}
          onUpdateColor={handleUpdateColor}
          onOpenDetailDialog={(comp) => {
            const ownerAp =
              assemblies.find((a) => a.components.some((c) => c.id === comp.id))?.id ||
              selectedAssemblyId;
            setEditingDialog({ assemblyId: ownerAp, component: comp, isNew: false });
          }}
          onOpenTechSpec={() => setShowTechSpec(true)}
          injectedAiDatasheet={injectedAiDatasheet}
          onApplyAiModel={(presetId, nextSpec, nextAssemblies, notes) => {
            setExternalMeshModel(null);
            handleApplyAiModel(presetId, nextSpec, nextAssemblies, notes);
          }}
        />
      </main>

      {/* Thin Classic Desktop Status Bar */}
      <footer className="h-[21px] px-2.5 flex items-center justify-between bg-[#eef1f5] border-t border-[#cbd5e1] text-[10.5px] text-[#475569] shrink-0 select-none tabular-nums">
        <span className="truncate">{statusMessage}</span>
        <div className="flex items-center gap-4 shrink-0">
          <span>位号: {spec.vesselTag}</span>
          <span>元件数: {bomSummary.rows.length}</span>
          <span>净重: {bomSummary.totalWeightKg.toFixed(1)} kg</span>
          {activeExplodeFactor > 0 && (
            <span className="text-[#2563eb] font-medium">
              爆炸: {Math.round(activeExplodeFactor * 100)}%
            </span>
          )}
        </div>
      </footer>

      {/* Parametric Component Dialog */}
      {editingDialog && (
        <ComponentDialog
          component={editingDialog.component}
          isNew={editingDialog.isNew}
          onConfirm={handleConfirmComponent}
          onCancel={() => setEditingDialog(null)}
        />
      )}

      {/* Technical Spec Dialog */}
      {showTechSpec && (
        <TechSpecDialog
          spec={spec}
          onSave={(nextSpec) => {
            setSpec(nextSpec);
            setShowTechSpec(false);
            setStatusMessage(`已更新技术特性表 (${nextSpec.vesselTag})`);
          }}
          onClose={() => setShowTechSpec(false)}
        />
      )}

      {/* Bill of Material Dialog */}
      {showBom && (
        <BomDialog assemblies={assemblies} spec={spec} onClose={() => setShowBom(false)} />
      )}

      {/* GH2V2D 2D Engineering Drawing Dialog */}
      {show2DCad && (
        <Drawing2DDialog assemblies={assemblies} spec={spec} onClose={() => setShow2DCad(false)} />
      )}

      {/* Guided Wizard Dialog (向导式建模) */}
      {showWizard && (
        <GuidedWizardDialog
          onApply={handleApplyWizard}
          onGenerateAndDraw={(presetId, nextSpec, nextAssemblies) => {
            handleApplyWizard(presetId, nextSpec, nextAssemblies);
            setShow2DCad(true);
            setStatusMessage(`向导式建模并已一键生成 2D 工程图: ${nextSpec.vesselTag}`);
          }}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Batch Nozzle Dialog (批量管口建模) */}
      {showBatchNozzle && activeAssembly && (
        <BatchNozzleDialog
          assembly={activeAssembly}
          onApplyNozzles={handleApplyBatchNozzles}
          onClose={() => setShowBatchNozzle(false)}
        />
      )}

      {/* Cost Estimate Dialog (造价估算) */}
      {showCostEstimate && (
        <CostEstimateDialog
          assemblies={assemblies}
          spec={spec}
          onClose={() => setShowCostEstimate(false)}
        />
      )}

      {/* PDMS Macro Export Dialog (导入PDMS) */}
      {showPdmsExport && (
        <PdmsExportDialog
          assemblies={assemblies}
          spec={spec}
          onClose={() => setShowPdmsExport(false)}
        />
      )}

      {/* Steel Material Library Dialog (材料库) */}
      {showMaterialLib && <MaterialLibraryDialog onClose={() => setShowMaterialLib(false)} />}

      {/* 3D Interference Check Dialog (干涉检查 — GHPV Ep 11) */}
      {showInterferenceCheck && (
        <InterferenceCheckDialog
          assemblies={assemblies}
          spec={spec}
          onLocateComponent={(compId) => {
            handleSelectFromViewport(compId);
            setShowInterferenceCheck(false);
          }}
          onAutoFix={handleAutoFixInterferences}
          onOpen2DDrawing={() => {
            setShowInterferenceCheck(false);
            setShow2DCad(true);
            setStatusMessage(`干涉检查通过，已一键生成 2D 工程图 (${spec.vesselTag})`);
          }}
          onClose={() => setShowInterferenceCheck(false)}
        />
      )}

      {/* Floating Section Plane Tool */}
      {showSectionDialog && (
        <SectionPlaneDialog
          state={sectionState}
          onChange={setSectionState}
          onClose={() => setShowSectionDialog(false)}
        />
      )}

      {/* Viewport Config Dialog */}
      {showConfigDialog && (
        <ConfigDialog
          config={bgConfig}
          onChange={setBgConfig}
          onClose={() => setShowConfigDialog(false)}
        />
      )}

      {/* Multi-Format 3D Model Export Dialog */}
      {showExport3D && (
        <Export3DModelDialog
          spec={spec}
          componentCount={bomSummary.rows.length}
          meshStats={exportMeshStats}
          onExport3D={handleExport3DFormat}
          onExportGhpvProject={handleSaveDocument}
          onOpenPdms={() => setShowPdmsExport(true)}
          onClose={() => setShowExport3D(false)}
        />
      )}

      {/* Import GHPV Native/Legacy & External 3D Model Dialog */}
      {showImportModel && (
        <ImportModelDialog
          onImportGhpvResult={handleImportGhpvResult}
          onSendExtractedToAi={(fileName, extractedText) => {
            setPropTab('aiModel');
            setInjectedAiDatasheet({
              token: Date.now(),
              text: `[高惠原版文件解析文本: ${fileName}]\n${extractedText}`,
            });
            setStatusMessage(`已将 ${fileName} 提取的参数送入右侧 AI 建模面板`);
          }}
          onImportExternal3DFile={handleImportExternal3DFile}
          onClose={() => setShowImportModel(false)}
        />
      )}

      {/* About Dialog */}
      {showAboutDialog && <AboutDialog onClose={() => setShowAboutDialog(false)} />}
    </div>
  );
}
