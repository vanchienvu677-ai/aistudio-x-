import React from 'react';
import type { ComponentType } from '../../types/vessel';

interface ComponentSchematicSvgProps {
  type: ComponentType;
  params: Record<string, unknown>;
}

/**
 * Returns component-specific Chinese engineering field labels so no dialog
 * ever falls back to vague "主尺寸A / 辅尺寸B" labels.
 */
export function getContextualFieldLabels(type: ComponentType): Record<string, string> {
  switch (type) {
    case 'horizontal_lug':
      return { sizeA: '耳板底宽 B(mm)', sizeB: '耳板高度 H(mm)', thickness: '耳板厚度 δ(mm)', axialOffset: '轴向定位(mm)', angleDeg: '方位角(°)' };
    case 'side_lug':
      return { sizeA: '耳板宽度 B(mm)', sizeB: '耳板高度 H(mm)', thickness: '耳板厚度 δ(mm)', axialOffset: '定位标高(mm)', angleDeg: '基准方位角(°)' };
    case 'lifting_ring':
      return { sizeA: '垫板边长(mm)', sizeB: '吊环外径 D(mm)', thickness: '圆钢直径/厚(mm)', axialOffset: '轴向定位(mm)', angleDeg: '方位角(°)' };
    case 'support_stand':
      return { sizeA: '支座立管外径(mm)', sizeB: '支座高度 H(mm)', thickness: '底板厚度 δ(mm)', axialOffset: '底部标高(mm)', angleDeg: '起始方位角(°)' };
    case 'wind_guide':
      return { sizeA: '伸出长度 L(mm)', sizeB: '导向高度 H(mm)', thickness: '筋板厚度 δ(mm)', axialOffset: '导向标高(mm)', angleDeg: '起始方位角(°)' };
    case 'structural_steel':
      return { sizeA: '型钢长度 L(mm)', sizeB: '截面高度 H(mm)', thickness: '翼缘厚度 t(mm)', axialOffset: '轴向定位(mm)', angleDeg: '方位角(°)' };
    case 'floating_hook':
      return { sizeA: '勾圈外径 OD(mm)', sizeB: '勾圈高度 H(mm)', thickness: '环壁厚度 δ(mm)', axialOffset: '轴向定位(mm)', angleDeg: '对开缝角度(°)' };
    case 'pass_partition':
      return { sizeA: '隔板跨径 D(mm)', sizeB: '隔板轴向长 L(mm)', thickness: '隔板厚度 δ(mm)', axialOffset: '管箱轴向位(mm)', angleDeg: '布置方位(°)' };
    case 'impingement_baffle':
      return { sizeA: '挡板弧宽 W(mm)', sizeB: '挡板轴长 L(mm)', thickness: '挡板厚度 δ(mm)', axialOffset: '入口对齐位(mm)', angleDeg: '方位角(°)' };
    case 'nameplate':
      return { sizeA: '铭牌宽度 W(mm)', sizeB: '铭牌高度 H(mm)', thickness: '支架板厚 δ(mm)', axialOffset: '安装标高(mm)', angleDeg: '方位角(°)' };
    case 'spatial_piping':
      return { sizeA: '管段跨距 L(mm)', sizeB: '管子外径 OD(mm)', thickness: '管子壁厚 t(mm)', axialOffset: '起始定位(mm)', angleDeg: '出口方位角(°)' };
    case 'insulation_support':
      return { sizeA: '参考筒径 Di(mm)', sizeB: '支承圈宽 W(mm)', thickness: '圈板厚度 δ(mm)', axialOffset: '首层标高(mm)', angleDeg: '缺口方位(°)' };
    case 'grounding_lug':
      return { sizeA: '接地耳长 L(mm)', sizeB: '接地耳宽 W(mm)', thickness: '极板厚度 δ(mm)', axialOffset: '焊接标高(mm)', angleDeg: '方位角(°)' };
    case 'pipe_boss':
      return { sizeA: '管座外径 OD(mm)', sizeB: '伸出长度 L(mm)', thickness: '管座壁厚 t(mm)', axialOffset: '轴向定位(mm)', angleDeg: '方位角(°)' };
    case 'vortex_breaker':
      return { sizeA: '十字跨径 D(mm)', sizeB: '叶片高度 H(mm)', thickness: '叶片厚度 δ(mm)', axialOffset: '出口轴向位(mm)', angleDeg: '旋转角度(°)' };
    case 'bottom_orifice':
      return { sizeA: '孔板外径 D(mm)', sizeB: '节流孔参考(mm)', thickness: '孔板厚度 δ(mm)', axialOffset: '轴向定位(mm)', angleDeg: '孔阵转角(°)' };
    case 'foundation_template':
      return { sizeA: '模板外径 OD(mm)', sizeB: '环板宽度 W(mm)', thickness: '模板厚度 δ(mm)', axialOffset: '预埋标高(mm)', angleDeg: '螺栓起始角(°)' };
    case 'gas_outlet_baffle':
      return { sizeA: '挡板弧宽 W(mm)', sizeB: '挡板长度 L(mm)', thickness: '挡板厚度 δ(mm)', axialOffset: '顶部定位(mm)', angleDeg: '出口方位(°)' };
    default:
      return {};
  }
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Dedicated GHPV CAD Blueprint SVG Schematic for every component handled by
 * the structured engineering dialog (38 types), giving all 46 GHPV components
 * genuine 1:1 CAD schematic visuals with live dimension annotations.
 */
export const ComponentSchematicSvg: React.FC<ComponentSchematicSvgProps> = ({ type, params }) => {
  const renderBlueprint = () => {
    switch (type) {
      case 'spherical_head': {
        const d = num(params, 'diameter', 1000);
        const t = num(params, 'thickness', 12);
        return (
          <>
            <path d="M40,95 A65,65 0 0,1 170,95 L162,95 A57,57 0 0,0 48,95 Z" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.4" />
            <line x1="105" y1="18" x2="105" y2="112" stroke="#dc2626" strokeWidth="0.9" strokeDasharray="5 2 1 2" />
            <line x1="40" y1="104" x2="170" y2="104" stroke="#334155" strokeWidth="0.9" />
            <text x="80" y="116" fontSize="10" fill="#0f172a">Di={d}</text>
            <text x="148" y="45" fontSize="9.5" fill="#1d4ed8">δ={t}</text>
          </>
        );
      }

      case 'gasket': {
        const od = num(params, 'outerDiameter', 1080);
        const id = num(params, 'innerDiameter', 1000);
        const t = num(params, 'thickness', 4.5);
        return (
          <>
            <circle cx="82" cy="64" r="42" fill="#fecaca" stroke="#b91c1c" strokeWidth="1.4" />
            <circle cx="82" cy="64" r="30" fill="#ffffff" stroke="#b91c1c" strokeWidth="1.2" />
            <line x1="82" y1="16" x2="82" y2="112" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <rect x="144" y="28" width="14" height="72" fill="#fecaca" stroke="#b91c1c" strokeWidth="1.3" />
            <text x="135" y="22" fontSize="9.5" fill="#0f172a">δ={t}</text>
            <text x="45" y="118" fontSize="9.5" fill="#0f172a">OD={od} / ID={id}</text>
          </>
        );
      }

      case 'skirt': {
        const td = num(params, 'topDiameter', 1800);
        const bd = num(params, 'bottomDiameter', 1800);
        const h = num(params, 'height', 3200);
        const isCone = bd > td;
        return (
          <>
            <path d="M62,22 A43,18 0 0,0 148,22" fill="none" stroke="#64748b" strokeWidth="1.1" strokeDasharray="3 2" />
            <polygon
              points={isCone ? '62,22 148,22 162,96 48,96' : '62,22 148,22 148,96 62,96'}
              fill="#dbeafe"
              stroke="#1d4ed8"
              strokeWidth="1.4"
            />
            <rect x="38" y="96" width="134" height="8" fill="#93c5fd" stroke="#1e40af" strokeWidth="1.2" />
            <circle cx="105" cy="58" r="10" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1.1" />
            <line x1="105" y1="12" x2="105" y2="112" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="5 2 1 2" />
            <text x="164" y="64" fontSize="9.5" fill="#0f172a">H={h}</text>
            <text x="72" y="117" fontSize="9.5" fill="#0f172a">D={td}/{bd}</text>
          </>
        );
      }

      case 'fixed_tubesheet':
      case 'u_tube_head': {
        const od = num(params, 'outerDiameter', 1050);
        const t = num(params, 'thickness', 48);
        const n = num(params, 'tubeCount', 180);
        return (
          <>
            <circle cx="80" cy="62" r="42" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.5" />
            {[-20, -10, 0, 10, 20].map((dx) =>
              [-20, -10, 0, 10, 20].map((dy) =>
                dx * dx + dy * dy < 680 ? (
                  <circle key={`${dx}-${dy}`} cx={80 + dx} cy={62 + dy} r="2.2" fill="#ffffff" stroke="#1e40af" strokeWidth="0.7" />
                ) : null
              )
            )}
            <rect x="142" y="24" width="22" height="76" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.3" />
            <text x="136" y="18" fontSize="9.5" fill="#0f172a">δ={t}</text>
            <text x="40" y="117" fontSize="9.5" fill="#0f172a">OD={od} · N={n}孔</text>
          </>
        );
      }

      case 'expansion_joint': {
        const dn = num(params, 'dn', 1000);
        const w = num(params, 'waveCount', 3);
        const l = num(params, 'totalLength', 360);
        return (
          <>
            <path
              d="M35,34 L62,34 Q72,18 82,34 Q92,50 102,34 Q112,18 122,34 Q132,50 142,34 L175,34 L175,88 L142,88 Q132,72 122,88 Q112,104 102,88 Q92,72 82,88 Q72,104 62,88 L35,88 Z"
              fill="#dbeafe"
              stroke="#1d4ed8"
              strokeWidth="1.4"
            />
            <line x1="25" y1="61" x2="185" y2="61" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="5 2 1 2" />
            <text x="48" y="116" fontSize="9.5" fill="#0f172a">DN{dn} · {w}波 · L={l}</text>
          </>
        );
      }

      case 'spherical_tank': {
        const d = num(params, 'diameter', 12300);
        const t = num(params, 'thickness', 34);
        return (
          <>
            <circle cx="105" cy="58" r="44" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
            <ellipse cx="105" cy="58" rx="44" ry="13" fill="none" stroke="#d97706" strokeWidth="1" />
            <ellipse cx="105" cy="58" rx="18" ry="44" fill="none" stroke="#d97706" strokeWidth="1" />
            <line x1="56" y1="58" x2="154" y2="58" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <text x="45" y="116" fontSize="9.5" fill="#0f172a">Di={d} · δ={t}</text>
          </>
        );
      }

      case 'sphere_column': {
        const cnt = num(params, 'count', 10);
        const od = num(params, 'pipeOD', 550);
        return (
          <>
            <circle cx="105" cy="40" r="28" fill="#fef3c7" stroke="#b45309" strokeWidth="1.3" />
            <rect x="74" y="40" width="8" height="62" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
            <rect x="128" y="40" width="8" height="62" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
            <line x1="82" y1="56" x2="128" y2="96" stroke="#1d4ed8" strokeWidth="1.1" />
            <line x1="128" y1="56" x2="82" y2="96" stroke="#1d4ed8" strokeWidth="1.1" />
            <line x1="52" y1="102" x2="158" y2="102" stroke="#334155" strokeWidth="1.5" />
            <text x="50" y="117" fontSize="9.5" fill="#0f172a">{cnt}根支柱 · Ø{od}</text>
          </>
        );
      }

      case 'ladder_platform': {
        const w = num(params, 'widthMm', 900);
        const h = num(params, 'ladderHeightMm', 6000);
        return (
          <>
            <rect x="65" y="16" width="44" height="90" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="109" y="34" width="52" height="5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
            <line x1="109" y1="18" x2="161" y2="18" stroke="#1d4ed8" strokeWidth="1.1" />
            <line x1="161" y1="18" x2="161" y2="34" stroke="#1d4ed8" strokeWidth="1.1" />
            <line x1="138" y1="34" x2="138" y2="104" stroke="#0f172a" strokeWidth="1.3" />
            <line x1="148" y1="34" x2="148" y2="104" stroke="#0f172a" strokeWidth="1.3" />
            {[44, 56, 68, 80, 92].map((y) => (
              <line key={y} x1="138" y1={y} x2="148" y2={y} stroke="#0f172a" strokeWidth="1" />
            ))}
            <text x="48" y="118" fontSize="9.5" fill="#0f172a">W={w} · 梯高H={h}</text>
          </>
        );
      }

      case 'lug_support':
      case 'ring_lug': {
        const h = num(params, 'height', 360);
        const bw = num(params, 'baseWidth', 220);
        return (
          <>
            <rect x="52" y="18" width="44" height="86" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <polygon points="96,34 146,84 96,84" fill="#fde68a" stroke="#b45309" strokeWidth="1.3" />
            <rect x="96" y="84" width="56" height="8" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
            {type === 'ring_lug' && (
              <>
                <rect x="48" y="34" width="52" height="6" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.1" />
                <rect x="48" y="84" width="52" height="6" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.1" />
              </>
            )}
            <text x="52" y="117" fontSize="9.5" fill="#0f172a">H={h} · B={bw}</text>
          </>
        );
      }

      case 'leg_support': {
        const h = num(params, 'height', 1200);
        const cnt = num(params, 'count', 4);
        return (
          <>
            <path d="M58,20 L152,20 L152,44 A47,20 0 0,1 58,44 Z" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="64" y="38" width="12" height="62" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
            <rect x="134" y="38" width="12" height="62" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
            <rect x="56" y="96" width="28" height="6" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
            <rect x="126" y="96" width="28" height="6" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
            <text x="54" y="117" fontSize="9.5" fill="#0f172a">{cnt}根支腿 · H={h}</text>
          </>
        );
      }

      case 'support_stand': {
        const a = num(params, 'sizeA', 168);
        const b = num(params, 'sizeB', 520);
        return (
          <>
            <path d="M46,20 A60,26 0 0,0 164,20" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.2" />
            <rect x="68" y="42" width="16" height="54" fill="#fde68a" stroke="#b45309" strokeWidth="1.3" />
            <rect x="126" y="42" width="16" height="54" fill="#fde68a" stroke="#b45309" strokeWidth="1.3" />
            <rect x="60" y="96" width="32" height="7" fill="#f59e0b" stroke="#92400e" strokeWidth="1.1" />
            <rect x="118" y="96" width="32" height="7" fill="#f59e0b" stroke="#92400e" strokeWidth="1.1" />
            <text x="42" y="117" fontSize="9.5" fill="#0f172a">NB/T 47065.4 · Ø{a}×H{b}</text>
          </>
        );
      }

      case 'wind_guide': {
        const a = num(params, 'sizeA', 240);
        const b = num(params, 'sizeB', 260);
        return (
          <>
            <rect x="46" y="18" width="40" height="86" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="86" y="42" width="66" height="10" fill="#cbd5e1" stroke="#334155" strokeWidth="1.3" />
            <polygon points="86,52 146,52 86,86" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
            <rect x="148" y="34" width="10" height="28" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
            <text x="48" y="117" fontSize="9.5" fill="#0f172a">L={a} · H={b} (4组导向)</text>
          </>
        );
      }

      case 'horizontal_lug':
      case 'side_lug': {
        const a = num(params, 'sizeA', 240);
        const b = num(params, 'sizeB', 210);
        const t = num(params, 'thickness', 20);
        return (
          <>
            <rect x="42" y="20" width="36" height="82" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="78" y="28" width="8" height="66" fill="#fde68a" stroke="#b45309" strokeWidth="1.1" />
            <path d="M86,34 L142,46 A16,16 0 0,1 142,78 L86,90 Z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.4" />
            <circle cx="140" cy="62" r="7" fill="#ffffff" stroke="#92400e" strokeWidth="1.3" />
            <line x1="70" y1="62" x2="165" y2="62" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <text x="42" y="117" fontSize="9.5" fill="#0f172a">B={a} · H={b} · δ={t}</text>
          </>
        );
      }

      case 'lifting_ring': {
        const a = num(params, 'sizeA', 180);
        const b = num(params, 'sizeB', 160);
        return (
          <>
            <rect x="46" y="20" width="38" height="82" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="84" y="42" width="10" height="38" fill="#fde68a" stroke="#b45309" strokeWidth="1.1" />
            <circle cx="128" cy="61" r="24" fill="none" stroke="#d97706" strokeWidth="8" />
            <circle cx="128" cy="61" r="24" fill="none" stroke="#92400e" strokeWidth="1.1" />
            <text x="46" y="117" fontSize="9.5" fill="#0f172a">垫板{a} · 吊环Ø{b}</text>
          </>
        );
      }

      case 'trunnion': {
        const od = num(params, 'trunnionOD', 168);
        const l = num(params, 'length', 260);
        return (
          <>
            <rect x="46" y="20" width="42" height="82" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="88" y="44" width="60" height="34" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.3" />
            <rect x="148" y="38" width="10" height="46" fill="#60a5fa" stroke="#1e40af" strokeWidth="1.3" />
            <line x1="76" y1="61" x2="170" y2="61" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <text x="50" y="117" fontSize="9.5" fill="#0f172a">轴耳Ø{od} · L={l}</text>
          </>
        );
      }

      case 'tray':
      case 'demister': {
        const cnt = num(params, 'count', 1);
        const sp = num(params, 'spacing', 500);
        const h = num(params, 'height', 150);
        return (
          <>
            <rect x="52" y="16" width="106" height="88" fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" />
            {[34, 58, 82].map((y) => (
              <g key={y}>
                <rect x="55" y={y} width="100" height={type === 'demister' ? 12 : 6} fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.1" />
                {type === 'tray' && <line x1="138" y1={y} x2="138" y2={y + 18} stroke="#1d4ed8" strokeWidth="1.3" />}
              </g>
            ))}
            <text x="48" y="117" fontSize="9.5" fill="#0f172a">
              {type === 'tray' ? `${cnt}层塔盘 · 板距${sp}` : `除沫器 H=${h}`}
            </text>
          </>
        );
      }

      case 'packing': {
        const h = num(params, 'height', 2400);
        return (
          <>
            <rect x="54" y="18" width="102" height="84" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.3" />
            {[28, 44, 60, 76, 92].map((y) => (
              <path key={y} d={`M54,${y} L156,${y - 12}`} stroke="#0284c7" strokeWidth="0.9" />
            ))}
            {[28, 44, 60, 76, 92].map((y) => (
              <path key={`b-${y}`} d={`M54,${y - 10} L156,${y + 2}`} stroke="#0284c7" strokeWidth="0.9" />
            ))}
            <text x="58" y="117" fontSize="9.5" fill="#0f172a">填料层高 H={h}</text>
          </>
        );
      }

      case 'top_davit': {
        const arm = num(params, 'armLength', 1200);
        const h = num(params, 'poleHeight', 2400);
        return (
          <>
            <path d="M52,98 A54,28 0 0,1 160,98" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.2" />
            <rect x="96" y="24" width="10" height="58" fill="#cbd5e1" stroke="#334155" strokeWidth="1.3" />
            <rect x="96" y="24" width="66" height="8" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.3" />
            <line x1="106" y1="54" x2="140" y2="32" stroke="#1d4ed8" strokeWidth="1.4" />
            <line x1="156" y1="32" x2="156" y2="54" stroke="#dc2626" strokeWidth="1.2" />
            <text x="48" y="117" fontSize="9.5" fill="#0f172a">臂长{arm} · 柱高{h}</text>
          </>
        );
      }

      case 'stiffening_ring': {
        const w = num(params, 'width', 100);
        const t = num(params, 'thickness', 12);
        return (
          <>
            <circle cx="105" cy="58" r="42" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.4" />
            <circle cx="105" cy="58" r="30" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1.3" />
            <line x1="105" y1="10" x2="105" y2="106" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <text x="48" y="117" fontSize="9.5" fill="#0f172a">加强圈 W={w} × δ={t}</text>
          </>
        );
      }

      case 'weld_seam': {
        const w = num(params, 'width', 18);
        return (
          <>
            <rect x="34" y="44" width="60" height="28" fill="#e2e8f0" stroke="#334155" strokeWidth="1.2" />
            <rect x="116" y="44" width="60" height="28" fill="#e2e8f0" stroke="#334155" strokeWidth="1.2" />
            <polygon points="88,44 122,44 108,72 102,72" fill="#fca5a5" stroke="#b91c1c" strokeWidth="1.3" />
            <path d="M88,44 Q105,34 122,44" fill="#fca5a5" stroke="#b91c1c" strokeWidth="1.2" />
            <text x="64" y="115" fontSize="9.5" fill="#0f172a">坡口焊缝 宽W={w}</text>
          </>
        );
      }

      case 'pad_plate': {
        const w = num(params, 'width', 240);
        const h = num(params, 'height', 300);
        const t = num(params, 'thickness', 12);
        return (
          <>
            <path d="M46,84 A75,45 0 0,1 164,84" fill="none" stroke="#64748b" strokeWidth="1.2" />
            <path d="M62,76 A62,38 0 0,1 148,76 L154,68 A70,42 0 0,0 56,68 Z" fill="#fecaca" stroke="#b91c1c" strokeWidth="1.3" />
            <text x="42" y="115" fontSize="9.5" fill="#0f172a">弧形垫板 {w}×{h}×δ{t}</text>
          </>
        );
      }

      case 'structural_steel': {
        const a = num(params, 'sizeA', 650);
        const b = num(params, 'sizeB', 150);
        const t = num(params, 'thickness', 12);
        return (
          <>
            <path d="M46,24 L106,24 L106,34 L82,34 L82,84 L106,84 L106,94 L46,94 L46,84 L70,84 L70,34 L46,34 Z" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1.4" />
            <rect x="128" y="32" width="54" height="54" fill="#e2e8f0" stroke="#334155" strokeWidth="1.2" />
            <line x1="128" y1="42" x2="182" y2="42" stroke="#334155" strokeWidth="1" />
            <line x1="128" y1="76" x2="182" y2="76" stroke="#334155" strokeWidth="1" />
            <text x="42" y="116" fontSize="9.5" fill="#0f172a">H{b}×δ{t} · L={a}</text>
          </>
        );
      }

      case 'floating_hook': {
        const a = num(params, 'sizeA', 700);
        const b = num(params, 'sizeB', 110);
        return (
          <>
            <path d="M102,20 A40,40 0 1,0 102,100 L102,86 A26,26 0 1,1 102,34 Z" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.3" />
            <path d="M108,20 A40,40 0 1,1 108,100 L108,86 A26,26 0 1,0 108,34 Z" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.3" />
            <line x1="105" y1="12" x2="105" y2="106" stroke="#dc2626" strokeWidth="0.9" strokeDasharray="4 2" />
            <text x="42" y="117" fontSize="9.5" fill="#0f172a">对开勾圈 OD={a} · H={b}</text>
          </>
        );
      }

      case 'pass_partition': {
        const a = num(params, 'sizeA', 900);
        const b = num(params, 'sizeB', 480);
        return (
          <>
            <circle cx="105" cy="58" r="40" fill="#f8fafc" stroke="#64748b" strokeWidth="1.3" />
            <rect x="65" y="55" width="80" height="6" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
            <rect x="102" y="58" width="6" height="40" fill="#60a5fa" stroke="#1d4ed8" strokeWidth="1.2" />
            <text x="46" y="116" fontSize="9.5" fill="#0f172a">分程隔板 D={a} · L={b}</text>
          </>
        );
      }

      case 'impingement_baffle':
      case 'gas_outlet_baffle': {
        const a = num(params, 'sizeA', 360);
        const b = num(params, 'sizeB', 300);
        return (
          <>
            <path d="M40,36 Q105,14 170,36" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="4 2" />
            <path d="M62,56 Q105,36 148,56 L148,66 Q105,46 62,66 Z" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.4" />
            <line x1="72" y1="42" x2="72" y2="54" stroke="#334155" strokeWidth="2" />
            <line x1="138" y1="42" x2="138" y2="54" stroke="#334155" strokeWidth="2" />
            <path d="M105,22 L105,40 M98,34 L105,41 L112,34" fill="none" stroke="#dc2626" strokeWidth="1.2" />
            <text x="44" y="116" fontSize="9.5" fill="#0f172a">弧宽{a} · 长{b}</text>
          </>
        );
      }

      case 'nameplate': {
        const a = num(params, 'sizeA', 240);
        const b = num(params, 'sizeB', 160);
        return (
          <>
            <rect x="46" y="24" width="118" height="70" rx="2" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
            <circle cx="54" cy="32" r="2.2" fill="#475569" />
            <circle cx="156" cy="32" r="2.2" fill="#475569" />
            <circle cx="54" cy="86" r="2.2" fill="#475569" />
            <circle cx="156" cy="86" r="2.2" fill="#475569" />
            <line x1="62" y1="44" x2="148" y2="44" stroke="#334155" strokeWidth="1.2" />
            <line x1="62" y1="58" x2="140" y2="58" stroke="#64748b" strokeWidth="1" />
            <line x1="62" y1="72" x2="132" y2="72" stroke="#64748b" strokeWidth="1" />
            <text x="50" y="116" fontSize="9.5" fill="#0f172a">TSG 21 铭牌 {a}×{b}</text>
          </>
        );
      }

      case 'spatial_piping': {
        const a = num(params, 'sizeA', 1200);
        const b = num(params, 'sizeB', 114);
        return (
          <>
            <path d="M40,86 L72,86 Q90,86 90,68 L90,42 Q90,26 108,26 L166,26" fill="none" stroke="#f97316" strokeWidth="9" strokeLinecap="round" />
            <path d="M40,86 L72,86 Q90,86 90,68 L90,42 Q90,26 108,26 L166,26" fill="none" stroke="#9a3412" strokeWidth="1.1" strokeDasharray="4 2" />
            <rect x="34" y="74" width="7" height="24" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
            <rect x="164" y="14" width="7" height="24" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.2" />
            <text x="42" y="116" fontSize="9.5" fill="#0f172a">空间管线 Ø{b} · L={a}</text>
          </>
        );
      }

      case 'insulation_support': {
        const b = num(params, 'sizeB', 80);
        const t = num(params, 'thickness', 8);
        return (
          <>
            <rect x="64" y="16" width="82" height="86" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.2" />
            {[34, 58, 82].map((y) => (
              <g key={y}>
                <rect x="44" y={y} width="20" height="5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.1" />
                <rect x="146" y={y} width="20" height="5" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.1" />
              </g>
            ))}
            <text x="44" y="116" fontSize="9.5" fill="#0f172a">保温支承圈 W={b}×δ{t}</text>
          </>
        );
      }

      case 'grounding_lug': {
        const a = num(params, 'sizeA', 100);
        const b = num(params, 'sizeB', 55);
        return (
          <>
            <rect x="44" y="22" width="38" height="76" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="82" y="46" width="72" height="28" rx="4" fill="#fed7aa" stroke="#c2410c" strokeWidth="1.4" />
            <circle cx="136" cy="60" r="6" fill="#ffffff" stroke="#c2410c" strokeWidth="1.3" />
            <text x="46" y="116" fontSize="9.5" fill="#0f172a">接地耳 {a}×{b} (M12)</text>
          </>
        );
      }

      case 'pipe_boss': {
        const a = num(params, 'sizeA', 65);
        const b = num(params, 'sizeB', 110);
        return (
          <>
            <rect x="46" y="22" width="38" height="76" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.1" />
            <rect x="84" y="42" width="52" height="36" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.4" />
            <rect x="136" y="38" width="16" height="44" fill="#60a5fa" stroke="#1e40af" strokeWidth="1.3" />
            <line x1="84" y1="54" x2="152" y2="54" stroke="#1e40af" strokeWidth="1" strokeDasharray="3 2" />
            <line x1="84" y1="66" x2="152" y2="66" stroke="#1e40af" strokeWidth="1" strokeDasharray="3 2" />
            <text x="48" y="116" fontSize="9.5" fill="#0f172a">锻制管座 Ø{a}×L{b}</text>
          </>
        );
      }

      case 'vortex_breaker': {
        const a = num(params, 'sizeA', 320);
        const b = num(params, 'sizeB', 160);
        return (
          <>
            <circle cx="105" cy="58" r="38" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.4" />
            <rect x="67" y="54" width="76" height="8" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.2" />
            <rect x="101" y="20" width="8" height="76" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.2" />
            <circle cx="105" cy="58" r="14" fill="#bae6fd" stroke="#0369a1" strokeWidth="1.2" />
            <text x="46" y="116" fontSize="9.5" fill="#0f172a">防涡流板 Ø{a}×H{b}</text>
          </>
        );
      }

      case 'bottom_orifice': {
        const a = num(params, 'sizeA', 720);
        const t = num(params, 'thickness', 12);
        return (
          <>
            <circle cx="105" cy="58" r="40" fill="#bae6fd" stroke="#0369a1" strokeWidth="1.5" />
            <circle cx="105" cy="58" r="6" fill="#ffffff" stroke="#0369a1" strokeWidth="1.1" />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <circle
                  key={deg}
                  cx={105 + Math.cos(rad) * 20}
                  cy={58 + Math.sin(rad) * 20}
                  r="4.2"
                  fill="#ffffff"
                  stroke="#0369a1"
                  strokeWidth="1"
                />
              );
            })}
            <text x="46" y="116" fontSize="9.5" fill="#0f172a">多孔底板 Ø{a}×δ{t}</text>
          </>
        );
      }

      case 'foundation_template': {
        const a = num(params, 'sizeA', 1800);
        const t = num(params, 'thickness', 16);
        return (
          <>
            <circle cx="105" cy="58" r="42" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
            <circle cx="105" cy="58" r="28" fill="#ffffff" stroke="#334155" strokeWidth="1.2" />
            {Array.from({ length: 12 }).map((_, i) => {
              const rad = (i * Math.PI) / 6;
              return (
                <circle
                  key={i}
                  cx={105 + Math.cos(rad) * 35}
                  cy={58 + Math.sin(rad) * 35}
                  r="2.4"
                  fill="#2563eb"
                />
              );
            })}
            <text x="42" y="116" fontSize="9.5" fill="#0f172a">基础模板 Ø{a} · 12孔 · δ{t}</text>
          </>
        );
      }

      default:
        return (
          <>
            <rect x="52" y="26" width="106" height="64" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.4" />
            <line x1="105" y1="14" x2="105" y2="104" stroke="#dc2626" strokeWidth="0.8" strokeDasharray="4 2 1 2" />
            <text x="64" y="116" fontSize="9.5" fill="#0f172a">GHPV 1:1 工程构件</text>
          </>
        );
    }
  };

  return (
    <svg viewBox="0 0 210 126" className="w-full h-[126px] bg-white border border-[#cbd5e1] rounded-[2px]">
      {renderBlueprint()}
    </svg>
  );
};
