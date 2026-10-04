// Recommendation engine — constraint-aware rule/grid optimiser (demonstration).
//
// Produces an AI-ASSISTED OPERATING RECOMMENDATION. It never actuates anything:
// output flows  Prediction → Recommendation → Safety Engine → Operator.
// Future: replace grid search with Bayesian optimisation over the same
// `CandidateEvaluation` contract.

import { FORECAST_HORIZON_H, OPTIMIZER, SAFETY_LIMITS } from './modelConfig';
import { evaluateSrp, evaluateSrpAtTemp, failureRisk, riskFromLoad, vfdForSpm } from './srpModel';
import { forecastTemperature, plateauForecast, temperatureSigma } from './thermalModel';
import { viscosityBand } from './viscosityModel';
import type { CandidateEvaluation, ForecastSnapshot, Recommendation, WellCalibration } from '../types';

export interface ForecastContext {
  cal: WellCalibration;
  nowH: number;
  /** True once the thermal model has confirmed post-CSS cooling; otherwise the plateau is assumed to persist. */
  coolingConfirmed: boolean;
  spm: number;
  stroke: number;
  timestamp: number;
}

export function buildForecast(ctx: ForecastContext, horizonH = FORECAST_HORIZON_H): ForecastSnapshot {
  const { cal } = ctx;
  const rawTemp = ctx.coolingConfirmed
    ? forecastTemperature(cal.tPlateau, ctx.nowH, horizonH, ctx.timestamp)
    : plateauForecast(cal.tPlateau, horizonH, ctx.timestamp);
  // Data-quality issues (e.g. failed downhole gauge) reduce trust in every downstream prediction
  const temp = { ...rawTemp, confidence: Math.max(0.5, rawTemp.confidence - (cal.confidencePenalty ?? 0)) };
  const sigma = temperatureSigma(horizonH);
  const vb = viscosityBand(temp.value, sigma);
  const mid = evaluateSrp(cal, { spm: ctx.spm, stroke: ctx.stroke, viscosity: vb.value });
  const hi = evaluateSrp(cal, { spm: ctx.spm, stroke: ctx.stroke, viscosity: vb.upper });
  const lo = evaluateSrp(cal, { spm: ctx.spm, stroke: ctx.stroke, viscosity: vb.lower });
  return {
    horizonH,
    temperature: temp,
    viscosity: { value: vb.value, lowerBound: vb.lower, upperBound: vb.upper, confidence: temp.confidence, timestamp: ctx.timestamp },
    rodLoadCurrentSpm: { value: mid.rodLoad, lowerBound: lo.rodLoad, upperBound: hi.rodLoad, confidence: temp.confidence, timestamp: ctx.timestamp },
    riskCurrentSpm: riskFromLoad(mid.rodLoad),
    oilCurrentSpm: mid.oil,
    fillageCurrentSpm: mid.pumpFillage,
    failureRisk: failureRisk(mid.rodLoad),
  };
}

export function evaluateCandidates(ctx: ForecastContext, forecastTempC: number): CandidateEvaluation[] {
  return OPTIMIZER.spmGrid.map((spm) => {
    const r = evaluateSrpAtTemp(ctx.cal, spm, ctx.stroke, forecastTempC);
    const step = Math.abs(spm - ctx.spm);
    const reasons: string[] = [];
    if (r.rodLoad > OPTIMIZER.targetMaxLoad) reasons.push(`load ${r.rodLoad.toFixed(0)}% > ${OPTIMIZER.targetMaxLoad}% target`);
    if (r.torque > SAFETY_LIMITS.warnTorque) reasons.push('torque margin');
    if (r.pumpFillage < SAFETY_LIMITS.minFillage) reasons.push('fillage');
    if (step > SAFETY_LIMITS.maxStepSpm) reasons.push('step > limit');
    if (spm > SAFETY_LIMITS.maxSpm || spm < SAFETY_LIMITS.minSpm) reasons.push('outside SPM envelope');
    return {
      spm,
      vfd: vfdForSpm(spm),
      rodLoad: r.rodLoad,
      torque: r.torque,
      fillage: r.pumpFillage,
      efficiency: r.pumpEfficiency,
      oil: r.oil,
      feasible: reasons.length === 0,
      note: reasons.length ? reasons.join(', ') : 'feasible',
    };
  });
}

/**
 * Returns a recommendation when the forecast at the current operating point is
 * HIGH risk (or above the target load band); otherwise null.
 */
export function generateRecommendation(ctx: ForecastContext, issuedAtH: number): Recommendation | null {
  const forecast = buildForecast(ctx);
  if (forecast.rodLoadCurrentSpm.value <= OPTIMIZER.targetMaxLoad) return null;
  const candidates = evaluateCandidates(ctx, forecast.temperature.value);
  const feasible = candidates.filter((c) => c.feasible && c.spm !== ctx.spm);
  if (!feasible.length) return null;
  // Objective: maximise predicted oil subject to constraints; tie-break → smaller change.
  feasible.sort((a, b) => b.oil - a.oil || Math.abs(a.spm - ctx.spm) - Math.abs(b.spm - ctx.spm));
  const best = feasible[0];
  const bestEval = evaluateSrpAtTemp(ctx.cal, best.spm, ctx.stroke, forecast.temperature.value);
  const sigma = temperatureSigma(forecast.horizonH);
  const vb = viscosityBand(forecast.temperature.value, sigma);
  const hi = evaluateSrp(ctx.cal, { spm: best.spm, stroke: ctx.stroke, viscosity: vb.upper });
  const lo = evaluateSrp(ctx.cal, { spm: best.spm, stroke: ctx.stroke, viscosity: vb.lower });
  forecast.rodLoadRecommended = {
    value: bestEval.rodLoad,
    lowerBound: lo.rodLoad,
    upperBound: hi.rodLoad,
    confidence: forecast.temperature.confidence,
    timestamp: ctx.timestamp,
  };
  forecast.riskRecommended = riskFromLoad(bestEval.rodLoad);

  const reason =
    `Predicted viscosity increase (${forecast.viscosity.value.toFixed(0)} cP at +${forecast.horizonH} h) is expected to raise ` +
    `rod loading to ${forecast.rodLoadCurrentSpm.value.toFixed(0)}% at the current ${ctx.spm} SPM and reduce pump fillage to ` +
    `${forecast.fillageCurrentSpm.toFixed(0)}% (incipient fluid pound). Reducing to ${best.spm} SPM lowers polished-rod velocity ` +
    `(viscous drag ↓) and gives the viscous oil more time to fill the barrel.`;

  return {
    id: `REC-${Math.round(issuedAtH * 10)}-${best.spm}`,
    parameter: 'SPM',
    currentValue: ctx.spm,
    recommendedValue: best.spm,
    currentVfd: vfdForSpm(ctx.spm),
    recommendedVfd: vfdForSpm(best.spm),
    stroke: ctx.stroke,
    reason,
    confidence: forecast.temperature.confidence,
    safetyStatus: 'PENDING',
    issuedAtH,
    horizonH: forecast.horizonH,
    forecast,
    candidates,
  };
}

/** Rebuild a recommendation for an operator-modified value (kept for safety re-validation). */
export function withModifiedValue(rec: Recommendation, ctx: ForecastContext, spm: number): Recommendation {
  const r = evaluateSrpAtTemp(ctx.cal, spm, ctx.stroke, rec.forecast.temperature.value);
  const sigma = temperatureSigma(rec.horizonH);
  const vb = viscosityBand(rec.forecast.temperature.value, sigma);
  const hi = evaluateSrp(ctx.cal, { spm, stroke: ctx.stroke, viscosity: vb.upper });
  const lo = evaluateSrp(ctx.cal, { spm, stroke: ctx.stroke, viscosity: vb.lower });
  return {
    ...rec,
    id: `${rec.id}-M${spm}`,
    recommendedValue: spm,
    recommendedVfd: vfdForSpm(spm),
    safetyStatus: 'PENDING',
    forecast: {
      ...rec.forecast,
      rodLoadRecommended: { value: r.rodLoad, lowerBound: lo.rodLoad, upperBound: hi.rodLoad, confidence: rec.confidence, timestamp: ctx.timestamp },
      riskRecommended: riskFromLoad(r.rodLoad),
    },
  };
}
