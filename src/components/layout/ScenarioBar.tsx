import { useNavigate } from 'react-router-dom';
import { Pause, Play, RotateCcw, ShieldAlert, PlayCircle, CheckCircle2, Hand, X, Bot, AlertOctagon } from 'lucide-react';
import { ControlModeSwitch } from '../safety/ApprovalPanel';
import { FlaskConical } from 'lucide-react';
import { LOW_CONFIDENCE_TEST_WELL } from '../../data/wells';
import { useTwin, currentPhase } from '../../store/twinStore';
import { SCENARIO_PHASES } from '../../data/demoScenario';

export function ScenarioBar() {
  const scenario = useTwin((s) => s.scenario);
  const h = useTwin((s) => s.h);
  const wellId = useTwin((s) => s.wellId);
  const start = useTwin((s) => s.startScenario);
  const pause = useTwin((s) => s.pauseScenario);
  const resume = useTwin((s) => s.resumeScenario);
  const reset = useTwin((s) => s.resetScenario);
  const setAuto = useTwin((s) => s.setAutoNavigate);
  const phase = useTwin(currentPhase);
  const mode = useTwin((s) => s.controlMode);
  const countdown = useTwin((s) => s.autoCountdown);
  const escalation = useTwin((s) => s.escalation);
  const hold = useTwin((s) => s.hold);
  const reject = useTwin((s) => s.reject);
  const rollback = useTwin((s) => s.rollback);
  const lastChange = useTwin((s) => s.lastChange);
  const auto = mode === 'AUTO';
  const nav = useNavigate();
  const { status } = scenario;
  const idle = status === 'IDLE';

  return (
    <div className="shrink-0 border-b border-line bg-[#e9edf1]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5">
        <span className="label mr-1 text-navy-800">DEMO SCENARIO</span>
        {idle || status === 'COMPLETE' ? (
          <button className="btn btn-primary" onClick={start} title="Runs the deterministic ~90 s thermal-decline scenario">
            <PlayCircle size={14} /> {idle ? 'START DEMO SCENARIO' : 'RESTART SCENARIO'}
          </button>
        ) : status === 'PAUSED' ? (
          <button className="btn btn-primary" onClick={resume}>
            <Play size={14} /> RESUME
          </button>
        ) : (
          <button className="btn" onClick={pause} disabled={status === 'AWAITING'}>
            <Pause size={14} /> PAUSE
          </button>
        )}
        {(idle || status === 'COMPLETE') && (
          <button
            className="btn"
            onClick={() => nav(`/well/${LOW_CONFIDENCE_TEST_WELL}/causal?start=1`)}
            title={`Test case: ${LOW_CONFIDENCE_TEST_WELL} has a failed downhole gauge, so model confidence is below the 85% automation threshold — the field officer must approve, modify or reject`}
          >
            <FlaskConical size={13} /> TEST CASE: LOW SCORE ({LOW_CONFIDENCE_TEST_WELL})
          </button>
        )}
        <button className="btn" onClick={reset} disabled={idle}>
          <RotateCcw size={13} /> RESET
        </button>

        <div className="mx-2 hidden h-5 w-px bg-line lg:block" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {phase ? (
            <>
              <span className={`num rounded-[2px] px-1.5 text-[11px] font-semibold text-white ${status === 'AWAITING' ? 'bg-warn' : status === 'COMPLETE' ? 'bg-ok' : 'bg-ind-600'}`}>
                {status === 'COMPLETE' ? 'DONE' : `P${String(phase.n).padStart(2, '0')}`}
              </span>
              <span className="truncate text-[12px] font-semibold text-navy-900">{status === 'COMPLETE' ? 'Scenario complete — review Outcome and History' : auto && phase.autoTitle ? phase.autoTitle : phase.title}</span>
              <span className="hidden truncate text-[11.5px] text-ink-3 xl:inline">— {status === 'COMPLETE' ? 'restart or reset at any time.' : auto && phase.autoNarrative ? phase.autoNarrative : phase.narrative}</span>
            </>
          ) : (
            <span className="truncate text-[12px] text-ink-3">
              Idle · {wellId} on hot-production plateau. Start the scenario to run CSS thermal decline → viscosity → rod load → recommendation → safety gate → automated or operator decision.
            </span>
          )}
        </div>

        {status === 'AWAITING' && countdown !== null && (
          <span className="flex items-center gap-1.5 rounded-[3px] border border-warn bg-warn-bg px-2 py-[3px] text-[11.5px] font-semibold text-[#7a5212]">
            <Bot size={14} /> AUTO-EXECUTING IN <span className="num">{Math.ceil(countdown)} s</span>
            <button className="btn ml-1 px-2 py-[2px] text-[11px]" onClick={hold}>
              <Hand size={12} /> HOLD
            </button>
            <button className="btn btn-crit px-2 py-[2px] text-[11px]" onClick={reject}>
              <X size={12} /> REJECT
            </button>
          </span>
        )}
        {status === 'AWAITING' && countdown === null && (
          <button className={`btn ${escalation ? 'btn-crit-solid' : 'btn-warn-solid'}`} onClick={() => nav(`/well/${wellId}/safety`)}>
            {escalation ? <AlertOctagon size={14} /> : <ShieldAlert size={14} />} {escalation ? 'ESCALATED — OPERATOR ACTION NEEDED' : auto ? 'ON HOLD — OPERATOR DECISION' : 'OPERATOR APPROVAL REQUIRED'}
          </button>
        )}
        {lastChange && scenario.decision === 'APPROVED' && (
          <button className="btn btn-crit" onClick={rollback} title={`Revert ${lastChange.recId}: SPM ${lastChange.toSpm} → ${lastChange.fromSpm}`}>
            <RotateCcw size={13} /> ROLLBACK {lastChange.by === 'AUTOMATION' ? 'AUTO ' : ''}CHANGE
          </button>
        )}
        {status === 'COMPLETE' && (
          <button className="btn" onClick={() => nav(`/well/${wellId}/outcome`)}>
            <CheckCircle2 size={14} className="text-ok" /> VIEW OUTCOME
          </button>
        )}
        <ControlModeSwitch compact />
        <span className="num text-[11px] text-ink-3" title="Scenario hours relative to post-CSS cooling onset (time-compressed)">
          t {h >= 0 ? '+' : '−'}
          {Math.abs(h).toFixed(1)} h
        </span>
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-ink-2 select-none" title="Automatically navigate to the page relevant to each phase">
          <input type="checkbox" checked={scenario.autoNavigate} onChange={(e) => setAuto(e.target.checked)} /> auto-follow
        </label>
      </div>
      {!idle && (
        <div className="flex gap-[2px] px-4 pb-1.5">
          {SCENARIO_PHASES.map((p, i) => {
            const done = i < scenario.phase || status === 'COMPLETE';
            const active = i === scenario.phase && status !== 'COMPLETE';
            const skipped = scenario.decision === 'REJECTED' && (p.id === 'SPM_CHANGE' || p.id === 'ANIMATION');
            return (
              <div
                key={p.id}
                title={`P${p.n} · ${p.title}`}
                className={`h-[5px] flex-1 rounded-[1px] ${
                  skipped ? 'bg-[#d8dde2]' : active ? (status === 'AWAITING' ? 'pulse bg-warn' : 'bg-ind-500') : done ? 'bg-steel-500' : 'bg-[#cfd6dd]'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
