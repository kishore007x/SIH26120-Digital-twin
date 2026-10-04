import { Printer } from 'lucide-react';
import { ROLE_LABEL, useTwin } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { useFleet } from '../hooks/useFleet';
import { useAllAlarms } from './AlarmsPage';
import { useWellDisplays } from '../components/field/useLiveWell';
import { Badge, Prov } from '../components/common/ui';
import { f0, f1, fmtDate, fmtDateTime, fmtSimTime } from '../lib/format';

/** Printable field shift report. Every section carries its data provenance. */
export default function ReportPage() {
  const now = useTwin((s) => s.simTime);
  const role = useTwin((s) => s.role);
  const mode = useTwin((s) => s.controlMode);
  const policy = useTwin((s) => s.policy);
  const edge = useTwin((s) => s.edge);
  const moc = useTwin((s) => s.moc);
  const wellId = useTwin((s) => s.wellId);
  const rec = useTwin((s) => s.recommendation);
  const scenario = useTwin((s) => s.scenario);
  const outcome = useTwin((s) => s.outcome);
  const events = useTwin((s) => s.events);
  const wells = dataSource.listWells();
  const ref = dataSource.fieldReference();
  const displays = useWellDisplays(wells);
  const fleet = useFleet();
  const alarms = useAllAlarms();

  const producing = wells.filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
  const fieldOil = producing.reduce((a, w) => a + displays[w.id].production, 0);
  const atRisk = producing.filter((w) => w.status === 'AT_RISK' || displays[w.id].risk === 'HIGH' || displays[w.id].risk === 'CRITICAL');
  const open = alarms.filter((a) => a.state !== 'SHELVED').sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 12);
  const due = fleet.ops.filter((o) => o.cycle.status === 'OVERDUE' || o.cycle.status === 'DUE');
  const tanks = fleet.ops.filter((o) => o.tank && o.tank.levelPct >= 70).sort((a, b) => b.tank!.levelPct - a.tank!.levelPct);
  const dq = fleet.ops.filter((o) => o.sensors.some((s) => s.status !== 'OK' && s.status !== 'N/A'));
  const reportNo = `SR-${new Date(now).toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(now / 3_600_000) % 24 < 12 ? 'A' : 'B'}`;

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-[18px] font-bold tracking-wide text-navy-900 uppercase">Field shift report</h1>
          <div className="text-[12.5px] text-ink-3">Generated from the current simulated state. Use Print → “Save as PDF” to keep a copy.</div>
        </div>
        <button className="btn btn-primary btn-lg ml-auto" onClick={() => window.print()}>
          <Printer size={15} /> Print / save as PDF
        </button>
      </div>

      <article className="report glass-strong rounded-2xl p-6 sm:p-8">
        <header className="flex flex-wrap items-start gap-4 border-b-2 border-navy-900 pb-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#a8561a] uppercase">Demonstration prototype · simulated data</div>
            <h2 className="text-[20px] font-bold text-navy-900">Baghewala Field Digital Twin — Shift Report</h2>
            <div className="text-[12.5px] text-ink-2">Heavy-oil CSS + SRP wells · field-level summary and automation log</div>
          </div>
          <table className="rep-meta">
            <tbody>
              <tr>
                <th>Report no.</th>
                <td className="num">{reportNo}</td>
              </tr>
              <tr>
                <th>Generated</th>
                <td className="num">{fmtSimTime(now)} IST</td>
              </tr>
              <tr>
                <th>Prepared as</th>
                <td>{ROLE_LABEL[role]}</td>
              </tr>
              <tr>
                <th>Control mode</th>
                <td>{mode === 'AUTO' ? 'Auto · supervised' : 'Advisory'}</td>
              </tr>
            </tbody>
          </table>
        </header>

        <Section n={1} title="Field summary" prov={<Prov kind="SIMULATED" />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fig k="Producing wells" v={`${ref.producing} / ${ref.total}`} />
            <Fig k="Field oil rate (demo wells)" v={`${f0(fieldOil)} BOPD`} />
            <Fig k="Wells at risk (predicted)" v={`${atRisk.length}`} />
            <Fig k="Open alarms" v={`${alarms.filter((a) => a.state === 'UNACK').length} unack.`} />
          </div>
        </Section>

        <Section n={2} title="Open alarms (top 12)" prov={<Prov kind="SIMULATED" />}>
          <table className="tbl rep-tbl">
            <thead>
              <tr>
                <th>Pri.</th>
                <th>Well</th>
                <th>Alarm</th>
                <th>Action</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {open.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Badge tone={a.priority === 'P1' ? 'crit' : a.priority === 'P2' ? 'warn' : 'info'}>{a.priority}</Badge>
                  </td>
                  <td className="num font-semibold">{a.wellId}</td>
                  <td>{a.message}</td>
                  <td className="text-ink-2">{a.action}</td>
                  <td>{a.state}</td>
                </tr>
              ))}
              {!open.length && (
                <tr>
                  <td colSpan={5}>No open alarms.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>

        <Section n={3} title={`Well ${wellId} — decision record`} prov={<Prov kind="PREDICTED" />}>
          {rec ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-[12.5px]">
                <Row k="Recommendation" v={`${rec.id}: SPM ${f1(rec.currentValue)} → ${f1(rec.recommendedValue)}`} />
                <Row k="Model confidence" v={`${(rec.confidence * 100).toFixed(0)} % (auto threshold ${(policy.autoMinConfidence * 100).toFixed(0)} %)`} />
                <Row k="Safety gate" v={rec.safetyStatus} />
                <Row k="Decision" v={scenario.decision ? `${scenario.decision}${scenario.decidedBy ? ' by ' + scenario.decidedBy.toLowerCase() : ''}` : 'pending'} />
              </div>
              <div className="text-[12.5px] leading-relaxed text-ink-2">{rec.reason}</div>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-3">No recommendation issued for {wellId} in this session. Run the demo scenario to create one.</p>
          )}
          {outcome && (
            <table className="tbl rep-tbl mt-3">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th className="text-right">Before</th>
                  <th className="text-right">No action (pred.)</th>
                  <th className="text-right">Predicted after</th>
                  <th className="text-right">Observed after</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rod load %</td>
                  <td className="num text-right">{f0(outcome.before.rodLoad)}</td>
                  <td className="num text-right">{f0(outcome.noAction.rodLoad)}</td>
                  <td className="num text-right">{f0(outcome.predictedAfter.rodLoad)}</td>
                  <td className="num text-right font-semibold">{f0(outcome.observedAfter.rodLoad)}</td>
                </tr>
                <tr>
                  <td>Oil BOPD</td>
                  <td className="num text-right">{f0(outcome.before.oil)}</td>
                  <td className="num text-right">{f0(outcome.noAction.oil)}</td>
                  <td className="num text-right">{f0(outcome.predictedAfter.oil)}</td>
                  <td className="num text-right font-semibold">{f0(outcome.observedAfter.oil)}</td>
                </tr>
                <tr>
                  <td>Pump fillage %</td>
                  <td className="num text-right">{f0(outcome.before.fillage)}</td>
                  <td className="num text-right">{f0(outcome.noAction.fillage)}</td>
                  <td className="num text-right">{f0(outcome.predictedAfter.fillage)}</td>
                  <td className="num text-right font-semibold">{f0(outcome.observedAfter.fillage)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Section n={4} title="Re-steam due / overdue" prov={<Prov kind="PREDICTED" />}>
            <ul className="rep-list">
              {due.slice(0, 10).map((o) => (
                <li key={o.id}>
                  <b className="num">{o.id}</b> — {o.cycle.status.toLowerCase()}, {o.cycle.currentBopd.toFixed(0)} BOPD{o.cycle.resteamDate ? `, re-steam by ${fmtDate(o.cycle.resteamDate)}` : ''}
                </li>
              ))}
              {!due.length && <li>None.</li>}
            </ul>
          </Section>
          <Section n={5} title="Tanks ≥ 70 %" prov={<Prov kind="SIMULATED" />}>
            <ul className="rep-list">
              {tanks.slice(0, 10).map((o) => (
                <li key={o.id}>
                  <b className="num">{o.id}</b> — {o.tank!.levelPct.toFixed(0)} %{o.tank!.nextPickup ? `, bowser ${o.tank!.bowser ?? ''} ${fmtDateTime(o.tank!.nextPickup)}` : ''}
                </li>
              ))}
              {!tanks.length && <li>None.</li>}
            </ul>
          </Section>
          <Section n={6} title="Data-quality issues" prov={<Prov kind="SIMULATED" />}>
            <ul className="rep-list">
              {dq.map((o) =>
                o.sensors
                  .filter((s) => s.status !== 'OK' && s.status !== 'N/A')
                  .map((s) => (
                    <li key={o.id + s.key}>
                      <b className="num">{o.id}</b> — {s.label}: {s.status.toLowerCase()}
                      {s.note ? ` (${s.note})` : ''}
                    </li>
                  )),
              )}
              {!dq.length && <li>None.</li>}
            </ul>
          </Section>
          <Section n={7} title="Automation status" prov={<Prov kind="CONFIGURED" />}>
            <ul className="rep-list">
              <li>Mode: {mode === 'AUTO' ? 'auto · supervised' : 'advisory'}; confidence threshold {(policy.autoMinConfidence * 100).toFixed(0)} %; intervention window {policy.autoWindowS} s</li>
              <li>Wells excluded from automation: {policy.autoDisabledWells.length ? policy.autoDisabledWells.join(', ') : 'none'}</li>
              <li>Wellsite RPC link: {edge.commsOnline ? 'online' : 'lost — local pump-off control'} ({edge.rpcMode === 'SUPERVISED' ? 'supervised' : 'local POC'})</li>
              {edge.lastSetpoint && (
                <li>
                  Last setpoint: SPM ≤ {f1(edge.lastSetpoint.spmMax)}, fillage {edge.lastSetpoint.fillageTarget[0]}–{edge.lastSetpoint.fillageTarget[1]} % at {fmtDateTime(edge.lastSetpoint.at)}
                </li>
              )}
            </ul>
          </Section>
        </div>

        <Section n={8} title="Management of change & event log" prov={<Prov kind="SIMULATED" />}>
          <ul className="rep-list">
            {moc
              .slice(-6)
              .reverse()
              .map((m, i) => (
                <li key={'m' + i}>
                  <span className="num text-ink-3">{fmtDateTime(m.time)}</span> · {ROLE_LABEL[m.role]}: {m.change} — {m.reason}
                </li>
              ))}
            {events
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <li key={'e' + i}>
                  <span className="num text-ink-3">{fmtDateTime(e.time)}</span> · {wellId}: {e.text}
                </li>
              ))}
            {!moc.length && !events.length && <li>No changes or events recorded in this session.</li>}
          </ul>
        </Section>

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-line pt-4 text-[12px] sm:grid-cols-2">
          <div>
            <div className="h-10 border-b border-ink-3" />
            <div className="mt-1 text-ink-3">Shift engineer — name & signature</div>
          </div>
          <div>
            <div className="h-10 border-b border-ink-3" />
            <div className="mt-1 text-ink-3">Reviewed by (supervisor) — name & signature</div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
          Notice: this report is produced by a demonstration prototype from simulated data. It is not an official document of any government body or operating company and must not be used for operational decisions. Values are labelled SIMULATED, PREDICTED, CONFIGURED or REFERENCE.
        </p>
      </article>
    </div>
  );
}

function Section({ n, title, prov, children }: { n: number; title: string; prov?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rep-sec">
      <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-navy-900 uppercase">
        <span className="num text-[#a8561a]">{n}.</span> {title} <span className="ml-auto">{prov}</span>
      </h3>
      {children}
    </section>
  );
}
function Fig({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/60 px-3 py-2">
      <div className="label">{k}</div>
      <div className="num text-[17px] font-bold text-navy-900">{v}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-[130px] shrink-0 text-ink-3">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}
