// Dynacard model — synthetic surface card generation + RULE-BASED classifier.
//
// The classifier sits behind the `DynacardClassifier` interface so that a
// CNN / LSTM service can replace `ruleBasedClassifier` later without touching
// the UI (it only consumes `DynacardResult`).

import type { DynacardClass } from '../types';

export interface CardPoint {
  position: number; // m
  load: number; // kN
}

export interface CardInputs {
  stroke: number;
  pprlKN: number;
  mprlKN: number;
  fillage: number; // 0..1
  viscousShare: number; // 0..1 fraction of load that is viscous drag
  spm: number;
  gasInterference?: boolean;
}

export interface DynacardFeatures {
  peakKN: number;
  minKN: number;
  fillage: number;
  peakPct: number;
  minPct: number;
  areaRatio: number;
  sharpRelease: boolean;
}

export interface DynacardResult {
  cls: DynacardClass;
  confidence: number;
  rationale: string;
  features: DynacardFeatures;
}

export interface DynacardClassifier {
  name: string;
  classify(card: CardPoint[], f: DynacardFeatures): DynacardResult;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function generateCard(inp: CardInputs, n = 160): CardPoint[] {
  const pts: CardPoint[] = [];
  const fill = Math.min(0.99, Math.max(0.3, inp.fillage));
  const normal = fill >= 0.9 && !inp.gasInterference;
  const oscAmp = 0.035 + 0.004 * inp.spm;
  const visc = Math.min(0.5, Math.max(0, inp.viscousShare));
  const raw: { u: number; l: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const u = 0.5 * (1 - Math.cos(2 * Math.PI * t)); // normalised position
    let l: number;
    if (t < 0.5) {
      const pickup = smooth(0, 0.2, u);
      l = pickup * (0.82 + visc * 0.25 * Math.sin(Math.PI * u)) + oscAmp * Math.sin(6 * Math.PI * t) * pickup;
    } else {
      let release: number;
      if (normal) release = smooth(0.83, 1.0, u);
      else if (inp.gasInterference) release = smooth(fill - 0.25, fill + 0.02, u);
      else release = smooth(fill - 0.045, fill + 0.005, u); // fluid pound: sharp drop
      l = release * (0.8 - visc * 0.2 * Math.sin(Math.PI * u)) - visc * 0.18 * Math.sin(Math.PI * u) * (1 - release) + oscAmp * 0.7 * Math.sin(6 * Math.PI * t);
    }
    raw.push({ u, l });
  }
  const lo = Math.min(...raw.map((r) => r.l));
  const hi = Math.max(...raw.map((r) => r.l));
  for (const r of raw) {
    const k = (r.l - lo) / (hi - lo || 1);
    pts.push({ position: r.u * inp.stroke, load: inp.mprlKN + k * (inp.pprlKN - inp.mprlKN) });
  }
  pts.push(pts[0]);
  return pts;
}

export function cardFeatures(card: CardPoint[], inp: CardInputs, ratedKN: number): DynacardFeatures {
  const peak = Math.max(...card.map((p) => p.load));
  const min = Math.min(...card.map((p) => p.load));
  let area = 0;
  for (let i = 1; i < card.length; i++) {
    area += (card[i].position - card[i - 1].position) * (card[i].load + card[i - 1].load) * 0.5;
  }
  const box = (peak - min) * inp.stroke || 1;
  return {
    peakKN: peak,
    minKN: min,
    fillage: inp.fillage,
    peakPct: (peak / ratedKN) * 100,
    minPct: (min / ratedKN) * 100,
    areaRatio: Math.abs(area) / box,
    sharpRelease: !inp.gasInterference && inp.fillage < 0.9,
  };
}

export const ruleBasedClassifier: DynacardClassifier = {
  name: 'Rule-based classifier v0.3 (demonstration)',
  classify(_card, f) {
    if (f.peakPct >= 88)
      return { cls: 'ABNORMAL LOAD', confidence: 0.9, rationale: `Peak load ${f.peakPct.toFixed(0)}% of rating exceeds 88% band.`, features: f };
    if (f.minPct < 6)
      return { cls: 'ROD FLOATING', confidence: 0.82, rationale: 'Downstroke load approaches zero — rods not falling freely through viscous fluid.', features: f };
    if (f.fillage < 0.82 && f.sharpRelease)
      return { cls: 'PUMP-OFF', confidence: 0.88, rationale: `Sharp downstroke load release at ${(f.fillage * 100).toFixed(0)}% of stroke — incomplete barrel fillage / fluid pound.`, features: f };
    if (f.fillage < 0.85 && !f.sharpRelease)
      return { cls: 'GAS INTERFERENCE', confidence: 0.8, rationale: 'Gradual downstroke load release — compressible gas in barrel.', features: f };
    return { cls: 'NORMAL', confidence: 0.94, rationale: 'Full card shape: load pickup and release at stroke ends; fillage adequate.', features: f };
  },
};

/** Active classifier — swap for an ML-backed implementation later. */
export let activeClassifier: DynacardClassifier = ruleBasedClassifier;
export function setDynacardClassifier(c: DynacardClassifier) {
  activeClassifier = c;
}

/**
 * Downhole pump card. In production this is computed from the surface card with the
 * damped wave equation (Gibbs method); here it is modelled directly from the pump state:
 * plunger stroke = surface stroke minus rod stretch, fluid load picked up on the upstroke,
 * released on the downstroke where the plunger meets liquid (fillage).
 */
export function generateDownholeCard(inp: CardInputs, n = 120): CardPoint[] {
  const sp = inp.stroke * 0.9; // net plunger stroke after rod stretch
  const fo = (inp.pprlKN - inp.mprlKN) * 0.55; // fluid load on plunger (kN)
  const fill = Math.min(0.99, Math.max(0.3, inp.fillage));
  const pts: CardPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let pos: number;
    let load: number;
    if (t < 0.5) {
      const u = t / 0.5;
      pos = u * sp;
      const pick = smooth(0, 0.07, u);
      load = fo * pick + fo * 0.03 * Math.sin(u * Math.PI * 5) * pick;
    } else {
      const u = (t - 0.5) / 0.5; // 0 at top → 1 at bottom
      pos = (1 - u) * sp;
      const posFrac = 1 - u;
      const release = inp.gasInterference ? smooth(fill - 0.22, fill + 0.02, posFrac) : smooth(fill - 0.035, fill + 0.005, posFrac);
      load = fo * release + fo * 0.025 * Math.sin(u * Math.PI * 4) * (1 - release);
    }
    pts.push({ position: pos, load: Math.max(-fo * 0.05, load) });
  }
  return pts;
}

export function analyseCard(inp: CardInputs, ratedKN: number) {
  const card = generateCard(inp);
  const pump = generateDownholeCard(inp);
  const f = cardFeatures(card, inp, ratedKN);
  return { card, pump, result: activeClassifier.classify(pump, f) };
}
