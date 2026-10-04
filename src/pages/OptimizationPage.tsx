import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Bar as RBar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTwin } from '../store/twinStore';
import { RecommendationPanel } from '../components/intelligence/RecommendationPanel';
import { evaluateCandidates } from '../services/recommendationEngine';
import { Badge, Note, PageTitle, Panel, Prov } from '../components/common/ui';
import { OPTIMIZER } from '../services/modelConfig';
import { AXIS, GRID, SERIES } from '../components/operations/TimeSeriesChart';
import type { CandidateEvaluation } from '../types';

function CandidateChart({ data, chosen, metric, unit, target }: { data: CandidateEvaluation[]; chosen?: number; metric: 'rodLoad' | 'oil'; unit: string; target?: number }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -12 }} barCategoryGap={6}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="spm" tick={AXIS} stroke="#c9d0d6" tickFormatter={(v) => `${v}`} label={{ value: 'SPM', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: '#66707a' }} />
        <YAxis tick={AXIS} stroke="#c9d0d6" domain={metric === 'rodLoad' ? [50, 100] : [0, 'auto']} width={44} />
        <Tooltip isAnimationActive={false} cursor={{ fill: 'rgba(45,100,168,0.06)' }} formatter={(v) => [`${Number(v).toFixed(1)} ${unit}`, metric === 'rodLoad' ? 'Predicted rod load' : 'Predicted oil']} labelFormatter={(l) => `${l} SPM`} contentStyle={{ fontSize: 11, border: '1px solid #dccab5', borderRadius: 3 }} />
        {target !== undefined && <ReferenceLine y={target} stroke="#b7791f" strokeDasharray="4 3" label={{ value: `target ≤ ${target}%`, position: 'insideTopLeft', fontSize: 9.5, fill: '#b7791f' }} />}
        <RBar dataKey={metric} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.spm} fill={d.spm === chosen ? SERIES.s1 : d.feasible ? '#c7ae98' : '#d6dbe0'} />
          ))}
        </RBar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function OptimizationPage() {
  const wellId = useTwin((s) => s.wellId);
  const rec = useTwin((s) => s.recommendation);
  const decision = useTwin((s) => s.scenario.decision);
  const status = useTwin((s) => s.scenario.status);
  const cal = useTwin((s) => s.cal);
  const spm = useTwin((s) => s.spm);
  const stroke = useTwin((s) => s.stroke);
  const fT = useTwin((s) => Math.round(s.computed.forecast.temperature.value * 10) / 10);

  const live = useMemo(() => evaluateCandidates({ cal, nowH: 0, coolingConfirmed: true, spm: Math.round(spm), stroke, timestamp: 0 }, fT), [cal, spm, stroke, fT]);
  const candidates = rec?.candidates ?? live;
  const chosen = rec?.recommendedValue;

  return (
    <div className="p-4">
      <PageTitle
        title={`Optimization — ${wellId}`}
        sub={
          <>
            <b>AI-ASSISTED RECOMMENDATION</b> · constraint-aware optimiser (demonstration) · every recommendation passes the independent safety engine; in <b>AUTO (supervised)</b> mode safe actions execute automatically and the operator can intervene or roll back; in ADVISORY mode each needs approval
          </>
        }
        right={
          rec && (
            <Link to={`/well/${wellId}/safety`} className={`btn ${status === 'AWAITING' ? 'btn-primary' : ''}`}>
              <ShieldCheck size={14} /> SAFETY VALIDATION <ArrowRight size={13} />
            </Link>
          )
        }
      />
      {rec ? (
        <RecommendationPanel rec={rec} applied={decision} />
      ) : (
        <Note>
          No recommendation active. The engine issues a recommendation when the +24 h rod-load forecast at the current operating point exceeds the {OPTIMIZER.targetMaxLoad}% target band (predicted risk HIGH). Below is a live evaluation of candidate SPM settings at the current forecast temperature ({fT.toFixed(1)} °C).
        </Note>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel title="Candidate evaluation — predicted rod load (%)" right={<Prov kind="PREDICTED" />} bodyClass="p-2">
          <CandidateChart data={candidates} chosen={chosen} metric="rodLoad" unit="%" target={OPTIMIZER.targetMaxLoad} />
        </Panel>
        <Panel title="Candidate evaluation — predicted oil rate (BOPD)" right={<Prov kind="PREDICTED" />} bodyClass="p-2">
          <CandidateChart data={candidates} chosen={chosen} metric="oil" unit="BOPD" />
        </Panel>
      </div>

      <Panel title="Optimiser trace" className="mt-3" right={<span className="text-[11px] text-ink-3">objective: maximise predicted oil · s.t. load ≤ {OPTIMIZER.targetMaxLoad}%, torque margin, fillage, step ≤ 3 SPM</span>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>SPM</th>
                <th className="text-right">VFD (Hz)</th>
                <th className="text-right">Rod load (%)</th>
                <th className="text-right">Torque (kN·m)</th>
                <th className="text-right">Fillage (%)</th>
                <th className="text-right">Pump eff. (%)</th>
                <th className="text-right">Oil (BOPD)</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((cnd) => (
                <tr key={cnd.spm} className={cnd.spm === chosen ? 'bg-[#fbece0] font-semibold' : ''}>
                  <td className="num">
                    {cnd.spm}
                    {cnd.spm === chosen && <span className="ml-1.5 text-[10px] text-ind-600">RECOMMENDED</span>}
                    {cnd.spm === (rec?.currentValue ?? Math.round(spm)) && <span className="ml-1.5 text-[10px] text-ink-3">CURRENT</span>}
                  </td>
                  <td className="num text-right">{cnd.vfd.toFixed(0)}</td>
                  <td className="num text-right">{cnd.rodLoad.toFixed(1)}</td>
                  <td className="num text-right">{cnd.torque.toFixed(1)}</td>
                  <td className="num text-right">{cnd.fillage.toFixed(0)}</td>
                  <td className="num text-right">{cnd.efficiency.toFixed(0)}</td>
                  <td className="num text-right">{cnd.oil.toFixed(1)}</td>
                  <td>{cnd.feasible ? <Badge tone="ok">feasible</Badge> : <span className="text-[11px] text-ink-3">{cnd.note}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="mt-2 text-[11px] text-ink-3">Future: grid search → Bayesian optimisation over the same candidate contract. Reducing SPM lowers polished-rod velocity (less viscous drag) and lengthens barrel-fill time, improving fillage for viscous oil.</div>
    </div>
  );
}
