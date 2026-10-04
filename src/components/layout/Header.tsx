import { Contrast, Search } from 'lucide-react';
import { useTwin } from '../../store/twinStore';
import { useUiPrefs, type FontScale } from '../../store/uiPrefs';
import { fmtSimTime } from '../../lib/format';

function UnitGlyph() {
  // Generic pumping-unit glyph (not an organisational logo or emblem)
  return (
    <svg viewBox="0 0 40 32" className="h-9 w-11 shrink-0 drop-shadow sm:h-11 sm:w-14" aria-hidden>
      <defs>
        <linearGradient id="gly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8401a" />
          <stop offset="1" stopColor="#3f160e" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="31" rx="6" fill="url(#gly)" stroke="#e8871e" strokeWidth="0.8" />
      <path d="M6 26h28" stroke="#c7ae98" strokeWidth="1.6" />
      <path d="M17 26l4-12 4 12" stroke="#f1dcc4" strokeWidth="1.6" fill="none" />
      <path d="M8 13.5l24-5" stroke="#f3c77a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M31 7.5c2.2.6 3.2 2.6 3 5" stroke="#f3c77a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M34 12.5v10" stroke="#c7ae98" strokeWidth="1" />
      <circle cx="11" cy="21" r="3" fill="none" stroke="#c7ae98" strokeWidth="1.4" />
    </svg>
  );
}

/** Thin accessibility / utility strip, as on public-sector portals. */
export function UtilityBar() {
  const { fontScale, setFontScale, contrast, setContrast } = useUiPrefs();
  const sizes: { s: FontScale; label: string; name: string }[] = [
    { s: 0.9, label: 'A-', name: 'Decrease text size' },
    { s: 1, label: 'A', name: 'Normal text size' },
    { s: 1.1, label: 'A+', name: 'Increase text size' },
    { s: 1.2, label: 'A++', name: 'Largest text size' },
  ];
  return (
    <div className="util-bar">
      <div className="mx-auto flex h-full max-w-[1920px] items-center gap-3 px-4">
        <span className="hidden min-w-0 truncate xl:inline">
          <b className="text-[#f3c77a]">DEMONSTRATION PROTOTYPE</b> · simulated data · not an official system of any government body or company
        </span>
        <span className="min-w-0 truncate xl:hidden">
          <b className="text-[#f3c77a]">DEMONSTRATION</b> · simulated data
        </span>
        <div className="ml-auto flex items-center gap-1">
          <a href="#main-content" className="util-link">
            Skip to main content
          </a>
          <span className="mx-1 h-3 w-px bg-white/25" />
          <span className="sr-only">Text size</span>
          {sizes.map((z) => (
            <button key={z.s} aria-label={z.name} aria-pressed={fontScale === z.s} onClick={() => setFontScale(z.s)} className={`util-btn ${fontScale === z.s ? 'util-btn-on' : ''}`}>
              {z.label}
            </button>
          ))}
          <span className="mx-1 h-3 w-px bg-white/25" />
          <button aria-pressed={contrast === 'high'} onClick={() => setContrast(contrast === 'high' ? 'normal' : 'high')} className={`util-btn gap-1 ${contrast === 'high' ? 'util-btn-on' : ''}`} title="Toggle high-contrast mode">
            <Contrast size={12} /> <span className="hidden md:inline">High contrast</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const simTime = useTwin((s) => s.simTime);
  const mode = useTwin((s) => s.controlMode);
  const comms = useTwin((s) => s.edge.commsOnline);
  const openPalette = useUiPrefs((s) => s.setPaletteOpen);
  return (
    <header className="masthead">
      <div className="mx-auto flex h-full max-w-[1920px] items-center gap-3 px-4">
        <UnitGlyph />
        <div className="min-w-0 leading-tight">
          <div className="font-hi truncate text-[12.5px] font-medium text-[#f3c77a]" lang="hi">
            बाघेवाला क्षेत्र डिजिटल ट्विन
          </div>
          <div className="truncate text-[15px] font-bold tracking-[0.02em] text-white sm:text-[18px]">BAGHEWALA FIELD DIGITAL TWIN</div>
          <div className="hidden truncate text-[11px] font-medium tracking-[0.08em] text-[#f1dcc4] min-[1380px]:block">WELL-TO-SURFACE OPTIMIZATION PLATFORM · CSS + SRP · HEAVY OIL</div>
        </div>

        <button onClick={() => openPalette(true)} className="search-pill ml-auto" aria-label="Search pages and wells (Ctrl+K)">
          <Search size={15} />
          <span className="hidden whitespace-nowrap min-[1380px]:inline">Search pages, wells…</span>
          <kbd className="hidden whitespace-nowrap min-[1380px]:inline">Ctrl K</kbd>
        </button>

        <div className="hidden shrink-0 items-stretch gap-2 lg:flex">
          <Chip label="Simulator" wide dot="#5cc274" pulse>
            Running
          </Chip>
          <Chip label="Control" dot={!comms ? '#ff8a7a' : mode === 'AUTO' ? '#5cc274' : '#f6c177'}>
            {!comms ? 'Local pump-off' : mode === 'AUTO' ? 'Auto · supervised' : 'Advisory'}
          </Chip>
          <Chip label="Data source" wide dot="#f3c77a">
            Simulated
          </Chip>
          <Chip label="Sim. time · IST">
            <span className="num">{fmtSimTime(simTime)}</span>
          </Chip>
        </div>
      </div>
    </header>
  );
}

function Chip({ label, children, wide, dot, pulse }: { label: string; children: React.ReactNode; wide?: boolean; dot?: string; pulse?: boolean }) {
  return (
    <div className={`glass-chip ${wide ? 'hidden min-[1380px]:flex' : ''}`}>
      <span className="text-[10px] font-medium tracking-[0.06em] text-[#e2c6a8] uppercase">{label}</span>
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
        {dot && <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${pulse ? 'pulse' : ''}`} style={{ background: dot }} aria-hidden />}
        {children}
      </span>
    </div>
  );
}
