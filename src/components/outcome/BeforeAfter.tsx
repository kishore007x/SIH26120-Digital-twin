import type { OutcomeRecord } from '../../store/twinStore';
import { Prov, RiskBadge } from '../common/ui';
import { loadColor } from '../../lib/format';
import { vfdForSpm } from '../../services/srpModel';

export function BeforeAfter({ o }: { o: OutcomeRecord }) {
  const approved = o.decision === 'APPROVED';
  const rows: { k: string; unit: string; before: string; noAct: string; pred: string; obs: string; color?: (v: number) => string; nums?: number[] }[] = [
    { k: 'SPM', unit: 'spm', before: o.before.spm.toFixed(0), noAct: o.before.spm.toFixed(0), pred: o.appliedSpm.toFixed(0), obs: o.observedAfter.spm.toFixed(1) },
    { k: 'VFD', unit: 'Hz', before: o.before.vfd.toFixed(0), noAct: o.before.vfd.toFixed(0), pred: vfdForSpm(o.appliedSpm).toFixed(0), obs: o.observedAfter.vfd.toFixed(0) },
    { k: 'Rod load', unit: '%', before: `${o.before.rodLoad.toFixed(0)} now`, noAct: o.noAction.rodLoad.toFixed(0), pred: o.predictedAfter.rodLoad.toFixed(0), obs: o.observedAfter.rodLoad.toFixed(0), color: loadColor, nums: [o.before.rodLoadPred, o.noAction.rodLoad, o.predictedAfter.rodLoad, o.observedAfter.rodLoad] },
    { k: 'Production', unit: 'BOPD', before: o.before.oil.toFixed(1), noAct: o.noAction.oil.toFixed(1), pred: o.predictedAfter.oil.toFixed(1), obs: o.observedAfter.oil.toFixed(1) },
    { k: 'Pump fillage', unit: '%', before: o.before.fillage.toFixed(0), noAct: o.noAction.fillage.toFixed(0), pred: o.predictedAfter.fillage.toFixed(0), obs: o.observedAfter.fillage.toFixed(0) },
    { k: 'Peak torque', unit: 'kN·m', before: o.before.torque.toFixed(1), noAct: o.noAction.torque.toFixed(1), pred: '—', obs: o.observedAfter.torque.toFixed(1) },
    { k: 'Temperature', unit: '°C', before: o.before.temperature.toFixed(1), noAct: o.predictedAfter.temperature.toFixed(1), pred: o.predictedAfter.temperature.toFixed(1), obs: o.observedAfter.temperature.toFixed(1) },
    { k: 'Viscosity', unit: 'cP', before: o.before.viscosity.toFixed(0), noAct: o.predictedAfter.viscosity.toFixed(0), pred: o.predictedAfter.viscosity.toFixed(0), obs: o.observedAfter.viscosity.toFixed(0) },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Parameter</th>
            <th className="text-right">
              Before <span className="font-normal normal-case">(at decision)</span>
            </th>
            <th className="text-right">
              No action <Prov kind="PREDICTED" label="+24 h fcst" />
            </th>
            <th className="text-right">
              {approved ? 'With action' : 'Decision (rejected)'} <Prov kind="PREDICTED" label="+24 h fcst" />
            </th>
            <th className="text-right">
              After <Prov kind="SIMULATED" label="Simulated observed" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="font-medium">
                {r.k} <span className="text-[11px] text-ink-3">({r.unit})</span>
              </td>
              {[r.before, r.noAct, r.pred, r.obs].map((v, i) => (
                <td key={i} className={`num text-right ${i === 3 ? 'font-semibold' : ''}`} style={r.color && r.nums ? { color: r.color(r.nums[i]) } : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="font-medium">Risk</td>
            <td className="text-right">
              <RiskBadge risk={o.before.risk} />
            </td>
            <td className="text-right">
              <RiskBadge risk={o.noAction.risk} />
            </td>
            <td className="text-right">
              <RiskBadge risk={o.predictedAfter.risk} />
            </td>
            <td className="text-right">
              <RiskBadge risk={o.observedAfter.risk} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
