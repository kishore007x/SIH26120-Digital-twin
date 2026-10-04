import { useState } from 'react';
import { KeyRound, RadioTower, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { ROLE_LABEL, useTwin, type Role } from '../store/twinStore';
import { dataSource } from '../services/dataSource';
import { SAFETY_LIMITS } from '../services/modelConfig';
import { Badge, Note, PageTitle, Panel, Prov } from '../components/common/ui';
import { ControlModeSwitch } from '../components/safety/ApprovalPanel';
import { fmtDateTime } from '../lib/format';

const MATRIX: { action: string; roles: Record<Role, boolean> }[] = [
  { action: 'View field, twins, forecasts', roles: { FIELD_OPERATOR: true, PRODUCTION_ENGINEER: true, SUPERVISOR: true } },
  { action: 'HOLD / REJECT / ROLL BACK an action', roles: { FIELD_OPERATOR: true, PRODUCTION_ENGINEER: true, SUPERVISOR: true } },
  { action: 'APPROVE / MODIFY an escalated action', roles: { FIELD_OPERATOR: true, PRODUCTION_ENGINEER: true, SUPERVISOR: true } },
  { action: 'Acknowledge / shelve alarms', roles: { FIELD_OPERATOR: true, PRODUCTION_ENGINEER: true, SUPERVISOR: true } },
  { action: 'Switch AUTO ↔ ADVISORY', roles: { FIELD_OPERATOR: false, PRODUCTION_ENGINEER: true, SUPERVISOR: true } },
  { action: 'Change automation policy (thresholds, window)', roles: { FIELD_OPERATOR: false, PRODUCTION_ENGINEER: false, SUPERVISOR: true } },
  { action: 'Enable / disable automation per well', roles: { FIELD_OPERATOR: false, PRODUCTION_ENGINEER: false, SUPERVISOR: true } },
  { action: 'Change safety limits (envelope)', roles: { FIELD_OPERATOR: false, PRODUCTION_ENGINEER: false, SUPERVISOR: false } },
];

export default function GovernancePage() {
  const role = useTwin((s) => s.role);
  const setRole = useTwin((s) => s.setRole);
  const policy = useTwin((s) => s.policy);
  const updatePolicy = useTwin((s) => s.updatePolicy);
  const setWellAutomation = useTwin((s) => s.setWellAutomation);
  const edge = useTwin((s) => s.edge);
  const setComms = useTwin((s) => s.setCommsOnline);
  const moc = useTwin((s) => s.moc);
  const events = useTwin((s) => s.events);
  const [conf, setConf] = useState(Math.round(policy.autoMinConfidence * 100));
  const [win, setWin] = useState(policy.autoWindowS);
  const [reason, setReason] = useState('');
  const sup = role === 'SUPERVISOR';
  const producing = dataSource.listWells().filter((w) => w.status === 'PRODUCING' || w.status === 'AT_RISK');
  const dirty = conf !== Math.round(policy.autoMinConfidence * 100) || win !== policy.autoWindowS;

  return (
    <div className="p-4">
      <PageTitle title="Automation & governance" sub="Who may do what, how automation is bounded, how the twin talks to the wellsite controller, and a record of every policy change (management of change)." />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="Signed-in role (demo)" icon={<Users size={13} />}>
          <div className="space-y-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <button key={r} className={`btn px-2 py-1 text-[11px] ${role === r ? 'btn-primary' : ''}`} onClick={() => setRole(r)}>
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="text-[11.5px] text-ink-3">In production this comes from single sign-on (e.g. Azure AD / LDAP) with role-based access control. Here you can switch roles to see how permissions change.</div>
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="label">Control mode</span>
              <ControlModeSwitch />
            </div>
          </div>
        </Panel>

        <Panel title="Automation policy" icon={<KeyRound size={13} />} right={<Badge tone={sup ? 'ok' : 'neutral'}>{sup ? 'EDITABLE' : 'SUPERVISOR ONLY'}</Badge>}>
          <div className="space-y-3 p-3">
            <div>
              <div className="flex justify-between">
                <span className="label">Automation confidence threshold</span>
                <span className="num font-semibold">{conf}%</span>
              </div>
              <input type="range" min={Math.round(SAFETY_LIMITS.minConfidence * 100)} max={98} value={conf} aria-label="Automation confidence threshold (%)" disabled={!sup} onChange={(e) => setConf(Number(e.target.value))} className="w-full" />
              <div className="text-[10.5px] text-ink-3">Never below the {SAFETY_LIMITS.minConfidence * 100}% safety minimum. Wells below this threshold escalate to the officer.</div>
            </div>
            <div>
              <div className="flex justify-between">
                <span className="label">Operator intervention window</span>
                <span className="num font-semibold">{win} s</span>
              </div>
              <input type="range" min={5} max={60} value={win} aria-label="Operator intervention window (seconds)" disabled={!sup} onChange={(e) => setWin(Number(e.target.value))} className="w-full" />
            </div>
            <input className="w-full rounded-[3px] border border-line px-2 py-1 text-[12px]" placeholder="Reason for change (required, recorded in MOC log)" value={reason} disabled={!sup} onChange={(e) => setReason(e.target.value)} />
            <button
              className="btn btn-primary w-full justify-center"
              disabled={!sup || !dirty || reason.trim().length < 4}
              onClick={() => {
                if (updatePolicy({ autoMinConfidence: conf / 100, autoWindowS: win }, reason.trim())) setReason('');
              }}
            >
              APPLY POLICY CHANGE
            </button>
            {!sup && <div className="text-[11px] text-warn">Switch to the Supervisor role to edit the policy.</div>}
          </div>
        </Panel>

        <Panel title="Wellsite rod pump controller (RPC) link" icon={<RadioTower size={13} />} right={<Badge tone={edge.commsOnline ? 'ok' : 'crit'}>{edge.commsOnline ? 'ONLINE' : 'COMMS LOST'}</Badge>}>
          <div className="space-y-2 p-3 text-[12px]">
            <div className="flex justify-between">
              <span className="text-ink-2">RPC mode</span>
              <b>{edge.rpcMode === 'SUPERVISED' ? 'SUPERVISED (twin setpoints within limits)' : 'LOCAL POC (fail-safe)'}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">Last setpoint</span>
              <span className="num">{edge.lastSetpoint ? `SPM ≤ ${edge.lastSetpoint.spmMax}, fillage ${edge.lastSetpoint.fillageTarget[0]}–${edge.lastSetpoint.fillageTarget[1]} %, ack ${edge.lastSetpoint.ackMs / 1000} s` : 'none issued this session'}</span>
            </div>
            <div className="rounded-[3px] border border-line bg-[#faf3ea] p-2 text-[11.5px] leading-snug text-ink-2">
              The twin never drives the motor directly. It sends <b>bounded setpoints</b> (speed limit and fillage target) to the wellsite RPC. The RPC keeps closed-loop, stroke-by-stroke control using the downhole card. If the link drops, the RPC keeps the last safe setpoint and falls back to its own pump-off control.
            </div>
            <button className={`btn w-full justify-center ${edge.commsOnline ? 'btn-crit' : 'btn-ok'}`} disabled={role === 'FIELD_OPERATOR'} onClick={() => setComms(!edge.commsOnline)}>
              {edge.commsOnline ? 'SIMULATE COMMS LOSS' : 'RESTORE COMMS'}
            </button>
            {role === 'FIELD_OPERATOR' && <div className="text-[11px] text-ink-3">Engineer or Supervisor role required for this test.</div>}
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Authority matrix" icon={<ShieldCheck size={13} />}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Action</th>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <th key={r} className={`text-center ${r === role ? 'text-ind-600' : ''}`}>
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((m) => (
                <tr key={m.action}>
                  <td>{m.action}</td>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <td key={r} className={`text-center font-semibold ${m.roles[r] ? 'text-ok' : 'text-[#c3ccd5]'}`}>
                      {m.roles[r] ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line px-3 py-2 text-[11px] text-ink-3">Safety limits are engineering-controlled configuration. Nobody can change them from the UI; changes go through formal MOC and code review.</div>
        </Panel>
        <Panel title="Per-well automation" right={<Prov kind="CONFIGURED" />}>
          <div className="max-h-[300px] overflow-auto" tabIndex={0} role="region" aria-label="Management of change log">
            <table className="tbl">
              <thead className="sticky top-0">
                <tr>
                  <th>Well</th>
                  <th>Automation</th>
                  <th className="text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {producing.map((w) => {
                  const on = !policy.autoDisabledWells.includes(w.id);
                  return (
                    <tr key={w.id}>
                      <td className="num font-semibold">{w.id}</td>
                      <td>
                        <Badge tone={on ? 'ok' : 'warn'}>{on ? 'SUPERVISED AUTO' : 'OFFICER ONLY'}</Badge>
                      </td>
                      <td className="text-right">
                        <button className="btn px-2 py-[2px] text-[11px]" disabled={!sup} onClick={() => setWellAutomation(w.id, !on, reason.trim() || 'Per-well automation change')}>
                          {on ? 'DISABLE' : 'ENABLE'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel title="Management of change (MOC) log" icon={<ScrollText size={13} />}>
          {moc.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Role</th>
                  <th>Change</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {moc.map((m, i) => (
                  <tr key={i}>
                    <td className="num text-[11px]">{fmtDateTime(m.time)}</td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td className="font-medium">{m.change}</td>
                    <td className="text-ink-2">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-3 text-[12px] text-ink-3">No policy changes this session.</div>
          )}
        </Panel>
        <Panel title="Audit trail (all actions)" bodyClass="max-h-[280px] overflow-y-auto">
          {events.length ? (
            <ul className="divide-y divide-[#f3eadf] text-[11.5px]">
              {events.map((e, i) => (
                <li key={i} className="flex gap-2 px-3 py-1.5">
                  <span className="num shrink-0 text-[10.5px] text-ink-3">{fmtDateTime(e.time)}</span>
                  <span className={e.level === 'action' ? 'font-semibold text-ind-600' : e.level === 'warn' ? 'text-warn' : e.level === 'ok' ? 'text-ok' : 'text-ink-2'}>{e.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-[12px] text-ink-3">No events yet.</div>
          )}
        </Panel>
      </div>
      <div className="mt-3">
        <Note>In production the audit trail and MOC log are written to append-only storage. Each approval carries the user identity from single sign-on and an electronic signature, for regulatory and incident review.</Note>
      </div>
    </div>
  );
}
