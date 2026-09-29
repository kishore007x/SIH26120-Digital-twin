// Demo scenario script — deterministic, time-compressed.
// Each phase maps real seconds → scenario hours (hours since cooling onset).
// Phase 10 holds indefinitely until the operator decides.

export type PhaseId =
  | 'NORMAL'
  | 'CSS_END'
  | 'THERMAL_DECLINE'
  | 'TEMP_DECREASE'
  | 'VISC_INCREASE'
  | 'LOAD_PREDICT'
  | 'RISK_HIGH'
  | 'RECOMMEND'
  | 'SAFETY'
  | 'AWAIT_APPROVAL'
  | 'APPROVED'
  | 'SPM_CHANGE'
  | 'ANIMATION'
  | 'LOAD_DECREASE'
  | 'OUTCOME'
  | 'VALIDATION';

export interface ScenarioPhase {
  n: number;
  id: PhaseId;
  title: string;
  narrative: string;
  duration: number; // real seconds (Infinity = hold)
  hStart: number;
  hEnd: number;
  route?: string; // suggested page (relative to /well/:id)
  /** Title/narrative used when the control mode is AUTO (supervised). */
  autoTitle?: string;
  autoNarrative?: string;
}

export const SCENARIO_PHASES: ScenarioPhase[] = [
  { n: 1, id: 'NORMAL', title: 'Normal operation', narrative: 'Well on hot-production plateau after its latest CSS cycle. Pump running at reference SPM.', duration: 7, hStart: -3, hEnd: -1.5, route: '' },
  { n: 2, id: 'CSS_END', title: 'CSS cycle thermal support ends', narrative: 'Steam-heated zone around the wellbore stops being replenished; thermal support from CSS-08 ends.', duration: 6, hStart: -1.5, hEnd: 0, route: '/thermal' },
  { n: 3, id: 'THERMAL_DECLINE', title: 'Thermal decline begins', narrative: 'Physics baseline switches to exponential decay toward reservoir temperature.', duration: 7, hStart: 0, hEnd: 2, route: '/thermal' },
  { n: 4, id: 'TEMP_DECREASE', title: 'Temperature decreasing', narrative: 'Simulated observations confirm cooling at the pump intake.', duration: 8, hStart: 2, hEnd: 4.5, route: '/thermal' },
  { n: 5, id: 'VISC_INCREASE', title: 'Viscosity increasing', narrative: 'μ(T) = A·exp(B/T): lower temperature → exponentially higher oil viscosity.', duration: 7, hStart: 4.5, hEnd: 6, route: '/thermal' },
  { n: 6, id: 'LOAD_PREDICT', title: 'Predicted rod loading increasing', narrative: 'Cooling confirmed (≥6 h). Twin forecasts +24 h rod load from forecast viscosity at current SPM.', duration: 8, hStart: 6, hEnd: 9, route: '/srp' },
  { n: 7, id: 'RISK_HIGH', title: 'Predicted risk: HIGH', narrative: 'Forecast rod load exceeds 80% band; incipient fluid pound on forecast dynacard.', duration: 6, hStart: 9, hEnd: 12, route: '/causal' },
  { n: 8, id: 'RECOMMEND', title: 'AI-assisted recommendation issued', narrative: 'Constraint-aware optimiser evaluates SPM candidates at forecast conditions.', duration: 6, hStart: 12, hEnd: 12, route: '/optimization' },
  { n: 9, id: 'SAFETY', title: 'Safety engine validating', narrative: 'Independent re-evaluation against the configured safety envelope.', duration: 8, hStart: 12, hEnd: 12, route: '/safety' },
  { n: 10, id: 'AWAIT_APPROVAL', title: 'Awaiting operator approval', narrative: 'ADVISORY mode: simulation holds at the decision point. OPERATOR APPROVAL REQUIRED — nothing is executed automatically.', autoTitle: 'Auto-execution window', autoNarrative: 'AUTO (supervised): safety-cleared action executes automatically unless the operator intervenes (HOLD / MODIFY / REJECT). Anything the gate cannot clear is escalated.', duration: Infinity, hStart: 12, hEnd: 12, route: '/safety' },
  { n: 11, id: 'APPROVED', title: 'Decision recorded', narrative: 'Decision logged with actor (automation or operator) and timestamp in the audit trail.', duration: 2, hStart: 12, hEnd: 12, route: '' },
  { n: 12, id: 'SPM_CHANGE', title: 'SPM setpoint change (simulated)', narrative: 'VFD ramps to the approved setpoint. In a live system this would be an operator-issued setpoint.', duration: 4, hStart: 12, hEnd: 13, route: '' },
  { n: 13, id: 'ANIMATION', title: 'Pumping unit responds', narrative: 'Stroke rate of the digital twin follows the new SPM.', duration: 4, hStart: 13, hEnd: 15, route: '' },
  { n: 14, id: 'LOAD_DECREASE', title: 'Rod load response', narrative: 'Scenario fast-forwards through the +24 h forecast horizon; simulated plant responds.', duration: 10, hStart: 15, hEnd: 36, route: '/srp' },
  { n: 15, id: 'OUTCOME', title: 'Outcome evaluated', narrative: 'Before / after comparison against the no-action forecast.', duration: 5, hStart: 36, hEnd: 36, route: '/outcome' },
  { n: 16, id: 'VALIDATION', title: 'Prediction vs simulated observation', narrative: 'Model error recorded for the trust ledger; feeds future residual training.', duration: 5, hStart: 36, hEnd: 36, route: '/outcome' },
];

export const COOLING_CONFIRM_H = 6;
export const SCENARIO_START_H = -3;
export const phaseIndex = (id: PhaseId) => SCENARIO_PHASES.findIndex((p) => p.id === id);
