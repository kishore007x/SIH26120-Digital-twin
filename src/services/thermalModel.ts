// Thermal model — PHYSICS-INFORMED THERMAL APPROXIMATION (prototype).
//
//   T_final(t) = T_physics(t) + ML_residual(t)
//   T_physics(t) = T_base + A · exp(-k · t),   A = T_plateau − T_base
//
// t = hours since CSS thermal support ended (cooling onset). Before onset the
// well sits on its hot-production plateau. The "ML residual" here is a fixed
// learned-shape stand-in (diurnal surface/flowline effect); a real deployment
// would call a trained residual model with the same signature.

import { THERMAL } from './modelConfig';
import type { Prediction } from '../types';

export function physicsTemperature(tPlateau: number, tH: number): number {
  if (tH <= 0) return tPlateau;
  const A = tPlateau - THERMAL.tBase;
  return THERMAL.tBase + A * Math.exp(-THERMAL.k * tH);
}

export function mlResidual(tH: number): number {
  if (tH <= 0) return 0; // plateau is well characterised; residual learned on cooling data only
  const phase = (2 * Math.PI * tH) / THERMAL.residualPeriodH;
  return -THERMAL.residualAmp * Math.sin(phase) * Math.exp(-tH / 96);
}

export function hybridTemperature(tPlateau: number, tH: number): number {
  return physicsTemperature(tPlateau, tH) + mlResidual(tH);
}

/** Deterministic pseudo-measurement noise for the simulated observation. */
export function observationNoise(tH: number): number {
  return 0.18 * Math.sin(tH * 5.3) * Math.cos(tH * 1.7);
}

/** Unmodelled plant behaviour: the simulated plant cools slightly slower than the model predicts. */
export function plantThermalBias(tH: number): number {
  return tH > 0 ? THERMAL.plantBias * (1 - Math.exp(-tH / 12)) : 0;
}

/** Simulated "plant" observation (clearly a simulation, not field data). */
export function simulatedObservedTemperature(tPlateau: number, tH: number): number {
  return hybridTemperature(tPlateau, tH) + plantThermalBias(tH) + observationNoise(tH);
}

export function temperatureSigma(horizonH: number): number {
  return THERMAL.sigma0 + THERMAL.sigmaPerH * horizonH;
}

/** Model confidence decreases with horizon. */
export function forecastConfidence(horizonH: number): number {
  return Math.max(0.5, Math.min(0.99, 0.95 - 0.0015 * horizonH));
}

export function forecastTemperature(tPlateau: number, nowH: number, horizonH: number, timestamp: number): Prediction {
  const value = hybridTemperature(tPlateau, nowH + horizonH);
  const s = temperatureSigma(horizonH);
  return { value, lowerBound: value - s, upperBound: value + s, confidence: forecastConfidence(horizonH), timestamp };
}

/** Forecast when cooling is not (yet) confirmed: plateau persists, with horizon-based uncertainty. */
export function plateauForecast(tPlateau: number, horizonH: number, timestamp: number): Prediction {
  const s = temperatureSigma(horizonH);
  return { value: tPlateau, lowerBound: tPlateau - s, upperBound: tPlateau + s, confidence: forecastConfidence(horizonH), timestamp };
}

export function thermalStateFor(tH: number, cooling: boolean): 'HOT PRODUCTION' | 'COOLING' {
  return cooling && tH > 0 ? 'COOLING' : 'HOT PRODUCTION';
}
