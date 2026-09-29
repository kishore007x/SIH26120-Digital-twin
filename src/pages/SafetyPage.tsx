import { useMemo, useState } from 'react';
import { ChevronRight, ShieldCheck, FlaskConical } from 'lucide-react';
import { useTwin } from '../store/twinStore';
import { SafetyEnvelope } from '../components/safety/SafetyEnvelope';
import { ApprovalPanel } from '../components/safety/ApprovalPanel';
import { RecommendationPanel } from '../components/intelligence/RecommendationPanel';
import { Note, PageTitle, Panel } from '../components/common/ui';
import { validateRecommendation } from '../services/safetyEngine';
import { buildForecast } from '../services/recommendationEngine';
import { vfdForSpm } from '../services/srpModel';
import type { Recommendation } from '../types';
import { fmtSimTime } from '../lib/format';

function Flow({ stage, auto }: { stage: number; auto: boolean }) {
  const steps = ['Prediction', 'Recommendation', 'Safety gate', auto ? 'Auto-execute (operator may intervene)' : 'Field officer approval', 'Simulated change'];
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11.5px]">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`rounded-[2px] border px-2 py-0.5 font-semibold tracking-wide uppercase ${i < stage ? 'border-steel-400 bg-steel-100 text-steel-600' : i === stage ? 'border-ind-500 bg-ind-600 text-white' : 'border-line bg-white text-ink-3'}`}>{s}</span>
          {i < steps.length - 1 && <ChevronRight size={13} className="text-ink-3" />}
        </span>
      ))}
      <span className="ml-3 text-[11px] text-ink-3">(never Prediction → direct control)</span>
    </div>
  );
}

function TestBench() {
  const cal = useTwin((s) => s.cal);
  const spm = useTwin((s) => s.spm);
  const stroke = useTwin((s) => s.stroke);
  const h = useTwin((s) => s.h);
  const confirmed = useTwin((s) => s.computed.coolingConfirmed);
  const [test, setTest] = useState(13);
  const result = useMemo(() => {
    const current = Math.round(spm);
    const forecast = buildForecast({ cal, nowH: Math.round(h * 2) / 2, coolingConfirmed: confirmed, spm: current, stroke, timestamp: 0 });
    const rec: Recommendation = {
      id: 'TEST',
      parameter: 'SPM',
      currentValue: current,
      recommendedValue: test,
      currentVfd: vfdForSpm(current),
      recommendedVfd: vfdForSpm(test),
      stroke,
      reason: 'test',
      confidence: forecast.temperature.confidence,
      safetyStatus: 'PENDING',
      issuedAtH: h,
      horizonH: forecast.horizonH,
      forecast,
      candidates: [],
    };
    return validateRecommendation(rec, { cal, currentSpm: current, stroke });
  }, [cal, spm, stroke, h, confirmed, test]);
  return (
    <Panel title="Safety engine test bench" icon={<FlaskConical size={13} />} right={<span className="text-[11px] text-ink-3">validation only — never executes</span>}>
      <div className="p-3">
        <div className="flex items-center gap-3">
          <span className="label">Test proposal</span>
          <input type="range" min={3} max={14} step={0.5} value={test} onChange={(e) => setTest(Number(e.target.value))} className="flex-1" aria-label="Test SPM" />
          <span className="num w-16 text-right text-[14px] font-semibold">{test} SPM</span>
        </div>
        <div className="mt-2">
          {result.safe ? (
            <Note tone="ok">Within envelope{result.warnings.length ? ` (warnings: ${result.warnings.join('; ')})` : ''}.</Note>
          ) : (
            <Note tone="crit">
              <b>REJECTED:</b> {result.violations.join(' · ')}
            </Note>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function SafetyPage() {
  const wellId = useTwin((s) => s.wellId);
  const rec = useTwin((s) => s.recommendation);
  const safety = useTwin((s) => s.safety);
  const revealed = useTwin((s) => s.safetyRevealed);
  const status = useTwin((s) => s.scenario.status);
  const decision = useTwin((s) => s.scenario.decision);
  const events = useTwin((s) => s.events);
  const mode = useTwin((s) => s.controlMode);
  const escalation = useTwin((s) => s.escalation);
  const stage = decision === 'APPROVED' ? 5 : decision === 'REJECTED' ? 4 : status === 'AWAITING' ? 3 : safety ? 2 : rec ? 1 : 0;

  return (
    <div className="p-4">
      <PageTitle title={`Safety gate & operator intervention — ${wellId}`} sub="Independent safety engine: validateRecommendation(recommendation, wellState) → { safe, warnings, violations, confidenceStatus }. Only fully-cleared actions may auto-execute." right={<Flow stage={stage} auto={mode === 'AUTO' && !escalation} />} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel title="Safety envelope" icon={<ShieldCheck size={13} />} right={safety && <span className="text-[11px] text-ink-3">confidence status: {safety.confidenceStatus}</span>}>
            {safety ? <SafetyEnvelope result={safety} revealed={revealed} /> : <div className="p-3 text-[12px] text-ink-3">No recommendation under validation. The safety engine runs automatically when a recommendation is issued (scenario phase 9).</div>}
          </Panel>
          {rec && <RecommendationPanel rec={rec} applied={decision} />}
        </div>
        <div className="flex flex-col gap-3">
          <ApprovalPanel />
          <TestBench />
          <Panel title="Audit trail" bodyClass="max-h-[260px] overflow-y-auto">
            {events.length ? (
              <ul className="divide-y divide-[#eef0f2] text-[11.5px]">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-2 px-3 py-1.5">
                    <span className="num shrink-0 text-[10.5px] text-ink-3">{fmtSimTime(e.time, false)}</span>
                    <span className={e.level === 'action' ? 'font-semibold text-ind-600' : e.level === 'warn' ? 'text-warn' : e.level === 'ok' ? 'text-ok' : 'text-ink-2'}>{e.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-3 text-[12px] text-ink-3">No events yet.</div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
