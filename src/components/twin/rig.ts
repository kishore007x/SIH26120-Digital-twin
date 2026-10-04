// Mutable per-frame rig state shared between the 3D scene and overlays.
// Kept outside React/zustand so the 60 fps animation never triggers re-renders.
import type { Linkage, LinkageRange, LinkState } from './kinematics';
import { linkageRange } from './kinematics';

export interface RigRuntime {
  theta: number;
  state: LinkState | null;
  resetRequested: boolean;
  strokesCompleted: number;
}

export const rig: RigRuntime = { theta: Math.PI * 0.5, state: null, resetRequested: false, strokesCompleted: 0 };

// Dev-only handle for automated visual checks (scripts/shot-twin.mjs)
if (import.meta.env.DEV) (window as unknown as { __rig?: RigRuntime }).__rig = rig;

/** Placeholder unit geometry (metres). Chosen to resemble a conventional API unit. */
export const PLACEHOLDER_LINKAGE: Linkage = {
  O: [0, 6.2],
  G: [-2.5, 2.12],
  R: 0.95,
  C: 2.5,
  P: 4.2,
  A: 3.0,
  dir: -1,
};

const cache = new WeakMap<Linkage, LinkageRange>();
export function rangeFor(L: Linkage): LinkageRange {
  let r = cache.get(L);
  if (!r) {
    r = linkageRange(L);
    cache.set(L, r);
  }
  return r;
}

export type ComponentKey =
  | 'base'
  | 'sampson'
  | 'beam'
  | 'horsehead'
  | 'equalizer'
  | 'pitman'
  | 'crank'
  | 'gearbox'
  | 'motor'
  | 'bridle'
  | 'polishedRod'
  | 'wellhead'
  | 'rodString'
  | 'tubing'
  | 'pump'
  | 'wellbore'
  | 'reservoir';

export const COMPONENT_INFO: Record<ComponentKey, { name: string; desc: string }> = {
  base: { name: 'Skid Base', desc: 'Structural steel base (I-beam skid) carrying the Sampson post, gear reducer and prime mover.' },
  sampson: { name: 'Sampson Post', desc: 'Four-leg A-frame supporting the saddle (centre) bearing of the walking beam.' },
  beam: { name: 'Walking Beam', desc: 'Oscillates about the saddle bearing, converting crank rotation into reciprocating rod motion.' },
  horsehead: { name: 'Horsehead', desc: 'Arc-shaped beam end; keeps the bridle vertical over the wellhead throughout the stroke.' },
  equalizer: { name: 'Equalizer', desc: 'Connects both pitman arms to the tail bearing of the walking beam.' },
  pitman: { name: 'Pitman Arms', desc: 'Connecting rods between crank pins and equalizer.' },
  crank: { name: 'Cranks & Counterweights', desc: 'Rotating cranks with counterweights balancing rod and fluid load.' },
  gearbox: { name: 'Gear Reducer', desc: 'Double-reduction gearbox. Peak torque is monitored against rating.' },
  motor: { name: 'Prime Mover + VFD', desc: 'Electric motor driven by variable-frequency drive; VFD Hz sets pumping speed (SPM).' },
  bridle: { name: 'Bridle / Carrier Bar', desc: 'Wireline hanger connecting horsehead to polished-rod clamp; load cell location.' },
  polishedRod: { name: 'Polished Rod', desc: 'Surface rod sealing in the stuffing box. Polished-rod load = measured SRP load.' },
  wellhead: { name: 'Wellhead', desc: 'Stuffing box, flow tee, tubing/casing heads and wing valves.' },
  rodString: { name: 'Sucker Rod String', desc: 'Steel rod string transmitting motion to the downhole pump (depth-compressed view).' },
  tubing: { name: 'Production Tubing', desc: 'Conduit for produced heavy oil/water to surface.' },
  pump: { name: 'Downhole Pump', desc: 'Insert rod pump: barrel, plunger, travelling & standing valves. Fillage from dynacard.' },
  wellbore: { name: 'Wellbore / Casing', desc: 'Cased wellbore; thermal state from CSS thermal model.' },
  reservoir: { name: 'Reservoir Zone (CSS-heated)', desc: 'Heavy-oil sand heated by cyclic steam; heated radius shrinks as the zone cools.' },
};
