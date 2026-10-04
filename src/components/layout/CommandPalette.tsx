import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { useUiPrefs } from '../../store/uiPrefs';
import { useTwin } from '../../store/twinStore';
import { ALL_NAV, WELL_NAV } from '../../lib/navConfig';
import { dataSource } from '../../services/dataSource';

interface Hit {
  id: string;
  label: string;
  hint: string;
  group: string;
  to: string;
}

/** Ctrl+K / "/" quick search over pages and wells. */
export function CommandPalette() {
  const open = useUiPrefs((s) => s.paletteOpen);
  const setOpen = useUiPrefs((s) => s.setPaletteOpen);
  const wellId = useTwin((s) => s.wellId);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUiPrefs.getState().paletteOpen);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const all = useMemo<Hit[]>(() => {
    const pages = ALL_NAV.map((n) => ({ id: n.key, label: n.label, hint: n.desc, group: 'Pages', to: n.path(wellId) }));
    const wellPages = WELL_NAV.map((n, i) => ({ id: 'w-' + n.key, label: `${i + 1}. ${n.label} — ${wellId}`, hint: n.desc, group: `Well ${wellId}`, to: n.path(wellId) }));
    const wells = dataSource.listWells().map((w) => ({ id: w.id, label: `${w.id} — open digital twin`, hint: `${w.status === "AT_RISK" ? "at risk" : w.status.toLowerCase()} · ${w.pad} · ${w.cssCycle}`, group: 'Wells', to: `/well/${w.id}` }));
    return [...pages, ...wellPages, ...wells];
  }, [wellId]);

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((h) => h.group !== 'Wells').concat(all.filter((h) => h.id === 'W-17' || h.id === 'W-19'));
    const words = s.split(/\s+/);
    return all.filter((h) => words.every((w) => (h.label + ' ' + h.hint + ' ' + h.group).toLowerCase().includes(w))).slice(0, 30);
  }, [q, all]);

  if (!open) return null;
  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    nav(h.to);
  };
  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#2b0e09]/45 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="glass-strong reveal w-full max-w-[620px] overflow-hidden rounded-2xl" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search size={18} className="text-ind-600" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((v) => Math.min(hits.length - 1, v + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((v) => Math.max(0, v - 1));
              } else if (e.key === 'Enter') go(hits[sel]);
              else if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search pages or wells — e.g. “safety”, “W-19”, “tanks”"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            aria-label="Search pages and wells"
          />
          <kbd className="rounded border border-line bg-white/70 px-1.5 text-[11px] text-ink-3">Esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {hits.length === 0 && <li className="p-4 text-center text-[13px] text-ink-3">No matching page or well.</li>}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup;
            lastGroup = h.group;
            return (
              <li key={h.group + h.id}>
                {head && <div className="px-2 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.12em] text-ink-3 uppercase">{h.group}</div>}
                <button
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? 'bg-ind-600 text-white' : 'text-ink hover:bg-white/60'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{h.label}</span>
                    <span className={`block truncate text-[11.5px] ${i === sel ? 'text-white/80' : 'text-ink-3'}`}>{h.hint}</span>
                  </span>
                  {i === sel && <CornerDownLeft size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-3">
          <span>↑ ↓ move</span>
          <span>Enter open</span>
          <span>Ctrl K or / to search from any page</span>
        </div>
      </div>
    </div>
  );
}
