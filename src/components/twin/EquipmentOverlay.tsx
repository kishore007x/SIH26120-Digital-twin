// Live equipment callouts and depth annotations anchored in the 3D scene.
import { useTwin } from '../../store/twinStore';
import type { Linkage } from './kinematics';
import { loadColor } from '../../lib/format';
import { LabelLayer, type LabelDef } from './labels';
import { DOWNHOLE } from './models/WellSystem';
import { depthToSceneY, dynamicFluidLevelM, sceneYToDepth } from './models/DownholeDetail';
import { PROFILE, fluidTemperature, isothermRadius, thermalCss } from '../../services/thermalProfile';

function Tag({ title, value, color, warn }: { title: string; value?: string; color?: string; warn?: boolean }) {
  return (
    <div className={`-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[2px] border bg-white/92 px-1.5 py-0.5 text-[10px] leading-tight shadow-sm ${warn ? 'border-[#e0a24a]' : 'border-[#dccab5]'}`}>
      <div className="font-semibold tracking-wide text-navy-800 uppercase">{title}</div>
      {value && (
        <div className="num font-semibold" style={{ color: color ?? '#1d242b' }}>
          {value}
        </div>
      )}
    </div>
  );
}

type V3 = [number, number, number];

export function EquipmentOverlay({ L, wellX, anchors, surface, downhole, thermal = false }: { L: Linkage; wellX: number; anchors: { motor: V3; gearbox: V3 }; surface: boolean; downhole: boolean; thermal?: boolean }) {
  const s = useTwin((st) => st.computed.sample);
  const risk = useTwin((st) => st.computed.risk);
  const pred = useTwin((st) => st.computed.forecast.rodLoadCurrentSpm.value);
  const high = risk === 'HIGH' || risk === 'CRITICAL';
  const labels: LabelDef[] = [];
  if (surface) {
    labels.push(
      { id: 'hh', pos: [wellX + 0.2, L.O[1] + 1.25, 0], content: <Tag title="Horsehead" /> },
      { id: 'beam', pos: [L.O[0] - 1.2, L.O[1] + 1.05, 0], content: <Tag title="Walking beam" value={`${s.spm.toFixed(1)} SPM`} /> },
      { id: 'gear', pos: anchors.gearbox, content: <Tag title="Gear reducer" value={`${s.torque.toFixed(1)} kN·m`} color={s.torque > 38 ? '#b3261e' : undefined} /> },
      { id: 'motor', pos: anchors.motor, content: <Tag title="Motor / VFD" value={`${s.vfd.toFixed(0)} Hz`} /> },
      {
        id: 'prl',
        pos: [wellX + 0.15, 2.2, 0.25],
        content: <Tag title="Polished rod load" value={`${s.rodLoad.toFixed(0)}% · +24h ${pred.toFixed(0)}%`} color={loadColor(Math.max(s.rodLoad, pred))} warn={high} />,
      },
    );
  }
  if (downhole) {
    const tick = (t: string) => <div className="-translate-y-1/2 whitespace-nowrap rounded-[3px] bg-white/85 px-1 text-[10px] font-semibold text-ink-2 shadow-sm num">{t}</div>;
    const call = (t: string, v?: string, accent?: string) => (
      <div className="-translate-x-full -translate-y-1/2 pr-1">
        <div className="flex items-center gap-1 whitespace-nowrap rounded-[3px] border bg-white/92 px-1.5 py-0.5 text-[10px] leading-tight shadow-sm" style={{ borderColor: accent ?? '#dccab5' }}>
          <span className="font-semibold tracking-wide text-navy-800 uppercase">{t}</span>
          {v && <span className="num font-semibold text-ink">{v}</span>}
        </div>
      </div>
    );
    for (const m of [0, 200, 400, 600, 800]) labels.push({ id: `dt${m}`, pos: [wellX + 1.3, depthToSceneY(m), 0.2], content: tick(`${m} m`), declutter: 'none' });
    const lvl = dynamicFluidLevelM(s.pumpFillage);
    labels.push(
      { id: 'dshoe', pos: [wellX - 0.45, -4.02, 0.2], content: call('Surface casing shoe', `~${sceneYToDepth(-4.02).toFixed(0)} m`) },
      { id: 'dlvl', pos: [wellX - 0.3, depthToSceneY(lvl), 0.2], content: call('Dynamic fluid level', `~${lvl.toFixed(0)} m · sim.`, '#e2b13c'), priority: 5 },
      { id: 'danc', pos: [wellX - 0.3, DOWNHOLE.pumpTop + 0.9, 0.2], content: call('Tubing anchor') },
      { id: 'dpump', pos: [wellX - 0.3, DOWNHOLE.pumpTop - 1.1, 0.2], content: call('Rod pump · barrel + plunger', `fillage ${s.pumpFillage.toFixed(0)}%`, s.pumpFillage < 82 ? '#d08a2a' : undefined), priority: 6 },
      { id: 'dperf', pos: [wellX - 1.0, DOWNHOLE.resTop - 1.4, 0.2], content: call('Perforations', `${PROFILE.resTopM + 2}–${PROFILE.resBottomM - 5} m`) },
      { id: 'dres', pos: [wellX - 5.5, DOWNHOLE.resTop - 0.6, 0.2], content: call(thermal ? 'CSS heated zone' : 'Heavy-oil reservoir', `${s.temperature.toFixed(1)} °C · ${s.viscosity.toFixed(0)} cP`), priority: 4 },
      { id: 'd4', pos: [wellX - 9, DOWNHOLE.bottom + 0.4, 0.2], content: <div className="text-[10px] font-semibold tracking-wider whitespace-nowrap text-white/90">DEPTH-COMPRESSED SCHEMATIC</div>, declutter: 'none' },
    );
    if (thermal) {
      const head = fluidTemperature(0, s.temperature, s.oil);
      const r60 = isothermRadius(60, s.temperature);
      labels.push(
        { id: 'thead', pos: [wellX + 0.2, -0.6, 0.2], content: <Tag title="Fluid at wellhead" value={`${head.toFixed(0)} °C`} color={thermalCss(head)} />, priority: 8 },
        { id: 'tint', pos: [wellX + 0.25, DOWNHOLE.pumpTop - 0.2, 0.2], content: <Tag title="Pump intake" value={`${s.temperature.toFixed(1)} °C`} color={thermalCss(s.temperature)} />, priority: 8 },
        {
          id: 'tzone',
          pos: [wellX + 5, DOWNHOLE.resBottom + 0.2, 0.2],
          content: <Tag title="Zone ≥ 60 °C" value={r60 > 0 && Number.isFinite(r60) ? `r ≈ ${r60.toFixed(1)} m` : 'cooled below 60 °C'} />,
          priority: 7,
        },
      );
    }
  }
  return <LabelLayer labels={labels} />;
}
