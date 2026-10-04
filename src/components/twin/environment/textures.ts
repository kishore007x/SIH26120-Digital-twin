// Procedural canvas textures (no downloads): sand, gravel, chain-link, signboard.
import * as THREE from 'three';
import { mulberry32, tileNoise } from './noise';

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(c: HTMLCanvasElement, repeat: number, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
const memo = (key: string, make: () => THREE.Texture) => {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
};

/** Wind-rippled desert sand: colour + bump. */
export function sandTextures(repeat = 80) {
  const map = memo('sand-map', () => {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d')!;
    const img = g.createImageData(n, n);
    const rnd = mulberry32(7);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const lo = tileNoise(x / 64, y / 64, n / 64) * 0.55 + tileNoise(x / 16, y / 16, n / 16) * 0.3;
        const grain = rnd() * 0.18;
        const v = 0.7 + (lo - 0.45) * 0.22 + grain * 0.3;
        const i = (y * n + x) * 4;
        img.data[i] = Math.min(255, 222 * v);
        img.data[i + 1] = Math.min(255, 190 * v);
        img.data[i + 2] = Math.min(255, 142 * v);
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return finish(c, repeat, true);
  });
  const bump = memo('sand-bump', () => {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d')!;
    const img = g.createImageData(n, n);
    const rnd = mulberry32(11);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        // wind ripples: warped stripes
        const warp = tileNoise(x / 48, y / 48, n / 48) * 6;
        const ripple = 0.5 + 0.5 * Math.sin(((x + y * 0.35) / n) * Math.PI * 2 * 22 + warp);
        const v = ripple * 0.55 + tileNoise(x / 8, y / 8, n / 8) * 0.25 + rnd() * 0.2;
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return finish(c, repeat, false);
  });
  return { map, bump };
}

/** Compacted gravel well-pad surface. */
export function gravelTextures(repeat = 6) {
  const map = memo('gravel-map', () => {
    const n = 512;
    const c = canvas(n);
    const g = c.getContext('2d')!;
    g.fillStyle = '#9d948a';
    g.fillRect(0, 0, n, n);
    const rnd = mulberry32(3);
    for (let k = 0; k < 9000; k++) {
      const x = rnd() * n;
      const y = rnd() * n;
      const r = 0.8 + rnd() * 2.8;
      const l = 95 + rnd() * 90;
      const warm = rnd() * 18;
      g.fillStyle = `rgb(${l + warm},${l + warm * 0.6},${l - 4})`;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    // tyre tracks / stains
    g.globalAlpha = 0.08;
    for (let k = 0; k < 40; k++) {
      g.fillStyle = rnd() > 0.5 ? '#3d352c' : '#d8cdb8';
      g.beginPath();
      g.ellipse(rnd() * n, rnd() * n, 20 + rnd() * 60, 10 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c, repeat, true);
  });
  return { map };
}

/** Chain-link diamond mesh (alpha). */
export function chainLinkTexture(repeatX: number, repeatY: number) {
  const t = memo('chainlink', () => {
    const n = 128;
    const c = canvas(n);
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, n / 2);
    g.lineTo(n / 2, 0);
    g.lineTo(n, n / 2);
    g.lineTo(n / 2, n);
    g.closePath();
    g.stroke();
    return finish(c, 1, false);
  }).clone();
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

/** Plain site signboard (no logos or organisational marks). */
export function signTexture(lines: string[]) {
  const key = `sign:${lines.join('|')}`;
  return memo(key, () => {
    const w = 1024;
    const h = 512;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f3f1ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#a8401a';
    g.fillRect(0, 0, w, 120);
    g.strokeStyle = '#a8401a';
    g.lineWidth = 14;
    g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = '#fff';
    g.font = 'bold 62px "IBM Plex Sans", Arial, sans-serif';
    g.fillText(lines[0] ?? '', 36, 82);
    g.fillStyle = '#1d242b';
    g.font = 'bold 50px "IBM Plex Sans", Arial, sans-serif';
    lines.slice(1).forEach((l, i) => {
      if (i === lines.length - 2) {
        g.fillStyle = '#b3261e';
        g.font = 'bold 40px "IBM Plex Sans", Arial, sans-serif';
      }
      g.fillText(l, 36, 200 + i * 86);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}
