// Simulation engine — composes the individual models into a twin state.
//
// thermalModel → viscosityModel → srpModel → dynacardModel
//                               ↘ recommendationEngine (forecast)
//
// "Plant" values are SIMULATED OBSERVATIONS (a stand-in for SCADA telemetry).
// "Model" values are PREDICTIONS. Keeping them separate lets the twin compute
// prediction error honestly even in simulation.

import { FORECAST_HORIZON_H, SRP } from './modelConfig';
import { hybridTemperature, observationNoise, physicsTemperature, plantThermalBias } from './thermalModel';
import { viscosityAt } from './viscosityModel';
import { evaluateSrp, healthFrom, maxRisk, riskFromLoad } from './srpModel';
import { buildForecast } from './recommendationEngine';
import { analyseCard } from './dynacardModel';
import { COOLING_CONFIRM_H } from '../data/demoScenario';
import type { ForecastSnapshot, HealthLevel, RiskLevel, TwinSample, WellCalibration } from '../types';

export interface TwinInputs {
  cal: WellCalibration;
  h: number; // scenario hours (cooling onset = 0)
  coolingDeclared: boolean;
  spm: number;
  stroke: number;
  time: number; // simulated epoch ms
  jitter: number; // free-running seconds for small observation noise
}

export interface TwinComputed {
  sample: TwinSample;
  forecast: ForecastSnapshot;
  risk: RiskLevel;
  currentRisk: RiskLevel;
  health: HealthLevel;
  coolingConfirmed: boolean;
  thermalState: 'HOT PRODUCTION' | 'COOLING' | 'COOLING (UNCONFIRMED)';
}

export function computeTwin(inp: TwinInputs): TwinComputed {
  const { cal } = inp;
  const hThermal = inp.coolingDeclared ? inp.h : Math.min(inp.h, 0);
  const tempPhysics = physicsTemperature(cal.tPlateau, hThermal);
  const tempHybrid = hybridTemperature(cal.tPlateau, hThermal);
  const noise = hThermal > 0 ? observationNoise(hThermal) + plantThermalBias(hThermal) : 0.4 * observationNoise(inp.jitter / 7);
  const temperature = tempHybrid + noise;
  const viscosity = viscosityAt(temperature);
  const plant = evaluateSrp(cal, { spm: inp.spm, stroke: inp.stroke, viscosity }, 'plant');
  const coolingConfirmed = inp.coolingDeclared && inp.h >= COOLING_CONFIRM_H;
  const forecast = buildForecast({ cal, nowH: inp.h, coolingConfirmed, spm: inp.spm, stroke: inp.stroke, timestamp: inp.time }, FORECAST_HORIZON_H);
  const currentRisk = riskFromLoad(plant.rodLoad);
  const risk = maxRisk(currentRisk, forecast.riskCurrentSpm);
  const health = healthFrom(plant.rodLoad, forecast.rodLoadCurrentSpm.value, plant.pumpFillage);
  const sample: TwinSample = {
    tH: inp.h,
    time: inp.time,
    temperature,
    tempPhysics,
    tempHybrid,
    viscosity,
    spm: inp.spm,
    vfd: plant.vfd,
    stroke: inp.stroke,
    rodLoad: plant.rodLoad,
    rodLoadPred: forecast.rodLoadCurrentSpm.value,
    torque: plant.torque,
    pumpEfficiency: plant.pumpEfficiency,
    pumpFillage: plant.pumpFillage,
    oil: plant.oil,
    liquid: plant.liquid,
    waterCut: cal.waterCut * 100,
    pip: plant.pip,
    whp: SRP.whp + 0.15 * Math.sin(inp.jitter / 11),
  };
  return {
    sample,
    forecast,
    risk,
    currentRisk,
    health,
    coolingConfirmed,
    thermalState: !inp.coolingDeclared || inp.h <= 0 ? 'HOT PRODUCTION' : coolingConfirmed ? 'COOLING' : 'COOLING (UNCONFIRMED)',
  };
}

/** Previous-24 h history on the plateau (deterministic). */
export function generateHistory(cal: WellCalibration, spm: number, stroke: number, endH: number, endTime: number, hours = 24, stepH = 0.25): TwinSample[] {
  const out: TwinSample[] = [];
  for (let h = endH - hours; h <= endH + 1e-9; h += stepH) {
    const time = endTime - (endH - h) * 3600_000;
    // mild operating variation in the history: a short SPM trim overnight
    const s = h > endH - 16 && h < endH - 13 ? spm - 0.5 : spm;
    out.push(computeTwin({ cal, h, coolingDeclared: false, spm: s, stroke, time, jitter: h * 60 }).sample);
  }
  return out;
}

/** Dynacard for a given operating point (uses plant or model evaluation). */
export function dynacardFor(cal: WellCalibration, spm: number, stroke: number, viscosity: number, mode: 'model' | 'plant' = 'plant') {
  const r = evaluateSrp(cal, { spm, stroke, viscosity }, mode);
  const muRef = viscosityAt(cal.tPlateau);
  const viscShare = Math.min(0.5, 0.18 * Math.pow(viscosity / muRef, 3) * (spm / cal.spmRef));
  const card = analyseCard(
    { stroke, pprlKN: r.pprlKN, mprlKN: r.mprlKN, fillage: r.pumpFillage / 100, viscousShare: viscShare, spm },
    SRP.ratedLoadKN,
  );
  return { ...card, srp: r };
}

/** Simulated clock anchor for the demonstration (IST). */
export const SIM_EPOCH = Date.parse('2026-09-28T08:00:00+05:30');
