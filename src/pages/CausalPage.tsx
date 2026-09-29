import { Link } from 'react-router-dom';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { useTwin } from '../store/twinStore';
import { CausalChain, type CausalStage } from '../components/intelligence/CausalChain';
import { HealthBadge, KV, Note, PageTitle, Panel, Prov, RiskBadge } from '../components/common/ui';
import { viscosityAt, relativeMobility } from '../services/viscosityModel';
import { evaluateSrpAtTemp, failureRisk } from '../services/srpModel';
import { THERMAL } from '../services/modelConfig';
import { ConfidenceIndicator } from '../components/intelligence/ConfidenceIndicator';
import { DecisionAuthority } from '../components/intelligence/DecisionAuthority';

export default function CausalPage() {
  const wellId = useTwin((s) => s.wellId);
  const cal = useTwin((s) => s.cal);
  const c = useTwin((s) => s.computed);
  const baseline = useTwin((s) => s.baseline) ?? c;
  const cooling = useTwin((s) => s.coolingDeclared);
  const rec = useTwin((s) => s.recommendation);
  const decision = useTwin((s) => s.scenario.decision);
  const b = baseline.sample;
  const f = c.forecast;
  const muRef = viscosityAt(cal.tPlateau);
  const mobB = relativeMobility(b.viscosity, muRef);
  const mobF = relativeMobility(f.viscosity.value, muRef);
  const fcSrp = evaluateSrpAtTemp(cal, c.sample.spm, c.sample.stroke, f.temperature.value);
  const tDrop = b.temperature - f.temperature.value;
  const confirmed = c.coolingConfirmed;
  const highRisk = f.riskCurrentSpm === 'HIGH' || f.riskCurrentSpm === 'CRITICAL';

  const stages: CausalStage[] = [
    { key: 'css', title: 'CSS cycle ends', from: 'SUPPORTED', to: cooling ? 'ENDED' : 'SUPPORTED', detail: 'CSS thermal support no longer replenishing near-wellbore heat', active: cooling, tone: 'warn' },
    { key: 'decline', title: 'Thermal decline', from: 'PLATEAU', to: c.thermalState === 'HOT PRODUCTION' ? 'PLATEAU' : c.thermalState.replace(' (UNCONFIRMED)', '*'), detail: `Physics baseline: T = ${THERMAL.tBase} + A·exp(−${THERMAL.k.toFixed(4)}·t)`, active: cooling && c.sample.tH > 0, tone: 'warn' },
    { key: 'temp', title: 'Temperature', arrow: '↓', from: `${b.temperature.toFixed(0)} °C`, to: `${f.temperature.value.toFixed(0)} °C`, detail: `+24 h forecast ${f.temperature.value.toFixed(1)} ± ${((f.temperature.upperBound - f.temperature.lowerBound) / 2).toFixed(0)} °C`, active: confirmed || tDrop > 0.3, tone: 'warn' },
    { key: 'visc', title: 'Viscosity', arrow: '↑', from: `${b.viscosity.toFixed(0)} cP`, to: `${f.viscosity.value.toFixed(0)} cP`, detail: 'μ(T) = A·exp(B/T) — exponential sensitivity to temperature', active: confirmed || tDrop > 0.3, tone: 'warn' },
    { key: 'mob', title: 'Oil mobility', arrow: '↓', from: mobB.toFixed(2), to: mobF.toFixed(2), detail: 'Relative mobility k/μ (normalised to plateau) — slower barrel fill, more viscous drag', active: confirmed, tone: 'warn' },
    { key: 'load', title: 'SRP load', arrow: '↑', from: `${b.rodLoad.toFixed(0)}%`, to: `${f.rodLoadCurrentSpm.value.toFixed(0)}%`, detail: `At ${c.sample.spm.toFixed(0)} SPM · fillage ${b.pumpFillage.toFixed(0)}% → ${fcSrp.pumpFillage.toFixed(0)}% · torque ${b.torque.toFixed(0)} → ${fcSrp.torque.toFixed(0)} kN·m`, active: confirmed, tone: highRisk ? 'crit' : 'warn' },
    {
      key: 'risk',
      title: 'Rod / pump risk',
      arrow: '↑',
      from: <RiskBadge risk={baseline.risk} />,
      to: <RiskBadge risk={f.riskCurrentSpm} />,
      detail: `30-day failure risk ${(failureRisk(b.rodLoad) * 100).toFixed(0)}% → ${(f.failureRisk * 100).toFixed(0)}% · forecast card ${fcSrp.pumpFillage < 82 ? 'PUMP-OFF' : 'NORMAL'}`,
      active: confirmed && highRisk,
      tone: 'crit',
    },
    {
      key: 'rec',
      title: 'Recommendation',
      from: rec ? `${rec.currentValue} SPM` : '—',
      to: rec ? `${rec.recommendedValue} SPM` : 'pending',
      detail: rec ? `AI-assisted · predicted load ${rec.forecast.rodLoadCurrentSpm.value.toFixed(0)}% → ${rec.forecast.rodLoadRecommended?.value.toFixed(0)}% · ${decision ? `operator ${decision.toLowerCase()}` : 'awaiting safety + operator'}` : 'Issued when forecast risk reaches HIGH',
      active: !!rec,
      tone: 'action',
    },
  ];

  const insight = confirmed
    ? `Thermal decline is predicted to increase viscosity (${b.viscosity.toFixed(0)} → ${f.viscosity.value.toFixed(0)} cP) and rod loading (${b.rodLoad.toFixed(0)}% → ${f.rodLoadCurrentSpm.value.toFixed(0)}%) during the next operating period. Detected ~24 h before the load materialises — before equipment performance deteriorates.`
    : cooling
      ? 'Cooling onset detected. The twin is accumulating observations to confirm the trend before issuing a load forecast.'
      : 'Well is on its hot-production plateau. No thermal decline expected at present — start the demo scenario to see the causal chain develop.';

  return (
    <div className="p-4">
      <PageTitle title={`Causal analysis — well-to-surface chain — ${wellId}`} sub={<>Baseline (cooling onset) → +24 h forecast at current operating point · values <Prov kind="PREDICTED" /> by coupled physics-informed models</>} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Reservoir → wellbore → pump → surface" bodyClass="p-3">
          <CausalChain stages={stages} />
        </Panel>
        <div className="flex flex-col gap-3">
          <DecisionAuthority />
          <Panel title="System insight" icon={<Lightbulb size={13} />}>
            <div className="p-3">
              <p className={`text-[13px] leading-relaxed ${confirmed ? 'text-navy-900' : 'text-ink-2'}`}>“{insight}”</p>
              {rec && (
                <Link to={`/well/${wellId}/optimization`} className="btn btn-primary mt-3 w-full justify-center">
                  VIEW RECOMMENDATION <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </Panel>
          <Panel title="Forecast summary (+24 h)" right={<Prov kind="PREDICTED" />}>
            <div className="p-3">
              <KV k="Temperature" v={`${f.temperature.value.toFixed(1)} °C`} sub={`${f.temperature.lowerBound.toFixed(1)}–${f.temperature.upperBound.toFixed(1)} °C`} />
              <KV k="Viscosity" v={`${f.viscosity.value.toFixed(0)} cP`} sub={`${f.viscosity.lowerBound.toFixed(0)}–${f.viscosity.upperBound.toFixed(0)} cP`} />
              <KV k="Rod load @ current SPM" v={`${f.rodLoadCurrentSpm.value.toFixed(0)}%`} sub={`${f.rodLoadCurrentSpm.lowerBound.toFixed(0)}–${f.rodLoadCurrentSpm.upperBound.toFixed(0)}%`} />
              <KV k="Oil @ current SPM" v={`${f.oilCurrentSpm.toFixed(1)} BOPD`} />
              <div className="flex items-center justify-between py-[5px]">
                <span className="text-[12px] text-ink-2">Health now</span>
                <HealthBadge health={c.health} />
              </div>
              <div className="mt-2">
                <ConfidenceIndicator value={f.temperature.confidence} />
              </div>
            </div>
          </Panel>
          <Note>
            Sensitivity (demonstration calibration): each 1 °C of cooling ≈ +{(viscosityAt(f.temperature.value - 0.5) - viscosityAt(f.temperature.value + 0.5)).toFixed(0)} cP ≈ +
            {(evaluateSrpAtTemp(cal, c.sample.spm, c.sample.stroke, f.temperature.value - 0.5).rodLoad - evaluateSrpAtTemp(cal, c.sample.spm, c.sample.stroke, f.temperature.value + 0.5).rodLoad).toFixed(1)} % rod load at current SPM.
          </Note>
        </div>
      </div>
    </div>
  );
}
