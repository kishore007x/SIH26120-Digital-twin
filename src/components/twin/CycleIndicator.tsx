import { useEffect, useRef, useState } from 'react';
import { rig } from './rig';
import { useTwin } from '../../store/twinStore';

/** Pumping-cycle HUD: stroke direction, rod position, crank angle, period. */
export function CycleIndicator() {
  const spm = useTwin((s) => s.spm);
  const playing = useTwin((s) => s.animationPlaying);
  const [st, setSt] = useState({ frac: 0, up: true, crank: 0, strokes: 0 });
  const prev = useRef(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 90 && rig.state) {
        last = t;
        const frac = rig.state.rodFrac;
        const up = frac >= prev.current;
        prev.current = frac;
        setSt({ frac, up, crank: ((((rig.theta * 180) / Math.PI) % 360) + 360) % 360, strokes: rig.strokesCompleted });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-3 rounded-[3px] border border-[#c6ced6] bg-white/92 px-3 py-2 text-[11px] shadow-sm">
      <div className="flex h-[58px] w-3 flex-col justify-end rounded-[1px] bg-[#e3e8ed]" title="Polished rod position">
        <div className="w-full rounded-[1px] bg-ind-500" style={{ height: `${Math.max(3, st.frac * 100)}%` }} />
      </div>
      <div className="leading-tight">
        <div className="label">Pumping cycle</div>
        <div className="num text-[15px] font-semibold text-navy-900">
          {spm.toFixed(1)} <span className="text-[11px] font-normal text-ink-3">strokes/min</span>
        </div>
        <div className="num text-ink-2">period {(60 / Math.max(spm, 0.1)).toFixed(2)} s · crank {st.crank.toFixed(0)}°</div>
        <div className={`font-semibold ${playing ? (st.up ? 'text-ok' : 'text-ind-600') : 'text-ink-3'}`}>{playing ? (st.up ? '▲ UPSTROKE (lifting fluid)' : '▼ DOWNSTROKE') : '■ ANIMATION PAUSED'}</div>
      </div>
    </div>
  );
}
