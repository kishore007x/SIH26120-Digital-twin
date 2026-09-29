import { useTwin } from '../../store/twinStore';
import { fmtSimTime } from '../../lib/format';

function UnitGlyph() {
  // Generic pumping-unit glyph (not an organisational logo)
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-10" aria-hidden>
      <rect x="0.5" y="0.5" width="39" height="31" rx="2" fill="#16305a" stroke="#3b5f93" />
      <path d="M6 26h28" stroke="#9fb3c8" strokeWidth="1.6" />
      <path d="M17 26l4-12 4 12" stroke="#c9d5e1" strokeWidth="1.6" fill="none" />
      <path d="M8 13.5l24-5" stroke="#e4eaf0" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 7.5c2.2.6 3.2 2.6 3 5" stroke="#e4eaf0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M34 12.5v10" stroke="#9fb3c8" strokeWidth="1" />
      <circle cx="11" cy="21" r="3" fill="none" stroke="#9fb3c8" strokeWidth="1.4" />
    </svg>
  );
}

export function Header() {
  const simTime = useTwin((s) => s.simTime);
  const mode = useTwin((s) => s.controlMode);
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-navy-950 bg-navy-900 px-4 text-white">
      <UnitGlyph />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold tracking-[0.08em]">BAGHEWALA FIELD DIGITAL TWIN</div>
        <div className="truncate text-[10.5px] tracking-[0.18em] text-steel-300">WELL-TO-SURFACE OPTIMIZATION PLATFORM · CSS + SRP</div>
      </div>
      <div className="ml-auto flex items-stretch gap-0 text-[11px]">
        <HeaderCell label="SYSTEM">
          <span className="flex items-center gap-1.5 font-semibold text-[#8fd19e]">
            <span className="pulse inline-block h-2 w-2 rounded-full bg-[#5cc274]" /> ONLINE
          </span>
        </HeaderCell>
        <HeaderCell label="CONTROL">
          <span className={`font-semibold ${mode === 'AUTO' ? 'text-[#8fd19e]' : 'text-[#9fc1e6]'}`}>{mode === 'AUTO' ? 'AUTO · SUPERVISED' : 'ADVISORY'}</span>
        </HeaderCell>
        <HeaderCell label="MODE">
          <span className="font-semibold text-[#f0c877]">DEMONSTRATION</span>
        </HeaderCell>
        <HeaderCell label="DATA">
          <span className="font-semibold text-steel-200">DEMONSTRATION SIMULATION</span>
        </HeaderCell>
        <HeaderCell label="SIMULATED TIME (IST)">
          <span className="num font-semibold text-white">{fmtSimTime(simTime)}</span>
        </HeaderCell>
      </div>
    </header>
  );
}

function HeaderCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hidden flex-col justify-center border-l border-navy-700 px-3 first:border-l-0 md:flex">
      <span className="text-[9px] tracking-[0.14em] text-steel-400">{label}</span>
      {children}
    </div>
  );
}
