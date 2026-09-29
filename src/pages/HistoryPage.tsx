import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTwin } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { MODEL_TRUST } from '../data/history';
import { Badge, Bar, Note, PageTitle, Panel, Prov } from '../components/common/ui';
import { AXIS, GRID, SERIES } from '../components/operations/TimeSeriesChart';
import type { ValidationRecord } from '../types';

const OUTCOME_TONE = { ACCEPTED: 'ok', MODIFIED: 'info', REJECTED: 'crit', PENDING: 'neutral' } as const;

export default function HistoryPage() {
  const wellId = useTwin((s) => s.wellId);
  const run = useTwin((s) => s.runValidation);
  const cycles = dataSource.getCycleHistory(wellId);
  const records: ValidationRecord[] = useMemo(() => {
    const hist = dataSource.getValidationHistory(wellId);
    const current: ValidationRecord = run ?? {
      cycle: 'CSS-08',
      period: 'Jun 2026 – (current)',
      temperatureAcc: NaN,
      viscosityAcc: NaN,
      rodLoadAcc: NaN,
      dynacardAcc: NaN,
      tempBand: '±4.0 °C',
      recommendation: '—',
      outcome: 'PENDING',
      predictedLoad: NaN,
      observedLoad: NaN,
    };
    return [...hist, current];
  }, [wellId, run]);
  const chart = records.filter((r) => Number.isFinite(r.rodLoadAcc)).map((r) => ({ cycle: r.cycle.replace('CSS-', 'Cycle '), temp: r.temperatureAcc, visc: r.viscosityAcc, load: r.rodLoadAcc }));
  const trust = [
    { k: 'Temperature prediction', v: MODEL_TRUST.temperature, band: '±4 °C @ +24 h' },
    { k: 'Viscosity prediction', v: MODEL_TRUST.viscosity, band: '±37 cP @ +24 h' },
    { k: 'Rod-load prediction', v: MODEL_TRUST.rodLoad, band: '±7 % @ +24 h' },
    { k: 'Dynacard classification', v: MODEL_TRUST.dynacard, band: 'top-1 agreement' },
  ];
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');

  return (
    <div className="p-4">
      <PageTitle
        title={`Model trust / history — ${wellId}`}
        sub={
          <>
            <b>PROTOTYPE DEMONSTRATION METRICS</b> — simulated back-test of prior cycles. Not field-validated performance.
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Model trust (demonstration)" right={<Prov kind="SIMULATED" />}>
          <div className="space-y-3 p-3">
            {trust.map((t) => (
              <div key={t.k}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-ink-2">{t.k}</span>
                  <span className="num text-[16px] font-semibold text-navy-900">{t.v}%</span>
                </div>
                <Bar value={t.v} color="#2d64a8" />
                <div className="text-[10.5px] text-ink-3">uncertainty: {t.band}</div>
              </div>
            ))}
            <Note>Trust figures are updated after every closed loop (prediction → decision → observation). They gate the minimum-confidence check in the safety engine.</Note>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Prediction accuracy by cycle (%)" right={<Prov kind="SIMULATED" />} bodyClass="p-2">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="cycle" tick={AXIS} stroke="#c9d0d6" />
                <YAxis domain={[75, 100]} tick={AXIS} stroke="#c9d0d6" width={44} />
                <Tooltip isAnimationActive={false} formatter={(v) => `${Number(v).toFixed(1)} %`} contentStyle={{ fontSize: 11, border: '1px solid #c6ced6', borderRadius: 3 }} />
                <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 10.5 }} verticalAlign="top" align="right" height={20} />
                <Line dataKey="temp" name="Temperature" stroke={SERIES.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
                <Line dataKey="visc" name="Viscosity" stroke={SERIES.s2} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
                <Line dataKey="load" name="Rod load" stroke={SERIES.s3} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Validation ledger — historical simulated cycles">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Period</th>
                    <th className="text-right">Temp. acc.</th>
                    <th className="text-right">Visc. acc.</th>
                    <th className="text-right">Rod-load acc.</th>
                    <th className="text-right">Dynacard acc.</th>
                    <th className="text-right">Temp. band</th>
                    <th>Recommendation</th>
                    <th className="text-right">Pred. / obs. load</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.cycle} className={r.cycle === 'CSS-08' ? 'bg-[#f4f7fa]' : ''}>
                      <td className="num font-semibold">{r.cycle.replace('CSS-', 'Cycle ')}</td>
                      <td className="text-ink-2">{r.period}</td>
                      <td className="num text-right">{fmt(r.temperatureAcc)}</td>
                      <td className="num text-right">{fmt(r.viscosityAcc)}</td>
                      <td className="num text-right">{fmt(r.rodLoadAcc)}</td>
                      <td className="num text-right">{fmt(r.dynacardAcc)}</td>
                      <td className="num text-right">{r.tempBand}</td>
                      <td className="num">{r.recommendation}</td>
                      <td className="num text-right">{Number.isFinite(r.predictedLoad) ? `${r.predictedLoad.toFixed(0)} / ${r.observedLoad.toFixed(0)} %` : '—'}</td>
                      <td>
                        <Badge tone={OUTCOME_TONE[r.outcome]}>{r.outcome}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!run && <div className="border-t border-line px-3 py-2 text-[11px] text-ink-3">Cycle 08 is filled in when the demo scenario completes (prediction vs simulated observation).</div>}
          </Panel>

          <Panel title="CSS cycle history" right={<Prov kind="CONFIGURED" label="Demonstration data" />}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th className="text-right">Steam (t)</th>
                    <th className="text-right">Inj. pressure (bar)</th>
                    <th className="text-right">Soak (h)</th>
                    <th className="text-right">Avg. oil (BOPD)</th>
                    <th className="text-right">SOR</th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.cycleId}>
                      <td className="num font-semibold">{c.cycleId}</td>
                      <td className="num text-right">{c.steamVolume}</td>
                      <td className="num text-right">{c.injectionPressure}</td>
                      <td className="num text-right">{c.soakTime}</td>
                      <td className="num text-right">{c.productionRate}</td>
                      <td className="num text-right">{c.sor.toFixed(1)}</td>
                      <td className="num">{c.startDate}</td>
                      <td className="num">{c.endDate ?? 'current'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
