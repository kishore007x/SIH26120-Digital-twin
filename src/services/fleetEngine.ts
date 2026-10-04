// Fleet engine — field-wide operational state for every well (DEMONSTRATION SIMULATION).
//
// Mirrors how rod-lift / CSS fields are actually run: management by exception
// across the whole field rather than one well at a time. Everything here is
// deterministic (seeded) and advances with the simulated clock:
//   • CSS cycle age, production decline and the economic re-steam window
//   • well-site crude tanks, fill rate, time-to-full and tanker (bowser) pickups
//   • sensor / data-quality health per well
//   • ISA-18.2-style alarms (priority, state) raised from the above
// In production each block is fed by SCADA/historian data instead of the seeded model.

import type { Well } from '../types';
import { mulberry32 } from '../components/twin/environment/noise';
import { SIM_EPOCH } from './simulationEngine';

const DAY = 86_400_000;

export const FLEET_CONFIG = {
  /** Oil rate below which steam cost exceeds oil value for the cycle (BOPD, demonstration). */
  economicLimitBopd: 16,
  /** Lead time to mobilise a steam generator before the economic limit (days). */
  resteamLeadDays: 10,
  /** Steam job duration: injection + soak (days). */
  steamDays: 5,
  soakDays: 3,
  mobileSteamGenerators: 2,
  /** Well-site storage: 2 tanks × 240 bbl. */
  tankCapacityBbl: 480,
  tankHighPct: 85,
  tankHighHighPct: 95,
  bowsers: 4,
  bowserCapacityBbl: 150,
  bblToTonnes: 0.154,
};

export type ResteamStatus = 'ON TRACK' | 'PLAN' | 'DUE' | 'OVERDUE' | 'IN STEAM' | 'SOAKING' | 'SHUT-IN' | 'N/A';
export type SensorStatus = 'OK' | 'STALE' | 'FLATLINE' | 'OFFLINE' | 'DRIFT' | 'N/A';

export interface CycleState {
  cycleNo: number;
  cycleStart: number; // ms
  daysOnProduction: number;
  peakBopd: number;
  currentBopd: number;
  declinePerDay: number; // exponential decline constant
  steamTonnes: number;
  cumOilBbl: number;
  cycleSor: number; // steam t / oil t (to date)
  economicLimitDate: number | null;
  resteamDate: number | null;
  daysToLimit: number | null;
  status: ResteamStatus;
}

export interface TankState {
  levelPct: number;
  levelBbl: number;
  fillBblPerDay: number;
  hoursToHigh: number | null;
  hoursToFull: number | null;
  nextPickup: number | null; // ms
  bowser: string | null;
}

export interface SensorState {
  key: 'loadCell' | 'position' | 'vfd' | 'downholeTemp' | 'tankLevel' | 'rtu';
  label: string;
  status: SensorStatus;
  lastUpdateMin: number;
  note?: string;
}

export interface WellOps {
  id: string;
  cycle: CycleState;
  tank: TankState | null;
  sensors: SensorState[];
  dataQuality: number; // 0..100
}

export type AlarmPriority = 'P1' | 'P2' | 'P3';
export interface FieldAlarm {
  id: string;
  wellId: string;
  priority: AlarmPriority;
  category: 'PROCESS' | 'EQUIPMENT' | 'TANK' | 'DATA' | 'CSS' | 'AUTOMATION';
  message: string;
  raisedAt: number;
  action: string;
}

// Seeded per-well operating history (cycle start offsets, decline, tank phase, sensor faults)
function seedFor(id: string) {
  const n = Number(id.replace('W-', ''));
  return mulberry32(9000 + n * 131);
}

/** Known, intentional data-quality issues for the demonstration. */
const SENSOR_FAULTS: Record<string, Partial<Record<SensorState['key'], { status: SensorStatus; minutes: number; note: string }>>> = {
  'W-19': { downholeTemp: { status: 'OFFLINE', minutes: 2 * 24 * 60 + 830, note: 'Gauge offline since 26-Sep; temperature inferred from surface flowline RTD' } },
  'W-07': { tankLevel: { status: 'FLATLINE', minutes: 610, note: 'Radar level unchanged for 10 h while pump running — suspect stuck reading' } },
  'W-30': { rtu: { status: 'STALE', minutes: 47, note: 'RTU last reported 47 min ago (radio link)' } },
  'W-45': { loadCell: { status: 'DRIFT', minutes: 1, note: 'Load-cell zero drift +2.1 kN vs last calibration — calibration due' } },
  'W-38': { position: { status: 'STALE', minutes: 22, note: 'Inclinometer packets delayed' } },
};

const SENSOR_LABELS: Record<SensorState['key'], string> = {
  loadCell: 'Polished-rod load cell',
  position: 'Position / inclinometer',
  vfd: 'VFD / motor data',
  downholeTemp: 'Downhole temperature gauge',
  tankLevel: 'Tank level (radar)',
  rtu: 'RTU / communications',
};

export function wellCycleHistory(well: Well) {
  const rnd = seedFor(well.id);
  const cycleNo = Number(well.cssCycle.replace('CSS-', '')) || 5;
  const daysAgo = well.id === 'W-17' ? (SIM_EPOCH - Date.parse('2026-06-12T00:00:00+05:30')) / DAY : 30 + rnd() * 230;
  const decline = 0.0035 + rnd() * 0.0065;
  const steam = 120 + cycleNo * 8 + Math.round(rnd() * 20);
  return { rnd, cycleNo, daysAgo, decline, steam };
}

export function computeWellOps(well: Well, simTime: number): WellOps {
  const { rnd, cycleNo, daysAgo, decline, steam } = wellCycleHistory(well);
  const producing = well.status === 'PRODUCING' || well.status === 'AT_RISK';
  const cycleStart = SIM_EPOCH - daysAgo * DAY;
  const days = (simTime - cycleStart) / DAY;
  // current rate at epoch = snapshot production; back out cycle peak from the decline
  const qEpoch = producing ? well.production : 0;
  const peak = qEpoch * Math.exp(decline * daysAgo);
  const qNow = producing ? peak * Math.exp(-decline * days) : 0;
  const cumOil = producing ? (peak / decline) * (1 - Math.exp(-decline * days)) : 0;
  const cycleSor = cumOil > 0 ? steam / (cumOil * FLEET_CONFIG.bblToTonnes) : 0;
  let economicLimitDate: number | null = null;
  let resteamDate: number | null = null;
  let daysToLimit: number | null = null;
  let status: ResteamStatus = 'N/A';
  if (producing) {
    const tLimit = Math.log(peak / FLEET_CONFIG.economicLimitBopd) / decline; // days from cycle start
    economicLimitDate = cycleStart + tLimit * DAY;
    resteamDate = economicLimitDate - FLEET_CONFIG.resteamLeadDays * DAY;
    daysToLimit = (economicLimitDate - simTime) / DAY;
    status = daysToLimit <= 0 ? 'OVERDUE' : daysToLimit <= FLEET_CONFIG.resteamLeadDays ? 'DUE' : daysToLimit <= 45 ? 'PLAN' : 'ON TRACK';
  } else if (well.status === 'INACTIVE') {
    // some shut-in wells are mid-CSS (steaming or soaking)
    const k = Number(well.id.replace('W-', ''));
    status = k % 3 === 0 ? 'SOAKING' : k % 3 === 1 ? 'IN STEAM' : 'SHUT-IN';
  }

  // Tanks: sawtooth between pickups (level rises with production, tanker empties at ~85 %)
  let tank: TankState | null = null;
  if (producing) {
    const cap = FLEET_CONFIG.tankCapacityBbl;
    const fill = qEpoch; // net crude to tank, bbl/d
    const l0 = rnd() * cap * 0.84;
    const band = cap * 0.84; // from ~13 % after pickup; late pickups can reach ~97 %
    const elapsed = ((simTime - SIM_EPOCH) / DAY) * fill;
    const levelBbl = 0.13 * cap + ((l0 + elapsed) % band);
    const levelPct = (levelBbl / cap) * 100;
    const toHigh = ((FLEET_CONFIG.tankHighPct / 100) * cap - levelBbl) / Math.max(fill, 0.1);
    const toFull = (cap - levelBbl) / Math.max(fill, 0.1);
    tank = {
      levelPct,
      levelBbl,
      fillBblPerDay: fill,
      hoursToHigh: toHigh > 0 ? toHigh * 24 : 0,
      hoursToFull: toFull * 24,
      nextPickup: null,
      bowser: null,
    };
  }

  // Sensors
  const faults = SENSOR_FAULTS[well.id] ?? {};
  const sensors: SensorState[] = (Object.keys(SENSOR_LABELS) as SensorState['key'][]).map((key) => {
    if (!producing && key !== 'rtu') return { key, label: SENSOR_LABELS[key], status: 'N/A', lastUpdateMin: 0 };
    const f = faults[key];
    if (f) return { key, label: SENSOR_LABELS[key], status: f.status, lastUpdateMin: f.minutes, note: f.note };
    return { key, label: SENSOR_LABELS[key], status: 'OK', lastUpdateMin: key === 'tankLevel' ? 5 : 1 };
  });
  const penalty: Record<SensorStatus, number> = { OK: 0, 'N/A': 0, DRIFT: 10, STALE: 15, FLATLINE: 25, OFFLINE: 35 };
  const dataQuality = Math.max(0, 100 - sensors.reduce((a, s) => a + penalty[s.status], 0));

  return {
    id: well.id,
    cycle: { cycleNo, cycleStart, daysOnProduction: Math.max(0, days), peakBopd: peak, currentBopd: qNow, declinePerDay: decline, steamTonnes: steam, cumOilBbl: cumOil, cycleSor, economicLimitDate, resteamDate, daysToLimit, status },
    tank,
    sensors,
    dataQuality,
  };
}

/** Assign bowser pickups: most urgent tanks first, round-robin over the tanker fleet. */
export function planPickups(ops: WellOps[], simTime: number) {
  const tanks = ops.filter((o) => o.tank).sort((a, b) => (a.tank!.hoursToHigh ?? 1e9) - (b.tank!.hoursToHigh ?? 1e9));
  const bowserFree = Array.from({ length: FLEET_CONFIG.bowsers }, () => simTime);
  const TRIP_H = 3.5; // load + intra-field haul + unload at camp
  tanks.slice(0, 16).forEach((o, i) => {
    const b = i % FLEET_CONFIG.bowsers;
    const due = simTime + Math.max(0, (o.tank!.hoursToHigh ?? 0) - 2) * 3_600_000;
    const start = Math.max(due, bowserFree[b]);
    o.tank!.nextPickup = start;
    o.tank!.bowser = `BWR-${String(b + 1).padStart(2, '0')}`;
    bowserFree[b] = start + TRIP_H * 3_600_000;
  });
  return ops;
}

/** Steam-generator schedule: DUE/OVERDUE wells first, then PLAN, earliest re-steam date first. */
export function planSteamJobs(ops: WellOps[], simTime: number) {
  const order: ResteamStatus[] = ['OVERDUE', 'DUE', 'PLAN'];
  const candidates = ops
    .filter((o) => order.includes(o.cycle.status) && o.cycle.resteamDate !== null)
    .sort((a, b) => order.indexOf(a.cycle.status) - order.indexOf(b.cycle.status) || a.cycle.resteamDate! - b.cycle.resteamDate!);
  const genFree = Array.from({ length: FLEET_CONFIG.mobileSteamGenerators }, () => simTime);
  const jobDays = FLEET_CONFIG.steamDays + FLEET_CONFIG.soakDays;
  return candidates.slice(0, 10).map((o) => {
    let g = 0;
    for (let k = 1; k < genFree.length; k++) if (genFree[k] < genFree[g]) g = k;
    const start = Math.max(genFree[g], Math.min(o.cycle.resteamDate!, simTime + 60 * DAY), simTime);
    genFree[g] = start + FLEET_CONFIG.steamDays * DAY + 1 * DAY; // generator moves on after injection + rig-down
    return { wellId: o.id, generator: `MSG-${g + 1}`, steamStart: start, soakStart: start + FLEET_CONFIG.steamDays * DAY, backOnline: start + jobDays * DAY, status: o.cycle.status };
  });
}

/** Alarms derived from the fleet state (process + live-twin alarms are merged by the UI). */
export function fleetAlarms(wells: Well[], ops: WellOps[], simTime: number): FieldAlarm[] {
  const out: FieldAlarm[] = [];
  const byId = new Map(ops.map((o) => [o.id, o]));
  for (const w of wells) {
    const o = byId.get(w.id)!;
    if (w.risk === 'HIGH' || w.risk === 'CRITICAL')
      out.push({ id: `${w.id}-LOAD`, wellId: w.id, priority: w.risk === 'CRITICAL' ? 'P1' : 'P2', category: 'EQUIPMENT', message: `Rod load ${w.rodLoad.toFixed(0)}% of structure rating`, raisedAt: simTime - 3.2 * 3_600_000, action: 'Review SRP page; consider speed reduction / rebalancing' });
    if (w.status === 'MAINTENANCE')
      out.push({ id: `${w.id}-WO`, wellId: w.id, priority: 'P3', category: 'EQUIPMENT', message: 'Well down for workover (rig on location)', raisedAt: simTime - 26 * 3_600_000, action: 'Track workover progress' });
    if (o.tank) {
      if (o.tank.levelPct >= FLEET_CONFIG.tankHighHighPct)
        out.push({ id: `${w.id}-TANKHH`, wellId: w.id, priority: 'P1', category: 'TANK', message: `Tank level HIGH-HIGH ${o.tank.levelPct.toFixed(0)}%`, raisedAt: simTime - 600_000, action: 'Dispatch bowser immediately or stop pumping' });
      else if (o.tank.levelPct >= FLEET_CONFIG.tankHighPct)
        out.push({ id: `${w.id}-TANKH`, wellId: w.id, priority: 'P2', category: 'TANK', message: `Tank level HIGH ${o.tank.levelPct.toFixed(0)}%`, raisedAt: simTime - 1_800_000, action: 'Confirm bowser pickup in plan' });
    }
    for (const s of o.sensors) {
      if (s.status === 'OFFLINE' || s.status === 'FLATLINE')
        out.push({ id: `${w.id}-${s.key}`, wellId: w.id, priority: s.key === 'downholeTemp' ? 'P2' : 'P3', category: 'DATA', message: `${s.label} ${s.status}`, raisedAt: simTime - s.lastUpdateMin * 60_000, action: s.note ?? 'Dispatch instrument technician' });
      else if (s.status === 'STALE' || s.status === 'DRIFT')
        out.push({ id: `${w.id}-${s.key}`, wellId: w.id, priority: 'P3', category: 'DATA', message: `${s.label} ${s.status}`, raisedAt: simTime - s.lastUpdateMin * 60_000, action: s.note ?? 'Check instrument' });
    }
    if (o.cycle.status === 'OVERDUE' && (w.status === 'PRODUCING' || w.status === 'AT_RISK'))
      out.push({ id: `${w.id}-CSS`, wellId: w.id, priority: 'P3', category: 'CSS', message: `Below economic limit (${o.cycle.currentBopd.toFixed(0)} BOPD) — re-steam overdue`, raisedAt: simTime - 5 * 3_600_000, action: 'Schedule in CSS planner' });
  }
  return out;
}

export function computeFleet(wells: Well[], simTime: number) {
  const ops = planPickups(
    wells.map((w) => computeWellOps(w, simTime)),
    simTime,
  );
  return { ops, byId: new Map(ops.map((o) => [o.id, o])), steamJobs: planSteamJobs(ops, simTime), alarms: fleetAlarms(wells, ops, simTime) };
}
