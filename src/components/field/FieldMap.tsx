import { memo, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GATHERING_STATION, PADS } from '../../data/wells';
import type { Well } from '../../types';
import { STATUS_COLOR, STATUS_LABEL, f0, loadColor } from '../../lib/format';
import type { WellDisplay } from './useLiveWell';
import { HealthBadge, RiskBadge } from '../common/ui';
import { WellMarker } from './WellMarker';

const W = 1000;
const H = 600;

const LEASE = 'M110,95 L420,70 L720,110 L880,215 L870,420 L760,520 L470,540 L230,500 L130,380 L90,230 Z';

function Terrain() {
  // Stylised dune contours (schematic, Thar desert setting)
  const dunes = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 14; i++) {
      const y = 40 + i * 42;
      const off = (i % 3) * 37;
      out.push(`M${-20 + off},${y} C${140 + off},${y - 18} ${260 + off},${y + 16} ${420 + off},${y - 4} S${700 + off},${y + 14} ${1040},${y - 8}`);
    }
    return out;
  }, []);
  return (
    <g>
      {dunes.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e1d9c6" strokeWidth={1} opacity={0.7} />
      ))}
    </g>
  );
}

function Grid() {
  const cols = 'ABCDEFGHIJ'.split('');
  return (
    <g>
      {cols.map((c, i) => (
        <g key={c}>
          <line x1={i * 100} y1={0} x2={i * 100} y2={H} stroke="#d9dde0" strokeWidth={0.6} />
          <text x={i * 100 + 50} y={12} fontSize={9} fill="#9aa3ab" textAnchor="middle" fontFamily="IBM Plex Mono">
            {c}
          </text>
        </g>
      ))}
      {Array.from({ length: 6 }, (_, j) => (
        <g key={j}>
          <line x1={0} y1={j * 100} x2={W} y2={j * 100} stroke="#d9dde0" strokeWidth={0.6} />
          <text x={6} y={j * 100 + 54} fontSize={9} fill="#9aa3ab" fontFamily="IBM Plex Mono">
            {j + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

const Static = memo(function Static({ wells }: { wells: Well[] }) {
  const padActive = (id: string) => wells.some((w) => w.pad === id && (w.status === 'PRODUCING' || w.status === 'AT_RISK'));
  return (
    <g>
      <rect width={W} height={H} fill="#f6f3ea" />
      <Terrain />
      <Grid />
      <path d={LEASE} fill="rgba(31,78,140,0.035)" stroke="#a8401a" strokeWidth={1.4} strokeDasharray="8 5" />
      <text x={430} y={92} fontSize={10} fill="#a8401a" fontWeight={600} letterSpacing={1.5}>
        BAGHEWALA FIELD AREA (SCHEMATIC)
      </text>
      {/* roads */}
      <path d="M0,560 L300,520 L540,470 L540,320 L980,250" fill="none" stroke="#b9b2a0" strokeWidth={5} />
      <path d="M0,560 L300,520 L540,470 L540,320 L980,250" fill="none" stroke="#f6f3ea" strokeWidth={1} strokeDasharray="10 8" />
      <text x={880} y={244} fontSize={9} fill="#8b8472" transform="rotate(-9 880 244)">
        to Jaisalmer road (schematic)
      </text>
      {/* flowlines */}
      {PADS.map((p) => (
        <g key={p.id}>
          <line x1={p.x} y1={p.y} x2={GATHERING_STATION.x} y2={GATHERING_STATION.y} stroke="#8fb0d6" strokeWidth={2.2} />
          {padActive(p.id) && <line className="flow" x1={p.x} y1={p.y} x2={GATHERING_STATION.x} y2={GATHERING_STATION.y} stroke="#a8401a" strokeWidth={1.2} />}
        </g>
      ))}
      {/* pads */}
      {PADS.map((p) => (
        <g key={p.id}>
          <rect x={p.x - 58} y={p.y - 48} width={116} height={96} rx={4} fill="rgba(255,255,255,0.55)" stroke="#c4bca6" strokeWidth={1} />
          <text x={p.x - 52} y={p.y - 36} fontSize={9} fill="#7c7462" fontWeight={600} letterSpacing={1}>
            PAD {p.id}
          </text>
        </g>
      ))}
      {/* gathering station */}
      <g transform={`translate(${GATHERING_STATION.x},${GATHERING_STATION.y})`}>
        <rect x={-20} y={-14} width={40} height={28} fill="#5a2112" stroke="#2b0e09" />
        <circle cx={-8} cy={0} r={5} fill="none" stroke="#c7ae98" strokeWidth={1.4} />
        <circle cx={8} cy={0} r={5} fill="none" stroke="#c7ae98" strokeWidth={1.4} />
        <text x={0} y={27} fontSize={9.5} fill="#5a2112" textAnchor="middle" fontWeight={600}>
          {GATHERING_STATION.label}
        </text>
      </g>
      {/* north arrow + scale */}
      <g transform="translate(948,540)">
        <path d="M0,-26 L8,4 L0,-2 L-8,4 Z" fill="#5a2112" />
        <text x={0} y={18} fontSize={10} textAnchor="middle" fill="#5a2112" fontWeight={700}>
          N
        </text>
      </g>
      <g transform="translate(40,572)">
        <rect width={50} height={5} fill="#5a2112" />
        <rect x={50} width={50} height={5} fill="#fff" stroke="#5a2112" strokeWidth={0.8} />
        <text x={0} y={17} fontSize={9} fill="#5c656e">
          SCHEMATIC — NOT TO SCALE · NOT GIS
        </text>
      </g>
    </g>
  );
});

export function FieldMap({ wells, displays, selectedId, focusId, onFocus }: { wells: Well[]; displays: Record<string, WellDisplay>; selectedId: string; focusId?: string | null; onFocus?: (id: string | null) => void }) {
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ well: Well; x: number; y: number } | null>(null);

  const onHover = (well: Well | null, e?: React.MouseEvent) => {
    if (!well || !e || !box.current) return setHover(null);
    const r = box.current.getBoundingClientRect();
    setHover({ well, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const d = hover ? displays[hover.well.id] : null;
  const producing = hover && (hover.well.status === 'PRODUCING' || hover.well.status === 'AT_RISK');

  return (
    <div ref={box} className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
        <Static wells={wells} />
        {wells.map((w) => (
          <WellMarker
            key={w.id}
            well={w}
            risk={displays[w.id].risk}
            selected={w.id === (focusId ?? selectedId)}
            onEnter={(e) => onHover(w, e)}
            onLeave={() => onHover(null)}
            onClick={() => (onFocus ? onFocus(w.id) : nav(`/well/${w.id}`))}
          />
        ))}
      </svg>
      {hover && d && (
        <div
          className="pointer-events-none absolute z-10 w-[210px] rounded-[3px] border border-navy-700 bg-white text-[11.5px] shadow-lg"
          style={{ left: Math.min(hover.x + 14, (box.current?.clientWidth ?? 800) - 220), top: Math.max(4, hover.y - 20) }}
        >
          <div className="flex items-center justify-between bg-navy-900 px-2.5 py-1.5 text-white">
            <span className="font-semibold tracking-wider">{hover.well.id}</span>
            <span className="flex items-center gap-1 text-[10px] text-steel-200">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[hover.well.status] }} />
              {STATUS_LABEL[hover.well.status].toUpperCase()}
            </span>
          </div>
          <div className="px-2.5 py-1.5">
            {producing ? (
              <table className="w-full">
                <tbody className="[&_td]:py-[2px]">
                  <Row k="Production" v={`${f0(d.production)} BOPD`} />
                  <Row k="Temperature" v={`${d.temperature.toFixed(1)} °C`} />
                  <Row k="Viscosity" v={`${f0(d.viscosity)} cP`} />
                  <Row k="SPM" v={d.spm.toFixed(1)} />
                  <Row k="Rod load" v={<span style={{ color: loadColor(d.rodLoad) }}>{f0(d.rodLoad)} %</span>} />
                  <tr>
                    <td className="text-ink-3">Health / Risk</td>
                    <td className="text-right">
                      <HealthBadge health={d.health} /> <RiskBadge risk={d.risk} />
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="py-1 text-ink-3">{hover.well.status === 'MAINTENANCE' ? 'Workover / pump maintenance in progress.' : 'Shut-in. No production.'}</div>
            )}
            <div className="mt-1 border-t border-line pt-1 text-[10px] text-ink-3">
              Pad {hover.well.pad} · {hover.well.cssCycle} · {d.live ? 'LIVE TWIN (simulated)' : 'demonstration snapshot'} · click to open
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr>
      <td className="text-ink-3">{k}</td>
      <td className="num text-right font-semibold">{v}</td>
    </tr>
  );
}
