import React from 'react';

interface IconProps {
  className?: string;
}

export const GhLogo: React.FC = () => (
  <div className="flex items-center justify-center w-6 h-5 rounded-[2px] bg-[#d92d20] text-white font-bold text-[12px] tracking-tighter leading-none shadow-xs select-none">
    GH
  </div>
);

export const TechSpecIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="4" y="4" width="24" height="24" rx="2" fill="#e6f2fa" stroke="#3b82b6" strokeWidth="1.5" />
    <rect x="4" y="4" width="24" height="6" rx="1" fill="#3b82b6" />
    <line x1="7" y1="14" x2="25" y2="14" stroke="#64748b" strokeWidth="1.2" />
    <line x1="7" y1="19" x2="25" y2="19" stroke="#64748b" strokeWidth="1.2" />
    <line x1="7" y1="24" x2="25" y2="24" stroke="#64748b" strokeWidth="1.2" />
    <line x1="14" y1="10" x2="14" y2="28" stroke="#94a3b8" strokeWidth="1" />
  </svg>
);

export const ShellIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <defs>
      <linearGradient id="cylGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0e7490" />
        <stop offset="35%" stopColor="#67e8f9" />
        <stop offset="70%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#164e63" />
      </linearGradient>
    </defs>
    <path d="M8 8v16c0 2.2 3.6 4 8 4s8-1.8 8-4V8H8z" fill="url(#cylGrad)" stroke="#155e75" strokeWidth="1.2" />
    <ellipse cx="16" cy="8" rx="8" ry="3.5" fill="#a5f3fc" stroke="#155e75" strokeWidth="1.2" />
    <ellipse cx="16" cy="8" rx="5.5" ry="2" fill="#0e7490" />
  </svg>
);

export const EllipticalHeadIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <defs>
      <radialGradient id="headGrad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#a5f3fc" />
        <stop offset="55%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#164e63" />
      </radialGradient>
    </defs>
    <path d="M5 17C5 9.5 10 6 16 6s11 3.5 11 11v5H5v-5z" fill="url(#headGrad)" stroke="#155e75" strokeWidth="1.2" />
    <ellipse cx="16" cy="22" rx="11" ry="3.5" fill="#155e75" stroke="#083344" strokeWidth="1" />
    <ellipse cx="16" cy="22" rx="8.5" ry="2.2" fill="#cffafe" />
  </svg>
);

export const SphericalHeadIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M5 20a11 11 0 0 1 22 0H5z" fill="#0ea5a4" stroke="#115e59" strokeWidth="1.2" />
    <ellipse cx="16" cy="20" rx="11" ry="3.5" fill="#99f6e4" stroke="#115e59" strokeWidth="1.1" />
  </svg>
);

export const ConeIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M11 7h10l6 17c0 2-4.9 3.5-11 3.5S5 26 5 24l6-17z" fill="#0891b2" stroke="#164e63" strokeWidth="1.2" />
    <ellipse cx="16" cy="7" rx="5" ry="2" fill="#a5f3fc" stroke="#164e63" strokeWidth="1.1" />
  </svg>
);

export const EquipmentFlangeIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <ellipse cx="16" cy="18" rx="12" ry="6" fill="#0e7490" stroke="#164e63" strokeWidth="1.2" />
    <ellipse cx="16" cy="16" rx="12" ry="5.5" fill="#67e8f9" stroke="#155e75" strokeWidth="1.1" />
    <ellipse cx="16" cy="15" rx="6.5" ry="3" fill="#0891b2" stroke="#155e75" strokeWidth="1" />
    <circle cx="8" cy="16" r="1.2" fill="#164e63" />
    <circle cx="24" cy="16" r="1.2" fill="#164e63" />
    <circle cx="16" cy="11.8" r="1.2" fill="#164e63" />
    <circle cx="16" cy="20.2" r="1.2" fill="#164e63" />
  </svg>
);

export const GasketIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <ellipse cx="16" cy="16" rx="11" ry="6.5" fill="#14b8a6" stroke="#0f766e" strokeWidth="1.3" />
    <ellipse cx="16" cy="16" rx="7" ry="3.8" fill="#f3f4f6" stroke="#0f766e" strokeWidth="1.2" />
  </svg>
);

export const BootShellIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="4" y="14" width="24" height="10" rx="5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.2" />
    <rect x="13" y="6" width="6" height="9" rx="2" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.1" />
  </svg>
);

export const SkirtIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M9 6h14l2 18H7L9 6z" fill="#0891b2" stroke="#164e63" strokeWidth="1.2" />
    <ellipse cx="16" cy="24" rx="11" ry="3.2" fill="#67e8f9" stroke="#164e63" strokeWidth="1.2" />
    <ellipse cx="16" cy="6" rx="7" ry="2.2" fill="#a5f3fc" stroke="#164e63" strokeWidth="1.1" />
  </svg>
);

export const TubeSheetIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="11" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.3" />
    {[
      [12, 12], [16, 12], [20, 12],
      [10, 16], [14, 16], [18, 16], [22, 16],
      [12, 20], [16, 20], [20, 20],
    ].map(([cx, cy], idx) => (
      <circle key={idx} cx={cx} cy={cy} r="1.4" fill="#0c4a6e" />
    ))}
  </svg>
);

export const UTubeIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M6 10h13a6 6 0 0 1 0 12H6" stroke="#0284c7" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M6 13.5h12a2.5 2.5 0 0 1 0 5H6" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    <rect x="4" y="8" width="3.5" height="16" fill="#0f766e" />
  </svg>
);

export const ExpansionJointIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M5 10c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4 2-4 4-4 2 4 2 4v12s0 4-2 4-2-4-4-4-2 4-4 4-2-4-4-4-2 4-4 4-2-4-4-4V10z" fill="#22d3ee" stroke="#0e7490" strokeWidth="1.2" />
  </svg>
);

export const NozzleFlangeIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M9 6h6v12h11v6H9V6z" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.2" />
    <rect x="7" y="4" width="10" height="3" rx="0.5" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1" />
    <rect x="25" y="16" width="3" height="10" rx="0.5" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1" />
  </svg>
);

export const SaddleIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M5 10c2.5 5 6.5 7 11 7s8.5-2 11-7v15H5V10z" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.2" />
    <rect x="3.5" y="24" width="25" height="3" fill="#0369a1" stroke="#0c4a6e" strokeWidth="1" />
  </svg>
);

export const LugIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="6" y="6" width="4" height="20" fill="#0369a1" />
    <path d="M10 8l14 10v6H10V8z" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.2" />
    <rect x="10" y="22" width="16" height="3" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1" />
  </svg>
);

export const LegIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M12 5h8v19h-8V5z" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.2" />
    <rect x="8" y="24" width="16" height="3.5" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.1" />
  </svg>
);

export const RingIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="11" stroke="#0284c7" strokeWidth="4" fill="none" />
    <circle cx="16" cy="16" r="11" stroke="#0c4a6e" strokeWidth="1" fill="none" />
  </svg>
);

export const TrayIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <ellipse cx="16" cy="11" rx="10" ry="3.5" fill="#67e8f9" stroke="#0e7490" strokeWidth="1.2" />
    <ellipse cx="16" cy="17" rx="10" ry="3.5" fill="#22d3ee" stroke="#0e7490" strokeWidth="1.2" />
    <ellipse cx="16" cy="23" rx="10" ry="3.5" fill="#0891b2" stroke="#164e63" strokeWidth="1.2" />
  </svg>
);

export const DavitIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M11 26V7h14" stroke="#0284c7" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 15l8-8" stroke="#0369a1" strokeWidth="2" />
    <circle cx="24" cy="11" r="2" fill="#0c4a6e" />
  </svg>
);

export const CadOutputIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#dc2626" />
    <path d="M16 7l8.5 18h-4.2l-1.8-4.2h-5L11.7 25H7.5L16 7zm0 7.2l-1.6 3.8h3.2L16 14.2z" fill="#ffffff" />
  </svg>
);

export const ExcelOutputIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="4" y="4" width="24" height="24" rx="3" fill="#15803d" />
    <rect x="16" y="7" width="9" height="18" rx="1" fill="#22c55e" fillOpacity="0.45" />
    <path d="M10 10l6 12M16 10l-6 12" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const SwOutputIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="3" y="3" width="26" height="26" rx="3" fill="#e11d48" />
    <text x="16" y="21" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800" fontFamily="sans-serif">
      SW
    </text>
  </svg>
);

export const WizardIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="4" y="5" width="24" height="22" rx="2.5" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.4" />
    <path d="M9 12h14M9 17h10M9 22h7" stroke="#0369a1" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M22 17l4 4-4 4v-8z" fill="#0284c7" />
  </svg>
);

export const MaterialLibIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="5" y="5" width="7" height="22" rx="1" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1.1" />
    <rect x="13" y="7" width="7" height="20" rx="1" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.1" />
    <rect x="21" y="9" width="6" height="18" rx="1" fill="#93c5fd" stroke="#0c4a6e" strokeWidth="1.1" />
  </svg>
);

export const BatchNozzleIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="4" y="13" width="24" height="10" rx="4" fill="#bae6fd" stroke="#0369a1" strokeWidth="1.2" />
    <path d="M10 13V7M16 13V6M22 13V7" stroke="#0284c7" strokeWidth="2.4" />
    <path d="M7.5 7h5M13.5 6h5M19.5 7h5" stroke="#0c4a6e" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const SphereTankIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="14" r="9.5" fill="#eab308" fillOpacity="0.82" stroke="#854d0e" strokeWidth="1.3" />
    <ellipse cx="16" cy="14" rx="9.5" ry="3.2" stroke="#4d7c0f" strokeWidth="1" />
    <ellipse cx="16" cy="14" rx="3.8" ry="9.5" stroke="#4d7c0f" strokeWidth="1" />
    <line x1="9" y1="19" x2="8" y2="28" stroke="#713f12" strokeWidth="2" />
    <line x1="23" y1="19" x2="24" y2="28" stroke="#713f12" strokeWidth="2" />
    <line x1="16" y1="23" x2="16" y2="28" stroke="#713f12" strokeWidth="2" />
  </svg>
);

export const SphereColumnIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="7" y="6" width="4" height="21" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1" />
    <rect x="21" y="6" width="4" height="21" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1" />
    <line x1="11" y1="10" x2="21" y2="22" stroke="#0369a1" strokeWidth="1.5" />
    <line x1="21" y1="10" x2="11" y2="22" stroke="#0369a1" strokeWidth="1.5" />
    <rect x="5" y="25" width="8" height="2.5" fill="#0c4a6e" />
    <rect x="19" y="25" width="8" height="2.5" fill="#0c4a6e" />
  </svg>
);

export const LadderPlatformIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="5" y="10" width="22" height="3" fill="#0284c7" stroke="#0c4a6e" strokeWidth="1" />
    <line x1="6" y1="5" x2="26" y2="5" stroke="#0369a1" strokeWidth="1.3" />
    <line x1="7" y1="5" x2="7" y2="10" stroke="#0369a1" strokeWidth="1.2" />
    <line x1="16" y1="5" x2="16" y2="10" stroke="#0369a1" strokeWidth="1.2" />
    <line x1="25" y1="5" x2="25" y2="10" stroke="#0369a1" strokeWidth="1.2" />
    <line x1="19" y1="13" x2="19" y2="28" stroke="#0c4a6e" strokeWidth="1.8" />
    <line x1="25" y1="13" x2="25" y2="28" stroke="#0c4a6e" strokeWidth="1.8" />
    <line x1="19" y1="17" x2="25" y2="17" stroke="#0c4a6e" strokeWidth="1.4" />
    <line x1="19" y1="21" x2="25" y2="21" stroke="#0c4a6e" strokeWidth="1.4" />
    <line x1="19" y1="25" x2="25" y2="25" stroke="#0c4a6e" strokeWidth="1.4" />
  </svg>
);

export const CostIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#d97706" />
    <text x="16" y="22" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="800" fontFamily="sans-serif">
      ¥
    </text>
  </svg>
);

export const PdmsIcon: React.FC<IconProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#2563eb" />
    <text x="16" y="20" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="sans-serif">
      PDMS
    </text>
  </svg>
);

export const ClashCheckIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="13" cy="17" r="7.5" fill="#fef3c7" stroke="#d97706" strokeWidth="1.6" />
    <circle cx="20" cy="14" r="7.5" fill="#fee2e2" fillOpacity="0.82" stroke="#dc2626" strokeWidth="1.6" />
    <path d="M16.5 11.5v5M16.5 18.8v1" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AiModelIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <rect x="3" y="4" width="26" height="24" rx="4" fill="#1d4ed8" />
    <text x="16" y="19.5" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="800" fontFamily="sans-serif">
      AI
    </text>
    <path d="M7 23.5h18" stroke="#93c5fd" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const BkuReboilerIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <path d="M3 16h7l4-6h13a3 3 0 0 1 0 13H3v-7z" fill="#f59e0b" fillOpacity="0.85" stroke="#92400e" strokeWidth="1.3" />
    <path d="M9 17.5h13a2 2 0 0 1 0 4H9" stroke="#6d28d9" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="17" y1="12" x2="17" y2="23" stroke="#7c3aed" strokeWidth="1.2" />
    <line x1="22" y1="12" x2="22" y2="23" stroke="#7c3aed" strokeWidth="1.2" />
  </svg>
);

export const CubeViewIcon: React.FC<{ face: 'fit' | 'front' | 'top' | 'left' | 'back' | 'right' | 'bottom' | 'iso' }> = ({
  face,
}) => {
  const fillFace = (f: string) => (face === f ? '#2563eb' : '#e2e8f0');
  if (face === 'fit') {
    return (
      <svg viewBox="0 0 22 22" className="w-5 h-5" fill="none">
        <rect x="3" y="4" width="12" height="12" rx="1" fill="#bfdbfe" stroke="#1d4ed8" strokeWidth="1.2" />
        <circle cx="14" cy="13" r="4.5" fill="#ffffff" stroke="#1e40af" strokeWidth="1.5" />
        <line x1="17.2" y1="16.2" x2="20" y2="19" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 22 22" className="w-5 h-5" fill="none">
      {/* Top */}
      <polygon points="11,3 18,6.5 11,10 4,6.5" fill={face === 'top' || face === 'iso' ? '#3b82f6' : fillFace('top')} stroke="#334155" strokeWidth="1" />
      {/* Left */}
      <polygon points="4,6.5 11,10 11,18 4,14.5" fill={face === 'left' || face === 'front' ? '#2563eb' : face === 'back' ? '#93c5fd' : '#cbd5e1'} stroke="#334155" strokeWidth="1" />
      {/* Right */}
      <polygon points="18,6.5 11,10 11,18 18,14.5" fill={face === 'right' || face === 'bottom' ? '#1d4ed8' : face === 'iso' ? '#60a5fa' : '#f1f5f9'} stroke="#334155" strokeWidth="1" />
    </svg>
  );
};
