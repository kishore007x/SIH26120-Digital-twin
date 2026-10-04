// SRP model — physics-inspired, demonstration-calibrated sucker-rod pump model.
//
// Peak polished-rod load (as % of rated structure load):
//   L = Ls + Ld·(S·N / S0·N0)² + Lv·(S·N / S0·N0)·(μ/μref)^p
//     Ls : buoyant rod weight + fluid load
//     Ld : dynamic (acceleration) load  ∝ S·N²
//     Lv : viscous rod drag + mobility-limited inflow resistance ∝ velocity · f(μ)
//
// Pump fillage: viscous oil needs time to flow through the standing valve.
//   fill = min(fmax, G / (N · (μ/μref)^a))          (G calibrated to reference)
//   efficiency = fill · (1 − γ·(1 − fill))           (fluid-pound penalty)
//   oil = Kq · N · S · efficiency · (1 − WC)
//
// The same functions are used for prediction ("model") and, with a slightly
// different viscosity exponent, to generate simulated observations ("plant").

import { SRP, RISK_BANDS, ROD, DRIVE_EFFICIENCY } from './modelConfig';
import { viscosityAt } from './viscosityModel';
import type { RiskLevel, HealthLevel, WellCalibration } from '../types';

export interface SrpInputs {
  spm: number;
  stroke: number;
  viscosity: number;
}

export interface SrpOutputs {
  rodLoad: number; // %
  minLoad: number; // %
  pprlKN: number;
  mprlKN: number;
  torque: number; // kN·m
  pumpFillage: number; // %
  pumpEfficiency: number; // %
  liquid: number; // BFPD
  oil: number; // BOPD
  pip: number; // bar
  /** Modified Goodman loading of the top rod taper (% of allowable, API RP 11BR). */
  goodmanPct: number;
  /** Motor input power (kW) and specific energy (kWh per barrel of oil). */
  powerKw: number;
  kwhPerBbl: number;
  vfd: number; // Hz
}

export function vfdForSpm(spm: number): number {
  return SRP.vfdA * spm + SRP.vfdB;
}
export function spmForVfd(hz: number): number {
  return (hz - SRP.vfdB) / SRP.vfdA;
}

function refFill(effRef: number): number {
  // Solve e = f(1 − γ + γf) for f
  const g = SRP.poundPenalty;
  const e = effRef / 100;
  return (-(1 - g) + Math.sqrt((1 - g) ** 2 + 4 * g * e)) / (2 * g);
}

export function evaluateSrp(cal: WellCalibration, inp: SrpInputs, mode: 'model' | 'plant' = 'model'): SrpOutputs {
  const muRef = viscosityAt(cal.tPlateau);
  const vRatio = (inp.stroke * inp.spm) / (cal.stroke * cal.spmRef);
  const nRatio = inp.spm / cal.spmRef;
  const muRatio = inp.viscosity / muRef;
  const p = mode === 'model' ? SRP.viscExpModel : SRP.viscExpPlant;

  const Ls = SRP.staticFrac * cal.rodLoadRef;
  const Ld = SRP.dynamicFrac * cal.rodLoadRef;
  const Lv = SRP.viscousFrac * cal.rodLoadRef;
  const rodLoad = Ls + Ld * vRatio * nRatio +Lv * vRatio * Math.pow(muRatio, p);
  const minLoad = Ls * 0.62 - 3 * nRatio * nRatio;

  const G = cal.spmRef * refFill(cal.effRef);
  const fill = Math.min(SRP.maxFillage, G / (inp.spm * Math.pow(muRatio, SRP.fillViscExp)));
  const eff = fill * (1 - SRP.poundPenalty * (1 - fill));

  const Kq = cal.oilRef / (1 - cal.waterCut) / (cal.spmRef * cal.stroke * (cal.effRef / 100));
  const liquid = Kq * inp.spm * inp.stroke * eff;
  const oil = liquid * (1 - cal.waterCut);

  const liqRef = cal.oilRef / (1 - cal.waterCut);
  const drawRef = SRP.reservoirPressure - SRP.pipRef;
  const pip = SRP.reservoirPressure - drawRef * (liquid / liqRef) * muRatio;

  const pprlKN = (rodLoad / 100) * SRP.ratedLoadKN;
  const mprlKN = (minLoad / 100) * SRP.ratedLoadKN;
  // Counterbalance set at reference conditions (fixed until re-balanced)
  const refPprl = (cal.rodLoadRef / 100) * SRP.ratedLoadKN;
  const refMprl = ((Ls * 0.62 - 3) / 100) * SRP.ratedLoadKN;
  const cbe = (refPprl + refMprl) / 2;
  const arm = SRP.torqueFactor * inp.stroke;
  const torque = Math.max(arm * (pprlKN - cbe), arm * (cbe - mprlKN));

  return {
    rodLoad,
    minLoad,
    pprlKN,
    mprlKN,
    torque,
    pumpFillage: fill * 100,
    pumpEfficiency: eff * 100,
    liquid,
    oil,
    pip,
    vfd: vfdForSpm(inp.spm),
    goodmanPct: goodmanLoading(pprlKN, mprlKN).loadingPct,
    powerKw: ((pprlKN - mprlKN) * inp.stroke * (inp.spm / 60)) / DRIVE_EFFICIENCY,
    kwhPerBbl: oil > 0 ? (((pprlKN - mprlKN) * inp.stroke * (inp.spm / 60)) / DRIVE_EFFICIENCY) * 24 / oil : 0,
  };
}

/** Convenience: evaluate at a temperature instead of viscosity. */
export function evaluateSrpAtTemp(cal: WellCalibration, spm: number, stroke: number, tempC: number, mode: 'model' | 'plant' = 'model') {
  return evaluateSrp(cal, { spm, stroke, viscosity: viscosityAt(tempC) }, mode);
}

/**
 * API RP 11BR Modified Goodman diagram for the top rod taper.
 *   Sa = (T/4 + M·Smin)·SF     loading % = (Smax − Smin) / (Sa − Smin) × 100
 */
export function goodmanLoading(pprlKN: number, mprlKN: number) {
  const smax = (pprlKN * 1000) / ROD.areaMm2; // MPa
  const smin = Math.max(0, (mprlKN * 1000) / ROD.areaMm2);
  const sa = (ROD.tensileMPa / 4 + ROD.goodmanSlope * smin) * ROD.serviceFactor;
  const loadingPct = ((smax - smin) / Math.max(1, sa - smin)) * 100;
  return { smax, smin, sa, loadingPct };
}

export function riskFromLoad(load: number): RiskLevel {
  if (load >= RISK_BANDS.critical) return 'CRITICAL';
  if (load >= RISK_BANDS.high) return 'HIGH';
  if (load >= RISK_BANDS.moderate) return 'MODERATE';
  return 'NORMAL';
}

export function healthFrom(currentLoad: number, predictedLoad: number, fillage: number): HealthLevel {
  const worst = Math.max(currentLoad, predictedLoad);
  if (worst >= 90 || fillage < 55) return 'CRITICAL';
  if (worst >= 80 || fillage < 70) return 'ALERT';
  if (worst >= 70 || fillage < 85) return 'WATCH';
  return 'GOOD';
}

/** Probability of rod/pump failure within 30 days — logistic on predicted load (demonstration). */
export function failureRisk(predictedLoad: number): number {
  return 1 / (1 + Math.exp(-(predictedLoad - 91) / 4.8));
}

export const RISK_ORDER: RiskLevel[] = ['NORMAL', 'MODERATE', 'HIGH', 'CRITICAL'];
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}
