// Viscosity model — deterministic temperature/viscosity relation.
// μ(T) = A · exp(B / T_K)   (Andrade form). Demonstration crude parameters.
// Future: replace with PVT-lab correlation or ML service with identical signature.

import { CRUDE } from './modelConfig';

export interface CrudeParams {
  A: number;
  B: number;
}

export function viscosityAt(tempC: number, p: CrudeParams = CRUDE): number {
  const tK = tempC + 273.15;
  return p.A * Math.exp(p.B / tK);
}

/** Viscosity interval from a temperature interval (monotonic decreasing in T). */
export function viscosityBand(tempC: number, sigmaC: number, p: CrudeParams = CRUDE) {
  return {
    value: viscosityAt(tempC, p),
    lower: viscosityAt(tempC + sigmaC, p),
    upper: viscosityAt(tempC - sigmaC, p),
  };
}

/** Relative oil mobility vs a reference viscosity (k/μ normalised). */
export function relativeMobility(mu: number, muRef: number): number {
  return muRef / mu;
}
