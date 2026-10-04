import { ArrowDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface CausalStage {
  key: string;
  title: string;
  arrow?: '↑' | '↓';
  from: ReactNode;
  to: ReactNode;
  detail: string;
  active: boolean;
  tone: 'neutral' | 'warn' | 'crit' | 'action';
}

const TONE = {
  neutral: 'border-steel-300 bg-white',
  warn: 'border-[#e0b25e] bg-[#fffaf0]',
  crit: 'border-[#e0948e] bg-[#fff6f5]',
  action: 'border-ind-500 bg-[#f1f6fc]',
};

export function CausalChain({ stages }: { stages: CausalStage[] }) {
  return (
    <ol className="flex flex-col items-stretch">
      {stages.map((s, i) => (
        <li key={s.key} className="flex flex-col items-center">
          <div className={`grid w-full grid-cols-[28px_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 rounded-[3px] border px-3 py-2 transition-opacity ${s.active ? TONE[s.tone] : 'border-dashed border-line bg-white/50 grayscale'}`}>
            <span className={`num flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${s.active ? 'bg-navy-900 text-white' : 'bg-[#d6dbe0] text-ink-3'}`}>{i + 1}</span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold tracking-wide text-navy-900 uppercase">
                {s.title} {s.arrow && <span className={s.arrow === '↑' ? 'text-crit' : 'text-ind-600'}>{s.arrow}</span>}
              </div>
              <div className="truncate text-[11px] text-ink-3">{s.detail}</div>
            </div>
            <div className="num flex items-center justify-end gap-2 text-[13px] font-semibold">
              <span className="text-ink-2">{s.from}</span>
              <span className="text-ink-3">→</span>
              <span className="text-navy-900">{s.to}</span>
            </div>
          </div>
          {i < stages.length - 1 && <ArrowDown size={16} className={`my-0.5 ${stages[i + 1].active ? 'text-navy-800' : 'text-[#c3ccd5]'}`} />}
        </li>
      ))}
    </ol>
  );
}
