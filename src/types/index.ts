// Core domain types for the Baghewala digital twin.
// These interfaces are the contract between the UI and the data/model layer.
// Replacing the local simulation with SCADA / historian / ML services only
// requires producing the same shapes.

export type WellStatus = 'PRODUCING' | 'INACTIVE' | 'MAINTENANCE' | 'AT_RISK';
export type HealthLevel = 'GOOD' | 'WATCH' | 'ALERT' | 'CRITICAL';
export type RiskLevel = 'NORMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type ThermalState = 'INJECTION' | 'SOAK' | 'HOT PRODUCTION' | 'COOLING' | 'COLD';
export type DynacardClass = 'NORMAL' | 'PUMP-OFF' | 'GAS INTERFERENCE' | 'ROD FLOATING' | 'ABNORMAL LOAD';

/** Provenance tag – every value shown in the UI should be attributable to one of these. */
export type Provenance = 'SIMULATED' | 'PREDICTED' | 'OBSERVED' | 'CONFIGURED' | 'REFERENCE';

export interface CSSCycle {
  cycleId: string;
  steamVolume: number; // tonnes
  injectionPressure: number; // bar
  soakTime: number; // hours
  productionRate: number; // BOPD (cycle average)
  sor: number; // steam-oil ratio (t/t)
  thermalState: ThermalState;
  startDate: string;
  endDate: string | null;
}

export interface SRPState {
  spm: number;
  stroke: number; // m
  vfd: number; // Hz
  rodLoad: number; // % of rated structure load
  torque: number; // kN·m (peak gearbox)
  pumpEfficiency: number; // %
  pumpFillage: number; // %
  dynacardState: DynacardClass;
  risk: RiskLevel;
}

/** Static per-well calibration used by the physics-inspired models. */
export interface WellCalibration {
  /** Hot-production plateau temperature (°C) */
  tPlateau: number;
  /** Reference rod load at plateau and reference SPM (%) */
  rodLoadRef: number;
  spmRef: number;
  stroke: number;
  /** Pump efficiency at reference (%) */
  effRef: number;
  /** Oil rate at reference (BOPD) */
  oilRef: number;
  waterCut: number; // fraction
  depth: number; // m, pump setting depth
  /** Reduction of model confidence due to a data-quality issue (0..1), e.g. a failed downhole gauge. */
  confidencePenalty?: number;
  /** Human-readable description of the data-quality issue. */
  dataIssue?: string;
}

export interface Well {
  id: string;
  name: string;
  status: WellStatus;
  /** Schematic map coordinates (0..1000 x 0..640), not GIS. */
  x: number;
  y: number;
  production: number;
  temperature: number;
  viscosity: number;
  pressure: number;
  spm: number;
  stroke: number;
  vfd: number;
  rodLoad: number;
  torque: number;
  pumpEfficiency: number;
  pumpFillage: number;
  health: HealthLevel;
  risk: RiskLevel;
  cssCycle: string;
  pad: string;
  calibration: WellCalibration;
}

export interface Prediction {
  value: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0..1
  timestamp: number; // epoch ms (simulated)
}

export type SafetyStatus = 'PENDING' | 'PASSED' | 'FAILED';

export interface Recommendation {
  id: string;
  parameter: 'SPM';
  currentValue: number;
  recommendedValue: number;
  currentVfd: number;
  recommendedVfd: number;
  stroke: number;
  reason: string;
  confidence: number; // 0..1
  safetyStatus: SafetyStatus;
  issuedAtH: number; // scenario hours
  horizonH: number;
  forecast: ForecastSnapshot;
  candidates: CandidateEvaluation[];
}

export interface CandidateEvaluation {
  spm: number;
  vfd: number;
  rodLoad: number;
  torque: number;
  fillage: number;
  efficiency: number;
  oil: number;
  feasible: boolean;
  note: string;
}

/** Everything the models forecast for one horizon at the current operating point. */
export interface ForecastSnapshot {
  horizonH: number;
  temperature: Prediction;
  viscosity: Prediction;
  rodLoadCurrentSpm: Prediction;
  rodLoadRecommended?: Prediction;
  riskCurrentSpm: RiskLevel;
  riskRecommended?: RiskLevel;
  oilCurrentSpm: number;
  fillageCurrentSpm: number;
  failureRisk: number; // 0..1
}

export interface SafetyCheck {
  id: string;
  label: string;
  limit: string;
  value: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  note?: string;
}

export interface SafetyResult {
  safe: boolean;
  checks: SafetyCheck[];
  warnings: string[];
  violations: string[];
  confidenceStatus: 'SUFFICIENT' | 'LOW';
}

/** One sample of the live twin state (simulated observation + model outputs). */
export interface TwinSample {
  tH: number; // hours relative to scenario cooling onset (negative = history)
  time: number; // epoch ms (simulated)
  temperature: number;
  tempPhysics: number;
  tempHybrid: number;
  viscosity: number;
  spm: number;
  vfd: number;
  stroke: number;
  rodLoad: number;
  rodLoadPred: number; // model forecast at +horizon
  torque: number;
  pumpEfficiency: number;
  pumpFillage: number;
  oil: number;
  liquid: number;
  waterCut: number;
  pip: number; // pump intake pressure, bar
  whp: number; // wellhead pressure, bar
}

export interface ValidationRecord {
  cycle: string;
  period: string;
  temperatureAcc: number;
  viscosityAcc: number;
  rodLoadAcc: number;
  dynacardAcc: number;
  tempBand: string;
  recommendation: string;
  outcome: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'PENDING';
  predictedLoad: number;
  observedLoad: number;
}
