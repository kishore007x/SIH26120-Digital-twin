// Safety engine — independent validation layer between recommendation and operator.
//
//   Prediction → Recommendation → SAFETY ENGINE → Operator (approval) → Change
//
// The engine does NOT trust numbers carried in the recommendation: it
// re-evaluates the proposed operating point with the SRP model at the
// forecast conditions, including the conservative (upper-bound viscosity) case.

import { SAFETY_LIMITS as L, ROD } from './modelConfig';
import { evaluateSrp } from './srpModel';
import { temperatureSigma } from './thermalModel';
import { viscosityBand } from './viscosityModel';
import type { Recommendation, SafetyCheck, SafetyResult, WellCalibration } from '../types';

export interface WellStateForSafety {
  cal: WellCalibration;
  currentSpm: number;
  stroke: number;
}

export function validateRecommendation(rec: Recommendation, well: WellStateForSafety): SafetyResult {
  const checks: SafetyCheck[] = [];
  const warnings: string[] = [];
  const violations: string[] = [];
  const add = (c: SafetyCheck) => {
    checks.push(c);
    if (c.status === 'FAIL') violations.push(`${c.label}: ${c.value} (limit ${c.limit})`);
    if (c.status === 'WARN') warnings.push(`${c.label}: ${c.note ?? c.value}`);
  };

  const spm = rec.recommendedValue;
  const stroke = rec.stroke;
  const tF = rec.forecast.temperature.value;
  // Conservative case = +1σ viscosity (P84); displayed bands are ~95% (±2σ).
  const vb = viscosityBand(tF, temperatureSigma(rec.horizonH) / 2);
  const nominal = evaluateSrp(well.cal, { spm, stroke, viscosity: vb.value });
  const conservative = evaluateSrp(well.cal, { spm, stroke, viscosity: vb.upper });

  add({ id: 'maxSpm', label: 'Maximum SPM', limit: `${L.maxSpm} spm`, value: `${spm} spm`, status: spm <= L.maxSpm ? 'PASS' : 'FAIL' });
  add({ id: 'minSpm', label: 'Minimum SPM', limit: `${L.minSpm} spm`, value: `${spm} spm`, status: spm >= L.minSpm ? 'PASS' : 'FAIL' });

  const step = Math.abs(spm - well.currentSpm);
  add({ id: 'step', label: 'Max change per action', limit: `±${L.maxStepSpm} spm`, value: `${spm - well.currentSpm > 0 ? '+' : ''}${spm - well.currentSpm} spm`, status: step <= L.maxStepSpm ? 'PASS' : 'FAIL' });

  const loadStatus = nominal.rodLoad > L.maxRodLoad ? 'FAIL' : conservative.rodLoad > L.maxRodLoad || nominal.rodLoad > L.warnRodLoad ? 'WARN' : 'PASS';
  add({
    id: 'rodLoad',
    label: 'Maximum rod load',
    limit: `${L.maxRodLoad}%`,
    value: `${nominal.rodLoad.toFixed(0)}% (≤${conservative.rodLoad.toFixed(0)}% P84)`,
    status: loadStatus,
    note: loadStatus === 'WARN' ? 'Worst-case viscosity band approaches limit' : undefined,
  });

  const tq = conservative.torque;
  add({
    id: 'torque',
    label: 'Maximum gearbox torque',
    limit: `${L.maxTorque} kN·m`,
    value: `${nominal.torque.toFixed(1)} kN·m (≤${tq.toFixed(1)})`,
    status: nominal.torque > L.maxTorque ? 'FAIL' : tq > L.warnTorque ? 'WARN' : 'PASS',
    note: tq > L.warnTorque ? 'Torque margin below 5% in P84 case' : undefined,
  });

  // Rod fatigue: API RP 11BR Modified Goodman loading of the top taper (nominal; conservative case may not exceed 100 %)
  const gNom = nominal.goodmanPct;
  const gCons = conservative.goodmanPct;
  add({
    id: 'goodman',
    label: 'Rod stress (Modified Goodman)',
    limit: '100% allowable',
    value: `${gNom.toFixed(0)}% (≤${gCons.toFixed(0)}% P84)`,
    status: gNom > 100 ? 'FAIL' : gCons > 100 || gNom >= ROD.warnPct ? 'WARN' : 'PASS',
    note: gCons > 100 || gNom >= ROD.warnPct ? 'Rod stress close to fatigue limit' : undefined,
  });

  add({ id: 'stroke', label: 'Stroke length', limit: `${L.minStroke}–${L.maxStroke} m`, value: `${stroke.toFixed(1)} m`, status: stroke <= L.maxStroke && stroke >= L.minStroke ? 'PASS' : 'FAIL' });

  const hz = rec.recommendedVfd;
  add({ id: 'vfd', label: 'VFD frequency limits', limit: `${L.vfdMin}–${L.vfdMax} Hz`, value: `${hz.toFixed(0)} Hz`, status: hz >= L.vfdMin && hz <= L.vfdMax ? 'PASS' : 'FAIL' });

  add({
    id: 'pump',
    label: 'Pump operating range (fillage)',
    limit: `≥ ${L.minFillage}%`,
    value: `${nominal.pumpFillage.toFixed(0)}%`,
    status: nominal.pumpFillage >= L.minFillage ? (nominal.pumpFillage >= 70 ? 'PASS' : 'WARN') : 'FAIL',
    note: nominal.pumpFillage < 70 ? 'Low fillage – fluid pound likely' : undefined,
  });

  const conf = rec.confidence;
  const confidenceStatus = conf >= L.minConfidence ? 'SUFFICIENT' : 'LOW';
  add({ id: 'confidence', label: 'Minimum model confidence', limit: `${(L.minConfidence * 100).toFixed(0)}%`, value: `${(conf * 100).toFixed(0)}%`, status: confidenceStatus === 'SUFFICIENT' ? 'PASS' : 'FAIL' });

  return { safe: violations.length === 0, checks, warnings, violations, confidenceStatus };
}
