import { useState } from 'react';
import { Bot, Check, Hand, Pencil, RotateCcw, UserCheck, X, AlertOctagon } from 'lucide-react';
import { AUTO_MIN_CONFIDENCE, AUTO_WINDOW_S, useTwin } from '../../store/twinStore';
import { Badge, Panel } from '../common/ui';
import { SAFETY_LIMITS } from '../../services/modelConfig';

/** Control-mode switch (AUTO supervised / ADVISORY). */
export function ControlModeSwitch({ compact = false }: { compact?: boolean }) {
  const mode = useTwin((s) => s.controlMode);
  const setMode = useTwin((s) => s.setControlMode);
  return (
    <span className="flex overflow-hidden rounded-[3px] border border-line" role="group" aria-label="Control mode">
      {(['AUTO', 'ADVISORY'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          title={m === 'AUTO' ? 'Safe recommendations execute automatically; operator may intervene' : 'Every recommendation waits for operator approval'}
          className={`flex items-center gap-1 px-2 py-[3px] text-[10.5px] font-semibold tracking-wide ${mode === m ? (m === 'AUTO' ? 'bg-ok text-white' : 'bg-ind-600 text-white') : 'bg-white text-ink-2 hover:bg-[#f0f3f6]'}`}
        >
          {m === 'AUTO' ? <Bot size={12} /> : <UserCheck size={12} />}
          {m === 'AUTO' ? (compact ? 'AUTO' : 'AUTO (SUPERVISED)') : 'ADVISORY'}
        </button>
      ))}
    </span>
  );
}

export function ApprovalPanel() {
  const status = useTwin((s) => s.scenario.status);
  const decision = useTwin((s) => s.scenario.decision);
  const decidedBy = useTwin((s) => s.scenario.decidedBy);
  const mode = useTwin((s) => s.controlMode);
  const countdown = useTwin((s) => s.autoCountdown);
  const escalation = useTwin((s) => s.escalation);
  const lastChange = useTwin((s) => s.lastChange);
  const rec = useTwin((s) => s.recommendation);
  const orig = useTwin((s) => s.originalRecommendation);
  const safety = useTwin((s) => s.safety);
  const approve = useTwin((s) => s.approve);
  const reject = useTwin((s) => s.reject);
  const hold = useTwin((s) => s.hold);
  const rollback = useTwin((s) => s.rollback);
  const modify = useTwin((s) => s.modifyRecommendation);
  const restore = useTwin((s) => s.restoreRecommendation);
  const [editing, setEditing] = useState(false);
  const awaiting = status === 'AWAITING';
  const canExecute = awaiting && !!safety?.safe;
  const counting = awaiting && countdown !== null;

  const badge = decision
    ? { tone: decision === 'APPROVED' ? ('ok' as const) : ('crit' as const), text: decision === 'APPROVED' ? (decidedBy === 'AUTOMATION' ? 'AUTO-EXECUTED' : 'OPERATOR EXECUTED') : decision === 'ROLLED_BACK' ? 'ROLLED BACK' : 'REJECTED' }
    : counting
      ? { tone: 'warn' as const, text: `AUTO IN ${Math.ceil(countdown!)} s` }
      : escalation
        ? { tone: 'crit' as const, text: 'ESCALATED' }
        : awaiting
          ? { tone: 'warn' as const, text: 'OPERATOR DECISION' }
          : { tone: 'neutral' as const, text: 'NO PENDING ACTION' };

  return (
    <Panel title="Operator intervention" icon={<Hand size={13} />} right={<Badge tone={badge.tone}>{badge.text}</Badge>}>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="label">Control mode</span>
          <ControlModeSwitch />
        </div>
        <div className={`mb-2 rounded-[3px] border px-2.5 py-1.5 text-[11.5px] leading-snug ${mode === 'AUTO' ? 'border-[#b9d5bf] bg-ok-bg text-[#2d5a38]' : 'border-[#ebcf94] bg-warn-bg text-[#7a5212]'}`}>
          {mode === 'AUTO' ? (
            <>
              <b>SUPERVISED AUTOMATION.</b> Recommendations that pass every safety check with no warnings and ≥ {AUTO_MIN_CONFIDENCE * 100}% confidence execute automatically after a {AUTO_WINDOW_S} s intervention window. Anything else is escalated to you. Setpoints are <u>simulated</u>.
            </>
          ) : (
            <>
              <b>ADVISORY.</b> Nothing executes without your explicit approval. Setpoints are <u>simulated</u>.
            </>
          )}
        </div>

        {rec ? (
          <div className="mb-2 text-[12px] text-ink-2">
            Action <b className="num">{rec.id}</b>: SPM <b className="num">{rec.currentValue}</b> → <b className="num text-ind-600">{rec.recommendedValue}</b> (VFD {rec.currentVfd.toFixed(0)} → {rec.recommendedVfd.toFixed(0)} Hz)
            {orig && rec.recommendedValue !== orig.recommendedValue && <span className="ml-1 text-warn">(operator-modified from {orig.recommendedValue})</span>}
          </div>
        ) : (
          <div className="mb-2 text-[12px] text-ink-3">No pending action. Start the demo scenario to generate one.</div>
        )}

        {counting && (
          <div className="mb-2">
            <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
              <span className="font-semibold text-[#7a5212]">Auto-executing — intervene if anything looks wrong</span>
              <span className="num font-semibold">{countdown!.toFixed(1)} s</span>
            </div>
            <div className="h-1.5 rounded-[1px] bg-[#e8ecef]">
              <div className="h-full rounded-[1px] bg-warn transition-[width] duration-200" style={{ width: `${(countdown! / AUTO_WINDOW_S) * 100}%` }} />
            </div>
          </div>
        )}
        {awaiting && escalation && (
          <div className="mb-2 flex gap-2 rounded-[3px] border border-[#e3aca7] bg-crit-bg px-2.5 py-1.5 text-[11.5px] text-crit">
            <AlertOctagon size={15} className="mt-[1px] shrink-0" />
            <span>
              <b>Escalated to operator — automation will not execute.</b> {escalation}
            </span>
          </div>
        )}

        {awaiting && (
          <div className="grid grid-cols-2 gap-2">
            {counting ? (
              <button className="btn justify-center border-warn py-2 text-[12.5px] text-[#7a5212]" onClick={hold}>
                <Hand size={14} /> HOLD
              </button>
            ) : (
              <button className="btn btn-ok justify-center py-2 text-[12.5px]" disabled={!canExecute} onClick={() => approve('OPERATOR')} title={!safety?.safe ? 'Blocked: safety engine violations' : undefined}>
                <Check size={15} /> {mode === 'AUTO' && !escalation ? 'EXECUTE' : 'APPROVE'}
              </button>
            )}
            {counting ? (
              <button className="btn btn-ok justify-center py-2 text-[12.5px]" onClick={() => approve('OPERATOR')}>
                <Check size={15} /> EXECUTE NOW
              </button>
            ) : (
              <button className={`btn justify-center py-2 text-[12.5px] ${editing ? 'btn-primary' : ''}`} onClick={() => setEditing((v) => !v)}>
                <Pencil size={14} /> MODIFY
              </button>
            )}
            {counting && (
              <button className={`btn justify-center py-2 text-[12.5px] ${editing ? 'btn-primary' : ''}`} onClick={() => setEditing(true)}>
                <Pencil size={14} /> MODIFY
              </button>
            )}
            <button className={`btn btn-crit justify-center py-2 text-[12.5px] ${counting ? '' : 'col-span-2'}`} onClick={reject}>
              <X size={15} /> REJECT
            </button>
          </div>
        )}
        {awaiting && !safety?.safe && <div className="mt-2 text-[11.5px] font-semibold text-crit">Execution blocked: the proposal violates the safety envelope. Modify or reject.</div>}

        {editing && awaiting && rec && (
          <div className="reveal mt-3 rounded-[3px] border border-line bg-[#f7f8f9] p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="label">Modified SPM</span>
              <span className="num text-[15px] font-semibold">{rec.recommendedValue}</span>
            </div>
            <input type="range" min={3} max={14} step={0.5} value={rec.recommendedValue} onChange={(e) => modify(Number(e.target.value))} className="w-full" aria-label="Modified SPM" />
            <div className="flex justify-between text-[10px] text-ink-3">
              <span>3</span>
              <span>envelope {SAFETY_LIMITS.minSpm}–{SAFETY_LIMITS.maxSpm}</span>
              <span>14</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="btn px-2 py-1 text-[11px]" onClick={restore}>
                Restore AI proposal
              </button>
              <button className="btn px-2 py-1 text-[11px]" onClick={() => modify(9)}>
                9 SPM
              </button>
              <button className="btn btn-crit px-2 py-1 text-[11px]" onClick={() => modify(13)} title="Demonstrates the safety engine rejecting an unsafe proposal">
                Test unsafe: 13 SPM
              </button>
            </div>
            <div className="mt-1.5 text-[10.5px] text-ink-3">Modifying hands the decision to you (auto-execution stops); every value is re-validated by the safety engine.</div>
          </div>
        )}

        {lastChange && decision === 'APPROVED' && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-[3px] border border-line bg-[#f7f8f9] px-2.5 py-2 text-[11.5px]">
            <span>
              {lastChange.by === 'AUTOMATION' ? 'Auto-executed' : 'Executed'} <b className="num">SPM {lastChange.fromSpm} → {lastChange.toSpm}</b>
            </span>
            <button className="btn btn-crit px-2 py-1 text-[11px]" onClick={rollback} title="Revert to the previous setpoint">
              <RotateCcw size={12} /> ROLLBACK
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
