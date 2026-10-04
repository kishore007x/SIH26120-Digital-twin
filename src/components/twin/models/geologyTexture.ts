// Procedural rock textures for the downhole cross-section (no downloads).
//
// One canvas covers the whole cut face: x ∈ [-W/2, W/2] around the well, y from the surface
// (0) down to GEO_BOTTOM. Layer boundaries undulate away from the well and run flat at the
// well itself, so the depth labels, perforations and reservoir interval still line up.
import * as THREE from 'three';

export const GEO_BOTTOM = -30;

export interface GeoLayer {
  top: number;
  name: string;
  base: [number, number, number];
  /** laminations: 0 = massive, 1 = finely bedded */
  lam: number;
  /** grain speckle strength */
  grain: number;
  /** cross-bedding strength (dune / channel sands) */
  cross: number;
  /** boundary undulation amplitude away from the well (scene units) */
  amp: number;
}

/** Ordered top → bottom; each layer extends to the next layer's top. */
export function geoLayers(resTop: number, resBottom: number): GeoLayer[] {
  return [
    { top: 0, name: 'Aeolian sand / alluvium', base: [201, 167, 116], lam: 0.15, grain: 0.22, cross: 0.5, amp: 0.25 },
    { top: -2.2, name: 'Shale', base: [112, 106, 98], lam: 0.85, grain: 0.07, cross: 0, amp: 0.45 },
    { top: -6.5, name: 'Sandstone', base: [184, 152, 106], lam: 0.25, grain: 0.18, cross: 0.8, amp: 0.55 },
    { top: -10.4, name: 'Cap shale / claystone', base: [92, 88, 82], lam: 0.95, grain: 0.06, cross: 0, amp: 0.5 },
    { top: resTop, name: 'Heavy-oil sand (reservoir)', base: [66, 46, 30], lam: 0.3, grain: 0.26, cross: 0.35, amp: 0.4 },
    { top: resBottom, name: 'Tight siltstone (base)', base: [122, 117, 108], lam: 0.55, grain: 0.1, cross: 0, amp: 0.35 },
  ];
}

const SOIL: [number, number, number] = [42, 33, 25];

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.03, y * 2.07) * 0.28 + vnoise(x * 4.1, y * 4.03) * 0.17;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Boundary depth of a layer top at horizontal position x (flat at the well, wavy beyond). */
export function boundaryY(layer: GeoLayer, idx: number, x: number) {
  if (idx === 0) return 0;
  const reach = smooth(2.5, 14, Math.abs(x));
  const w = Math.sin(x * 0.11 + idx * 1.7) * 0.6 + Math.sin(x * 0.29 + idx * 4.1) * 0.25 + (fbm(x * 0.18, idx * 7.3) - 0.5) * 0.5;
  return layer.top + layer.amp * reach * w;
}

let cache: { face: THREE.CanvasTexture; grain: THREE.CanvasTexture } | null = null;

/**
 * Face texture (colour) + tiling grain texture (bump). Built once, on first use.
 * width / height are the cut-face size in scene units.
 */
export function geologyTextures(width: number, resTop: number, resBottom: number) {
  if (cache) return cache;
  const layers = geoLayers(resTop, resBottom);
  const W = 2048;
  const H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  // per-column boundaries
  const bounds: Float32Array[] = layers.map(() => new Float32Array(W));
  for (let px = 0; px < W; px++) {
    const x = (px / (W - 1) - 0.5) * width;
    layers.forEach((l, i) => (bounds[i][px] = boundaryY(l, i, x)));
  }
  for (let py = 0; py < H; py++) {
    const y = (py / (H - 1)) * GEO_BOTTOM;
    for (let px = 0; px < W; px++) {
      const x = (px / (W - 1) - 0.5) * width;
      let li = 0;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (y <= bounds[i][px]) {
          li = i;
          break;
        }
      }
      const L = layers[li];
      const top = bounds[li][px];
      const depthIn = top - y; // distance below this layer's top
      // bedding follows the (wavy) top surface
      const bed = y + (top - L.top);
      let k = 1;
      // laminations
      // laminations: irregular spacing and strength so beds read as rock, not stripes
      if (L.lam > 0) {
        const env = 0.45 + 0.9 * fbm(x * 0.06 + 11, bed * 0.8);
        k += L.lam * 0.085 * env * Math.sin(bed * 31 + fbm(x * 0.25, bed * 2.2) * 9 + 3 * vnoise(bed * 4, li));
        k += L.lam * 0.09 * (vnoise(x * 0.12, bed * 17) - 0.5);
      }
      // cross-bedding: inclined foresets in sets
      if (L.cross > 0) {
        const set = Math.floor(bed * 1.6 + fbm(x * 0.05, li) * 1.5);
        const dir = set % 2 ? 1 : -1;
        k += L.cross * 0.08 * Math.sin((x * 0.9 * dir + bed * 6) * 5 + set * 3.1);
      }
      // grain speckle + large-scale tonal variation
      k += L.grain * (hash2(px * 1.31, py * 0.73) - 0.5);
      k += 0.16 * (fbm(x * 0.07 + li * 3, y * 0.25) - 0.5);
      // thin darker contact just under each boundary
      if (li > 0) k -= 0.18 * Math.max(0, 1 - depthIn / 0.08);
      let r = L.base[0] * k;
      let g = L.base[1] * k;
      let b = L.base[2] * k;
      // reservoir: oil-stained patches, slightly glossy-dark
      if (L.name.startsWith('Heavy')) {
        const stain = smooth(0.35, 0.7, fbm(x * 0.35, y * 0.9));
        r *= 1 - 0.35 * stain;
        g *= 1 - 0.38 * stain;
        b *= 1 - 0.42 * stain;
      }
      // scattered pebbles / concretions in the upper sands
      if (y > -10.4 && li !== 1 && vnoise(x * 4.2, y * 7.5) > 0.83) {
        r = r * 0.7 + 70;
        g = g * 0.7 + 62;
        b = b * 0.7 + 55;
      }
      // far edges dissolve into the surrounding earth (no hard block edge)
      const edge = smooth(width * 0.32, width * 0.5, Math.abs(x)) * 0.9 + smooth(GEO_BOTTOM * 0.75, GEO_BOTTOM, y) * 0.8;
      const e = Math.min(1, edge);
      r = r * (1 - e) + SOIL[0] * e;
      g = g * (1 - e) + SOIL[1] * e;
      b = b * (1 - e) + SOIL[2] * e;
      const o = (py * W + px) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const face = new THREE.CanvasTexture(cv);
  face.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 8;

  // tiling grain (bump): sand grains + fine pits
  const g = document.createElement('canvas');
  g.width = g.height = 256;
  const gctx = g.getContext('2d')!;
  const gi = gctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const px = i % 256;
    const py = (i / 256) | 0;
    const v = 128 + 70 * (hash2(px, py) - 0.5) + 50 * (vnoise(px / 6, py / 6) - 0.5) + 30 * (vnoise(px / 23, py / 23) - 0.5);
    gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v;
    gi.data[i * 4 + 3] = 255;
  }
  gctx.putImageData(gi, 0, 0);
  const grain = new THREE.CanvasTexture(g);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(width / 1.6, -GEO_BOTTOM / 1.6);
  cache = { face, grain };
  return cache;
}
