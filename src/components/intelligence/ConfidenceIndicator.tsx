import { SAFETY_LIMITS } from '../../services/modelConfig';

export function ConfidenceIndicator({ value, label = 'Model confidence' }: { value: number; label?: string }) {
  const pct = value * 100;
  const ok = value >= SAFETY_LIMITS.minConfidence;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className={`num text-[15px] font-semibold ${ok ? 'text-ok' : 'text-warn'}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="relative mt-1 h-2 rounded-[1px] bg-[#efe4d6]">
        <div className="absolute inset-y-0 left-0 rounded-[1px]" style={{ width: `${pct}%`, background: ok ? '#3f7d4e' : '#b7791f' }} />
        <div className="absolute -top-1 -bottom-1 w-[2px] bg-ink" style={{ left: `${SAFETY_LIMITS.minConfidence * 100}%` }} title="Minimum confidence for recommendations" />
      </div>
      <div className="mt-0.5 text-[10px] text-ink-3">min. {SAFETY_LIMITS.minConfidence * 100}% required for recommendations</div>
    </div>
  );
}
