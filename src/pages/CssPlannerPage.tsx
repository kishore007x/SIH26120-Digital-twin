import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Flame } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFleet } from '../hooks/useFleet';
import { useTwin } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { FLEET_CONFIG, type ResteamStatus } from '../services/fleetEngine';
import { Badge, Note, PageTitle, Panel, Prov, Stat, StatStrip } from '../components/common/ui';
import { AXIS, GRID, SERIES } from '../components/operations/TimeSeriesChart';
import { fmtDate } from '../lib/format';

const DAY = 86_400_000;
const TONE: Record<ResteamStatus, 'crit' | 'warn' | 'info' | 'ok' | 'neutral'> = { OVERDUE: 'crit', DUE: 'warn', PLAN: 'info', 'ON TRACK': 'ok', 'IN STEAM': 'info', SOAKING: 'info', 'SHUT-IN': 'neutral', 'N/A': 'neutral' };

export default function CssPlannerPage() {
  const fleet = useFleet();
  const now = useTwin((s) => s.simTime);
  const wells = dataSource.listWells();
  const [sel, setSel] = useState('W-17');
  const rows = fleet.ops
    .filter((o) => o.cycle.status !== 'N/A')
    .sort((a, b) => (a.cycle.daysToLimit ?? 1e9) - (b.cycle.daysToLimit ?? 1e9));
  const cnt = (s: ResteamStatus) => fleet.ops.filter((o) => o.cycle.status === s).length;
  const selOps = fleet.byId.get(sel);

  const curve = useMemo(() => {
    if (!selOps || selOps.cycle.peakBopd <= 0) return [];
    const { peakBopd, declinePerDay, cycleStart } = selOps.cycle;
    const out = [];
    const end = Math.max(selOps.cycle.daysOnProduction + 120, Math.log(peakBopd / FLEET_CONFIG.economicLimitBopd) / declinePerDay + 30);
    for (let d = 0; d <= end; d += 4) out.push({ day: d, date: cycleStart + d * DAY, q: peakBopd * Math.exp(-declinePerDay * d), actual: d <= selOps.cycle.daysOnProduction ? peakBopd * Math.exp(-declinePerDay * d) : undefined });
    return out;
  }, [selOps]);

  const horizon = 60;
  const jobs = fleet.steamJobs;

  return (
    <div className="p-4">
      <PageTitle
        title="CSS cycle planner — re-steam scheduling"
        sub={
          <>
            When should each well be re-steamed? Production decline per cycle vs the economic limit ({FLEET_CONFIG.economicLimitBopd} BOPD), and a schedule for the {FLEET_CONFIG.mobileSteamGenerators} mobile steam generators · <Prov kind="PREDICTED" />
          </>
        }
      />
      <StatStrip cols={6}>
        <Stat label="Overdue" value={cnt('OVERDUE')} tone={cnt('OVERDUE') ? 'crit' : 'ok'} sub="below economic limit" />
        <Stat label="Due (≤ 10 d)" value={cnt('DUE')} tone={cnt('DUE') ? 'warn' : 'ok'} />
        <Stat label="Plan (≤ 45 d)" value={cnt('PLAN')} />
        <Stat label="In steam / soaking" value={cnt('IN STEAM') + cnt('SOAKING')} />
        <Stat label="On track" value={cnt('ON TRACK')} tone="ok" />
        <Stat label="Steam jobs scheduled" value={jobs.length} sub={`next ${horizon} days`} />
      </StatStrip>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title={`Cycle decline — ${sel}`} icon={<Flame size={13} />} right={<Prov kind="PREDICTED" />} bodyClass="p-2">
          {selOps && curve.length ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: -6 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="day" type="number" tick={AXIS} stroke="#c9d0d6" tickFormatter={(v) => `${v} d`} />
                  <YAxis tick={AXIS} stroke="#c9d0d6" width={44} />
                  <Tooltip isAnimationActive={false} formatter={(v) => `${Number(v).toFixed(1)} BOPD`} labelFormatter={(l) => `Day ${l} of cycle ${selOps.cycle.cycleNo}`} contentStyle={{ fontSize: 11, border: '1px solid #dccab5', borderRadius: 3 }} />
                  <Line dataKey="q" name="Forecast" stroke={SERIES.s1} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  <Line dataKey="actual" name="Produced (sim.)" stroke={SERIES.s2} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
                  <ReferenceLine y={FLEET_CONFIG.economicLimitBopd} stroke="#b3261e" strokeDasharray="4 3" label={{ value: `economic limit ${FLEET_CONFIG.economicLimitBopd} BOPD`, position: 'insideBottomLeft', fontSize: 9.5, fill: '#b3261e' }} />
                  <ReferenceLine x={Math.round(selOps.cycle.daysOnProduction)} stroke="#1d242b" strokeDasharray="3 3" label={{ value: 'today', position: 'insideTopLeft', fontSize: 10, fill: '#1d242b' }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 px-2 pb-1 text-[12px] sm:grid-cols-4">
                <div>
                  <div className="label">Cycle</div>
                  <div className="num font-semibold">CSS-{String(selOps.cycle.cycleNo).padStart(2, '0')} · day {selOps.cycle.daysOnProduction.toFixed(0)}</div>
                </div>
                <div>
                  <div className="label">Peak → now</div>
                  <div className="num font-semibold">
                    {selOps.cycle.peakBopd.toFixed(0)} → {selOps.cycle.currentBopd.toFixed(0)} BOPD
                  </div>
                </div>
                <div>
                  <div className="label">Decline</div>
                  <div className="num font-semibold">{((1 - Math.exp(-selOps.cycle.declinePerDay * 30)) * 100).toFixed(0)} % / month</div>
                </div>
                <div>
                  <div className="label">Recommended re-steam</div>
                  <div className="num font-semibold">{selOps.cycle.resteamDate ? fmtDate(selOps.cycle.resteamDate) : '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-ink-3">Select a producing well.</div>
          )}
        </Panel>

        <Panel title="Mobile steam generator schedule" icon={<CalendarClock size={13} />} bodyClass="p-3">
          <div className="mb-1 flex justify-between text-[10px] text-ink-3">
            <span>{fmtDate(now)}</span>
            <span>+30 d</span>
            <span>+{horizon} d</span>
          </div>
          {Array.from({ length: FLEET_CONFIG.mobileSteamGenerators }, (_, g) => `MSG-${g + 1}`).map((gen) => (
            <div key={gen} className="mb-2">
              <div className="label mb-1">{gen}</div>
              <div className="relative h-9 rounded-[2px] bg-[#f3e9dc]">
                {jobs
                  .filter((j) => j.generator === gen)
                  .map((j) => {
                    const x0 = ((j.steamStart - now) / DAY / horizon) * 100;
                    const w1 = (FLEET_CONFIG.steamDays / horizon) * 100;
                    const w2 = (FLEET_CONFIG.soakDays / horizon) * 100;
                    if (x0 > 100) return null;
                    return (
                      <button key={j.wellId} onClick={() => setSel(j.wellId)} className="absolute top-1 bottom-1 flex overflow-hidden rounded-[2px] text-[9.5px] font-semibold text-white shadow-sm" style={{ left: `${Math.max(0, x0)}%`, width: `${w1 + w2}%` }} title={`${j.wellId}: steam ${fmtDate(j.steamStart)}, soak ${fmtDate(j.soakStart)}, back online ${fmtDate(j.backOnline)}`}>
                        <span className="flex items-center justify-center bg-[#a4480c] px-0.5" style={{ width: `${(w1 / (w1 + w2)) * 100}%` }}>
                          {j.wellId}
                        </span>
                        <span className="flex-1 bg-[#e6a36b]" />
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          <div className="mt-1 flex gap-3 text-[10.5px] text-ink-3">
            <span>
              <span className="inline-block h-2 w-3 bg-[#a4480c]" /> steam injection ({FLEET_CONFIG.steamDays} d)
            </span>
            <span>
              <span className="inline-block h-2 w-3 bg-[#e6a36b]" /> soak ({FLEET_CONFIG.soakDays} d)
            </span>
          </div>
          <Note>Overdue and due wells are scheduled first. Each generator moves to the next well after injection and rig-down, while the previous well soaks.</Note>
        </Panel>
      </div>

      <Panel title="Wells by time to economic limit" className="mt-3">
        <div className="max-h-[420px] overflow-auto">
          <table className="tbl">
            <thead className="sticky top-0">
              <tr>
                <th>Well</th>
                <th>Cycle</th>
                <th className="text-right">Days on prod.</th>
                <th className="text-right">Peak BOPD</th>
                <th className="text-right">Now BOPD</th>
                <th className="text-right">Decline %/mo</th>
                <th>Economic limit</th>
                <th>Re-steam by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const w = wells.find((x) => x.id === o.id)!;
                const producing = w.status === 'PRODUCING' || w.status === 'AT_RISK';
                return (
                  <tr key={o.id} className={`cursor-pointer hover:bg-[#faf1e6] ${sel === o.id ? 'bg-[#fbece0]' : ''}`} onClick={() => producing && setSel(o.id)}>
                    <td className="num font-semibold">
                      <Link to={`/well/${o.id}/thermal`} className="text-ind-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {o.id}
                      </Link>
                    </td>
                    <td className="num">CSS-{String(o.cycle.cycleNo).padStart(2, '0')}</td>
                    <td className="num text-right">{producing ? o.cycle.daysOnProduction.toFixed(0) : '—'}</td>
                    <td className="num text-right">{producing ? o.cycle.peakBopd.toFixed(0) : '—'}</td>
                    <td className="num text-right">{producing ? o.cycle.currentBopd.toFixed(1) : '—'}</td>
                    <td className="num text-right">{producing ? ((1 - Math.exp(-o.cycle.declinePerDay * 30)) * 100).toFixed(0) : '—'}</td>
                    <td className="num">{o.cycle.economicLimitDate ? fmtDate(o.cycle.economicLimitDate) : '—'}</td>
                    <td className="num">{o.cycle.resteamDate ? fmtDate(o.cycle.resteamDate) : '—'}</td>
                    <td>
                      <Badge tone={TONE[o.cycle.status]}>{o.cycle.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="mt-2 text-[11px] text-ink-3">
        Decline model: exponential per cycle, q(t) = q<sub>peak</sub>·e<sup>−Dt</sup>. The economic limit is where the oil value no longer covers steam and lifting cost. In production, decline would be fitted to well-test / tank-gauging data, and the limit would come from live oil price and steam cost.
      </div>
    </div>
  );
}
