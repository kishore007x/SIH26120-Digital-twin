// Static technical representation shown when WebGL is unavailable.
import { useTwin } from '../../store/twinStore';
import { loadColor } from '../../lib/format';

export function TwinFallback2D() {
  const s = useTwin((st) => st.computed.sample);
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#eef1f4] p-4">
      <div className="mb-2 rounded-[2px] border border-[#ebcf94] bg-warn-bg px-2 py-1 text-[11px] font-semibold text-warn">WEBGL UNAVAILABLE — STATIC TECHNICAL REPRESENTATION</div>
      <svg viewBox="0 0 520 360" className="h-full max-h-[520px] w-full max-w-[760px]">
        <line x1="10" y1="300" x2="510" y2="300" stroke="#8a857b" strokeWidth="2" />
        <rect x="60" y="288" width="300" height="12" fill="#3a3f45" />
        <path d="M200 288 L240 90 L280 288" fill="none" stroke="#2f5f9e" strokeWidth="8" />
        <rect x="110" y="78" width="280" height="18" fill="#2f5f9e" transform="rotate(-4 240 87)" />
        <path d="M385 60 A 60 60 0 0 1 400 150 L 375 150 L 372 70 Z" fill="#2f5f9e" />
        <line x1="400" y1="110" x2="400" y2="230" stroke="#2a2f35" strokeWidth="2" />
        <line x1="400" y1="230" x2="400" y2="300" stroke={loadColor(s.rodLoad)} strokeWidth="5" />
        <rect x="388" y="270" width="24" height="30" fill="#6b7782" />
        <circle cx="120" cy="230" r="40" fill="#2d3136" />
        <line x1="120" y1="230" x2="130" y2="100" stroke="#244b7e" strokeWidth="7" />
        <rect x="85" y="195" width="70" height="60" fill="#5f7489" />
        <text x="400" y="330" fontSize="12" textAnchor="middle" fill="#1d242b">Rod load {s.rodLoad.toFixed(0)}%</text>
        <text x="120" y="330" fontSize="12" textAnchor="middle" fill="#1d242b">{s.spm.toFixed(1)} SPM</text>
        <text x="260" y="30" fontSize="12" textAnchor="middle" fill="#1d242b">
          T {s.temperature.toFixed(1)} °C · μ {s.viscosity.toFixed(0)} cP
        </text>
      </svg>
    </div>
  );
}
