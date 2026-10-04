import { useMemo } from 'react';
import { useTwin } from '../store/twinStore';
import { dynacardFor } from '../services/simulationEngine';
import { activeClassifier } from '../services/dynacardModel';
import { DynacardChart, type CardSeries } from '../components/srp/DynacardChart';
import { SERIES } from '../components/operations/TimeSeriesChart';
import { Badge, Bar, KV, Note, PageTitle, Panel, Prov, RiskBadge, Stat, StatStrip } from '../components/common/ui';
import { SRP, SAFETY_LIMITS, ROD } from '../services/modelConfig';
import { loadColor } from '../lib/format';
import type { DynacardClass } from '../types';

const CLASSES: DynacardClass[] = ['NORMAL', 'PUMP-OFF', 'GAS INTERFERENCE', 'ROD FLOATING', 'ABNORMAL LOAD'];

export default function SrpPage() {
  const wellId = useTwin((s) => s.wellId);
  const cal = useTwin((s) => s.cal);
  const c = useTwin((s) => s.computed);
  const spm = useTwin((s) => s.spm);
  const rec = useTwin((s) => s.recommendation);
  const decision = useTwin((s) => s.scenario.decision);
  const x = c.sample;
  const f = c.forecast;

  // Round inputs so the (relatively expensive) card only regenerates on meaningful change
  const kSpm = Math.round(spm * 10) / 10;
  const kMu = Math.round(x.viscosity);
  const kMuF = Math.round(f.viscosity.value);
  const current = useMemo(() => dynacardFor(cal, kSpm, x.stroke, kMu, 'plant'), [cal, kSpm, x.stroke, kMu]);
  const forecast = useMemo(() => dynacardFor(cal, kSpm, x.stroke, kMuF, 'model'), [cal, kSpm, x.stroke, kMuF]);
  const recCard = useMemo(
    () => (rec && !decision ? dynacardFor(cal, rec.recommendedValue, rec.stroke, rec.forecast.viscosity.value, 'model') : null),
    [cal, rec, decision],
  );

  const cards: CardSeries[] = [{ name: `Current (${kSpm.toFixed(1)} SPM, sim. obs.)`, points: current.card, color: SERIES.s1 }];
  const pumpCards: CardSeries[] = [{ name: `Pump card now (fillage ${x.pumpFillage.toFixed(0)}%)`, points: current.pump, color: SERIES.s1 }];
  if (Math.abs(kMuF - kMu) > 3) pumpCards.push({ name: `Forecast +24 h (fillage ${forecast.srp.pumpFillage.toFixed(0)}%)`, points: forecast.pump, color: SERIES.s2, dashed: true });
  if (Math.abs(kMuF - kMu) > 3) cards.push({ name: `Forecast +24 h @ ${kSpm.toFixed(1)} SPM`, points: forecast.card, color: SERIES.s2, dashed: true });
  if (recCard && rec) cards.push({ name: `Forecast +24 h @ ${rec.recommendedValue} SPM (recommended)`, points: recCard.card, color: SERIES.s3, dashed: true });

  const cls = current.result;
  const fcls = forecast.result;
  const failPct = f.failureRisk * 100;

  return (
    <div className="p-4">
      <PageTitle
        title={`SRP / dynacard intelligence — ${wellId}`}
        sub={
          <>
            Synthetic surface dynacards from the SRP model · classifier: {activeClassifier.name} · CNN/LSTM-replaceable interface
          </>
        }
      />
      <StatStrip cols={7}>
        <Stat label="SPM" value={x.spm.toFixed(1)} unit="spm" />
        <Stat label="Stroke" value={x.stroke.toFixed(1)} unit="m" />
        <Stat label="Rod load" value={<span style={{ color: loadColor(x.rodLoad) }}>{x.rodLoad.toFixed(0)}</span>} unit="%" prov="SIMULATED" />
        <Stat label="Predicted +24 h load" value={<span style={{ color: loadColor(f.rodLoadCurrentSpm.value) }}>{f.rodLoadCurrentSpm.value.toFixed(0)}</span>} unit="%" prov="PREDICTED" sub={`${f.rodLoadCurrentSpm.lowerBound.toFixed(0)}–${f.rodLoadCurrentSpm.upperBound.toFixed(0)}% band`} />
        <Stat label="Pump efficiency" value={x.pumpEfficiency.toFixed(0)} unit="%" sub={`fillage ${x.pumpFillage.toFixed(0)}%`} />
        <Stat label="Failure risk (30 d)" value={failPct.toFixed(0)} unit="%" tone={failPct > 15 ? 'crit' : failPct > 5 ? 'warn' : 'ok'} prov="PREDICTED" />
        <div className="flex flex-col justify-center px-3 py-2">
          <span className="label">Risk</span>
          <div className="mt-1">
            <RiskBadge risk={c.risk} />
          </div>
        </div>
      </StatStrip>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Surface dynacard — polished-rod load vs position" right={<Prov kind="SIMULATED" label="Synthetic card" />} bodyClass="p-2">
            <DynacardChart cards={cards} ratedKN={SRP.ratedLoadKN} stroke={x.stroke} height={290} />
          </Panel>
          <Panel title="Downhole pump card — basis for diagnosis" right={<Prov kind="SIMULATED" label="Modelled (Gibbs in production)" />} bodyClass="p-2">
            <DynacardChart cards={pumpCards} ratedKN={SRP.ratedLoadKN} stroke={x.stroke} height={230} yMax={Math.max(...current.pump.map((p) => p.load)) * 1.25} showRef={false} xLabel="Plunger position (m)" />
            <div className="px-2 pb-1 text-[10.5px] text-ink-3">
              The pump card shows what the plunger actually feels. A full rectangle means the barrel is full. A drop part-way down the downstroke means the plunger hits liquid late: incomplete fillage, or fluid pound. In production it is computed from the surface card with the damped wave equation (Gibbs method), the same way wellsite rod pump controllers do it.
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel title="Card classification">
            <div className="p-3">
              <div className="grid grid-cols-1 gap-1">
                {CLASSES.map((k) => (
                  <div key={k} className={`flex items-center justify-between rounded-[2px] border px-2 py-1 text-[11.5px] ${k === cls.cls ? 'border-ind-500 bg-[#fbece0] font-semibold text-navy-900' : 'border-transparent text-ink-3'}`}>
                    <span>{k}</span>
                    {k === cls.cls && <span className="num text-[11px]">{(cls.confidence * 100).toFixed(0)}% conf.</span>}
                    {k === fcls.cls && k !== cls.cls && <Badge tone="warn">+24 h forecast</Badge>}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11.5px] leading-snug text-ink-2">{cls.rationale}</div>
              {fcls.cls !== cls.cls && (
                <Note tone="warn">
                  <b>Forecast card: {fcls.cls}.</b> {fcls.rationale}
                </Note>
              )}
            </div>
          </Panel>
          <Panel title="Rod loading" right={<Prov kind="PREDICTED" />}>
            <div className="space-y-2 p-3">
              <div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ink-2">Current</span>
                  <span className="num font-semibold">{x.rodLoad.toFixed(1)}%</span>
                </div>
                <Bar value={x.rodLoad} color={loadColor(x.rodLoad)} marks={[{ at: SAFETY_LIMITS.maxRodLoad, color: '#b3261e' }]} />
              </div>
              <div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ink-2">Predicted +24 h @ current SPM</span>
                  <span className="num font-semibold">{f.rodLoadCurrentSpm.value.toFixed(1)}%</span>
                </div>
                <Bar value={f.rodLoadCurrentSpm.value} color={loadColor(f.rodLoadCurrentSpm.value)} marks={[{ at: SAFETY_LIMITS.maxRodLoad, color: '#b3261e' }]} />
              </div>
              <KV k="PPRL / MPRL" v={`${current.srp.pprlKN.toFixed(1)} / ${current.srp.mprlKN.toFixed(1)}`} unit="kN" />
              <KV k="Peak torque" v={x.torque.toFixed(1)} unit="kN·m" />
              <KV k="Structure rating (configured)" v={SRP.ratedLoadKN} unit="kN" />
              <div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ink-2">Rod stress — Modified Goodman ({ROD.description})</span>
                  <span className="num font-semibold">{current.srp.goodmanPct.toFixed(0)}%</span>
                </div>
                <Bar value={current.srp.goodmanPct} max={120} color={current.srp.goodmanPct >= 100 ? '#b3261e' : current.srp.goodmanPct >= ROD.warnPct ? '#d0661b' : '#3f7d4e'} marks={[{ at: 100, color: '#b3261e' }]} />
                <div className="text-[10.5px] text-ink-3">API RP 11BR allowable stress: S<sub>a</sub> = (T/4 + 0.5625·S<sub>min</sub>)·SF · forecast at current SPM: {forecast.srp.goodmanPct.toFixed(0)}%</div>
              </div>
              <KV k="Motor power / energy" v={`${current.srp.powerKw.toFixed(1)} kW · ${current.srp.kwhPerBbl.toFixed(1)}`} unit="kWh/bbl" />
            </div>
          </Panel>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-ink-3">
        Load model: L = L<sub>static</sub> + L<sub>dynamic</sub>·(S·N²) + L<sub>viscous</sub>·(S·N)·(μ/μ<sub>ref</sub>)<sup>p</sup>. Fillage falls when viscous oil cannot fill the barrel within the upstroke time (∝ 1/N). Demonstration calibration.
      </div>
    </div>
  );
}
