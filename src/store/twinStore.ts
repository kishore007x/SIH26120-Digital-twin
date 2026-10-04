// Global twin state + deterministic demo-scenario orchestration.
//
// The store is the only place that advances time. It calls the pure model
// services (simulationEngine, recommendationEngine, safetyEngine) and keeps
// the human-in-the-loop gate: a recommendation can only change the simulated
// SPM through `approve()`, and only if the safety engine returned `safe`.
//
// Control modes
//   AUTO (supervised, default): a recommendation that clears the safety engine with no
//     warnings and sufficient confidence executes automatically after a short operator
//     intervention window (HOLD / MODIFY / REJECT / EXECUTE NOW). Anything else is
//     ESCALATED to the operator and never auto-executes. Executed changes can be rolled back.
//   ADVISORY: every recommendation waits for explicit operator approval.

import { create } from 'zustand';
import { computeTwin, generateHistory, SIM_EPOCH, type TwinComputed } from '../services/simulationEngine';
import { generateRecommendation, withModifiedValue, type ForecastContext } from '../services/recommendationEngine';
import { validateRecommendation } from '../services/safetyEngine';
import { evaluateSrpAtTemp, riskFromLoad, vfdForSpm } from '../services/srpModel';
import { viscosityAt } from '../services/viscosityModel';
import { FORECAST_HORIZON_H, SAFETY_LIMITS } from '../services/modelConfig';
import { temperatureSigma } from '../services/thermalModel';
import { dataSource } from '../services/dataSource';
import { DEFAULT_WELL } from '../data/wells';
import { SCENARIO_PHASES, SCENARIO_START_H, phaseIndex } from '../data/demoScenario';
import type { HealthLevel, Recommendation, RiskLevel, SafetyResult, TwinSample, ValidationRecord, WellCalibration } from '../types';

export type ScenarioStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'AWAITING' | 'COMPLETE';
export type Decision = 'APPROVED' | 'REJECTED' | 'ROLLED_BACK';
export type ControlMode = 'AUTO' | 'ADVISORY';
export type DecidedBy = 'AUTOMATION' | 'OPERATOR';

/** Default operator intervention window before a safe recommendation auto-executes (real seconds). */
export const AUTO_WINDOW_S = 8;
/** Default minimum model confidence for automatic execution (stricter than the advisory minimum). */
export const AUTO_MIN_CONFIDENCE = 0.85;

export type Role = 'FIELD_OPERATOR' | 'PRODUCTION_ENGINEER' | 'SUPERVISOR';
export const ROLE_LABEL: Record<Role, string> = { FIELD_OPERATOR: 'Field operator', PRODUCTION_ENGINEER: 'Production engineer', SUPERVISOR: 'Supervisor' };

/** Automation policy — editable by a supervisor, every change logged (management of change). */
export interface AutomationPolicy {
  autoMinConfidence: number;
  autoWindowS: number;
  /** Wells excluded from automation (always escalate to the officer). */
  autoDisabledWells: string[];
}

/** Supervisory link to the wellsite rod pump controller (RPC). */
export interface EdgeLink {
  commsOnline: boolean;
  /** SUPERVISED: RPC follows twin setpoints within limits. LOCAL_POC: RPC runs its own pump-off control. */
  rpcMode: 'SUPERVISED' | 'LOCAL_POC';
  lastSetpoint: { spmMax: number; fillageTarget: [number, number]; ackMs: number; at: number } | null;
}

export interface MocEntry {
  time: number;
  role: Role;
  change: string;
  reason: string;
}

export interface AlarmAction {
  state: 'ACKED' | 'SHELVED';
  by: Role;
  at: number;
  until?: number;
}

export interface TwinEvent {
  time: number;
  h: number;
  level: 'info' | 'warn' | 'action' | 'ok';
  text: string;
}

export interface OperatingSnapshot {
  h: number;
  spm: number;
  vfd: number;
  temperature: number;
  viscosity: number;
  rodLoad: number;
  rodLoadPred: number;
  oil: number;
  efficiency: number;
  fillage: number;
  torque: number;
  risk: RiskLevel;
  health: HealthLevel;
}

export interface OutcomeRecord {
  decision: Decision;
  decidedBy: DecidedBy;
  appliedSpm: number;
  before: OperatingSnapshot;
  noAction: { rodLoad: number; oil: number; fillage: number; torque: number; risk: RiskLevel };
  predictedAfter: { rodLoad: number; lower: number; upper: number; oil: number; fillage: number; risk: RiskLevel; temperature: number; viscosity: number };
  observedAfter: OperatingSnapshot;
  errors: { rodLoad: number; temperature: number; viscosity: number };
}

interface ScenarioState {
  status: ScenarioStatus;
  phase: number; // index into SCENARIO_PHASES, -1 when idle
  phaseT: number;
  phaseStartH: number;
  decision: Decision | null;
  decidedBy: DecidedBy | null;
  autoNavigate: boolean;
}

interface TwinStore {
  wellId: string;
  cal: WellCalibration;
  realT: number;
  h: number;
  simTime: number;
  spm: number;
  spmTarget: number;
  stroke: number;
  animationPlaying: boolean;
  coolingDeclared: boolean;
  computed: TwinComputed;
  baseline: TwinComputed | null;
  trend: TwinSample[];
  scenario: ScenarioState;
  recommendation: Recommendation | null;
  originalRecommendation: Recommendation | null;
  safety: SafetyResult | null;
  safetyRevealed: number;
  decisionSnapshot: OperatingSnapshot | null;
  outcome: OutcomeRecord | null;
  runValidation: ValidationRecord | null;
  events: TwinEvent[];
  navTarget: { path: string; seq: number } | null;
  controlMode: ControlMode;
  /** Seconds left before a safe recommendation auto-executes (null = no pending auto action). */
  autoCountdown: number | null;
  /** Why automation handed the decision to the operator. */
  escalation: string | null;
  lastChange: { fromSpm: number; toSpm: number; recId: string; by: DecidedBy } | null;
  policy: AutomationPolicy;
  role: Role;
  edge: EdgeLink;
  moc: MocEntry[];
  alarmActions: Record<string, AlarmAction>;

  selectWell(id: string): void;
  tick(dt: number): void;
  startScenario(): void;
  pauseScenario(): void;
  resumeScenario(): void;
  resetScenario(): void;
  setAutoNavigate(v: boolean): void;
  approve(by?: DecidedBy): void;
  reject(): void;
  hold(): void;
  rollback(): void;
  setControlMode(m: ControlMode): void;
  setRole(r: Role): void;
  updatePolicy(patch: Partial<AutomationPolicy>, reason: string): boolean;
  setWellAutomation(wellId: string, enabled: boolean, reason: string): boolean;
  setCommsOnline(v: boolean): void;
  ackAlarm(id: string): void;
  shelveAlarm(id: string, hours: number): void;
  unshelveAlarm(id: string): void;
  modifyRecommendation(spm: number): void;
  restoreRecommendation(): void;
  setWhatIfSpm(spm: number): void;
  toggleAnimation(): void;
  setAnimation(v: boolean): void;
}

const calFor = (id: string) => (dataSource.getWell(id) ?? dataSource.getWell(DEFAULT_WELL)!).calibration;
const simTimeAt = (realT: number, h: number) => SIM_EPOCH + realT * 1000 + (h - SCENARIO_START_H) * 3600_000;

function compute(s: Pick<TwinStore, 'cal' | 'h' | 'coolingDeclared' | 'spm' | 'stroke' | 'realT'>): TwinComputed {
  return computeTwin({ cal: s.cal, h: s.h, coolingDeclared: s.coolingDeclared, spm: s.spm, stroke: s.stroke, time: simTimeAt(s.realT, s.h), jitter: s.realT });
}

function snapshot(c: TwinComputed): OperatingSnapshot {
  const x = c.sample;
  return {
    h: x.tH,
    spm: x.spm,
    vfd: x.vfd,
    temperature: x.temperature,
    viscosity: x.viscosity,
    rodLoad: x.rodLoad,
    rodLoadPred: x.rodLoadPred,
    oil: x.oil,
    efficiency: x.pumpEfficiency,
    fillage: x.pumpFillage,
    torque: x.torque,
    risk: c.risk,
    health: c.health,
  };
}

function initialState(wellId: string, realT = 0) {
  const cal = calFor(wellId);
  const base = { cal, h: SCENARIO_START_H, coolingDeclared: false, spm: cal.spmRef, stroke: cal.stroke, realT };
  const computed = compute(base);
  return {
    wellId,
    ...base,
    simTime: simTimeAt(realT, SCENARIO_START_H),
    spmTarget: cal.spmRef,
    computed,
    baseline: null,
    trend: generateHistory(cal, cal.spmRef, cal.stroke, SCENARIO_START_H, simTimeAt(realT, SCENARIO_START_H)),
    scenario: { status: 'IDLE' as ScenarioStatus, phase: -1, phaseT: 0, phaseStartH: SCENARIO_START_H, decision: null, decidedBy: null, autoNavigate: true },
    recommendation: null,
    originalRecommendation: null,
    safety: null,
    safetyRevealed: 0,
    decisionSnapshot: null,
    outcome: null,
    runValidation: null,
    events: [] as TwinEvent[],
    autoCountdown: null as number | null,
    escalation: null as string | null,
    lastChange: null as TwinStore['lastChange'],
  };
}

let navSeq = 0;

/** Why a recommendation may NOT be auto-executed (null = eligible). */
export function autoBlocker(
  rec: Recommendation | null,
  safety: SafetyResult | null,
  ctx: { policy?: AutomationPolicy; wellId?: string; edge?: EdgeLink } = {},
): string | null {
  const minConf = ctx.policy?.autoMinConfidence ?? AUTO_MIN_CONFIDENCE;
  if (!rec || !safety) return 'No recommendation';
  if (ctx.edge && !ctx.edge.commsOnline) return 'Wellsite RPC communications lost — local pump-off control in effect; no remote setpoints can be issued';
  if (ctx.wellId && ctx.policy?.autoDisabledWells.includes(ctx.wellId)) return `Automation disabled for ${ctx.wellId} by policy — officer decision required`;
  if (!safety.safe) return `Safety engine violations: ${safety.violations.join('; ')}`;
  if (safety.warnings.length) return `Safety warnings require human judgement: ${safety.warnings.join('; ')}`;
  if (rec.confidence < minConf) return `Model confidence ${(rec.confidence * 100).toFixed(0)}% below automation threshold ${Math.round(minConf * 100)}%`;
  return null;
}

export const useTwin = create<TwinStore>((set, get) => {
  const log = (level: TwinEvent['level'], text: string) => {
    const s = get();
    set({ events: [{ time: s.simTime, h: s.h, level, text }, ...s.events].slice(0, 80) });
  };

  const ctx = (): ForecastContext => {
    const s = get();
    return { cal: s.cal, nowH: s.h, coolingConfirmed: s.computed.coolingConfirmed, spm: s.spm, stroke: s.stroke, timestamp: s.simTime };
  };

  const enterPhase = (idx: number) => {
    const s = get();
    if (idx >= SCENARIO_PHASES.length) {
      set({ scenario: { ...s.scenario, status: 'COMPLETE', phase: SCENARIO_PHASES.length - 1, phaseT: 0 } });
      log('ok', 'Demo scenario complete. Outcome and validation recorded.');
      return;
    }
    const p = SCENARIO_PHASES[idx];
    const nav = s.scenario.autoNavigate && p.route !== undefined ? { path: `/well/${s.wellId}${p.route}`, seq: ++navSeq } : s.navTarget;
    set({ scenario: { ...s.scenario, phase: idx, phaseT: 0, phaseStartH: s.h, status: p.id === 'AWAIT_APPROVAL' ? 'AWAITING' : s.scenario.status === 'PAUSED' ? 'PAUSED' : 'RUNNING' }, navTarget: nav });

    switch (p.id) {
      case 'NORMAL':
        log('info', `Scenario started on ${s.wellId}: hot-production plateau, ${s.spm} SPM.`);
        if (s.cal.dataIssue) log('warn', `DATA-QUALITY ISSUE on ${s.wellId}: ${s.cal.dataIssue} Model confidence reduced — actions will need field-officer approval.`);
        break;
      case 'CSS_END':
        set({ coolingDeclared: true });
        log('warn', 'CSS-08 thermal support ended — thermal model switched to post-CSS decay.');
        break;
      case 'THERMAL_DECLINE':
        set({ baseline: get().computed });
        log('info', 'Thermal decline onset recorded (baseline snapshot captured for causal analysis).');
        break;
      case 'TEMP_DECREASE':
        log('info', `Simulated intake temperature ${get().computed.sample.temperature.toFixed(1)} °C and falling.`);
        break;
      case 'VISC_INCREASE':
        log('info', `Viscosity rising: ${get().computed.sample.viscosity.toFixed(0)} cP (μ = A·exp(B/T)).`);
        break;
      case 'LOAD_PREDICT':
        log('warn', 'Cooling trend confirmed (≥6 h). +24 h rod-load forecast now includes thermal decline.');
        break;
      case 'RISK_HIGH': {
        const f = get().computed.forecast;
        log('warn', `Predicted rod load ${f.rodLoadCurrentSpm.value.toFixed(0)}% at +24 h → risk ${f.riskCurrentSpm}. Detected before equipment degradation.`);
        break;
      }
      case 'RECOMMEND': {
        const rec = generateRecommendation(ctx(), get().h);
        if (!rec) {
          log('info', 'Forecast within target band — no recommendation required. Scenario ends.');
          set({ scenario: { ...get().scenario, status: 'COMPLETE' } });
          return;
        }
        set({ recommendation: rec, originalRecommendation: rec });
        log('action', `AI-assisted recommendation ${rec.id}: SPM ${rec.currentValue} → ${rec.recommendedValue} (confidence ${(rec.confidence * 100).toFixed(0)}%).`);
        break;
      }
      case 'SAFETY': {
        const rec = get().recommendation;
        if (rec) {
          const result = validateRecommendation(rec, { cal: s.cal, currentSpm: s.spm, stroke: s.stroke });
          set({ safety: result, safetyRevealed: 0, recommendation: { ...rec, safetyStatus: result.safe ? 'PASSED' : 'FAILED' } });
        }
        break;
      }
      case 'AWAIT_APPROVAL': {
        const sf = get().safety;
        set({ safetyRevealed: sf?.checks.length ?? 0 });
        log(sf?.safe ? 'ok' : 'warn', sf?.safe ? 'ALL SAFETY CHECKS PASSED — recommendation within safety envelope.' : 'Safety engine flagged violations — execution blocked.');
        armAutomation();
        break;
      }
      case 'OUTCOME':
        buildOutcome();
        break;
      case 'VALIDATION': {
        const o = get().outcome;
        if (o) {
          const acc = (e: number) => Math.max(0, 100 - e);
          set({
            runValidation: {
              cycle: 'CSS-08',
              period: 'This run (demo)',
              temperatureAcc: acc(o.errors.temperature),
              viscosityAcc: acc(o.errors.viscosity),
              rodLoadAcc: acc(o.errors.rodLoad),
              dynacardAcc: 94,
              tempBand: `±${temperatureSigma(FORECAST_HORIZON_H).toFixed(1)} °C`,
              recommendation: `SPM ${o.before.spm.toFixed(0)} → ${o.appliedSpm.toFixed(0)}${o.decidedBy === 'AUTOMATION' ? ' (auto)' : ''}`,
              outcome: o.decision === 'APPROVED' ? (get().recommendation?.id.includes('-M') ? 'MODIFIED' : 'ACCEPTED') : 'REJECTED',
              predictedLoad: o.predictedAfter.rodLoad,
              observedLoad: o.observedAfter.rodLoad,
            },
          });
          log('ok', `Validation: predicted rod load ${o.predictedAfter.rodLoad.toFixed(1)}% vs simulated observed ${o.observedAfter.rodLoad.toFixed(1)}% (error ${o.errors.rodLoad.toFixed(1)}%). Record added to trust ledger.`);
        }
        break;
      }
      default:
        break;
    }
  };

  /** Start the intervention countdown, or escalate to the operator. */
  const armAutomation = () => {
    const st = get();
    if (st.scenario.status !== 'AWAITING') return;
    if (st.controlMode !== 'AUTO') {
      set({ autoCountdown: null, escalation: null });
      log('info', 'ADVISORY mode — OPERATOR APPROVAL REQUIRED.');
      return;
    }
    const blocker = autoBlocker(st.recommendation, st.safety, { policy: st.policy, wellId: st.wellId, edge: st.edge });
    if (blocker) {
      set({ autoCountdown: null, escalation: blocker });
      log('warn', `ESCALATED TO OPERATOR — automation will not execute: ${blocker}`);
    } else {
      set({ autoCountdown: st.policy.autoWindowS, escalation: null });
      log('action', `AUTO mode: ${st.recommendation!.id} will execute in ${st.policy.autoWindowS} s unless the operator intervenes (HOLD / MODIFY / REJECT).`);
    }
  };

  const buildOutcome = () => {
    const s = get();
    const rec = s.recommendation;
    const before = s.decisionSnapshot;
    if (!rec || !before || !s.scenario.decision) return;
    const tF = rec.forecast.temperature.value;
    const executed = s.scenario.decision === 'APPROVED';
    const applied = executed ? rec.recommendedValue : rec.currentValue;
    const noAct = evaluateSrpAtTemp(s.cal, rec.currentValue, rec.stroke, tF);
    const pred = evaluateSrpAtTemp(s.cal, applied, rec.stroke, tF);
    const band = executed ? rec.forecast.rodLoadRecommended! : rec.forecast.rodLoadCurrentSpm;
    // Evaluated at the +24 h evaluation point: risk from the observed load (the live forecast keeps rolling forward).
    const obs = { ...snapshot(s.computed), risk: s.computed.currentRisk };
    const pctErr = (p: number, o: number) => (Math.abs(p - o) / Math.abs(p)) * 100;
    set({
      outcome: {
        decision: s.scenario.decision,
        decidedBy: s.scenario.decidedBy ?? 'OPERATOR',
        appliedSpm: applied,
        before,
        noAction: { rodLoad: noAct.rodLoad, oil: noAct.oil, fillage: noAct.pumpFillage, torque: noAct.torque, risk: riskFromLoad(noAct.rodLoad) },
        predictedAfter: { rodLoad: pred.rodLoad, lower: band.lowerBound, upper: band.upperBound, oil: pred.oil, fillage: pred.pumpFillage, risk: riskFromLoad(pred.rodLoad), temperature: tF, viscosity: viscosityAt(tF) },
        observedAfter: obs,
        errors: { rodLoad: pctErr(pred.rodLoad, obs.rodLoad), temperature: pctErr(tF, obs.temperature), viscosity: pctErr(viscosityAt(tF), obs.viscosity) },
      },
    });
    log('ok', `Outcome at +24 h: rod load ${obs.rodLoad.toFixed(0)}% (simulated observed), oil ${obs.oil.toFixed(1)} BOPD.`);
  };

  return {
    ...initialState(DEFAULT_WELL),
    navTarget: null,
    animationPlaying: true,
    controlMode: 'AUTO' as ControlMode,
    policy: { autoMinConfidence: AUTO_MIN_CONFIDENCE, autoWindowS: AUTO_WINDOW_S, autoDisabledWells: [] } as AutomationPolicy,
    role: 'FIELD_OPERATOR' as Role,
    edge: { commsOnline: true, rpcMode: 'SUPERVISED', lastSetpoint: null } as EdgeLink,
    moc: [] as MocEntry[],
    alarmActions: {} as Record<string, AlarmAction>,

    selectWell(id) {
      const s = get();
      if (id === s.wellId) return;
      if (!dataSource.getWell(id)) return;
      set({ ...initialState(id, s.realT), scenario: { ...initialState(id).scenario, autoNavigate: s.scenario.autoNavigate } });
    },

    tick(dt) {
      const s = get();
      const realT = s.realT + dt;
      let h = s.h;
      let scenario = s.scenario;
      if (scenario.status === 'RUNNING') {
        const p = SCENARIO_PHASES[scenario.phase];
        const phaseT = scenario.phaseT + dt;
        const frac = Number.isFinite(p.duration) ? Math.min(1, phaseT / p.duration) : 0;
        h = scenario.phaseStartH + (p.hEnd - scenario.phaseStartH) * frac;
        scenario = { ...scenario, phaseT };
        if (p.id === 'SAFETY' && s.safety) {
          const n = Math.min(s.safety.checks.length, Math.floor((phaseT / p.duration) * (s.safety.checks.length + 1)));
          if (n !== s.safetyRevealed) set({ safetyRevealed: n });
        }
      }
      // SPM ramp (VFD acceleration limit)
      let spm = s.spm;
      if (Math.abs(s.spmTarget - spm) > 1e-3) {
        const rate = 0.6 * dt;
        spm = spm + Math.sign(s.spmTarget - spm) * Math.min(rate, Math.abs(s.spmTarget - spm));
      }
      const next = { ...s, realT, h, spm };
      const computed = compute(next);
      const simTime = simTimeAt(realT, h);
      let trend = s.trend;
      const last = trend[trend.length - 1];
      if (last && (h - last.tH >= 0.25 || (Math.abs(spm - last.spm) > 0.25 && h > last.tH))) {
        trend = [...trend, computed.sample].slice(-400);
      }
      set({ realT, h, spm, simTime, computed, trend, scenario });
      if (scenario.status === 'AWAITING' && s.autoCountdown !== null) {
        const left = s.autoCountdown - dt;
        if (left <= 0) {
          set({ autoCountdown: null });
          get().approve('AUTOMATION');
          return;
        }
        set({ autoCountdown: left });
      }
      if (scenario.status === 'RUNNING') {
        const p = SCENARIO_PHASES[scenario.phase];
        if (scenario.phaseT >= p.duration) {
          let nextIdx = scenario.phase + 1;
          // Rejected path skips the setpoint-change phases
          if (scenario.decision === 'REJECTED' && SCENARIO_PHASES[nextIdx]?.id === 'SPM_CHANGE') nextIdx = phaseIndex('LOAD_DECREASE');
          enterPhase(nextIdx);
        }
      }
    },

    startScenario() {
      const s = get();
      const fresh = initialState(s.wellId, s.realT);
      set({ ...fresh, scenario: { ...fresh.scenario, status: 'RUNNING', autoNavigate: s.scenario.autoNavigate }, animationPlaying: true });
      enterPhase(0);
    },
    pauseScenario() {
      const s = get();
      if (s.scenario.status === 'RUNNING') {
        set({ scenario: { ...s.scenario, status: 'PAUSED' } });
        log('info', 'Scenario paused by user.');
      }
    },
    resumeScenario() {
      const s = get();
      if (s.scenario.status === 'PAUSED') {
        set({ scenario: { ...s.scenario, status: 'RUNNING' } });
        log('info', 'Scenario resumed.');
      }
    },
    resetScenario() {
      const s = get();
      const fresh = initialState(s.wellId, s.realT);
      set({ ...fresh, scenario: { ...fresh.scenario, autoNavigate: s.scenario.autoNavigate } });
    },
    setAutoNavigate(v) {
      set({ scenario: { ...get().scenario, autoNavigate: v } });
    },

    approve(by = 'OPERATOR') {
      const s = get();
      if (s.scenario.status !== 'AWAITING' || !s.recommendation || !s.safety?.safe) return;
      // Automation may only execute what the gate cleared; the operator may execute anything the safety engine passed
      if (by === 'AUTOMATION' && autoBlocker(s.recommendation, s.safety, { policy: s.policy, wellId: s.wellId, edge: s.edge })) return;
      // No remote setpoint can be issued while the wellsite RPC is unreachable
      if (!s.edge.commsOnline) return;
      const r = s.recommendation;
      set({
        decisionSnapshot: snapshot(s.computed),
        scenario: { ...s.scenario, decision: 'APPROVED', decidedBy: by, status: 'RUNNING' },
        spmTarget: r.recommendedValue,
        autoCountdown: null,
        escalation: null,
        lastChange: { fromSpm: r.currentValue, toSpm: r.recommendedValue, recId: r.id, by },
        edge: { ...s.edge, rpcMode: 'SUPERVISED', lastSetpoint: { spmMax: r.recommendedValue, fillageTarget: [85, 95], ackMs: 1200, at: s.simTime } },
      });
      log(
        'action',
        by === 'AUTOMATION'
          ? `AUTO-EXECUTED ${r.id}: setpoint pushed to wellsite RPC — SPM limit ${r.recommendedValue} (VFD ${vfdForSpm(r.recommendedValue).toFixed(0)} Hz), fillage target 85–95 %, RPC ack 1.2 s. No operator intervention within ${s.policy.autoWindowS} s; operator may roll back.`
          : `${ROLE_LABEL[s.role].toUpperCase()} APPROVED ${r.id}: setpoint pushed to wellsite RPC — SPM limit ${r.recommendedValue} (VFD ${vfdForSpm(r.recommendedValue).toFixed(0)} Hz), fillage target 85–95 %.`,
      );
      enterPhase(phaseIndex('APPROVED'));
    },
    reject() {
      const s = get();
      if (s.scenario.status !== 'AWAITING' || !s.recommendation) return;
      set({ decisionSnapshot: snapshot(s.computed), scenario: { ...s.scenario, decision: 'REJECTED', decidedBy: 'OPERATOR', status: 'RUNNING' }, autoCountdown: null, escalation: null });
      log('warn', `OPERATOR INTERVENED — rejected ${s.recommendation.id}. Operating point unchanged at ${s.spm.toFixed(0)} SPM.`);
      enterPhase(phaseIndex('APPROVED'));
    },
    modifyRecommendation(spm) {
      const s = get();
      if (!s.originalRecommendation || s.scenario.status !== 'AWAITING') return;
      const v = Math.round(spm * 2) / 2;
      const rec = v === s.originalRecommendation.recommendedValue ? s.originalRecommendation : withModifiedValue(s.originalRecommendation, ctx(), v);
      const result = validateRecommendation(rec, { cal: s.cal, currentSpm: s.spm, stroke: s.stroke });
      // Operator engagement suspends the auto-execution timer; the operator now owns the decision
      set({ recommendation: { ...rec, safetyStatus: result.safe ? 'PASSED' : 'FAILED' }, safety: result, safetyRevealed: result.checks.length, autoCountdown: null, escalation: null });
      log(result.safe ? 'info' : 'warn', `Operator modified proposal to ${v} SPM → safety engine: ${result.safe ? 'within envelope' : `REJECTED (${result.violations.length} violation${result.violations.length > 1 ? 's' : ''})`}.`);
    },
    hold() {
      const s = get();
      if (s.scenario.status !== 'AWAITING' || s.autoCountdown === null) return;
      set({ autoCountdown: null });
      log('warn', `OPERATOR HOLD — auto-execution of ${s.recommendation?.id} suspended. Awaiting operator decision.`);
    },
    rollback() {
      const s = get();
      const lc = s.lastChange;
      if (!lc || s.scenario.decision !== 'APPROVED') return;
      set({ spmTarget: lc.fromSpm, scenario: { ...s.scenario, decision: 'ROLLED_BACK', decidedBy: 'OPERATOR' }, lastChange: null });
      log('warn', `OPERATOR ROLLBACK — ${lc.recId} reverted: SPM ${lc.toSpm} → ${lc.fromSpm}. Simulated setpoint restored.`);
      if (s.outcome) buildOutcome();
    },
    setControlMode(m) {
      const s = get();
      if (m === s.controlMode) return;
      if (s.role === 'FIELD_OPERATOR') {
        log('warn', 'Control-mode change refused: requires Production engineer or Supervisor role.');
        return;
      }
      set({ controlMode: m });
      log('info', m === 'AUTO' ? 'Control mode → AUTO (supervised): safe recommendations execute automatically; operator may intervene.' : 'Control mode → ADVISORY: every recommendation requires operator approval.');
      if (s.scenario.status === 'AWAITING') {
        if (m === 'ADVISORY') set({ autoCountdown: null, escalation: null });
        else armAutomation();
      }
    },
    setRole(r) {
      set({ role: r });
      log('info', `Signed-in role → ${ROLE_LABEL[r]} (demo role switch).`);
    },
    updatePolicy(patch, reason) {
      const s = get();
      if (s.role !== 'SUPERVISOR') return false;
      const next = { ...s.policy, ...patch };
      const parts: string[] = [];
      if (patch.autoMinConfidence !== undefined) parts.push(`automation threshold ${Math.round(s.policy.autoMinConfidence * 100)}% → ${Math.round(next.autoMinConfidence * 100)}%`);
      if (patch.autoWindowS !== undefined) parts.push(`intervention window ${s.policy.autoWindowS}s → ${next.autoWindowS}s`);
      set({ policy: next, moc: [{ time: s.simTime, role: s.role, change: parts.join('; ') || 'policy updated', reason: reason || '—' }, ...s.moc] });
      log('warn', `POLICY CHANGE (MOC) by supervisor: ${parts.join('; ')}. Reason: ${reason || '—'}`);
      if (get().scenario.status === 'AWAITING' && get().autoCountdown === null && !get().scenario.decision) armAutomation();
      return true;
    },
    setWellAutomation(wellId, enabled, reason) {
      const s = get();
      if (s.role !== 'SUPERVISOR') return false;
      const dis = new Set(s.policy.autoDisabledWells);
      if (enabled) dis.delete(wellId);
      else dis.add(wellId);
      set({ policy: { ...s.policy, autoDisabledWells: [...dis] }, moc: [{ time: s.simTime, role: s.role, change: `${wellId} automation ${enabled ? 'ENABLED' : 'DISABLED'}`, reason: reason || '—' }, ...s.moc] });
      log('warn', `POLICY CHANGE (MOC): ${wellId} automation ${enabled ? 'enabled' : 'disabled'}. Reason: ${reason || '—'}`);
      return true;
    },
    setCommsOnline(v) {
      const s = get();
      if (s.edge.commsOnline === v) return;
      set({ edge: { ...s.edge, commsOnline: v, rpcMode: v ? s.edge.rpcMode : 'LOCAL_POC' } });
      log(v ? 'ok' : 'warn', v ? 'Wellsite RPC communications restored — supervisory setpoints available again.' : 'WELLSITE RPC COMMS LOST — controller fell back to local pump-off control (fail-safe). Automation suspended; last safe setpoint retained.');
      if (!v && s.autoCountdown !== null) set({ autoCountdown: null, escalation: 'Wellsite RPC communications lost — local pump-off control in effect' });
      if (v && s.scenario.status === 'AWAITING' && !s.scenario.decision) armAutomation();
    },
    ackAlarm(id) {
      const s = get();
      set({ alarmActions: { ...s.alarmActions, [id]: { state: 'ACKED', by: s.role, at: s.simTime } } });
    },
    shelveAlarm(id, hours) {
      const s = get();
      set({ alarmActions: { ...s.alarmActions, [id]: { state: 'SHELVED', by: s.role, at: s.simTime, until: s.simTime + hours * 3_600_000 } } });
      log('info', `Alarm ${id} shelved for ${hours} h by ${ROLE_LABEL[s.role]}.`);
    },
    unshelveAlarm(id) {
      const s = get();
      const next = { ...s.alarmActions };
      delete next[id];
      set({ alarmActions: next });
    },
    restoreRecommendation() {
      const s = get();
      if (s.originalRecommendation) get().modifyRecommendation(s.originalRecommendation.recommendedValue);
    },
    setWhatIfSpm(spm) {
      const s = get();
      if (s.scenario.status === 'RUNNING' || s.scenario.status === 'AWAITING' || s.scenario.status === 'PAUSED') return;
      const v = Math.max(SAFETY_LIMITS.minSpm, Math.min(SAFETY_LIMITS.maxSpm, spm));
      set({ spmTarget: v });
    },
    toggleAnimation() {
      set({ animationPlaying: !get().animationPlaying });
    },
    setAnimation(v) {
      set({ animationPlaying: v });
    },
  };
});

export const currentPhase = (s: Pick<TwinStore, 'scenario'>) => (s.scenario.phase >= 0 ? SCENARIO_PHASES[s.scenario.phase] : null);
