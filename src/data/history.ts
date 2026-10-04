// PROTOTYPE DEMONSTRATION METRICS — simulated back-test of previous cycles.
// These are NOT field-validated performance figures.
import type { ValidationRecord } from '../types';

export const HISTORICAL_VALIDATION: ValidationRecord[] = [
  { cycle: 'CSS-04', period: 'Feb–May 2025', temperatureAcc: 88.4, viscosityAcc: 84.1, rodLoadAcc: 82.6, dynacardAcc: 90.2, tempBand: '±5.5 °C', recommendation: 'SPM 9 → 7', outcome: 'ACCEPTED', predictedLoad: 77, observedLoad: 73 },
  { cycle: 'CSS-05', period: 'May–Sep 2025', temperatureAcc: 89.9, viscosityAcc: 86.0, rodLoadAcc: 84.3, dynacardAcc: 91.5, tempBand: '±5.0 °C', recommendation: 'SPM 10 → 9', outcome: 'MODIFIED', predictedLoad: 79, observedLoad: 76 },
  { cycle: 'CSS-06', period: 'Sep–Dec 2025', temperatureAcc: 90.8, viscosityAcc: 87.2, rodLoadAcc: 85.1, dynacardAcc: 92.8, tempBand: '±4.6 °C', recommendation: 'Stroke 3.0 → 2.4 m', outcome: 'REJECTED', predictedLoad: 81, observedLoad: 84 },
  { cycle: 'CSS-07', period: 'Jan–May 2026', temperatureAcc: 91.6, viscosityAcc: 88.5, rodLoadAcc: 86.4, dynacardAcc: 93.6, tempBand: '±4.2 °C', recommendation: 'SPM 10 → 8', outcome: 'ACCEPTED', predictedLoad: 76, observedLoad: 75 },
];

/** Aggregate "current" model trust figures shown on the history page (demonstration). */
export const MODEL_TRUST = {
  temperature: 92,
  viscosity: 89,
  rodLoad: 87,
  dynacard: 94,
};
