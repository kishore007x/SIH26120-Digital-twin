// Live equipment callouts and depth annotations anchored in the 3D scene.
import { useTwin } from '../../store/twinStore';
import type { Linkage } from './kinematics';
import { loadColor } from '../../lib/format';
import { LabelLayer, type LabelDef } from './labels';
import { DOWNHOLE } from './models/WellSystem';

function Tag({ title, value, color, warn }: { title: string; value?: string; color?: string; warn?: boolean }) {
  return (
    <div className={`-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[2px] border bg-white/92 px-1.5 py-0.5 text-[10px] leading-tight shadow-sm ${warn ? 'border-[#e0a24a]' : 'border-[#c6ced6]'}`}>
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

export function EquipmentOverlay({ L, wellX, anchors, surface, downhole }: { L: Linkage; wellX: number; anchors: { motor: V3; gearbox: V3 }; surface: boolean; downhole: boolean }) {
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
    const depth = (t: string) => <div className="-translate-y-1/2 whitespace-nowrap rounded-[2px] bg-white/85 px-1 text-[10px] text-ink-2 shadow-sm">{t}</div>;
    labels.push(
      { id: 'd0', pos: [wellX + 1.2, -0.2, 0.2], content: depth('Surface · 0 m') },
      { id: 'd1', pos: [wellX + 1.2, -6.5, 0.2], content: depth('~350 m') },
      { id: 'd2', pos: [wellX + 1.2, DOWNHOLE.pumpTop, 0.2], content: depth(`Pump seat ~850 m · fillage ${s.pumpFillage.toFixed(0)}%`) },
      { id: 'd3', pos: [wellX + 1.2, DOWNHOLE.resTop - 1.2, 0.2], content: depth(`CSS-heated reservoir · ${s.temperature.toFixed(1)} °C · ${s.viscosity.toFixed(0)} cP`) },
      { id: 'd4', pos: [wellX - 9, DOWNHOLE.bottom + 0.4, 0.2], content: <div className="text-[10px] font-semibold tracking-wider whitespace-nowrap text-white/90">DEPTH-COMPRESSED SCHEMATIC</div> },
    );
  }
  return <LabelLayer labels={labels} />;
}
