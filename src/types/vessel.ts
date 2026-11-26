export type Orientation = 'horizontal' | 'vertical';

export type RenderMode = 'solid' | 'wireframe' | 'hiddenline';

export type CameraViewPreset =
  | 'fit'
  | 'front'
  | 'top'
  | 'left'
  | 'back'
  | 'right'
  | 'bottom'
  | 'iso';

export type MainComponentType =
  | 'shell'
  | 'elliptical_head'
  | 'spherical_head'
  | 'spherical_tank'
  | 'cone'
  | 'equipment_flange'
  | 'gasket'
  | 'boot_shell'
  | 'skirt'
  | 'fixed_tubesheet'
  | 'u_tube_head'
  | 'expansion_joint';

export type AttachmentType =
  | 'nozzle_manhole'
  | 'saddle'
  | 'lug_support'
  | 'leg_support'
  | 'support_stand'
  | 'horizontal_lug'
  | 'ring_lug'
  | 'wind_guide'
  | 'stiffening_ring'
  | 'trunnion'
  | 'tray'
  | 'side_lug'
  | 'lifting_ring'
  | 'packing'
  | 'top_davit'
  | 'demister'
  | 'structural_steel'
  | 'weld_seam'
  | 'pad_plate'
  | 'tube_layout'
  | 'floating_hook'
  | 'pass_partition'
  | 'impingement_baffle'
  | 'nameplate'
  | 'spatial_piping'
  | 'insulation_support'
  | 'grounding_lug'
  | 'pipe_boss'
  | 'vortex_breaker'
  | 'bottom_orifice'
  | 'foundation_template'
  | 'gas_outlet_baffle'
  | 'sphere_column'
  | 'ladder_platform';

export type ComponentType = MainComponentType | AttachmentType;

export interface RgbaColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-255
}

export interface ShellParams {
  shellKind: '筒体' | '变壁厚筒体';
  diameter: number; // Di mm
  thickness: number; // δn mm
  length: number; // L mm
  material: string;
  density: number; // g/cm3
  returnBendRadiusMm?: number; // 180° 弯头筒体弯曲半径 mm (重叠式换热器)
}

export interface EllipticalHeadParams {
  headType: 'EHA' | 'EHB';
  standard: string;
  diameter: number; // Di mm
  straightHeight: number; // h mm
  nominalThickness: number; // δn mm
  minThickness: number; // mm
  blankThickness: number; // 投料厚度 mm
  formingMethod: '冷冲压法' | '冷旋压法' | '热冲压法';
  thinningRate: number; // %
  flipped: boolean; // 上下翻转 (false = left/bottom cup opening +axis, true = right/top cap)
  material: string;
  density: number;
}

export interface SphericalHeadParams {
  diameter: number; // Di mm
  thickness: number; // mm
  flipped: boolean;
  material: string;
  density: number;
}

export interface ConeParams {
  coneType: '正锥' | '偏心锥';
  edgeStyle: '无折边' | '双折边' | '单折边';
  smallDiameter: number; // d mm
  largeDiameter: number; // D mm
  thickness: number; // mm
  totalLength: number; // H mm
  r1: number; // 小端折边半径
  r2: number; // 大端折边半径
  h1: number; // 小端直边高度
  h2: number; // 大端直边高度
  flipped: boolean;
  material: string;
  density: number;
}

export interface EquipmentFlangeParams {
  flangeType: '甲型' | '乙型' | '长颈对焊(WN)' | '法兰盖(BL)';
  facing: 'RF' | 'MF' | 'TG';
  standard: string;
  pn: number; // MPa
  dn: number; // mm
  thickness: number; // δ mm
  outerDiameter: number; // OD mm
  boltCircle: number; // BCD mm
  boltCount: number;
  boltSpec: string;
  height: number; // 总高 mm
  flipped: boolean;
  material: string;
  density: number;
}

export interface GasketParams {
  standard: string;
  pn: number;
  dn: number;
  thickness: number; // T1 mm
  innerDiameter: number; // D1 mm
  outerDiameter: number; // D2 mm
  material: string;
  density: number;
}

export interface SkirtParams {
  skirtType: '圆筒形裙座' | '圆锥形裙座' | '中间裙座';
  topDiameter: number; // mm
  bottomDiameter: number; // mm
  thickness: number; // mm
  height: number; // mm
  boltCount: number;
  boltSpec: string;
  baseRingOD: number;
  baseRingID: number;
  baseRingThickness: number;
  gussetHeight: number;
  hasInspectionHole: boolean;
  material: string;
  density: number;
}

export interface FixedTubeSheetParams {
  diameter: number; // Di mm
  outerDiameter: number; // OD mm
  thickness: number; // Ts mm
  bcd: number;
  boltCount: number;
  boltSpec: string;
  tubeCount: number;
  tubeOD: number;
  material: string;
  density: number;
}

export interface ExpansionJointParams {
  standard: string;
  pn: number;
  dn: number;
  waveCount: number;
  waveHeight: number; // h mm
  wavePitch: number; // q mm
  thickness: number; // mm
  totalLength: number; // mm
  material: string;
  density: number;
}

export interface NozzleManholeParams {
  tag: string; // N1, N2, M1...
  purpose: string; // 物料入口, 人孔, 液位计...
  isManhole: boolean;
  manholeType: '水平吊盖带颈对焊法兰人孔' | '垂直吊盖带颈对焊法兰人孔' | '回转盖人孔';
  flangeStandard: 'HG美标法兰' | 'HG欧标法兰';
  flangeSpec: string; // HG/T 20615-2009 or HG/T 20592-2009
  flangeType: 'WN-RF' | 'SO-RF' | 'LWN-RF' | 'PL-RF';
  pn: string; // 150, 300, 10, 16
  dn: number; // mm
  pipeOD: number; // mm
  pipeThickness: number; // mm
  axialOffset: number; // 距起始点距离 mm
  angleDeg: number; // 周向方位角 deg (0 = top/+Y in horizontal, 0 = +X in vertical)
  protrusion: number; // 外伸高度 L1 mm
  innerProtrusion: number; // 内伸长度 L2 mm
  hasBlindCover: boolean; // 是否有配对法兰盖
  hasPad: boolean; // 补强圈
  hasElbow: boolean; // 带90°弯头
  elbowDirDeg: number; // 弯头方位角 β
  boltCount: number;
  flangeOD: number;
  flangeThickness: number;
  material: string;
  pipeMaterial: string;
  density: number;
  // GHPV 几何定位 / 弯头扩展参数
  tiltAngleDeg?: number; // 与中心线夹角 (°)
  positionType?: '径向' | '平行' | '切向'; // 定位类型
  headRegion?: '上半球' | '下半球'; // 封头位置
  eccentricOffset?: number; // 偏心距 E (mm)
  offsetL4?: number; // 距离 L4 (mm)
  elbowType?: '长半径' | '短半径'; // 弯头类型 (1.5D / 1.0D)
  elbowStandard?: string; // 弯头标准 GB/T 12459-2017
  elbowModel?: string; // 弯头型号 DN150-90E(L)
  elbowMaterial?: string; // 弯头材料
  elbowDensity?: number; // 弯头密度
  elbowRadius?: number; // 弯曲半径 R (mm)
  elbowRunLength?: number; // 至接管中心距 L3 (mm)
  padOD?: number; // 补强圈外径 (mm)
  padThickness?: number; // 补强圈厚度 (mm)
  padMaterial?: string; // 补强圈材料
  // 底部集液包 / 大直径气包扩展参数
  isLiquidBoot?: boolean;
  bootLength?: number; // 集液包筒体长度 (mm)
  bootDiameter?: number; // 集液包内径 (mm)
}

export interface SaddleParams {
  standard: string;
  saddleType: 'A型' | 'BI型' | 'BII型';
  fixType: '固定(F)' | '滑动(S)';
  vesselDiameter: number; // mm
  centerHeight: number; // H mm
  axialOffset: number; // 距筒体起始端 mm
  wrapAngleDeg: number; // 包角 120°
  width: number; // B mm
  baseLength: number; // L1 mm
  baseWidth: number; // B1 mm
  webThickness: number; // δ1 mm
  ribCount: number;
  padThickness: number; // 垫板厚度 mm
  material: string;
  density: number;
}

export interface LegSupportParams {
  standard: string;
  legType: 'A型' | 'B型' | 'C型';
  count: number; // 3 or 4
  height: number; // H0 mm
  startAngleDeg: number; // deg
  legSectionWidth: number; // 角钢边宽 mm
  basePlateSize: number; // 底板边长 mm
  basePlateThickness: number; // mm
  axialOffset: number; // 距筒体底部 mm
  material: string;
  density: number;
}

export interface LugSupportParams {
  standard: string;
  lugType: 'A型' | 'B型' | 'C型';
  isRingLug: boolean;
  count: number;
  startAngleDeg: number;
  axialOffset: number;
  baseWidth: number;
  baseLength: number;
  height: number;
  material: string;
  density: number;
}

export interface StiffeningRingParams {
  profileType: '扁钢' | '角钢' | '工字钢';
  position: '筒体外侧' | '筒体内侧';
  spec: string;
  width: number; // L mm
  thickness: number; // t mm
  axialOffset: number;
  count: number;
  spacing: number;
  material: string;
  density: number;
}

export interface TrunnionParams {
  standard: string;
  spec: string;
  trunnionOD: number;
  length: number;
  axialOffset: number;
  angleDeg: number;
  material: string;
  density: number;
}

export interface TrayParams {
  trayType: '浮阀塔盘' | '筛板塔盘' | '泡罩塔盘';
  count: number;
  spacing: number; // mm
  startOffset: number; // mm
  thickness: number; // mm
  material: string;
  density: number;
}

export interface PackingParams {
  packingType: '金属波纹规整填料' | '拉西环散堆填料';
  height: number; // mm
  startOffset: number; // mm
  material: string;
  density: number;
}

export interface TopDavitParams {
  standard: string;
  capacityKg: number;
  armLength: number; // S mm
  poleHeight: number; // L mm
  pipeOD: number;
  angleDeg: number;
  material: string;
  density: number;
}

export interface DemisterParams {
  standard: string;
  installType: '上装式' | '下装式';
  startOffset: number;
  thickness: number; // mm
  material: string;
  density: number;
}

export interface WeldSeamParams {
  grooveType: '单V型坡口' | '双V型坡口' | 'U型坡口';
  axialOffset: number;
  width: number;
  material: string;
  density: number;
}

export interface PadPlateParams {
  axialOffset: number;
  angleDeg: number;
  width: number;
  height: number;
  thickness: number;
  material: string;
  density: number;
}

export interface TubeLayoutParams {
  tubeType: '直管' | 'U形管';
  shellDiameter: number; // Di mm
  tubeOD: number; // d mm
  tubeThickness: number; // t mm
  tubePitch: number; // S mm
  outerLimitDiameter: number; // DL mm
  pattern: '正三角形' | '转角正三角形' | '正方形' | '转角正方形';
  passes: number; // 管程数 1, 2, 4
  tubeLength: number; // mm
  baffleCount: number; // 折流板数量
  verticalOffsetMm?: number; // 管束相对壳体中心向下偏移 (BKU 釜式重沸器专用)
  material: string;
  density: number;
}

export interface SphericalTankParams {
  diameter: number; // 内径 mm (e.g., 12300 for 1000m3)
  thickness: number; // 壁厚 mm
  zoneStyle: '混合式五带' | '橘瓣式三带' | '橘瓣式四带';
  equatorPetals: number; // 赤道带分瓣数 (e.g., 16)
  temperatePetals: number; // 温带分瓣数 (e.g., 12)
  standard: string; // GB/T 12337-2014
  material: string;
  density: number;
}

export interface SphereColumnParams {
  count: number; // 支柱根数 (e.g., 10)
  pipeOD: number; // 支柱钢管外径 mm
  pipeThickness: number; // 壁厚 mm
  clearanceMm: number; // 球底距地坪净空 mm
  hasTieRods: boolean; // 是否带交叉拉杆
  tieRodOD: number; // 拉杆直径 mm
  material: string;
  density: number;
}

export interface LadderPlatformParams {
  platformType: '圆形操作平台' | '弧形检修平台';
  elevationMm: number; // 平台标高 mm
  widthMm: number; // 平台宽度 mm
  angleSpanDeg: number; // 包角 deg
  startAngleDeg: number;
  ladderHeightMm: number; // 爬梯高度 mm
  hasCage: boolean; // 护笼
  material: string;
  density: number;
}

export interface GenericAttachmentParams {
  label: string;
  axialOffset: number;
  angleDeg: number;
  sizeA: number;
  sizeB: number;
  thickness: number;
  standard: string;
  material: string;
  density: number;
}

export type ComponentParams =
  | ShellParams
  | EllipticalHeadParams
  | SphericalHeadParams
  | SphericalTankParams
  | ConeParams
  | EquipmentFlangeParams
  | GasketParams
  | SkirtParams
  | FixedTubeSheetParams
  | ExpansionJointParams
  | NozzleManholeParams
  | SaddleParams
  | LegSupportParams
  | LugSupportParams
  | StiffeningRingParams
  | TrunnionParams
  | TrayParams
  | PackingParams
  | TopDavitParams
  | DemisterParams
  | WeldSeamParams
  | PadPlateParams
  | TubeLayoutParams
  | SphereColumnParams
  | LadderPlatformParams
  | GenericAttachmentParams;

export interface VesselComponent {
  id: string;
  name: string;
  type: ComponentType;
  category: 'main' | 'attachment';
  parentId?: string; // for attachments attached to a main component
  visible: boolean;
  color: RgbaColor;
  params: ComponentParams;
  subNodes?: string[]; // display sub-tree labels matching GHPV (e.g. 垫板, 底板, 腹板...)
}

export interface AssemblyPoint {
  id: string;
  name: string;
  x: number; // 水平左右偏移 X (mm)
  y?: number; // 前后深度偏移 Y (mm, 默认 0)
  z: number; // 垂直标高偏移 Z (mm)
  orientation: Orientation;
  components: VesselComponent[];
}

export interface TechnicalSpec {
  vesselTag: string;
  vesselName: string;
  designCode: string;
  vesselClass: string;
  designPressure: number; // MPa
  workPressure: number; // MPa
  testPressure: number; // MPa
  designTemp: number; // °C
  workTemp: number; // °C
  medium: string;
  corrosionAllowance: number; // mm
  weldEfficiency: number;
  ndtMethod: string;
  heatTreatment: string;
  companyName: string;
  projectName: string;
  drawingNo: string;
  revision?: string; // 图纸版次（标题栏 REV，缺省按 A）
  ndtRequirement?: string; // NDT 要求（缺省 NB/T 47013.2）
}

export interface ViewportBackgroundConfig {
  mode: 'solid' | 'gradient' | 'grid';
  topColor: string;
  bottomColor: string;
}

export interface SectionPlaneState {
  enabled: boolean;
  xEnabled: boolean;
  xPos: number; // mm
  xFlip: boolean;
  yEnabled: boolean;
  yPos: number; // mm
  yFlip: boolean;
  zEnabled: boolean;
  zPos: number; // mm
  zFlip: boolean;
}

export interface CameraAngles {
  azimuthDeg: number; // 水平旋转 -180..180
  elevationDeg: number; // 垂直旋转 -80..80
  zoomPercent: number; // 缩放比例 40..220
}

export interface MaterialCatalogItem {
  grade: string;
  category: '碳素钢/低合金钢' | '不锈钢' | '锻件' | '非金属垫片';
  standard: string;
  density: number; // g/cm3
  yieldStrengthMpa: number;
  allowableStress20: number; // MPa
  allowableStress150: number; // MPa
  allowableStress250: number; // MPa
  refPricePerTon: number; // RMB/ton
}

export interface CostBreakdownRow {
  category: string;
  basis: string;
  unitPriceLabel: string;
  amountRmb: number;
}

export interface CostEstimateSummary {
  materialRows: Array<{
    material: string;
    weightKg: number;
    unitPricePerTon: number;
    costRmb: number;
  }>;
  breakdownRows: CostBreakdownRow[];
  materialTotalRmb: number;
  manufacturingTotalRmb: number;
  taxRmb: number;
  grandTotalRmb: number;
  unitPricePerKg: number;
}

export interface ComputedComponentMetrics {
  weightKg: number;
  volumeM3: number;
  internalVolumeM3: number;
  outerAreaM2: number;
  innerAreaM2: number;
  cogMm: number; // 质心距起始点
  specText: string;
  standardText: string;
  cuttingSize?: string;
  extraProperties: Array<{ label: string; value: string }>;
}

export interface PlacedMainComponent {
  component: VesselComponent;
  startPosMm: number; // axial position along assembly axis
  endPosMm: number;
  axialLengthMm: number;
  outerRadiusMm: number;
  eccentricOffsetMm?: number; // upward (+world Y / local -X) radial centerline shift after eccentric cone
}

export interface InterferenceIssue {
  id: string;
  severity: 'error' | 'warning';
  category: 'tube_bundle' | 'nozzle_nozzle' | 'nozzle_saddle';
  componentIds: string[];
  componentNames: string;
  title: string;
  detail: string;
  suggestion: string;
  clearanceMm: number;
}

export interface InterferenceReport {
  checkedCount: number;
  errorCount: number;
  warningCount: number;
  issues: InterferenceIssue[];
}

export interface AiNozzleSpec {
  tag: string;
  purpose: string;
  dn: number;
  pn: string;
  angleDeg: number;
  axialRatio: number;
  isManhole: boolean;
}

export interface AiParsedVesselSpec {
  vesselTag: string;
  vesselName: string;
  equipmentType:
    | 'horizontal'
    | 'vertical'
    | 'tower'
    | 'exchanger'
    | 'u_exchanger'
    | 'bku_reboiler'
    | 'spherical_tank';
  orientation: Orientation;
  designCode: string;
  designPressureMpa: number;
  workPressureMpa: number;
  designTempC: number;
  workTempC: number;
  medium: string;
  material: string;
  shellDiameterMm: number;
  kettleDiameterMm: number;
  shellLengthMm: number;
  shellThicknessMm: number;
  supportType: 'saddle' | 'leg' | 'skirt' | 'sphere_column' | 'lug';
  tubeODMm: number;
  tubePitchMm: number;
  baffleCount: number;
  nozzles: AiNozzleSpec[];
  engineeringNotes: string;
}

export interface BomRow {
  index: number;
  tag: string;
  standard: string;
  partName: string;
  material: string;
  spec: string;
  cuttingSize: string;
  unitQty: number;
  spareQty: number;
  unitWeightKg: number;
  totalWeightKg: number;
  innerAreaM2: number;
  outerAreaM2: number;
  internalVolumeM3: number;
}
