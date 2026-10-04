// Pure generators for the field map's static assets (no DOM / React).
// Run once at build time by scripts/gen-field-assets.ts, which writes
//   public/img/field-albedo.jpg        world-scale sand albedo
//   public/data/field-vegetation.json  shrub / tree placements
// so the browser only downloads them instead of computing millions of noise samples.
import { fbm, mulberry32, valueNoise } from '../twin/environment/noise';
import { CAMP_R, PAD_R, duneness, toWorld, WORLD_SIZE, type RoadPath } from './fieldWorld';
import type { Well } from '../../types';

/** RGB bytes (n × n) of the aerial-style desert albedo covering the whole world square. */
export function renderAlbedo(n: number): Uint8Array {
  const out = new Uint8Array(n * n * 3);
  const rnd = mulberry32(2024);
  const crest = [238, 200, 134];
  const flank = [224, 178, 110];
  const flat = [199, 162, 110];
  const gravel = [166, 136, 98];
  const scrub = [104, 96, 58];
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = (px / n - 0.5) * WORLD_SIZE;
      const z = (py / n - 0.5) * WORLD_SIZE;
      const d = duneness(x, z); // 0 flats → 1 crests
      const u = x * 0.7 + z * 0.71;
      const v = -x * 0.71 + z * 0.7;
      const streak = valueNoise(u * 0.004, v * 0.05) * 0.6 + valueNoise(u * 0.012, v * 0.14) * 0.4;
      const patch = fbm(x * 0.0016 + 7, z * 0.0016, 3);
      const gr = Math.max(0, 0.55 - d) * (0.6 + patch * 0.8);
      const k = Math.min(1, d * 1.4);
      let r = flat[0] + (flank[0] - flat[0]) * k;
      let g = flat[1] + (flank[1] - flat[1]) * k;
      let b = flat[2] + (flank[2] - flat[2]) * k;
      const kc = Math.max(0, d - 0.6) / 0.4;
      r += (crest[0] - r) * kc;
      g += (crest[1] - g) * kc;
      b += (crest[2] - b) * kc;
      r += (gravel[0] - r) * gr * 0.7;
      g += (gravel[1] - g) * gr * 0.7;
      b += (gravel[2] - b) * gr * 0.7;
      const shade = 0.9 + streak * 0.14 + (patch - 0.5) * 0.12 + (rnd() - 0.5) * 0.05;
      r *= shade;
      g *= shade;
      b *= shade;
      if (rnd() < 0.05 * Math.pow(1 - d, 2) * (0.5 + patch)) {
        const s = 0.55 + rnd() * 0.35;
        r = r * (1 - s) + scrub[0] * s;
        g = g * (1 - s) + scrub[1] * s;
        b = b * (1 - s) + scrub[2] * s;
      }
      const i = (py * n + px) * 3;
      out[i] = Math.min(255, r);
      out[i + 1] = Math.min(255, g);
      out[i + 2] = Math.min(255, b);
    }
  }
  return out;
}

/** Distance test against pads, camp and tracks using a coarse spatial hash. */
function makeClearance(wells: Well[], roads: RoadPath[]) {
  const cell = 40;
  const hash = new Map<string, [number, number][]>();
  const add = (x: number, z: number) => {
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const a = hash.get(key);
    if (a) a.push([x, z]);
    else hash.set(key, [[x, z]]);
  };
  for (const r of roads)
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let s = 0; s <= len; s += 6) add(a.x + ((b.x - a.x) * s) / len, a.z + ((b.z - a.z) * s) / len);
    }
  const pads = wells.map((w) => toWorld(w.x, w.y));
  return (x: number, z: number) => {
    if (Math.hypot(x, z) < CAMP_R + 40) return false;
    for (const [px, pz] of pads) if (Math.hypot(x - px, z - pz) < PAD_R + 14) return false;
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const a = hash.get(`${cx + i},${cz + j}`);
        if (a) for (const [rx, rz] of a) if (Math.hypot(x - rx, z - rz) < 9) return false;
      }
    return true;
  };
}

export interface VegetationData {
  /** flattened [x, z, size, height, colourIndex] per shrub */
  shrubs: number[];
  /** flattened [x, z, size, height] per tree */
  trees: number[];
}

export const N_SHRUB = 4200;
export const N_TREE = 420;

export function placeVegetation(wells: Well[], roads: RoadPath[]): VegetationData {
  const ok = makeClearance(wells, roads);
  const rnd = mulberry32(77);
  const shrubs: number[] = [];
  const trees: number[] = [];
  let guard = 0;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  while ((shrubs.length / 5 < N_SHRUB || trees.length / 4 < N_TREE) && guard++ < 200000) {
    const x = (rnd() - 0.5) * 5600;
    const z = (rnd() - 0.5) * 4600;
    const d = duneness(x, z);
    const clump = fbm(x * 0.003 + 11, z * 0.003, 2);
    if (rnd() > (1 - d) * (0.3 + clump)) continue;
    if (!ok(x, z)) continue;
    if (trees.length / 4 < N_TREE && rnd() < 0.1 && d < 0.3) trees.push(r1(x), r1(z), r1(2.6 + rnd() * 2.4), r1(3.5 + rnd() * 2.5));
    else if (shrubs.length / 5 < N_SHRUB) shrubs.push(r1(x), r1(z), r1(0.8 + rnd() * 1.6), r1(0.6 + rnd() * 0.9), Math.floor(rnd() * 5));
  }
  return { shrubs, trees };
}
