import type {
  EquipmentFlangeParams,
  NozzleManholeParams,
  SaddleParams,
  SkirtParams,
  SphericalTankParams,
  TubeLayoutParams,
  VesselComponent,
} from '../types/vessel';
import { computeTubeLayout } from './vesselMath';

/**
 * Authoritative Pressure Vessel CAD / GHPV Engineering Field Glossary.
 * Explains the exact engineering meaning, symbol, unit, and GB/NB/HG code basis
 * for every displayed field in PropertyPanel, StructureTree, and dialogs.
 */
const EXACT_GLOSSARY: Record<string, string> = {
  // Assembly Point (装配点)
  装配点名: '装配点是压力容器三维装配的局部坐标系原点；多壳体设备（如重叠式换热器、立式塔+副罐）可建立多个装配点。',
  方位型式: '决定主构件串联的中心轴方向：卧式沿世界 +X 轴从左向右串联；立式沿世界 +Y 轴从下向上串联。',
  '起始 X(mm)': '装配点原点在全局 X 方向（水平左右方向）的坐标偏移量，单位 mm。',
  '起始 Y(mm)': '装配点原点在全局深度 Y 方向（前后横向）的坐标偏移量，单位 mm。',
  '起始 Z(mm)': '装配点原点在全局高度 Z 方向（标高/上下层间距，如重叠换热器上下壳中心距）的坐标偏移量，单位 mm。',
  所含元件数: '当前装配点下包含的全部主构件与附属件总数量。',
  '主构件 / 附属件': '主构件沿轴线首尾串联构成容器主体壳程；附属件挂载于主构件表面或内部（管口、支座、管束、内件等）。',
  '本装配点总长(mm)': '当前装配点内所有主构件沿中心轴线头尾串联后的总轴向长度（含封头总深、筒体、法兰、裙座等），单位 mm。',
  '最大外径(mm)': '当前装配点内所有主构件的最大外包络直径 Do，用于校核设备间安全通道与起吊空间，单位 mm。',
  '本装配点净重(kg)': '仅统计当前装配点内所有元件的金属净重之和（不含整机其他装配点），单位 kg。',
  '本装配点容积(m³)': '仅统计当前装配点内承压主壳体的内部几何容积，单位 m³。',
  '本装配点外表面积(m²)': '仅统计当前装配点内元件的外表面积之和，用于保温层与防腐涂装工程量计算，单位 m²。',
  '装配点表面积(m²)': '仅统计当前装配点内元件的外表面积之和，用于保温层与防腐涂装工程量计算，单位 m²。',
  '本装配点重心(mm)': '当前装配点按质量加权计算得到的轴向质心距装配点起始端面的距离，用于鞍座定位与吊装校核，单位 mm。',
  '整机总重(kg)': '整个工程全部装配点所有元件的金属总净重，单位 kg。',
  '设备总重(kg)': '整个工程全部装配点所有元件的金属总净重，单位 kg。',
  '整机总容积(m³)': '整个工程全部装配点承压腔体的总内容积，单位 m³。',
  '设备总容积(m³)': '整个工程全部装配点承压腔体的总内容积，单位 m³。',
  补强状态: '接管开孔补强圈是否启用的状态标识。',

  // Common Component Metadata
  元件名: '当前构件在结构树、三维标注、明细表(BOM)及 PDMS/CAD 导出中的唯一显示名称。',
  模型颜色: '构件在三维视口中的 RGBA 显示颜色；调低 Alpha(<255) 可呈现半透明壳体，便于透视观察内部管束/塔盘。',
  详细参数: '点击「设置」打开该构件的完整参数化对话框与 1:1 工程示意简图。',
  所属装配点: '该构件归属的装配点坐标系及安装方位（卧式/立式）。',
  构件分类: '主构件沿轴线串联决定容器外形与总长；附属件依托父级主构件进行轴向与周向定位。',
  挂载主构件: '附属件附着的主构件（如筒体、封头、球壳）；更改挂载主构件会重新计算其在三维空间中的定位基准。',
  显示状态: '控制该构件在三维视口中的可见性；隐藏后仍保留在结构树与材料表计算中。',
  '轴向起止(mm)': '该主构件沿所属装配点中心轴线的起始位置与终止位置（距装配点 0 基准面），单位 mm。',
  '轴向长度(mm)': '该主构件沿设备中心轴方向占据的有效轴向长度，单位 mm。',
  '偏心偏移(mm)': '偏心锥下游壳体相对上游中心线的径向偏心位移量（如 BKU 重沸器下平顶扩结构），单位 mm。',
  元件类型: '高惠压力容器标准元件分类（全系统共 46 类主构件与附属件）。',
  执行标准: '该构件遵循的国家/行业设计制造标准（如 GB/T 150、GB/T 151、NB/T 47023、HG/T 20615 等）。',
  材料: '构件选用的压力容器钢板、锻件、无缝管或非金属材料牌号（如 Q345R、S30408、16MnIII 等）。',
  材料密度: '材料的理论密度 ρ，单位 g/cm³（碳钢/低合金钢约 7.85，奥氏体不锈钢约 7.93~7.98）。',
  '单重(kg)': '按几何实体体积与材料密度计算的单个构件理论净重，单位 kg。',
  '体积(m3)': '构件实体材料自身所占的金属体积（用于质量与锻件/钢板用量核算），单位 m³。',
  '内容积(m3)': '承压构件内部可容纳工艺介质的几何容积（用于水压试验充水重与设备容积标定），单位 m³。',
  '外表面积(m2)': '构件外露表面积（用于外保温绝热面积、油漆防腐面积估算），单位 m²。',
  '内表面积(m2)': '构件内壁接触介质的表面积（用于内衬、酸洗钝化或衬里面积估算），单位 m²。',
  '质心(距起始点)': '构件自身重心距该构件起始基准面的轴向距离，单位 mm。',
  下料尺寸: '钢板卷制或冲压前的理论展开下料尺寸（中性层展开周长 × 长度 × 板厚），单位 mm。',
  规格描述: '汇总显示在设备总图明细表(BOM)中的标准工程规格代号。',

  // Shell & Head & Cone
  筒体类型: '标准等壁厚筒体或变壁厚复合筒节。',
  '筒体直径(mm)': '筒体内径 Di（压力容器按内径基准设计），单位 mm。',
  '筒体外径(mm)': '筒体外径 Do = Di + 2×δn，单位 mm。',
  '筒体厚度(mm)': '筒体名义壁厚 δn（含腐蚀裕量及钢板负偏差圆整值），单位 mm。',
  '筒体长度(mm)': '筒体直段长度 L（两环焊缝/切线之间的净长），单位 mm。',
  '展开长度(mm)': '筒体按中性层计算的钢板下料展开周长 π×(Di + δn)，单位 mm。',
  '180°弯头半径(mm)': '重叠式换热器上下壳体连通 180° 弯头筒体的中心线弯曲半径，单位 mm。',
  封头型式: 'EHA 为以内径 Di 为基准的 2:1 标准椭圆形封头；EHB 为以外径 Do 为基准。',
  椭圆封头直径: '椭圆形封头公称直径 Di（内径基准），单位 mm。',
  椭圆名义厚度: '封头图样标注的名义壁厚 δn，单位 mm。',
  最小成型厚度: '封头压制成型后任意部位允许的最小实测壁厚（δn 扣除加工减薄量），单位 mm。',
  投料厚度: '封头热/冷冲压下料坯料钢板的原始厚度，单位 mm。',
  直边高度: '封头环向直边段高度 h（切线 T.L. 至焊缝端面距离，通常 25/40/50 mm），单位 mm。',
  曲面高度: '标准 2:1 椭圆形封头内曲面深度 hi = Di / 4，单位 mm。',
  '封头总深(mm)': '封头内部总深度 H = hi + h（曲面高度 + 直边高度），单位 mm。',
  '展开坯料径(mm)': 'GB/T 25198 封头下料圆形坯料理论展开直径，单位 mm。',
  成型方法: '封头制造工艺（冷冲压、冷旋压或热冲压），影响加工减薄率与热处理要求。',
  '减薄率(%)': '封头成形过程中壁厚减薄百分比，用于校核最小成型厚度。',
  朝向翻转: '控制封头/锥壳/法兰的轴向安装朝向（左/下封头 ↔ 右/上封头，或配对法兰面对面翻转）。',
  锥壳类型: '正锥（上下端同轴心）或偏心锥（如 BKU 重沸器一侧母线平齐的偏心变径壳体）。',
  折边型式: '锥壳大/小端与筒体过渡处的折边结构（无折边、单折边或双折边），用于降低边缘应力。',
  小端内径: '锥壳较小一端的内径 d，单位 mm。',
  大端内径: '锥壳较大一端的内径 D，单位 mm。',
  锥体总长: '锥壳两端口之间的总轴向高度 H（含大小端折边及直边），单位 mm。',
  '半顶角(°)': '锥壳斜母线与中心轴线的夹角 α，GB/T 150 要求无折边锥壳半顶角一般 ≤30°。',
  小端折边半径: '锥壳小端过渡圆弧内半径 r1，单位 mm。',
  大端折边半径: '锥壳大端过渡圆弧内半径 r2，单位 mm。',
  '小端直边h1(mm)': '锥壳小端与筒体对接的直边高度 h1，单位 mm。',
  '大端直边h2(mm)': '锥壳大端与筒体对接的直边高度 h2，单位 mm。',

  // Flange / Gasket / Tubesheet / Expansion Joint
  法兰类型: '设备法兰结构形式（甲型平焊、乙型平焊、长颈对焊 WN 或盲法兰盖 BL）。',
  法兰密封面: '法兰垫片压紧面型式：RF 突面、MF 凹凸面、TG 榫槽面。',
  公称压力: '法兰或垫片的设计压力等级 PN（MPa 或美标 Class 等级）。',
  公称直径: '法兰、垫片或膨胀节的公称通径 DN，单位 mm。',
  法兰盘厚度: '法兰盘主体厚度 δ（不含突面高度），单位 mm。',
  法兰外径: '法兰盘最外缘直径 OD，单位 mm。',
  螺栓中心圆: '所有紧固螺栓孔圆心所在的分布圆直径 BCD，单位 mm。',
  螺栓数量: '法兰圆周均布的紧固双头螺柱总数量（一般为 4 的倍数）。',
  螺栓规格: '紧固双头螺柱的公制螺纹规格（如 M24、M27、M30）。',
  法兰总高: '法兰密封端面至焊接颈端面的总轴向高度，单位 mm。',
  '垫片厚度(mm)': '密封垫片未压缩前的名义厚度 T1，单位 mm。',
  垫片直径D1: '密封垫片内径 D1，单位 mm。',
  垫片直径D2: '密封垫片外径 D2，单位 mm。',
  '管板内径Di(mm)': '管板对应的换热器壳体公称内径 Di，单位 mm。',
  '管板外径(mm)': '管板圆盘最外缘直径（兼作法兰时等于法兰外径），单位 mm。',
  '管板厚度(mm)': '管板名义厚度 Ts，承受管/壳程压差及温差载荷，单位 mm。',
  管孔数量: '管板上钻削用于穿装换热管的管孔总数。',
  '换热管外径(mm)': '穿装于管板上的换热管公称外径 d（常用 Ø19、Ø25、Ø32），单位 mm。',
  波数: '波形膨胀节（波纹管）的波峰数量，决定轴向热膨胀补偿能力。',
  '波高(mm)': '波形膨胀节单波外凸高度 h，单位 mm。',
  '波距(mm)': '波形膨胀节相邻两波峰中心距 q，单位 mm。',
  '波纹壁厚(mm)': '波纹管单层或总成型壁厚，单位 mm。',

  // Nozzle & Manhole
  管口符号: '设备总图与管口表中的接管代号（如 N1、N2 表示工艺口，M1 表示人孔，L1 表示液位计口）。',
  管口用途: '该接管的工艺功能说明（如壳程进料、气相出口、安全阀、检修人孔、排净口等）。',
  管口类别: '区分普通工艺接管与检修人孔/手孔（HG/T 21524）。',
  人孔型式: '人孔盖启闭结构（水平吊盖、垂直吊盖或回转盖），便于检修吊装。',
  法兰体系: '管法兰采用的标准体系：HG 美标(HG/T 20615, Class 系列)或 HG 欧标(HG/T 20592, PN 系列)。',
  法兰标准号: '管口法兰或人孔遵循的具体行业标准编号。',
  法兰型式: '管口法兰焊接形式：WN-RF 带颈对焊、SO-RF 带颈平焊、LWN-RF 长高颈、PL-RF 板式平焊。',
  法兰公称直径: '接管公称直径 DN，单位 mm。',
  法兰压力等级: '管法兰压力等级（美标 Class 150/300/600 或欧标 PN10/16/25/40）。',
  '法兰外径×厚(mm)': '管口法兰盘外径与法兰厚度组合尺寸，单位 mm。',
  '接管外径×壁厚': '接管无缝钢管的外径 × 壁厚（Ø×S），单位 mm。',
  接管材质: '接管段所用的压力管道钢材牌号（如 20、Q345R、S30408）。',
  '轴向距离(mm)': '接管中心线距其挂载主构件起始基准面（如左切线或底切线）的轴向距离，单位 mm。',
  '外伸长度L1(mm)': '接管法兰密封面距容器中心线或壳体外壁的外伸定位尺寸 L1，单位 mm。',
  '内伸长度L2(mm)': '接管伸入容器内壁以内的内伸长度 L2（0 表示与容器内壁齐平），单位 mm。',
  '方位角(°)': '接管沿容器圆周的顺时针安装方位角 θ（卧式 0° 为正顶部、180° 为正底部；立式 0° 为东/+X）。',
  定位类型: '接管相对容器中心线的空间布置形式：径向（正对圆心）、平行（偏心平行）或切向（沿切线进入）。',
  '与中心线夹角(°)': '接管轴线与容器中心轴线之间的夹角（默认 90° 为垂直壳体）。',
  '偏心距E(mm)': '平行或切向接管中心线相对容器中心线的横向偏心距离 E，单位 mm。',
  '偏置距离L4(mm)': '封头或特殊方位接管的附加定位偏移距离 L4，单位 mm。',
  补强圈: '接管开孔补强圈外径 × 厚度（JB/T 4736），用于补偿大开孔削弱的壳体强度。',
  补强圈材质: '补强圈选用的钢板材料牌号（通常与壳体主材一致）。',
  法兰盲盖: '是否在管口法兰外端配装盲板/法兰盖（常用于人孔、备用口或排净口）。',
  '90°弯头': '接管外端是否带 90° 弯头引出管及其型号（如 GB/T 12459 长/短半径弯头）。',
  '弯头弯曲半径R(mm)': '90° 弯头中心线曲率半径 R（长半径 1.5D，短半径 1.0D），单位 mm。',
  '弯头引出长L3(mm)': '弯头旋转轴至出口法兰密封面的引出水平长度 L3，单位 mm。',
  '弯头方位角β(°)': '90° 弯头出口的指向角度 β。',

  // Supports & Internals
  鞍座型式: 'NB/T 47065.1 鞍式支座结构型式：A 型轻型、BI 型重型带筋板、BII 型重型带大包角垫板。',
  固定滑动: '卧式容器双鞍座必须一端固定(F，圆螺栓孔)、一端滑动(S，长圆孔)以释放热膨胀位移。',
  '适用筒径(mm)': '鞍座弧形托板匹配的卧式容器筒体公称内径，单位 mm。',
  '鞍座宽度B(mm)': '鞍座轴向腹板/垫板宽度 B，单位 mm。',
  '底板长度': '鞍座接地底板沿周向的总长度 L1，单位 mm。',
  '底板宽度': '鞍座接地底板沿轴向的宽度 B1，单位 mm。',
  '腹板厚度': '鞍座主承载竖向腹板厚度 δ1，单位 mm。',
  '筋板数量': '鞍座单侧加强立筋板数量。',
  '垫板厚度(mm)': '鞍座与筒体之间焊接的弧形加强垫板厚度，单位 mm。',
  '鞍座高度H': '容器中心线至鞍座底板底面的中心标高 H，单位 mm。',
  '包角(°)': '鞍座弧形包覆筒体底部的圆心角（通常为 120° 或 150°）。',
  定位尺寸: '支座或内件距挂载主构件起始端的轴向安装距离，单位 mm。',
  裙座类型: '立式塔器支承裙座型式：圆筒形（上下等径）、圆锥形（下扩抗倾覆）或中间裙座。',
  '裙座内径(mm)': '裙座顶部与塔体封头对焊处的内径，单位 mm。',
  '裙座底径(mm)': '裙座底部基础环处的内径（圆锥形裙座大于顶径），单位 mm。',
  '裙座厚度(mm)': '裙座筒体钢板壁厚，单位 mm。',
  '裙座高度(mm)': '基础面至裙座与下封头切线焊缝处的高度，单位 mm。',
  '基础环外径/内径(mm)': '裙座底部地脚螺栓座基础环板的外径 × 内径，单位 mm。',
  '基础环厚度(mm)': '裙座底部承载基础环钢板厚度，单位 mm。',
  '筋板高度(mm)': '基础环与裙座筒壁之间抗弯筋板的高度，单位 mm。',
  检查孔: '裙座壁是否开设用于下封头引出管检修的圆形检查孔。',
  地脚螺栓规格: '固定立式塔器裙座的地脚螺栓公称规格（如 M36、M42）。',
  地脚螺栓数量: '沿裙座基础环均布的地脚螺栓总数量。',
  支腿型式: 'NB/T 47065.2 腿式支座型式（A 型角钢、B 型钢管、C 型 H 型钢）。',
  '角钢边宽(mm)': '支腿截面的型钢边宽或管外径，单位 mm。',
  '底板边长(mm)': '支腿底部方形接地底板边长，单位 mm。',
  耳座型式: 'NB/T 47065.3 耳式支座结构型式（A 型短臂、B 型长臂带筋板、C 型带垫板）。',
  刚性环结构: '是否采用整圈刚性环加强耳座以分散大吨位局部应力。',
  '底板尺寸(mm)': '耳座水平支承底板的宽度 × 长度，单位 mm。',
  换热管型式: '直管（用于固定管板/浮头式换热器）或 U 形管（用于 BIU/BKU 换热器，可自由热膨胀）。',
  '壳体内径(mm)': '换热管束所在壳程筒体的内径 Di，单位 mm。',
  '布管限定圆DL(mm)': '允许布置换热管的最外圆直径 DL（留出拉杆与壳壁间隙），单位 mm。',
  布管根数: '按管间距、排列方式与管程分程隔板槽自动计算得到的实际换热管根数。',
  换热管规格: '单根换热管的外径 × 壁厚（Ø×t），单位 mm。',
  '管间距S(mm)': '相邻两根换热管中心距 S（GB/T 151 规定 S ≥ 1.25d），单位 mm。',
  排列方式: '换热管在管板上的几何排列（正三角形换热紧凑、正方形便于机械清洗）。',
  管程数: '管程介质折返次数（1/2/4 程，多管程会在中心留出分程隔板通道）。',
  '换热管长(mm)': '单根直管有效换热长度或 U 形管直段长度，单位 mm。',
  折流板数量: '壳程内用于支撑管束并引导流体横向冲刷的弓形折流板总数。',
  '换热面积(m²)': '按全部换热管外表面积汇总计算的有效传热面积，单位 m²。',
  'BKU下移偏心(mm)': 'BKU 釜式重沸器管束相对扩大釜体中心线向下偏移的距离（顶部留气相分离空间），单位 mm。',
  结构分带: '球罐橘瓣球壳的球皮分带组合方案（三带、四带或混合式五带）。',
  赤道带瓣数: '球罐赤道带圆周分块球壳板的数量。',
  温带瓣数: '球罐上下温带圆周分块球壳板的数量。',
  '焊缝总长(m)': '球罐全壳体纵环焊缝累计长度（用于探伤与焊接造价核算），单位 m。',
  '赤道瓣弧长(mm)': '单块赤道带球壳板的理论弧长尺寸，单位 mm。',
  支柱根数: '支承球罐赤道带的立柱钢管总数量。',
  支柱规格: '球罐支柱钢管外径 × 壁厚，单位 mm。',
  '底部净空(mm)': '球罐最底端距地坪基础面的净空高度，单位 mm。',
  交叉拉杆: '球罐相邻支柱之间用于抗风抗震的斜向拉杆规格。',
  平台类型: '圆形操作平台（塔顶/球顶全周）或弧形检修平台（局部人孔检修）。',
  '平台标高(mm)': '操作平台面距设备基准零点的高度，单位 mm。',
  '平台宽度(mm)': '平台走道净宽（化工规范一般 ≥700~900 mm），单位 mm。',
  '起始方位角(°)': '弧形平台或对称支座的起始安装方位角。',
  '直梯高度(mm)': '配套钢直爬梯的总攀爬高度，单位 mm。',
  安全护笼: '攀爬高度 >3m 时按 GB 4053.1 配备的直梯安全护笼。',

  // TechnicalSpec (技术特性表)
  设备位号: '工艺流程图(P&ID)及装置中的唯一设备编号（如 V-101、E-402、T-301）。',
  设备名称: '压力容器的工艺功能名称（如 U形管换热器、加氢脱硫反应器）。',
  容器类别: '按 TSG 21《固定式压力容器安全技术监察规程》划分的 I / II / III 类（A/C/D 级）监管类别。',
  设计标准: '设备遵循的核心设计规范（如 GB/T 150-2024 压力容器、GB/T 151-2014 热交换器、GB/T 12337 球罐）。',
  '设计压力(MPa)': '设定的容器顶部最高压力，作为壁厚强度计算与安全阀整定基准，单位 MPa。',
  '工作压力(MPa)': '正常工艺操作条件下容器顶部可能达到的最高压力，单位 MPa。',
  '试验压力(MPa)': '制造完成后进行液压/气压耐压试验的规定压力（一般为 1.25×设计压力×应力比），单位 MPa。',
  '设计温度(°C)': '容器在正常工作情况下受压元件金属可能达到的最高/最低设定温度，单位 °C。',
  '工作温度(°C)': '正常工艺操作时的介质温度，单位 °C。',
  工作介质: '容器内盛装的物料名称及特性（决定毒性/易燃危害分类与选材）。',
  '腐蚀裕量(mm)': '为防止受压元件因介质腐蚀而减薄预留的附加壁厚 C2，单位 mm。',
  焊缝系数: '焊接接头系数 φ（双面焊 100% 无损检测取 1.0，局部检测取 0.85），直接影响壁厚计算。',
  无损检测: '对接焊缝的射线(RT)、超声(UT)或磁粉/渗透(MT/PT)检测比例与合格级别（NB/T 47013）。',
  热处理: '焊后消除应力热处理(PWHT)要求，用于厚壁容器、抗应力腐蚀或低温工况。',
  图号: '设备施工总图的工程归档图纸编号。',
  项目名称: '所属石化/化工工程建设项目名称。',
  设计单位: '承担本台设备压力容器设计资质的工程公司或设计院名称。',
};

/**
 * Look up the human-readable engineering meaning of a property label.
 */
export function getFieldMeaning(label: string): string {
  if (EXACT_GLOSSARY[label]) return EXACT_GLOSSARY[label];
  const clean = label.replace(/\(.*?\)$/, '').trim();
  if (EXACT_GLOSSARY[clean]) return EXACT_GLOSSARY[clean];

  // Fallback pattern rules for generic/dynamic labels
  if (/标准/.test(label)) return '该构件所执行的国家、化工或机械行业工程标准编号。';
  if (/定位|标高|起始/.test(label)) return '构件沿父级主构件中心轴线的安装定位尺寸，单位 mm。';
  if (/方位角|角度/.test(label)) return '构件沿壳体圆周方向的顺时针角度定位（0°~360°）。';
  if (/直径|外径|内径|跨径/.test(label)) return '构件的径向特征尺寸，单位 mm。';
  if (/厚|δ/.test(label)) return '构件钢板或管壁的厚度尺寸，单位 mm。';
  if (/长度|高度|宽度|跨度|间距/.test(label)) return '构件的结构外形或布置间距尺寸，单位 mm。';
  if (/数量|根数|层数|组数|孔数/.test(label)) return '该零件在当前装配单元中的成套数量。';
  if (/螺栓/.test(label)) return '紧固件连接规格与数量配置。';
  return `工程属性字段「${label}」的当前数值。`;
}

export interface SubNodeDetailInfo {
  subNodeName: string;
  partCategory: string;
  description: string;
  material: string;
  density: number;
  rows: Array<{ label: string; value: string }>;
}

/**
 * Provide structured engineering details when the user selects any sub-node
 * under a main component or attachment in StructureTree (not only baffles!).
 */
export function describeSubNode(
  component: VesselComponent,
  subNode: string
): SubNodeDetailInfo {
  const baseMat = (component.params as { material?: string }).material || 'Q345R';
  const baseDensity = (component.params as { density?: number }).density || 7.85;

  // 1. Heat exchanger baffle sub-node (折流板N)
  if (component.type === 'tube_layout' && /^折流板\d+$/.test(subNode)) {
    const tp = component.params as TubeLayoutParams;
    const layout = computeTubeLayout(tp);
    const outerDia = Math.max(100, tp.shellDiameter - 6);
    const thickness = 8;
    const discAreaMm2 = Math.PI * (outerDia / 2) * (outerDia / 2) * 0.78;
    const holeCount = Math.max(12, Math.round(layout.totalCount * 0.44));
    const holesAreaMm2 = holeCount * Math.PI * ((tp.tubeOD + 0.8) / 2) ** 2;
    const netAreaMm2 = Math.max(discAreaMm2 * 0.35, discAreaMm2 - holesAreaMm2);
    const volumeM3 = (netAreaMm2 * thickness) / 1e9;
    const weightKg = volumeM3 * 7850;
    return {
      subNodeName: subNode,
      partCategory: '弓形折流板 (GB/T 151)',
      description: '支撑换热管束并引导壳程介质折流横向冲刷管束，提高传热系数。',
      material: 'Q235B',
      density: 7.85,
      rows: [
        { label: '零件实体', value: '弓形折流板' },
        { label: '材料', value: 'Q235B' },
        { label: '材料密度', value: '7.85' },
        { label: '单重(kg)', value: weightKg.toFixed(2) },
        { label: '体积(m3)', value: volumeM3.toFixed(6) },
        { label: '外径(mm)', value: String(outerDia) },
        { label: '厚度(mm)', value: String(thickness) },
        { label: '开孔数量', value: `${holeCount} 孔 (Ø${(tp.tubeOD + 0.8).toFixed(1)})` },
        { label: '弓形切口率', value: '22%' },
      ],
    };
  }

  // 2. Equipment flange bolt set
  if (component.type === 'equipment_flange' && /螺栓/.test(subNode)) {
    const fp = component.params as EquipmentFlangeParams;
    return {
      subNodeName: subNode,
      partCategory: '法兰紧固件组 (NB/T 47027)',
      description: '双头螺柱配双六角螺母及垫圈，用于压紧设备法兰密封面与垫片。',
      material: '35CrMoA / 30CrMoA',
      density: 7.85,
      rows: [
        { label: '螺栓规格', value: fp.boltSpec || 'M24' },
        { label: '螺栓数量', value: `${fp.boltCount} 套` },
        { label: '螺栓中心圆', value: `${fp.boltCircle} mm` },
        { label: '执行标准', value: 'NB/T 47027-2012' },
      ],
    };
  }

  // 3. Nozzle / manhole sub-nodes
  if (component.type === 'nozzle_manhole') {
    const np = component.params as NozzleManholeParams;
    if (/接管/.test(subNode)) {
      return {
        subNodeName: subNode,
        partCategory: '接管段 (GB/T 8163 / GB/T 9948)',
        description: '连接容器壳体开孔与外部法兰的承压无缝钢管段。',
        material: np.pipeMaterial || baseMat,
        density: baseDensity,
        rows: [
          { label: '管口符号', value: np.tag },
          { label: '接管外径×壁厚', value: `Ø${np.pipeOD}×${np.pipeThickness} mm` },
          { label: '外伸长度L1(mm)', value: String(np.protrusion) },
          { label: '内伸长度L2(mm)', value: String(np.innerProtrusion) },
        ],
      };
    }
    if (/法兰/.test(subNode)) {
      return {
        subNodeName: subNode,
        partCategory: `管法兰 (${np.flangeSpec})`,
        description: '接管端面配对连接法兰，用于与外部工艺管线或盲盖螺栓紧固密封。',
        material: baseMat,
        density: baseDensity,
        rows: [
          { label: '法兰型式', value: np.flangeType },
          { label: '法兰公称直径', value: `DN${np.dn}` },
          { label: '法兰压力等级', value: `PN${np.pn}` },
          { label: '法兰外径×厚(mm)', value: `${np.flangeOD}×${np.flangeThickness}` },
          { label: '螺栓数量', value: `${np.boltCount} 个` },
        ],
      };
    }
    if (/补强圈/.test(subNode)) {
      const padOD = np.padOD || Math.round(np.pipeOD * 1.65);
      const padT = np.padThickness || Math.max(10, np.pipeThickness + 4);
      return {
        subNodeName: subNode,
        partCategory: '开孔补强圈 (JB/T 4736)',
        description: '贴焊在壳体开孔周围的加强环板，带 M10 信号检漏孔。',
        material: np.padMaterial || 'Q345R',
        density: 7.85,
        rows: [
          { label: '补强状态', value: np.hasPad ? '已启用' : '未启用' },
          { label: '补强圈', value: `Ø${padOD}×${padT} mm` },
          { label: '执行标准', value: 'JB/T 4736-2002' },
        ],
      };
    }
  }

  // 4. Saddle sub-nodes
  if (component.type === 'saddle') {
    const sp = component.params as SaddleParams;
    return {
      subNodeName: subNode,
      partCategory: `鞍座子件 (${sp.standard || 'NB/T 47065.1'})`,
      description: `卧式容器 ${sp.saddleType} ${sp.fixType} 鞍座组成零件。`,
      material: baseMat,
      density: baseDensity,
      rows: [
        { label: '鞍座型式', value: `${sp.saddleType} · ${sp.fixType}` },
        { label: '底板长度', value: `${sp.baseLength} mm` },
        { label: '底板宽度', value: `${sp.baseWidth} mm` },
        { label: '腹板厚度', value: `${sp.webThickness} mm` },
        { label: '垫板厚度(mm)', value: `${sp.padThickness} mm` },
      ],
    };
  }

  // 5. Skirt sub-nodes
  if (component.type === 'skirt') {
    const sk = component.params as SkirtParams;
    return {
      subNodeName: subNode,
      partCategory: '裙座子件 (NB/T 47041)',
      description: '立式塔器裙座支承结构的组成板件或开孔。',
      material: baseMat,
      density: baseDensity,
      rows: [
        { label: '裙座类型', value: sk.skirtType },
        { label: '基础环外径/内径(mm)', value: `${sk.baseRingOD} / ${sk.baseRingID}` },
        { label: '基础环厚度(mm)', value: `${sk.baseRingThickness} mm` },
        { label: '筋板高度(mm)', value: `${sk.gussetHeight} mm` },
        { label: '地脚螺栓规格', value: `${sk.boltCount}-${sk.boltSpec}` },
      ],
    };
  }

  // 6. Spherical tank sub-nodes
  if (component.type === 'spherical_tank') {
    const st = component.params as SphericalTankParams;
    return {
      subNodeName: subNode,
      partCategory: '球罐分带球皮 (GB/T 12337)',
      description: '橘瓣/混合式球壳压制球瓣带或焊缝组。',
      material: baseMat,
      density: baseDensity,
      rows: [
        { label: '结构分带', value: st.zoneStyle },
        { label: '球罐内径(mm)', value: String(st.diameter) },
        { label: '球壳壁厚(mm)', value: String(st.thickness) },
        { label: '赤道带瓣数', value: String(st.equatorPetals) },
        { label: '温带瓣数', value: String(st.temperatePetals) },
      ],
    };
  }

  return {
    subNodeName: subNode,
    partCategory: `${component.name} 子零件`,
    description: `属于「${component.name}」的组成子构件，双击树节点或点击「设置」可调整整组参数。`,
    material: baseMat,
    density: baseDensity,
    rows: [
      { label: '所属元件', value: component.name },
      { label: '材料', value: baseMat },
      { label: '材料密度', value: baseDensity.toFixed(2) },
    ],
  };
}
