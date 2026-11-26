import React, { useEffect, useRef, useState } from 'react';
import {
  FilePlus2,
  FolderOpen,
  Save,
  FileDown,
  HelpCircle,
  Settings,
  Minus,
  Square,
  X,
  ClipboardCheck,
} from 'lucide-react';
import type { ComponentType } from '../types/vessel';
import { VESSEL_PRESETS } from '../data/presets';
import {
  GhLogo,
  TechSpecIcon,
  ShellIcon,
  EllipticalHeadIcon,
  SphericalHeadIcon,
  ConeIcon,
  EquipmentFlangeIcon,
  GasketIcon,
  BootShellIcon,
  SkirtIcon,
  TubeSheetIcon,
  UTubeIcon,
  ExpansionJointIcon,
  NozzleFlangeIcon,
  SaddleIcon,
  LugIcon,
  LegIcon,
  RingIcon,
  TrayIcon,
  DavitIcon,
  CadOutputIcon,
  ExcelOutputIcon,
  SwOutputIcon,
  WizardIcon,
  MaterialLibIcon,
  BatchNozzleIcon,
  SphereTankIcon,
  SphereColumnIcon,
  LadderPlatformIcon,
  CostIcon,
  PdmsIcon,
  ClashCheckIcon,
  AiModelIcon,
  BkuReboilerIcon,
} from './CadIcons';

export type RibbonTab = 'start' | 'main' | 'attachment' | 'sphere' | 'ladder' | 'tank' | 'output' | 'tools';

interface RibbonToolbarProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  activePresetId: string;
  importedDocLabel?: string | null;
  activeVesselTitle?: string;
  onSelectPreset: (presetId: string) => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onExportStl: () => void;
  onOpenAbout: () => void;
  onOpenConfig: () => void;
  onOpenTechSpec: () => void;
  onAddComponent: (type: ComponentType) => void;
  onOpenBom: () => void;
  onOpen2DCad: () => void;
  onOpenShellUnroll: () => void;
  onOpenWizard: () => void;
  onOpenMaterialLib: () => void;
  onOpenBatchNozzle: () => void;
  onOpenCostEstimate: () => void;
  onOpenPdmsExport: () => void;
  onOpenInterferenceCheck: () => void;
  onOpenAiModel: () => void;
  onOpenLifecycle: () => void;
}

interface RibbonBtnDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  activeTab,
  onTabChange,
  activePresetId,
  importedDocLabel = null,
  activeVesselTitle,
  onSelectPreset,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onExportStl,
  onOpenAbout,
  onOpenConfig,
  onOpenTechSpec,
  onAddComponent,
  onOpenBom,
  onOpen2DCad,
  onOpenShellUnroll,
  onOpenWizard,
  onOpenMaterialLib,
  onOpenBatchNozzle,
  onOpenCostEstimate,
  onOpenPdmsExport,
  onOpenInterferenceCheck,
  onOpenAiModel,
  onOpenLifecycle,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fileMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fileMenuOpen]);

  const runFileAction = (fn: () => void) => {
    setFileMenuOpen(false);
    fn();
  };

  const startButtons: RibbonBtnDef[] = [
    { id: 'ai_model_start', label: 'AI 建模', icon: <AiModelIcon />, onClick: onOpenAiModel },
    { id: 'import_model_start', label: '导入模型', icon: <FolderOpen className="w-6 h-6 text-[#2563eb]" />, onClick: onOpenDocument },
    { id: 'export_3d_start', label: '导出3D模型', icon: <SwOutputIcon />, onClick: onExportStl },
    { id: 'wizard', label: '向导式建模', icon: <WizardIcon />, onClick: onOpenWizard },
    { id: 'tech_spec_start', label: '技术特性表', icon: <TechSpecIcon />, onClick: onOpenTechSpec },
    { id: 'batch_nozzle_start', label: '批量管口', icon: <BatchNozzleIcon />, onClick: onOpenBatchNozzle },
    { id: 'clash_start', label: '干涉检查', icon: <ClashCheckIcon />, onClick: onOpenInterferenceCheck },
    { id: 'preset_exchanger', label: '固定管板', icon: <TubeSheetIcon />, onClick: () => onSelectPreset('exchanger') },
    { id: 'preset_u_exchanger', label: 'U形管换热', icon: <UTubeIcon />, onClick: () => onSelectPreset('u_exchanger') },
    { id: 'preset_bku', label: 'BKU重沸器', icon: <BkuReboilerIcon />, onClick: () => onSelectPreset('bku_reboiler') },
    { id: 'preset_stacked', label: '重叠换热', icon: <UTubeIcon />, onClick: () => onSelectPreset('stacked_exchanger') },
    { id: 'preset_separator', label: '高压分离器', icon: <BootShellIcon />, onClick: () => onSelectPreset('large_separator') },
    { id: 'preset_tower', label: '精馏塔', icon: <SkirtIcon />, onClick: () => onSelectPreset('tower') },
    { id: 'preset_sphere', label: '1000m³球罐', icon: <SphereTankIcon />, onClick: () => onSelectPreset('spherical_tank') },
    { id: 'cost_start', label: '造价估算', icon: <CostIcon className="w-7 h-7" />, onClick: onOpenCostEstimate },
    { id: 'pdms_start', label: '导入PDMS', icon: <PdmsIcon className="w-7 h-7" />, onClick: onOpenPdmsExport },
    { id: 'lifecycle_start', label: '全生命周期', icon: <ClipboardCheck className="w-6 h-6 text-[#0f766e]" />, onClick: onOpenLifecycle },
  ];

  const mainButtons: RibbonBtnDef[] = [
    { id: 'tech_spec', label: '技术特性表', icon: <TechSpecIcon />, onClick: onOpenTechSpec },
    { id: 'shell', label: '筒体', icon: <ShellIcon />, onClick: () => onAddComponent('shell') },
    { id: 'elliptical_head', label: '椭圆封头', icon: <EllipticalHeadIcon />, onClick: () => onAddComponent('elliptical_head') },
    { id: 'spherical_head', label: '球形封头', icon: <SphericalHeadIcon />, onClick: () => onAddComponent('spherical_head') },
    { id: 'cone', label: '锥壳', icon: <ConeIcon />, onClick: () => onAddComponent('cone') },
    { id: 'equipment_flange', label: '设备法兰', icon: <EquipmentFlangeIcon />, onClick: () => onAddComponent('equipment_flange') },
    { id: 'gasket', label: '垫片', icon: <GasketIcon />, onClick: () => onAddComponent('gasket') },
    { id: 'boot_shell', label: '气(液)包筒体', icon: <BootShellIcon />, onClick: () => onAddComponent('boot_shell') },
    { id: 'skirt', label: '裙座', icon: <SkirtIcon />, onClick: () => onAddComponent('skirt') },
    { id: 'fixed_tubesheet', label: '固定管板', icon: <TubeSheetIcon />, onClick: () => onAddComponent('fixed_tubesheet') },
    { id: 'u_tube_head', label: 'U型/浮头', icon: <UTubeIcon />, onClick: () => onAddComponent('u_tube_head') },
    { id: 'expansion_joint', label: '膨胀节', icon: <ExpansionJointIcon />, onClick: () => onAddComponent('expansion_joint') },
  ];

  const attachmentButtons: RibbonBtnDef[] = [
    { id: 'nozzle_manhole', label: '法兰人孔', icon: <NozzleFlangeIcon />, onClick: () => onAddComponent('nozzle_manhole') },
    { id: 'batch_nozzle', label: '批量管口', icon: <BatchNozzleIcon />, onClick: onOpenBatchNozzle },
    { id: 'saddle', label: '鞍座', icon: <SaddleIcon />, onClick: () => onAddComponent('saddle') },
    { id: 'lug_support', label: '耳座', icon: <LugIcon />, onClick: () => onAddComponent('lug_support') },
    { id: 'leg_support', label: '支腿', icon: <LegIcon />, onClick: () => onAddComponent('leg_support') },
    { id: 'support_stand', label: '支承式支座', icon: <SkirtIcon />, onClick: () => onAddComponent('support_stand') },
    { id: 'ring_lug', label: '刚性环耳座', icon: <RingIcon />, onClick: () => onAddComponent('ring_lug') },
    { id: 'wind_guide', label: '防风定位板', icon: <LugIcon />, onClick: () => onAddComponent('wind_guide') },
    { id: 'horizontal_lug', label: '卧式吊耳', icon: <LugIcon />, onClick: () => onAddComponent('horizontal_lug') },
    { id: 'trunnion', label: '轴耳', icon: <EquipmentFlangeIcon />, onClick: () => onAddComponent('trunnion') },
    { id: 'side_lug', label: '侧壁式吊耳', icon: <LugIcon />, onClick: () => onAddComponent('side_lug') },
    { id: 'lifting_ring', label: '吊耳环', icon: <RingIcon />, onClick: () => onAddComponent('lifting_ring') },
    { id: 'top_davit', label: '塔顶吊柱', icon: <DavitIcon />, onClick: () => onAddComponent('top_davit') },
    { id: 'tray', label: '塔盘', icon: <TrayIcon />, onClick: () => onAddComponent('tray') },
    { id: 'packing', label: '填料', icon: <ShellIcon />, onClick: () => onAddComponent('packing') },
    { id: 'demister', label: '丝网除沫器', icon: <TrayIcon />, onClick: () => onAddComponent('demister') },
    { id: 'stiffening_ring', label: '外压加强圈', icon: <RingIcon />, onClick: () => onAddComponent('stiffening_ring') },
    { id: 'weld_seam', label: '焊缝', icon: <GasketIcon />, onClick: () => onAddComponent('weld_seam') },
    { id: 'pad_plate', label: '垫板', icon: <TechSpecIcon />, onClick: () => onAddComponent('pad_plate') },
    { id: 'tube_layout', label: '管排', icon: <TubeSheetIcon />, onClick: () => onAddComponent('tube_layout') },
    { id: 'floating_hook', label: '浮头勾圈', icon: <RingIcon />, onClick: () => onAddComponent('floating_hook') },
    { id: 'pass_partition', label: '分程隔板', icon: <TrayIcon />, onClick: () => onAddComponent('pass_partition') },
    { id: 'impingement_baffle', label: '防冲挡板', icon: <TechSpecIcon />, onClick: () => onAddComponent('impingement_baffle') },
    { id: 'nameplate', label: '铭牌', icon: <TechSpecIcon />, onClick: () => onAddComponent('nameplate') },
    { id: 'spatial_piping', label: '空间管线', icon: <NozzleFlangeIcon />, onClick: () => onAddComponent('spatial_piping') },
    { id: 'insulation_support', label: '保温支承', icon: <RingIcon />, onClick: () => onAddComponent('insulation_support') },
    { id: 'grounding_lug', label: '接地垫片', icon: <GasketIcon />, onClick: () => onAddComponent('grounding_lug') },
    { id: 'pipe_boss', label: '管座', icon: <EquipmentFlangeIcon />, onClick: () => onAddComponent('pipe_boss') },
    { id: 'vortex_breaker', label: '防涡流板', icon: <TubeSheetIcon />, onClick: () => onAddComponent('vortex_breaker') },
    { id: 'bottom_orifice', label: '底部孔板', icon: <GasketIcon />, onClick: () => onAddComponent('bottom_orifice') },
    { id: 'foundation_template', label: '基础模板', icon: <RingIcon />, onClick: () => onAddComponent('foundation_template') },
    { id: 'gas_outlet_baffle', label: '气体出口挡板', icon: <TrayIcon />, onClick: () => onAddComponent('gas_outlet_baffle') },
    { id: 'structural_steel', label: '型钢', icon: <LegIcon />, onClick: () => onAddComponent('structural_steel') },
  ];

  const sphereButtons: RibbonBtnDef[] = [
    { id: 'sphere_load_1000', label: '1000m³球罐', icon: <SphereTankIcon />, onClick: () => onSelectPreset('spherical_tank') },
    { id: 'sphere_shell', label: '橘瓣球壳', icon: <SphereTankIcon />, onClick: () => onAddComponent('spherical_tank') },
    { id: 'sphere_col', label: '赤道支柱', icon: <SphereColumnIcon />, onClick: () => onAddComponent('sphere_column') },
    { id: 'sphere_nozzle', label: '球罐人孔', icon: <NozzleFlangeIcon />, onClick: () => onAddComponent('nozzle_manhole') },
    { id: 'sphere_platform', label: '球顶平台', icon: <LadderPlatformIcon />, onClick: () => onAddComponent('ladder_platform') },
    { id: 'sphere_weld', label: '球壳焊缝', icon: <GasketIcon />, onClick: () => onAddComponent('weld_seam') },
    { id: 'sphere_wizard', label: '球罐向导', icon: <WizardIcon />, onClick: onOpenWizard },
  ];

  const ladderButtons: RibbonBtnDef[] = [
    { id: 'plat_circle', label: '圆形平台', icon: <LadderPlatformIcon />, onClick: () => onAddComponent('ladder_platform') },
    { id: 'plat_davit', label: '塔顶吊柱', icon: <DavitIcon />, onClick: () => onAddComponent('top_davit') },
    { id: 'plat_steel', label: '支承型钢', icon: <LegIcon />, onClick: () => onAddComponent('structural_steel') },
    { id: 'plat_pad', label: '平台垫板', icon: <TechSpecIcon />, onClick: () => onAddComponent('pad_plate') },
  ];

  const tankButtons: RibbonBtnDef[] = [
    { id: 'tank_horiz', label: '卧式储罐', icon: <ShellIcon />, onClick: () => onSelectPreset('horizontal') },
    { id: 'tank_vert', label: '立式储罐', icon: <SkirtIcon />, onClick: () => onSelectPreset('vertical') },
    { id: 'tank_conical', label: '平底锥壳罐', icon: <ConeIcon />, onClick: () => onSelectPreset('conical_vertical') },
    { id: 'tank_shell', label: '罐壁筒节', icon: <ShellIcon />, onClick: () => onAddComponent('shell') },
    { id: 'tank_cone', label: '锥顶盖', icon: <ConeIcon />, onClick: () => onAddComponent('cone') },
    { id: 'tank_ring', label: '抗风圈', icon: <RingIcon />, onClick: () => onAddComponent('stiffening_ring') },
    { id: 'tank_nozzle', label: '储罐人孔', icon: <NozzleFlangeIcon />, onClick: () => onAddComponent('nozzle_manhole') },
  ];

  const outputButtons: RibbonBtnDef[] = [
    { id: 'save_model', label: '导出3D模型', icon: <SwOutputIcon />, onClick: onExportStl },
    { id: 'gh2v2d', label: 'GH2V2D出图', icon: <CadOutputIcon />, onClick: onOpen2DCad },
    { id: 'shell_unroll', label: '展开筒体', icon: <ShellIcon />, onClick: onOpenShellUnroll },
    { id: 'bom', label: '材料表BOM', icon: <ExcelOutputIcon />, onClick: onOpenBom },
    { id: 'cost', label: '造价估算', icon: <CostIcon />, onClick: onOpenCostEstimate },
    { id: 'pdms', label: '导入PDMS', icon: <PdmsIcon />, onClick: onOpenPdmsExport },
    { id: 'lifecycle_out', label: '全生命周期', icon: <ClipboardCheck className="w-6 h-6 text-[#0f766e]" />, onClick: onOpenLifecycle },
  ];

  const toolsButtons: RibbonBtnDef[] = [
    { id: 'tools_clash', label: '干涉检查', icon: <ClashCheckIcon />, onClick: onOpenInterferenceCheck },
    { id: 'tools_unroll', label: '展开筒体', icon: <ShellIcon />, onClick: onOpenShellUnroll },
    { id: 'tools_ai', label: 'AI 建模', icon: <AiModelIcon />, onClick: onOpenAiModel },
    { id: 'tools_batch', label: '批量管口', icon: <BatchNozzleIcon />, onClick: onOpenBatchNozzle },
    { id: 'tools_wizard', label: '向导式建模', icon: <WizardIcon />, onClick: onOpenWizard },
    { id: 'tools_matlib', label: '材料库', icon: <MaterialLibIcon />, onClick: onOpenMaterialLib },
    { id: 'tools_lifecycle', label: '全生命周期', icon: <ClipboardCheck className="w-6 h-6 text-[#0f766e]" />, onClick: onOpenLifecycle },
    { id: 'tools_bku', label: 'BKU重沸器', icon: <BkuReboilerIcon />, onClick: () => onSelectPreset('bku_reboiler') },
  ];

  const activeButtons =
    activeTab === 'start'
      ? startButtons
      : activeTab === 'main'
      ? mainButtons
      : activeTab === 'attachment'
      ? attachmentButtons
      : activeTab === 'sphere'
      ? sphereButtons
      : activeTab === 'ladder'
      ? ladderButtons
      : activeTab === 'tank'
      ? tankButtons
      : activeTab === 'tools'
      ? toolsButtons
      : outputButtons;

  const ribbonTabs: Array<{ key: RibbonTab; label: string }> = [
    { key: 'start', label: '开始' },
    { key: 'main', label: '主构件' },
    { key: 'attachment', label: '附属件' },
    { key: 'sphere', label: '球罐' },
    { key: 'ladder', label: '梯子平台' },
    { key: 'tank', label: '储罐' },
    { key: 'output', label: '输出' },
    { key: 'tools', label: '工具' },
  ];

  return (
    <header className="w-full shrink-0 bg-[#f3f4f6] border-b border-[#cbd5e1] select-none">
      {/* Row 1: Classic GHPV V2.1 Desktop Title Bar + Menu Bar + File Quick Access */}
      <div className="h-[28px] px-2 flex items-center justify-between bg-gradient-to-b from-[#f8fafc] to-[#e9edf2] border-b border-[#d5dbe3]">
        {/* Left: GH Logo + File Quick Access + Classic Menu Strip */}
        <div className="flex items-center gap-1">
          <GhLogo />
          <div className="h-3.5 w-[1px] bg-[#cbd5e1] mx-1" />
          <button
            type="button"
            onClick={onNewDocument}
            title="新建文档"
            aria-label="新建文档"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#334155] hover:text-[#1d4ed8] transition-colors"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenDocument}
            title="打开文件 (Ctrl+O) — 支持 .ghpv / .stp / .igs / .stl / .obj / .glb / .pdf / .dxf"
            aria-label="打开文档"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#334155] hover:text-[#1d4ed8] transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onSaveDocument}
            title="保存高惠工程文件 (.ghpv) (Ctrl+S)"
            aria-label="保存文档"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#334155] hover:text-[#1d4ed8] transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onExportStl}
            title="另存为三维模型 (.stp / .igs / .stl / .glb / .obj)"
            aria-label="另存为三维模型"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#334155] hover:text-[#1d4ed8] transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-[1px] bg-[#cbd5e1] mx-1 hidden md:block" />
          <nav aria-label="主菜单" className="hidden md:flex items-center gap-0.5 text-[11px] text-[#334155]">
            <div ref={fileMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
                onClick={() => setFileMenuOpen((v) => !v)}
                className={`px-1.5 py-0.5 rounded-[2px] transition-colors ${
                  fileMenuOpen
                    ? 'bg-[#dbeafe] text-[#1d4ed8] font-medium'
                    : 'hover:bg-[#dbeafe] hover:text-[#1d4ed8]'
                }`}
              >
                文件
              </button>
              {fileMenuOpen && (
                <div
                  role="menu"
                  aria-label="文件菜单"
                  className="absolute left-0 top-full mt-0.5 w-[220px] py-1 bg-white border border-[#94a3b8] shadow-lg rounded-[2px] z-50 text-[11.5px] text-[#1e293b]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onNewDocument)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left"
                  >
                    <span>新建空白工程</span>
                    <span className="text-[10px] text-[#64748b] font-mono">New</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onOpenDocument)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left font-medium"
                  >
                    <span>打开模型 / 图纸...</span>
                    <span className="text-[10px] text-[#64748b] font-mono">Ctrl+O</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onSaveDocument)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left"
                  >
                    <span>保存高惠工程 (.ghpv)</span>
                    <span className="text-[10px] text-[#64748b] font-mono">Ctrl+S</span>
                  </button>
                  <div className="my-1 border-t border-[#e2e8f0]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onExportStl)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left"
                  >
                    <span>导出 3D 模型 (.stp/.igs/.stl)...</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onOpenPdmsExport)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left"
                  >
                    <span>导出 PDMS 宏 (.mac)...</span>
                  </button>
                  <div className="my-1 border-t border-[#e2e8f0]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runFileAction(onOpenWizard)}
                    className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#eff6ff] hover:text-[#1d4ed8] text-left"
                  >
                    <span>向导式建模...</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenConfig}
              className="px-1.5 py-0.5 rounded-[2px] hover:bg-[#dbeafe] hover:text-[#1d4ed8]"
            >
              视图
            </button>
            <button
              type="button"
              onClick={() => onTabChange('main')}
              className="px-1.5 py-0.5 rounded-[2px] hover:bg-[#dbeafe] hover:text-[#1d4ed8]"
            >
              主构件
            </button>
            <button
              type="button"
              onClick={() => onTabChange('attachment')}
              className="px-1.5 py-0.5 rounded-[2px] hover:bg-[#dbeafe] hover:text-[#1d4ed8]"
            >
              附属件
            </button>
            <button
              type="button"
              onClick={onOpenMaterialLib}
              className="px-1.5 py-0.5 rounded-[2px] hover:bg-[#dbeafe] hover:text-[#1d4ed8]"
            >
              材料库
            </button>
            <button
              type="button"
              onClick={onOpenAbout}
              className="px-1.5 py-0.5 rounded-[2px] hover:bg-[#dbeafe] hover:text-[#1d4ed8]"
            >
              帮助
            </button>
          </nav>
        </div>

        {/* Center Application Title (matches GHPV V2.1 Ep 15 title bar) */}
        <div
          className="text-[12px] font-semibold text-[#1e293b] tracking-wide whitespace-nowrap truncate max-w-[44vw]"
          title={`GHPV V2.1 — ${activeVesselTitle || '高惠PV压力容器数字化交付系统'}`}
        >
          GHPV V2.1 — {activeVesselTitle || '高惠PV压力容器数字化交付系统'}
        </div>

        {/* Right Utility Icons + Window Chrome */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenAbout}
            title="关于高惠PV"
            aria-label="关于高惠PV"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#475569] hover:text-[#1d4ed8] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenConfig}
            title="视口与系统设置"
            aria-label="视口设置"
            className="p-1 rounded hover:bg-[#dbeafe] text-[#475569] hover:text-[#1d4ed8] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-[1px] bg-[#cbd5e1] mx-1" />
          <span className="p-1 text-[#64748b]" aria-hidden="true">
            <Minus className="w-3 h-3" />
          </span>
          <span className="p-1 text-[#64748b]" aria-hidden="true">
            <Square className="w-2.5 h-2.5" />
          </span>
          <span className="p-1 text-[#64748b]" aria-hidden="true">
            <X className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Row 2: GHPV V1.6 7-Tab Ribbon + Preset Selector */}
      <div className="h-[24px] px-2 flex items-center justify-between bg-[#eef1f5] border-b border-[#d5dbe3]">
        <div className="flex items-center gap-0.5 h-full" role="tablist" aria-label="GHPV 功能区">
          {ribbonTabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.key)}
                className={`px-3 h-full text-[11px] whitespace-nowrap transition-colors border-t border-x rounded-t-[2px] ${
                  active
                    ? 'bg-white text-[#0f172a] font-semibold border-[#cbd5e1] -mb-[1px] z-10'
                    : 'bg-transparent text-[#475569] border-transparent hover:bg-[#e2e8f0] hover:text-[#0f172a]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Built-in Showcase Vessel Presets */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <label htmlFor="preset-select" className="text-[#475569] whitespace-nowrap">
            {importedDocLabel ? '当前设备:' : '示例设备:'}
          </label>
          <select
            id="preset-select"
            value={activePresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="h-[19px] px-1.5 text-[11px] bg-white border border-[#cbd5e1] rounded-[2px] text-[#1e293b] max-w-[240px] focus:outline-none focus:border-[#2563eb]"
          >
            {importedDocLabel && (
              <option value="__imported__">已导入: {importedDocLabel}</option>
            )}
            {VESSEL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Ribbon Component Icon Strip (元件区) */}
      <div className="h-[54px] px-2 py-1 flex items-center gap-0.5 bg-white overflow-x-auto">
        {activeButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={btn.onClick}
            className="flex flex-col items-center justify-center min-w-[56px] h-[46px] px-1.5 rounded-[3px] border border-transparent hover:bg-[#e8f1fb] hover:border-[#93c5fd] active:bg-[#dbeafe] transition-colors shrink-0 group"
          >
            <div className="flex items-center justify-center h-[28px]">{btn.icon}</div>
            <span className="text-[10.5px] leading-tight text-[#1f2937] whitespace-nowrap mt-0.5">
              {btn.label}
            </span>
          </button>
        ))}
      </div>
    </header>
  );
};
