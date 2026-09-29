// Conventional beam-pumping-unit kinematics (planar four-bar linkage).
//
//   O : saddle bearing (walking-beam pivot) on the Sampson post
//   G : crank shaft centre (gearbox output)
//   R : crank radius (crank-pin circle)
//   C : pivot → equalizer bearing distance (rear of beam)
//   P : pitman length
//   A : pivot → horsehead arc radius (front of beam)
//
// Coordinates are in the plane of the unit: x toward the well, y up.
// Given crank angle θ, solve beam angle β such that |E(β) − Pin(θ)| = P.
// Polished-rod displacement = A · (β − β_min).

export interface Linkage {
  O: [number, number];
  G: [number, number];
  R: number;
  C: number;
  P: number;
  A: number;
  /** Direction of crank rotation (+1 CCW seen from +z) */
  dir: 1 | -1;
}

export interface LinkState {
  theta: number;
  beta: number;
  pin: [number, number];
  eq: [number, number];
  rodDisp: number; // 0 (bottom) .. stroke (top)
  rodFrac: number; // 0..1
}

export function equalizerAt(L: Linkage, beta: number): [number, number] {
  return [L.O[0] - L.C * Math.cos(beta), L.O[1] - L.C * Math.sin(beta)];
}

export function pinAt(L: Linkage, theta: number): [number, number] {
  return [L.G[0] + L.R * Math.cos(L.dir * theta), L.G[1] + L.R * Math.sin(L.dir * theta)];
}

/** Solve β for a crank angle (bisection on the rear-beam branch – robust and cheap). */
export function solveBeta(L: Linkage, theta: number): number {
  const pin = pinAt(L, theta);
  const f = (b: number) => {
    const e = equalizerAt(L, b);
    return Math.hypot(e[0] - pin[0], e[1] - pin[1]) - L.P;
  };
  // Beam angle range bracket: equalizer above crank pin branch.
  let lo = -0.9;
  let hi = 0.9;
  let flo = f(lo);
  // Distance decreases as β increases (equalizer goes down toward the crank) on this branch
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export interface LinkageRange {
  betaMin: number;
  betaMax: number;
  stroke: number;
}

export function linkageRange(L: Linkage): LinkageRange {
  let bMin = Infinity;
  let bMax = -Infinity;
  for (let i = 0; i < 360; i++) {
    const b = solveBeta(L, (i / 360) * Math.PI * 2);
    bMin = Math.min(bMin, b);
    bMax = Math.max(bMax, b);
  }
  return { betaMin: bMin, betaMax: bMax, stroke: L.A * (bMax - bMin) };
}

export function linkState(L: Linkage, range: LinkageRange, theta: number): LinkState {
  const beta = solveBeta(L, theta);
  const rodDisp = L.A * (beta - range.betaMin);
  return { theta, beta, pin: pinAt(L, theta), eq: equalizerAt(L, beta), rodDisp, rodFrac: rodDisp / (range.stroke || 1) };
}
