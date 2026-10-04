// World layout for the 3D field view.
// Well positions come from the schematic inventory (not surveyed coordinates),
// scaled to a ~3.2 km × 1.9 km operating area around the field camp.
import * as THREE from 'three';
import { fbm, smoothstep } from '../twin/environment/noise';
import { GATHERING_STATION, PADS } from '../../data/wells';
import type { Well } from '../../types';

export const SCALE = 3.2; // metres per schematic unit
export const WORLD_SIZE = 6400;

export const toWorld = (x: number, y: number): [number, number] => [(x - GATHERING_STATION.x) * SCALE, (y - GATHERING_STATION.y) * SCALE];

export const CAMP_R = 95;
export const PAD_R = 26;

let padCenters: [number, number][] = [];
let clusterCenters: [number, number][] = [];

export function initLayout(wells: Well[]) {
  padCenters = wells.map((w) => toWorld(w.x, w.y));
  clusterCenters = PADS.map((p) => toWorld(p.x, p.y));
}

/** Linear (seif) dunes aligned SW–NE, as typical of the Thar, plus undulation. */
/** 0 in interdune flats → 1 on dune crests (used for colour and vegetation). */
export function duneness(x: number, z: number) {
  const u = x * 0.7 + z * 0.71;
  const v = -x * 0.71 + z * 0.7;
  const warp = fbm(u * 0.0012, v * 0.0012, 3) * 260;
  return Math.pow(1 - Math.abs(Math.sin((v + warp) * 0.0095)), 2.6);
}

function rawHeight(x: number, z: number) {
  const u = x * 0.7 + z * 0.71; // along-dune
  const v = -x * 0.71 + z * 0.7; // across-dune
  const warp = fbm(u * 0.0012, v * 0.0012, 3) * 260;
  const ridge = 1 - Math.abs(Math.sin((v + warp) * 0.0095));
  const envelope = 0.45 + 0.9 * fbm(u * 0.0009 + 4, v * 0.002, 3);
  const dunes = Math.pow(ridge, 2.6) * 10 * envelope; // linear-dune relief (visual; not a surveyed terrain model)
  const und = (fbm(x * 0.004, z * 0.004, 4) - 0.5) * 2;
  return dunes + und;
}

export function fieldHeight(x: number, z: number) {
  let h = rawHeight(x, z);
  // camp / production facility levelled
  const dc = Math.hypot(x, z);
  if (dc < CAMP_R + 60) {
    const hc = rawHeight(0, 0);
    h = hc + (h - hc) * smoothstep(CAMP_R, CAMP_R + 60, dc);
  }
  for (const [px, pz] of padCenters) {
    const d = Math.hypot(x - px, z - pz);
    if (d < PAD_R + 30) {
      const hp = rawHeight(px, pz);
      h = hp + (h - hp) * smoothstep(PAD_R, PAD_R + 30, d);
    }
  }
  return h;
}

export interface RoadPath {
  pts: THREE.Vector3[];
  width: number;
  trunk: boolean;
}

/** Trunk tracks from the camp to each pad cluster, spurs from cluster to each well. */
export function buildRoads(wells: Well[]): RoadPath[] {
  const roads: RoadPath[] = [];
  const sample = (a: [number, number], b: [number, number], bend: number, width: number, trunk: boolean) => {
    const pts: THREE.Vector3[] = [];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(4, Math.ceil(len / 18));
    const nx = -(b[1] - a[1]) / (len || 1);
    const nz = (b[0] - a[0]) / (len || 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = Math.sin(t * Math.PI) * bend;
      const x = a[0] + (b[0] - a[0]) * t + nx * off;
      const z = a[1] + (b[1] - a[1]) * t + nz * off;
      pts.push(new THREE.Vector3(x, fieldHeight(x, z) + 0.25, z));
    }
    roads.push({ pts, width, trunk });
  };
  clusterCenters.forEach((c, i) => sample([0, 0], c, (i % 2 ? 1 : -1) * 40, 7, true));
  PADS.forEach((p, i) => {
    const c = clusterCenters[i];
    wells
      .filter((w) => w.pad === p.id)
      .forEach((w) => sample(c, toWorld(w.x, w.y), 0, 4, false));
  });
  return roads;
}

export function roadGeometry(road: RoadPath) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const { pts, width } = road;
  let acc = 0;
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const r = pts[Math.max(i - 1, 0)];
    const dir = new THREE.Vector2(q.x - r.x, q.z - r.z).normalize();
    const n = new THREE.Vector2(-dir.y, dir.x);
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    for (const s of [-1, 1]) {
      const x = p.x + n.x * s * (width / 2);
      const z = p.z + n.y * s * (width / 2);
      pos.push(x, Math.max(p.y, fieldHeight(x, z) + 0.2), z);
      uv.push(s > 0 ? 1 : 0, acc / 8);
    }
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
