import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, ShieldCheck, UserCheck } from 'lucide-react';
import { AUTO_MIN_CONFIDENCE, useTwin } from '../../store/twinStore';
import { SAFETY_LIMITS } from '../../services/modelConfig';
import { Badge, Panel } from '../common/ui';

/**
 * Who will decide the pending/next action: supervised automation (confidence ≥ threshold)
 * or the field officer (confidence below the automation threshold, or ADVISORY mode).
 */
export function DecisionAuthority() {
  const wellId = useTwin((s) => s.wellId);
  const cal = useTwin((s) => s.cal);
  const mode = useTwin((s) => s.controlMode);
  const rec = useTwin((s) => s.recommendation);
  const liveConf = useTwin((s) => s.computed.forecast.temperature.confidence);
  const status = useTwin((s) => s.scenario.status);
  const decision = useTwin((s) => s.scenario.decision);
  const decidedBy = useTwin((s) => s.scenario.decidedBy);
  const conf = rec?.confidence ?? liveConf;
  const lowConf = conf < AUTO_MIN_CONFIDENCE;
  const officer = mode === 'ADVISORY' || lowConf;
  const pct = conf * 100;

  return (
    <Panel
      title="Decision authority"
      icon={officer ? <UserCheck size={13} /> : <Bot size={13} />}
      right={<Badge tone={officer ? 'warn' : 'ok'}>{officer ? 'FIELD OFFICER' : 'AUTOMATION'}</Badge>}
    >
      <div className="space-y-2.5 p-3">
        {cal.dataIssue && (
          <div className="flex gap-2 rounded-[3px] border border-[#ebcf94] bg-warn-bg px-2.5 py-1.5 text-[11.5px] leading-snug text-[#7a5212]">
            <AlertTriangle size={14} className="mt-[1px] shrink-0" />
            <span>
              <b>Data-quality issue:</b> {cal.dataIssue}
            </span>
          </div>
        )}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label">Model confidence (score)</span>
            <span className={`num text-[18px] font-semibold ${lowConf ? 'text-warn' : 'text-ok'}`}>{pct.toFixed(0)}%</span>
          </div>
          <div className="relative mt-1 h-2.5 rounded-[1px] bg-[#e8ecef]">
            <div className="absolute inset-y-0 left-0 rounded-[1px]" style={{ width: `${pct}%`, background: lowConf ? '#b7791f' : '#3f7d4e' }} />
            <div className="absolute -top-1 -bottom-1 w-[2px] bg-crit" style={{ left: `${SAFETY_LIMITS.minConfidence * 100}%` }} title="Safety minimum" />
            <div className="absolute -top-1 -bottom-1 w-[2px] bg-ink" style={{ left: `${AUTO_MIN_CONFIDENCE * 100}%` }} title="Automation threshold" />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>
              <span className="text-crit">▮</span> {SAFETY_LIMITS.minConfidence * 100}% safety minimum
            </span>
            <span>▮ {AUTO_MIN_CONFIDENCE * 100}% automation threshold</span>
          </div>
        </div>

        {decision ? (
          <div className="rounded-[3px] border border-line bg-[#f7f8f9] px-2.5 py-1.5 text-[12px]">
            Decision recorded: <b>{decision === 'APPROVED' ? 'EXECUTED' : decision.replace('_', ' ')}</b> by <b>{decidedBy === 'AUTOMATION' ? 'supervised automation' : 'field officer'}</b>.
          </div>
        ) : officer ? (
          <div className="rounded-[3px] border border-[#ebcf94] bg-warn-bg px-2.5 py-2 text-[12px] leading-snug text-[#7a5212]">
            <div className="text-[13px] font-bold tracking-wide">FIELD OFFICER APPROVAL REQUIRED</div>
            {mode === 'ADVISORY'
              ? 'ADVISORY mode is selected — every action needs an officer decision.'
              : `Score ${pct.toFixed(0)}% is below the ${AUTO_MIN_CONFIDENCE * 100}% automation threshold, so this well's recommendation will not auto-execute. The officer decides on the Safety page: APPROVE, MODIFY or REJECT.`}
            {conf >= SAFETY_LIMITS.minConfidence && <div className="mt-1 text-[11px]">Confidence is above the {SAFETY_LIMITS.minConfidence * 100}% safety minimum, so approval is permitted.</div>}
          </div>
        ) : (
          <div className="flex gap-2 rounded-[3px] border border-[#b9d5bf] bg-ok-bg px-2.5 py-1.5 text-[12px] text-[#2d5a38]">
            <ShieldCheck size={15} className="mt-[1px] shrink-0" />
            <span>Score meets the automation threshold — a safety-cleared action will auto-execute after the intervention window.</span>
          </div>
        )}

        {officer && rec && !decision && (
          <Link to={`/well/${wellId}/safety`} className={`btn w-full justify-center ${status === 'AWAITING' ? 'btn-primary' : ''}`}>
            <UserCheck size={14} /> {status === 'AWAITING' ? 'REVIEW & DECIDE ON SAFETY PAGE' : 'OPEN SAFETY VALIDATION'}
          </Link>
        )}
      </div>
    </Panel>
  );
}
