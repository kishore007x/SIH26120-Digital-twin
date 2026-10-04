import type { ReactNode } from 'react';
import type { HealthLevel, Provenance, RiskLevel } from '../../types';
import { healthTone, riskTone, type Tone } from '../../lib/format';

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok border-[#b9d5bf]',
  warn: 'bg-warn-bg text-warn border-[#ebcf94]',
  crit: 'bg-crit-bg text-crit border-[#e3aca7]',
  info: 'bg-steel-100 text-ind-600 border-steel-200',
  neutral: 'bg-[#f3eadf] text-ink-3 border-line',
};

export function Badge({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-[1px] text-[10.5px] font-semibold tracking-wide uppercase ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export const RiskBadge = ({ risk }: { risk: RiskLevel }) => <Badge tone={riskTone(risk)}>{risk}</Badge>;
export const HealthBadge = ({ health }: { health: HealthLevel }) => <Badge tone={healthTone(health)}>{health}</Badge>;

const PROV: Record<Provenance, string> = {
  SIMULATED: 'text-steel-500 border-steel-300',
  OBSERVED: 'text-steel-600 border-steel-300 bg-steel-100',
  PREDICTED: 'text-ind-600 border-ind-400 bg-[#fbece0]',
  CONFIGURED: 'text-ink-3 border-line bg-[#f7efe5]',
  REFERENCE: 'text-warn border-[#ebcf94] bg-warn-bg',
};

/** Small provenance tag – makes clear what is simulated, predicted, configured. */
export function Prov({ kind, label }: { kind: Provenance; label?: string }) {
  return <span className={`inline-block rounded-[2px] border px-1 text-[9px] leading-[14px] font-semibold tracking-wider uppercase ${PROV[kind]}`}>{label ?? kind}</span>;
}

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClass = '',
  icon,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={`panel flex min-w-0 flex-col ${className}`}>
      <header className="panel-head">
        {icon}
        <span className="min-w-0 leading-snug">{title}</span>
        <span className="ml-auto flex items-center gap-1.5 normal-case tracking-normal font-normal">{right}</span>
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function KV({ k, v, unit, tone, sub }: { k: ReactNode; v: ReactNode; unit?: string; tone?: Tone; sub?: ReactNode }) {
  const color = tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#f3eadf] py-[5px] last:border-b-0">
      <span className="text-[12px] text-ink-2">{k}</span>
      <span className="text-right">
        <span className={`num text-[13px] font-semibold ${color}`}>{v}</span>
        {unit && <span className="ml-1 text-[11px] text-ink-3">{unit}</span>}
        {sub && <div className="text-[10.5px] text-ink-3">{sub}</div>}
      </span>
    </div>
  );
}

const ACCENT: Record<Tone, string> = { ok: '#3f7d4e', warn: '#c98a12', crit: '#b3261e', info: '#2d64a8', neutral: '#c7ae98' };
const TONE_WORD: Partial<Record<Tone, string>> = { ok: 'OK', warn: 'Watch', crit: 'Action' };

/** KPI cell for strips — coloured accent + large figure so status reads at a glance. */
export function Stat({ label, value, unit, tone, sub, prov }: { label: string; value: ReactNode; unit?: string; tone?: Tone; sub?: ReactNode; prov?: Provenance }) {
  const color = tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-navy-900';
  return (
    <div className="relative min-w-0 border-r border-line/70 py-2.5 pr-3 pl-4 last:border-r-0">
      <span className="absolute top-2.5 bottom-2.5 left-1.5 w-[4px] rounded-full" style={{ background: ACCENT[tone ?? 'neutral'] }} aria-hidden />
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="label leading-tight">{label}</span>
        {prov && <Prov kind={prov} />}
        {tone && TONE_WORD[tone] && (
          <span className="ml-auto rounded-full px-1.5 text-[9.5px] font-bold tracking-wide uppercase" style={{ color: ACCENT[tone], background: `${ACCENT[tone]}1a` }}>
            {TONE_WORD[tone]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`num text-[24px] leading-7 font-bold ${color}`}>{value}</span>
        {unit && <span className="text-[12px] font-medium text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

export function StatStrip({ children, cols }: { children: ReactNode; cols: number }) {
  return (
    <div className="panel stat-strip grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <div>
        <h1 className="text-[17px] font-semibold tracking-wide text-navy-900 uppercase">{title}</h1>
        {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  const cls = tone === 'warn' ? 'border-[#ebcf94] bg-warn-bg text-[#7a5212]' : tone === 'ok' ? 'border-[#b9d5bf] bg-ok-bg text-[#2d5a38]' : tone === 'crit' ? 'border-[#e3aca7] bg-crit-bg text-crit' : 'border-steel-200 bg-[#eef3f8] text-steel-600';
  return <div className={`rounded-[3px] border px-3 py-2 text-[12px] ${cls}`}>{children}</div>;
}

export function Bar({ value, max = 100, color, marks = [] }: { value: number; max?: number; color: string; marks?: { at: number; color: string }[] }) {
  return (
    <div className="relative h-2 w-full rounded-[1px] bg-[#efe4d6]">
      <div className="absolute inset-y-0 left-0 rounded-[1px] transition-[width] duration-300" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      {marks.map((m) => (
        <div key={m.at} className="absolute -top-0.5 -bottom-0.5 w-[2px]" style={{ left: `${(m.at / max) * 100}%`, background: m.color }} />
      ))}
    </div>
  );
}
