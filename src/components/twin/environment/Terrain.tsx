// Thar-desert terrain: fBm dunes with wind-aligned ridges, flattened around the well site.
import { useMemo } from 'react';
import * as THREE from 'three';
import { fbm, smoothstep } from './noise';
import { sandTextures } from './textures';

export const TERRAIN_SIZE = 700;

/** Levelled pads for other wells and the tank farm, as offsets from the site centre: [dx, dz, radius]. */
export const LEVELLED_PADS: [number, number, number][] = [
  [-70, -45, 13], [55, -80, 13], [95, 40, 13], [-40, 95, 13], [150, -20, 13], [-130, 30, 13], [30, 150, 13], [-95, -120, 13],
  [-165, -95, 26],
];

/** Terrain height (m) at world (x, z); the site around (cx, 0) is flat at y ≈ 0. */
export function heightAt(x: number, z: number, cx = 0) {
  let h = rawHeight(x, z, cx);
  for (const [dx, dz, r] of LEVELLED_PADS) {
    const d = Math.hypot(x - cx - dx, z - dz);
    if (d < r + 6) {
      const hc = rawHeight(cx + dx, dz, cx);
      h = hc + (h - hc) * smoothstep(r, r + 6, d);
    }
  }
  return h;
}

function rawHeight(x: number, z: number, cx: number) {
  const r = Math.hypot(x - cx, z);
  const blend = smoothstep(30, 85, r);
  if (blend <= 0) return -0.02;
  // wind from the south-west: elongated dune ridges
  const u = x * 0.8 + z * 0.6;
  const v = -x * 0.6 + z * 0.8;
  const warp = fbm(u * 0.006, v * 0.006, 3) * 40;
  const ridge = 1 - Math.abs(Math.sin((u + warp) * 0.028));
  const dunes = Math.pow(ridge, 2.2) * 5.5 * (0.5 + fbm(u * 0.004 + 3, v * 0.01, 3)) * (0.35 + 0.65 * smoothstep(70, 220, r));
  const undulation = (fbm(x * 0.012, z * 0.012, 4) - 0.5) * 2.2;
  const far = smoothstep(120, 320, r) * 6 * fbm(x * 0.003 + 9, z * 0.003, 3);
  return -0.02 + blend * (dunes + undulation + far);
}

export function Terrain({ cx, opacity = 1 }: { cx: number; opacity?: number }) {
  const geometry = useMemo(() => {
    const seg = 220;
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i);
      const h = heightAt(x, z, cx);
      pos.setY(i, h);
      // crests lighter/warmer, troughs slightly darker and redder
      const t = Math.min(1, Math.max(0, (h + 1) / 7));
      const n = fbm(x * 0.05, z * 0.05, 2);
      colors[i * 3] = 0.93 + t * 0.07 + (n - 0.5) * 0.06;
      colors[i * 3 + 1] = 0.9 + t * 0.08 + (n - 0.5) * 0.05;
      colors[i * 3 + 2] = 0.86 + t * 0.06 + (n - 0.5) * 0.04;
    }
    g.translate(cx, 0, 0);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [cx]);
  const { map, bump } = useMemo(() => sandTextures(90), []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={map}
        bumpMap={bump}
        bumpScale={0.6}
        vertexColors
        roughness={0.96}
        metalness={0}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  );
}
