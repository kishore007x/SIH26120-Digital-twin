// DEMONSTRATION DATA — schematic well inventory for the Baghewala field twin.
// Field-level counts (52 total / 33 producing / 19 not producing) are used as a
// FIELD REFERENCE; individual well values are generated deterministically and
// computed through the same models the twin uses. They are NOT field records.

import type { HealthLevel, RiskLevel, Well, WellCalibration, WellStatus } from '../types';
import { evaluateSrpAtTemp, healthFrom, riskFromLoad } from '../services/srpModel';
import { viscosityAt } from '../services/viscosityModel';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pad {
  id: string;
  x: number;
  y: number;
  wells: number;
}

// Pads laid out along a NE–SW structural trend (schematic)
export const PADS: Pad[] = [
  { id: 'A', x: 190, y: 150, wells: 6 },
  { id: 'B', x: 330, y: 205, wells: 7 },
  { id: 'C', x: 470, y: 250, wells: 7 },
  { id: 'D', x: 610, y: 190, wells: 6 },
  { id: 'E', x: 300, y: 380, wells: 7 },
  { id: 'F', x: 450, y: 430, wells: 6 },
  { id: 'G', x: 610, y: 400, wells: 7 },
  { id: 'H', x: 770, y: 330, wells: 6 },
];

export const GATHERING_STATION = { x: 540, y: 320, label: 'GGS-1 (schematic)' };

// Status plan: 26 producing + 7 at-risk (=33 producing), 13 inactive + 6 maintenance (=19 not producing)
const STATUS_PLAN: Record<number, WellStatus> = {};
const INACTIVE = [3, 6, 9, 12, 20, 24, 27, 31, 35, 40, 44, 48, 51];
const MAINT = [5, 14, 22, 33, 42, 50];
const AT_RISK = [8, 11, 26, 29, 37, 41, 46];
for (let i = 1; i <= 52; i++) {
  STATUS_PLAN[i] = INACTIVE.includes(i) ? 'INACTIVE' : MAINT.includes(i) ? 'MAINTENANCE' : AT_RISK.includes(i) ? 'AT_RISK' : 'PRODUCING';
}

/**
 * TEST CASE — W-19: downhole temperature gauge failed, so pump-intake temperature is
 * inferred from the surface flowline. Model confidence drops below the 85 % automation
 * threshold (but stays above the 80 % safety minimum): recommendations require field-officer
 * approval instead of executing automatically.
 */
export const W19_CALIBRATION: WellCalibration = {
  tPlateau: 73,
  rodLoadRef: 69,
  spmRef: 10,
  stroke: 2.4,
  effRef: 80,
  oilRef: 38,
  waterCut: 0.38,
  depth: 870,
  confidencePenalty: 0.095,
  dataIssue: 'Downhole temperature gauge offline since 26-Sep — pump-intake temperature inferred from surface flowline RTD (±3 °C transfer uncertainty).',
};

export const LOW_CONFIDENCE_TEST_WELL = 'W-19';

export const W17_CALIBRATION: WellCalibration = {
  tPlateau: 72,
  rodLoadRef: 72,
  spmRef: 10,
  stroke: 2.4,
  effRef: 81,
  oilRef: 42,
  waterCut: 0.35,
  depth: 850,
};

function buildWells(): Well[] {
  const rnd = mulberry32(20260928);
  const wells: Well[] = [];
  let n = 1;
  for (const pad of PADS) {
    for (let k = 0; k < pad.wells; k++) {
      const ang = (k / pad.wells) * Math.PI * 2 + rnd() * 0.5;
      const rad = 26 + rnd() * 22;
      const id = `W-${String(n).padStart(2, '0')}`;
      const status = STATUS_PLAN[n];
      const atRisk = status === 'AT_RISK';
      // W-17 historically draws nothing; W-19 draws and discards so all other wells keep their values
      const generated: WellCalibration | null = id === 'W-17' ? null : {
        tPlateau: Math.round(58 + rnd() * 34),
        rodLoadRef: Math.round(atRisk ? 81 + rnd() * 7 : 48 + rnd() * 24),
        spmRef: Math.round(6 + rnd() * 5),
        stroke: [1.8, 2.4, 2.4, 3.0][Math.floor(rnd() * 4)],
        effRef: Math.round(atRisk ? 62 + rnd() * 10 : 74 + rnd() * 14),
        oilRef: Math.round(12 + rnd() * 40),
        waterCut: Math.round((0.2 + rnd() * 0.4) * 100) / 100,
        depth: Math.round(760 + rnd() * 220),
      };
      const cal: WellCalibration = id === 'W-17' ? W17_CALIBRATION : id === LOW_CONFIDENCE_TEST_WELL ? W19_CALIBRATION : generated!;
      const producing = status === 'PRODUCING' || status === 'AT_RISK';
      const temp = producing ? cal.tPlateau : 44 + Math.round(rnd() * 3);
      const mu = viscosityAt(temp);
      const srp = producing ? evaluateSrpAtTemp(cal, cal.spmRef, cal.stroke, temp, 'plant') : null;
      const risk: RiskLevel = srp ? riskFromLoad(srp.rodLoad) : 'NORMAL';
      const health: HealthLevel = srp ? healthFrom(srp.rodLoad, srp.rodLoad, srp.pumpFillage) : 'GOOD';
      wells.push({
        id,
        name: `Baghewala ${id}`,
        status,
        pad: pad.id,
        x: pad.x + Math.cos(ang) * rad,
        y: pad.y + Math.sin(ang) * rad * 0.8,
        production: srp ? srp.oil : 0,
        temperature: temp,
        viscosity: mu,
        pressure: srp ? srp.pip : 0,
        spm: srp ? cal.spmRef : 0,
        stroke: cal.stroke,
        vfd: srp ? srp.vfd : 0,
        rodLoad: srp ? srp.rodLoad : 0,
        torque: srp ? srp.torque : 0,
        pumpEfficiency: srp ? srp.pumpEfficiency : 0,
        pumpFillage: srp ? srp.pumpFillage : 0,
        health: status === 'MAINTENANCE' ? 'ALERT' : health,
        risk,
        cssCycle: `CSS-${String(3 + Math.floor(rnd() * 6)).padStart(2, '0')}`,
        calibration: cal,
      });
      n++;
    }
  }
  const w17 = wells.find((w) => w.id === 'W-17');
  if (w17) w17.cssCycle = 'CSS-08';
  return wells;
}

export const WELLS: Well[] = buildWells();

export function getWell(id: string | undefined): Well | undefined {
  return WELLS.find((w) => w.id === id);
}

export const FIELD_REFERENCE = {
  total: 52,
  producing: 33,
  notProducing: 19,
};

export const DEFAULT_WELL = 'W-17';
