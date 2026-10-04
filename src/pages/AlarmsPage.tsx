import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Check, Clock, EyeOff } from 'lucide-react';
import { useFleet, useLiveAlarms } from '../hooks/useFleet';
import { ROLE_LABEL, useTwin } from '../store/twinStore';
import { Badge, Note, PageTitle, Panel, Prov, Stat, StatStrip } from '../components/common/ui';
import { fmtDateTime } from '../lib/format';
import type { FieldAlarm } from '../services/fleetEngine';

const PRI_TONE = { P1: 'crit', P2: 'warn', P3: 'info' } as const;
const PRI_LABEL = { P1: 'P1 · CRITICAL', P2: 'P2 · HIGH', P3: 'P3 · LOW' };

export type AlarmState = 'UNACK' | 'ACKED' | 'SHELVED';

export function useAllAlarms() {
  const fleet = useFleet();
  const live = useLiveAlarms();
  const actions = useTwin((s) => s.alarmActions);
  const now = useTwin((s) => s.simTime);
  return useMemo(() => {
    const ids = new Set(live.map((a) => a.id));
    const all = [...live, ...fleet.alarms.filter((a) => !ids.has(a.id))];
    return all.map((a) => {
      const act = actions[a.id];
      const state: AlarmState = act?.state === 'SHELVED' && (act.until ?? 0) > now ? 'SHELVED' : act?.state === 'ACKED' ? 'ACKED' : 'UNACK';
      return { ...a, state, act };
    });
  }, [fleet.alarms, live, actions, now]);
}

export default function AlarmsPage() {
  const alarms = useAllAlarms();
  const ack = useTwin((s) => s.ackAlarm);
  const shelve = useTwin((s) => s.shelveAlarm);
  const unshelve = useTwin((s) => s.unshelveAlarm);
  const role = useTwin((s) => s.role);
  const [pri, setPri] = useState<'ALL' | FieldAlarm['priority']>('ALL');
  const [cat, setCat] = useState<'ALL' | FieldAlarm['category']>('ALL');
  const [showShelved, setShowShelved] = useState(false);

  const order = { P1: 0, P2: 1, P3: 2 };
  const stateOrder = { UNACK: 0, ACKED: 1, SHELVED: 2 };
  const rows = alarms
    .filter((a) => (pri === 'ALL' || a.priority === pri) && (cat === 'ALL' || a.category === cat) && (showShelved || a.state !== 'SHELVED'))
    .sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || order[a.priority] - order[b.priority] || b.raisedAt - a.raisedAt);
  const count = (f: (a: (typeof alarms)[number]) => boolean) => alarms.filter(f).length;
  const cats: FieldAlarm['category'][] = ['PROCESS', 'EQUIPMENT', 'TANK', 'DATA', 'CSS', 'AUTOMATION'];

  return (
    <div className="p-4">
      <PageTitle
        title="Alarms & events — field"
        sub={
          <>
            Prioritised alarm list (ISA-18.2 style: priority, acknowledge, shelve) across all 52 wells · <Prov kind="SIMULATED" /> · signed in as <b>{ROLE_LABEL[role]}</b>
          </>
        }
      />
      <StatStrip cols={6}>
        <Stat label="P1 · critical" value={count((a) => a.priority === 'P1' && a.state !== 'SHELVED')} tone={count((a) => a.priority === 'P1' && a.state !== 'SHELVED') ? 'crit' : 'ok'} />
        <Stat label="P2 · high" value={count((a) => a.priority === 'P2' && a.state !== 'SHELVED')} tone="warn" />
        <Stat label="P3 · low" value={count((a) => a.priority === 'P3' && a.state !== 'SHELVED')} />
        <Stat label="Unacknowledged" value={count((a) => a.state === 'UNACK')} tone={count((a) => a.state === 'UNACK') ? 'warn' : 'ok'} />
        <Stat label="Shelved" value={count((a) => a.state === 'SHELVED')} />
        <Stat label="Wells with alarms" value={new Set(alarms.filter((a) => a.state !== 'SHELVED').map((a) => a.wellId)).size} sub="of 52" />
      </StatStrip>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label">Priority</span>
        {(['ALL', 'P1', 'P2', 'P3'] as const).map((p) => (
          <button key={p} className={`btn px-2 py-1 text-[11px] ${pri === p ? 'btn-primary' : ''}`} onClick={() => setPri(p)}>
            {p}
          </button>
        ))}
        <span className="label ml-3">Category</span>
        {(['ALL', ...cats] as const).map((c) => (
          <button key={c} className={`btn px-2 py-1 text-[11px] ${cat === c ? 'btn-primary' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11.5px] text-ink-2">
          <input type="checkbox" checked={showShelved} onChange={(e) => setShowShelved(e.target.checked)} /> show shelved
        </label>
      </div>

      <Panel title={`Active alarms (${rows.length})`} icon={<BellRing size={13} />} className="mt-3">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Well</th>
                <th>Category</th>
                <th>Message</th>
                <th>Raised</th>
                <th>Recommended action</th>
                <th>State</th>
                <th className="text-right">Operator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className={a.state === 'UNACK' && a.priority === 'P1' ? 'bg-crit-bg/60' : a.state === 'SHELVED' ? 'opacity-55' : ''}>
                  <td>
                    <Badge tone={PRI_TONE[a.priority]}>{PRI_LABEL[a.priority]}</Badge>
                  </td>
                  <td className="num font-semibold">
                    <Link to={`/well/${a.wellId}`} className="text-ind-600 hover:underline">
                      {a.wellId}
                    </Link>
                  </td>
                  <td className="text-[11px] text-ink-3">{a.category}</td>
                  <td className="font-medium">{a.message}</td>
                  <td className="num text-[11px] text-ink-3">{fmtDateTime(a.raisedAt)}</td>
                  <td className="max-w-[280px] text-[11.5px] text-ink-2">{a.action}</td>
                  <td>
                    {a.state === 'UNACK' ? (
                      <span className="pulse text-[11px] font-semibold text-crit">UNACK</span>
                    ) : a.state === 'ACKED' ? (
                      <span className="text-[11px] text-ok">ACK · {a.act ? ROLE_LABEL[a.act.by] : ''}</span>
                    ) : (
                      <span className="text-[11px] text-ink-3">SHELVED → {a.act?.until ? fmtDateTime(a.act.until) : ''}</span>
                    )}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {a.state === 'UNACK' && (
                      <button className="btn px-2 py-[2px] text-[11px]" onClick={() => ack(a.id)}>
                        <Check size={12} /> ACK
                      </button>
                    )}
                    {a.state !== 'SHELVED' ? (
                      <button className="btn ml-1 px-2 py-[2px] text-[11px]" onClick={() => shelve(a.id, 4)} title="Suppress for 4 h (nuisance / known issue)">
                        <EyeOff size={12} /> SHELVE 4H
                      </button>
                    ) : (
                      <button className="btn px-2 py-[2px] text-[11px]" onClick={() => unshelve(a.id)}>
                        <Clock size={12} /> UNSHELVE
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-ink-3">
                    No alarms match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="mt-3">
        <Note>
          Alarms come from four sources: live twin forecasts (selected well), field equipment state, well-site tanks, and data-quality checks. In production they would also come from the RPC/SCADA. ISA-18.2 recommends that each operator sees no more than ~6 alarms per hour on average; shelving is logged against the signed-in role.
        </Note>
      </div>
    </div>
  );
}
