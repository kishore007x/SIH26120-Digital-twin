import { useEffect, useState } from 'react';
import { MousePointerClick, X } from 'lucide-react';
import { COMPONENT_INFO, rig, type ComponentKey } from './rig';
import { useTwin } from '../../store/twinStore';
import { KV, Panel, Prov } from '../common/ui';
import { SAFETY_LIMITS, SRP } from '../../services/modelConfig';
import { loadColor } from '../../lib/format';

function useRigPoll() {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  return rig.state;
}

export function ComponentInspector({ selected, onClear }: { selected: ComponentKey | null; onClear: () => void }) {
  const c = useTwin((s) => s.computed);
  const st = useRigPoll();
  const x = c.sample;
  if (!selected)
    return (
      <Panel title="Component inspector" icon={<MousePointerClick size={13} />}>
        <div className="p-3 text-[12px] text-ink-3">Click any equipment in the 3D view (walking beam, gearbox, polished rod, pump, reservoir…) to inspect its live simulated parameters.</div>
      </Panel>
    );
  const info = COMPONENT_INFO[selected];
  const beta = st ? (st.beta * 180) / Math.PI : 0;
  const crank = st ? (((st.theta * 180) / Math.PI) % 360 + 360) % 360 : 0;
  const rows: React.ReactNode[] = [];
  switch (selected) {
    case 'beam':
    case 'horsehead':
    case 'equalizer':
      rows.push(<KV key="b" k="Beam angle" v={beta.toFixed(1)} unit="°" />, <KV key="s" k="Pumping speed" v={x.spm.toFixed(1)} unit="SPM" />, <KV key="st" k="Stroke length" v={x.stroke.toFixed(1)} unit="m" />);
      break;
    case 'crank':
    case 'pitman':
      rows.push(<KV key="c" k="Crank angle" v={crank.toFixed(0)} unit="°" />, <KV key="t" k="Peak gearbox torque" v={x.torque.toFixed(1)} unit="kN·m" />, <KV key="s" k="Speed" v={x.spm.toFixed(1)} unit="SPM" />);
      break;
    case 'gearbox':
      rows.push(
        <KV key="t" k="Peak torque" v={x.torque.toFixed(1)} unit="kN·m" tone={x.torque > SAFETY_LIMITS.warnTorque ? 'crit' : undefined} />,
        <KV key="r" k="Rating (configured)" v={SAFETY_LIMITS.maxTorque} unit="kN·m" />,
        <KV key="u" k="Utilisation" v={((x.torque / SAFETY_LIMITS.maxTorque) * 100).toFixed(0)} unit="%" />,
      );
      break;
    case 'motor':
      rows.push(<KV key="v" k="VFD frequency" v={x.vfd.toFixed(1)} unit="Hz" />, <KV key="s" k="Resulting speed" v={x.spm.toFixed(1)} unit="SPM" />, <KV key="m" k="VFD map (configured)" v={`Hz = ${SRP.vfdA}·SPM + ${SRP.vfdB}`} />);
      break;
    case 'bridle':
    case 'polishedRod':
    case 'rodString':
    case 'sampson':
    case 'base':
      rows.push(
        <KV key="l" k="Rod load (PPRL)" v={<span style={{ color: loadColor(x.rodLoad) }}>{x.rodLoad.toFixed(1)}</span>} unit="%" />,
        <KV key="k" k="PPRL" v={((x.rodLoad / 100) * SRP.ratedLoadKN).toFixed(1)} unit="kN" />,
        <KV key="p" k="Predicted +24 h" v={<span style={{ color: loadColor(c.forecast.rodLoadCurrentSpm.value) }}>{c.forecast.rodLoadCurrentSpm.value.toFixed(1)}</span>} unit="%" />,
        <KV key="d" k="Rod position" v={st ? `${(st.rodFrac * 100).toFixed(0)}` : '—'} unit="% of stroke" />,
      );
      break;
    case 'wellhead':
      rows.push(<KV key="w" k="Wellhead pressure" v={x.whp.toFixed(1)} unit="bar" />, <KV key="o" k="Oil rate" v={x.oil.toFixed(1)} unit="BOPD" />, <KV key="l" k="Liquid rate" v={x.liquid.toFixed(1)} unit="BFPD" />);
      break;
    case 'tubing':
    case 'pump':
      rows.push(
        <KV key="f" k="Pump fillage" v={x.pumpFillage.toFixed(0)} unit="%" tone={x.pumpFillage < 82 ? 'warn' : undefined} />,
        <KV key="e" k="Pump efficiency" v={x.pumpEfficiency.toFixed(0)} unit="%" />,
        <KV key="i" k="Pump intake pressure" v={x.pip.toFixed(1)} unit="bar" />,
        <KV key="p" k="Forecast fillage +24 h" v={c.forecast.fillageCurrentSpm.toFixed(0)} unit="%" tone={c.forecast.fillageCurrentSpm < 82 ? 'warn' : undefined} />,
      );
      break;
    case 'wellbore':
    case 'reservoir':
      rows.push(
        <KV key="t" k="Temperature" v={x.temperature.toFixed(1)} unit="°C" />,
        <KV key="v" k="Viscosity" v={x.viscosity.toFixed(0)} unit="cP" />,
        <KV key="s" k="Thermal state" v={c.thermalState} />,
        <KV key="f" k="Forecast +24 h" v={`${c.forecast.temperature.value.toFixed(1)} °C`} />,
      );
      break;
  }
  return (
    <Panel
      title={info.name}
      icon={<MousePointerClick size={13} />}
      right={
        <button className="text-ink-3 hover:text-ink" onClick={onClear} aria-label="Clear selection">
          <X size={13} />
        </button>
      }
    >
      <div className="p-3">
        <div className="mb-2 text-[11.5px] leading-snug text-ink-2">{info.desc}</div>
        {rows}
        <div className="mt-2 flex gap-1">
          <Prov kind="SIMULATED" />
          {selected === 'reservoir' && <Prov kind="PREDICTED" label="Physics-informed" />}
        </div>
      </div>
    </Panel>
  );
}
