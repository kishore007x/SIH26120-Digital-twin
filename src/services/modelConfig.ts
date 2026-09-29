// CONFIGURED parameters for the demonstration models.
// All values are demonstration calibrations — NOT measured Baghewala properties.
// They are chosen so that the model chain is internally consistent and
// deterministic; replace with lab PVT / field calibration when available.

export const CRUDE = {
  /** Andrade-type viscosity law μ(T) = A · exp(B / T[K]) — demo heavy crude */
  A: 0.2071, // cP
  B: 2594, // K
};

export const THERMAL = {
  /**
   * Near-wellbore quasi-steady temperature (°C) the pump-intake temperature relaxes to
   * after CSS support ends (sustained by produced fluid from the heated zone). The
   * undisturbed reservoir temperature (tReservoir) is only approached over the full cycle.
   */
  tBase: 66,
  tReservoir: 45,
  /** Post-CSS thermal decay constant (1/h) for the physics baseline: ln(3)/36 → 72 °C to 68 °C in 36 h */
  k: 0.030517,
  /** Simulated-plant thermal bias (°C) — plant truth deliberately differs slightly from the model */
  plantBias: 0.12,
  /** Amplitude of learned residual (°C) – represents effects missing from physics (diurnal flowline, etc.) */
  residualAmp: 0.5,
  residualPeriodH: 24,
  /** Forecast uncertainty growth: σ(H) = σ0 + σH · H (°C) */
  sigma0: 1.0,
  sigmaPerH: 0.125,
};

/** SRP load model: L = Ls + Ld·(S·N)²-scaled + Lv·(S·N)-scaled·(μ/μref)^p. Fractions of reference load. */
export const SRP = {
  staticFrac: 48.8 / 72,
  dynamicFrac: 6 / 72,
  viscousFrac: 17.2 / 72,
  /** Viscosity sensitivity exponent (model). Captures viscous rod drag + mobility-limited inflow. */
  viscExpModel: 6,
  /** "Plant truth" exponent used to generate simulated observations — deliberately differs from the model. */
  viscExpPlant: 5,
  /** Pump fillage sensitivity to viscosity (barrel fill time ∝ μ^a) */
  fillViscExp: 1.5,
  /** Fluid-pound / incomplete-fillage efficiency penalty */
  poundPenalty: 0.8,
  maxFillage: 0.98,
  ratedLoadKN: 95,
  torqueFactor: 0.475, // × stroke → effective torque arm (m)
  /** VFD setpoint map (configured): Hz = a·SPM + b */
  vfdA: 3,
  vfdB: 12,
  /** Simple inflow model for pump-intake pressure */
  reservoirPressure: 25, // bar
  pipRef: 9, // bar at reference
  whp: 6.2, // bar
};

export const SAFETY_LIMITS = {
  maxSpm: 12,
  minSpm: 5,
  maxStepSpm: 3,
  maxRodLoad: 90, // %
  warnRodLoad: 85,
  maxTorque: 40, // kN·m
  warnTorque: 38, // 95% of rating
  maxStroke: 3.0, // m
  minStroke: 1.2,
  vfdMin: 25, // Hz
  vfdMax: 50,
  minFillage: 60, // %
  minConfidence: 0.8,
};

export const RISK_BANDS = {
  moderate: 70,
  high: 80,
  critical: 90,
};

export const OPTIMIZER = {
  /** Target upper bound for predicted rod load after action (%) */
  targetMaxLoad: 78,
  spmGrid: [5, 6, 7, 8, 9, 10, 11, 12],
};

export const FORECAST_HORIZON_H = 24;
