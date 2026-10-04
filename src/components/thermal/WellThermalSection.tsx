import { memo, useMemo, useState } from 'react';
import { useTwin } from '../../store/twinStore';
import { hybridTemperature } from '../../services/thermalModel';
import { THERMAL } from '../../services/modelConfig';
import { PROFILE, THERMAL_GRADIENT_CSS, THERMAL_SCALE, fluidTemperature, geothermal, isothermRadius, radialTemperature, thermalCss, wellProfile } from '../../services/thermalProfile';

const HORIZONS = [
  { h: 0, label: 'Now' },
  { h: 24, label: '+24 h' },
  { h: 48, label: '+48 h' },
  { h: 168, label: '+7 d' },
];

/** Well thermal view: depth profile of the produced fluid + radial heat map of the CSS heated zone. */
export function WellThermalSection() {
  const cal = useTwin((s) => s.cal);
  const h = useTwin((s) => s.h);
  const cooling = useTwin((s) => s.coolingDeclared);
  const tNow = useTwin((s) => Math.round(s.computed.sample.temperature * 10) / 10);
  const oil = useTwin((s) => Math.round(s.computed.sample.oil));
  const [sel, setSel] = useState(0);
  const horizon = HORIZONS[sel].h;
  const tNear = horizon === 0 ? tNow : cooling ? hybridTemperature(cal.tPlateau, Math.max(0, h) + horizon) : cal.tPlateau;
  const tHead = fluidTemperature(0, tNear, oil);
  const r60 = isothermRadius(60, tNear);
  const heatLeft = Math.max(0, Math.min(1, (tNear - THERMAL.tReservoir) / (cal.tPlateau - THERMAL.tReservoir)));

  return (
    <div className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="label">Time</span>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Forecast time">
          {HORIZONS.map((x, i) => (
            <button key={x.label} onClick={() => setSel(i)} aria-pressed={sel === i} className={`px-2.5 py-1 text-[11.5px] font-semibold ${sel === i ? 'bg-ind-600 text-white' : 'bg-white/80 text-ink-2 hover:bg-white'}`}>
              {x.label}
            </button>
          ))}
        </div>
        {!cooling && horizon > 0 && <span className="text-[11px] text-ink-3">Plateau assumed — cooling not yet declared.</span>}
        <div className="ml-auto flex flex-wrap gap-2 text-[11.5px]">
          <Fact k="Wellhead" v={`${tHead.toFixed(0)} °C`} />
          <Fact k="Pump intake" v={`${tNear.toFixed(1)} °C`} />
          <Fact k="Zone ≥ 60 °C" v={r60 > 0 && Number.isFinite(r60) ? `${r60.toFixed(1)} m` : 'none'} />
          <Fact k="CSS heat left" v={`${(heatLeft * 100).toFixed(0)} %`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <DepthProfile tNear={tNear} oil={oil} />
        <RadialMap tNear={tNear} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-2">
          <span className="num">{THERMAL_SCALE.min} °C</span>
          <span className="inline-block h-2.5 w-44 rounded-full" style={{ background: THERMAL_GRADIENT_CSS }} aria-hidden />
          <span className="num">{THERMAL_SCALE.max} °C</span>
        </span>
        <span>
          Simplified model for visualisation: geothermal {PROFILE.gradient * 100} °C/100 m, Ramey-type heat loss in tubing, Gaussian CSS heated zone (R ≈ {PROFILE.heatedRadiusM} m). Not a reservoir simulator.
        </span>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="glass-tag">
      {k} <b className="num text-navy-900">{v}</b>
    </span>
  );
}

const DepthProfile = memo(function DepthProfile({ tNear, oil }: { tNear: number; oil: number }) {
  const W = 360,
    H = 300,
    L = 44,
    R = 12,
    T = 12,
    B = 30;
  const zMax = 900;
  const x = (t: number) => L + ((t - 20) / (95 - 20)) * (W - L - R);
  const y = (z: number) => T + (z / zMax) * (H - T - B);
  const prof = wellProfile(tNear, oil, 20);
  const fluid = prof.map((p) => `${x(p.fluid).toFixed(1)},${y(p.z).toFixed(1)}`).join(' ');
  const ground = prof.map((p) => `${x(p.ground).toFixed(1)},${y(p.z).toFixed(1)}`).join(' ');
  const head = fluidTemperature(0, tNear, oil);
  return (
    <figure className="rounded-xl border border-line/70 bg-white/60 p-2">
      <figcaption className="label mb-1">Temperature vs depth (produced fluid in tubing)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Fluid temperature ${head.toFixed(0)} °C at the wellhead, ${tNear.toFixed(0)} °C at the pump`}>
        <rect x={L} y={y(PROFILE.resTopM)} width={W - L - R} height={y(PROFILE.resBottomM) - y(PROFILE.resTopM)} fill="#e8d3b0" opacity={0.7} />
        <text x={W - R - 4} y={y(PROFILE.resTopM) - 3} textAnchor="end" fontSize="9.5" fill="#7a5a2a">
          heavy-oil reservoir
        </text>
        {[0, 200, 400, 600, 800].map((z) => (
          <g key={z}>
            <line x1={L} x2={W - R} y1={y(z)} y2={y(z)} stroke="#eadfce" />
            <text x={L - 5} y={y(z) + 3} textAnchor="end" fontSize="9.5" fill="#56616c" className="num">
              {z}
            </text>
          </g>
        ))}
        {[30, 45, 60, 75, 90].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="#f3e9dc" />
            <text x={x(t)} y={H - B + 13} textAnchor="middle" fontSize="9.5" fill="#56616c" className="num">
              {t}
            </text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize="10" fill="#3d4650">
          temperature (°C)
        </text>
        <text x={11} y={(T + H - B) / 2} textAnchor="middle" fontSize="10" fill="#3d4650" transform={`rotate(-90 11 ${(T + H - B) / 2})`}>
          depth (m)
        </text>
        <polyline points={ground} fill="none" stroke="#8a939c" strokeWidth="1.5" strokeDasharray="5 4" />
        <polyline points={fluid} fill="none" stroke="#a8401a" strokeWidth="2.5" />
        {prof
          .filter((_, i) => i % 3 === 0)
          .map((p) => (
            <circle key={p.z} cx={x(p.fluid)} cy={y(p.z)} r="3.2" fill={thermalCss(p.fluid)} stroke="#fff" strokeWidth="0.8" />
          ))}
        <line x1={L} x2={W - R} y1={y(PROFILE.pumpDepthM)} y2={y(PROFILE.pumpDepthM)} stroke="#1d242b" strokeDasharray="3 3" />
        <text x={L + 4} y={y(PROFILE.pumpDepthM) - 3} fontSize="9.5" fill="#1d242b">
          pump ~{PROFILE.pumpDepthM} m · {tNear.toFixed(0)} °C
        </text>
        <text x={x(head) + 6} y={y(0) + 12} fontSize="9.5" fill="#1d242b">
          wellhead {head.toFixed(0)} °C
        </text>
        <g transform={`translate(${W - R - 128} ${T + 70})`} fontSize="9.5">
          <rect width="124" height="34" rx="5" fill="#fff" opacity="0.85" />
          <line x1="8" x2="26" y1="11" y2="11" stroke="#a8401a" strokeWidth="2.5" />
          <text x="31" y="14" fill="#3d4650">
            produced fluid
          </text>
          <line x1="8" x2="26" y1="25" y2="25" stroke="#8a939c" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="31" y="28" fill="#3d4650">
            undisturbed ground
          </text>
        </g>
      </svg>
    </figure>
  );
});

const RadialMap = memo(function RadialMap({ tNear }: { tNear: number }) {
  const W = 480,
    H = 300,
    L = 30,
    R = 10,
    T = 12,
    B = 30;
  const rMax = 40,
    z0 = 830,
    z1 = 905;
  const x = (r: number) => L + ((r + rMax) / (2 * rMax)) * (W - L - R);
  const y = (z: number) => T + ((z - z0) / (z1 - z0)) * (H - T - B);
  const cells = useMemo(() => {
    const nx = 64,
      nz = 30;
    const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const dx = (2 * rMax) / nx,
      dz = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const r = Math.abs(-rMax + (i + 0.5) * dx);
        const z = z0 + (j + 0.5) * dz;
        const inRes = z >= PROFILE.resTopM && z <= PROFILE.resBottomM;
        const excess = radialTemperature(r, tNear) - THERMAL.tReservoir;
        const dOut = inRes ? 0 : z < PROFILE.resTopM ? PROFILE.resTopM - z : z - PROFILE.resBottomM;
        const t = geothermal(z) + excess * Math.exp(-((dOut / 6) ** 2));
        out.push({ x: x(-rMax + i * dx), y: y(z0 + j * dz), w: (W - L - R) / nx + 0.6, h: (H - T - B) / nz + 0.6, c: thermalCss(t) });
      }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tNear]);
  const isos = [50, 60, 70].map((t) => ({ t, r: isothermRadius(t, tNear) })).filter((i) => i.r > 0 && i.r < rMax);
  return (
    <figure className="rounded-xl border border-line/70 bg-white/60 p-2">
      <figcaption className="label mb-1">CSS heated zone around the wellbore (vertical section through the reservoir)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Heated zone: ${isos.map((i) => `${i.t} °C out to ${i.r.toFixed(1)} m`).join(', ') || 'no zone above 50 °C'}`}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={c.c} />
        ))}
        <line x1={L} x2={W - R} y1={y(PROFILE.resTopM)} y2={y(PROFILE.resTopM)} stroke="#fff" strokeOpacity="0.8" />
        <line x1={L} x2={W - R} y1={y(PROFILE.resBottomM)} y2={y(PROFILE.resBottomM)} stroke="#fff" strokeOpacity="0.8" />
        <text x={L + 4} y={y(PROFILE.resTopM) - 4} fontSize="9.5" fill="#fff">
          cap rock
        </text>
        <text x={L + 4} y={y(PROFILE.resTopM) + 12} fontSize="9.5" fill="#fff" fontWeight="600">
          reservoir ({PROFILE.resTopM}–{PROFILE.resBottomM} m)
        </text>
        {isos.map((i) => (
          <g key={i.t}>
            {[-1, 1].map((s) => (
              <line key={s} x1={x(s * i.r)} x2={x(s * i.r)} y1={y(PROFILE.resTopM)} y2={y(PROFILE.resBottomM)} stroke="#fff" strokeWidth="1.2" strokeDasharray="4 3" />
            ))}
            <text x={x(i.r) + 3} y={y(PROFILE.resBottomM) - 4 - (i.t - 50) / 2} fontSize="9.5" fill="#fff" fontWeight="600" className="num">
              {i.t} °C
            </text>
          </g>
        ))}
        <rect x={x(0) - 2.5} y={T} width="5" height={y(PROFILE.resBottomM) - T} fill="#2c3238" />
        <text x={x(0) + 6} y={T + 10} fontSize="9.5" fill="#fff" fontWeight="600">
          wellbore
        </text>
        {[-40, -20, 0, 20, 40].map((r) => (
          <text key={r} x={x(r)} y={H - B + 13} textAnchor="middle" fontSize="9.5" fill="#56616c" className="num">
            {Math.abs(r)}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize="10" fill="#3d4650">
          distance from well (m)
        </text>
      </svg>
    </figure>
  );
});
