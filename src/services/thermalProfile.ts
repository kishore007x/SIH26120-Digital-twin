// Well thermal profile — SIMPLIFIED, for visualisation (prototype model).
//
// 1) Geothermal gradient:     Tg(z) = T_surface + G · z
// 2) Produced fluid in tubing (Ramey-type heat-loss approximation):
//      T(z) = Tg(z) + G·A·(1 − e^{−(zp−z)/A}) + (T_intake − Tg(zp)) · e^{−(zp−z)/A}
//    zp = pump depth, A = relaxation length (longer at higher flow rate).
// 3) CSS heated zone around the wellbore (radial):
//      T(r) = T_res + (T_near − T_res) · exp(−(r / R_h)²)
//
// Parameters are demonstration values for a shallow Thar-basin heavy-oil well. They are
// chosen so the reservoir end matches THERMAL.tReservoir. Not a reservoir or wellbore simulator.

import { THERMAL } from './modelConfig';

export const PROFILE = {
  tSurface: 28, // °C, mean ground surface temperature (desert, annual average)
  gradient: 0.02, // °C per m (2 °C / 100 m)
  pumpDepthM: 850,
  resTopM: 855,
  resBottomM: 885,
  heatedRadiusM: 12, // CSS heated-zone e-folding radius after soak
  /** relaxation length (m) = base + perBopd × oil rate */
  relaxBaseM: 380,
  relaxPerBopd: 5,
};

export const geothermal = (zM: number) => PROFILE.tSurface + PROFILE.gradient * zM;

/** Produced-fluid temperature in the tubing at depth z (m) for a given pump-intake temperature. */
export function fluidTemperature(zM: number, tIntake: number, oilBopd: number) {
  const zp = PROFILE.pumpDepthM;
  if (zM >= zp) return tIntake;
  const A = PROFILE.relaxBaseM + PROFILE.relaxPerBopd * Math.max(0, oilBopd);
  const e = Math.exp(-(zp - zM) / A);
  return geothermal(zM) + PROFILE.gradient * A * (1 - e) + (tIntake - geothermal(zp)) * e;
}

/** Temperature in the reservoir at radial distance r (m) from the wellbore. */
export function radialTemperature(rM: number, tNear: number) {
  const tRes = THERMAL.tReservoir;
  return tRes + (tNear - tRes) * Math.exp(-((rM / PROFILE.heatedRadiusM) ** 2));
}

/** Radius (m) at which the heated zone is still ≥ tIso (°C), or 0 if the near-wellbore is cooler. */
export function isothermRadius(tIso: number, tNear: number) {
  const tRes = THERMAL.tReservoir;
  if (tNear <= tIso || tIso <= tRes) return tIso <= tRes ? Infinity : 0;
  return PROFILE.heatedRadiusM * Math.sqrt(Math.log((tNear - tRes) / (tIso - tRes)));
}

export function wellProfile(tIntake: number, oilBopd: number, step = 25) {
  const out: { z: number; fluid: number; ground: number }[] = [];
  for (let z = 0; z <= PROFILE.resBottomM; z += step) out.push({ z, fluid: fluidTemperature(z, tIntake, oilBopd), ground: geothermal(z) });
  return out;
}

// Shared false-colour thermal scale (blue → cyan → yellow → orange → red), 25–90 °C.
export const THERMAL_SCALE = { min: 25, max: 90 };
const STOPS: [number, [number, number, number]][] = [
  [0, [38, 70, 140]],
  [0.25, [40, 150, 190]],
  [0.5, [235, 205, 70]],
  [0.75, [232, 120, 40]],
  [1, [190, 35, 35]],
];
export function thermalRGB(t: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, (t - THERMAL_SCALE.min) / (THERMAL_SCALE.max - THERMAL_SCALE.min)));
  for (let i = 1; i < STOPS.length; i++) {
    if (k <= STOPS[i][0]) {
      const [k0, c0] = STOPS[i - 1];
      const [k1, c1] = STOPS[i];
      const f = (k - k0) / (k1 - k0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return STOPS[STOPS.length - 1][1];
}
export const thermalCss = (t: number) => {
  const [r, g, b] = thermalRGB(t);
  return `rgb(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)})`;
};
export const THERMAL_GRADIENT_CSS = `linear-gradient(90deg, ${STOPS.map(([k, c]) => `rgb(${c.join(',')}) ${(k * 100).toFixed(0)}%`).join(', ')})`;
