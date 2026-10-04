// Photoreal-leaning desert terrain for the field map (procedural — no real imagery).
//  • world-scale albedo (wind-streaked dune sand, gravel flats, scrub specks) and the
//    vegetation layout are PRE-GENERATED at build time (npm run gen:field → fieldGen.ts),
//    so the browser downloads two small files instead of computing millions of samples
//  • close-range wind-ripple bump detail
//  • instanced vegetation (shrubs + khejri-type trees) kept clear of pads, tracks and camp
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, valueNoise } from '../twin/environment/noise';
import { sandTextures } from '../twin/environment/textures';
import { fieldHeight, WORLD_SIZE, type RoadPath } from './fieldWorld';
import { N_SHRUB, N_TREE, type VegetationData } from './fieldGen';

export const ALBEDO_URL = '/img/field-albedo.jpg';
export const VEGETATION_URL = '/data/field-vegetation.json';

export function RealisticTerrain() {
  const geometry = useMemo(() => {
    const seg = 256;
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, fieldHeight(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  // flat sand colour until the albedo arrives (loads in the background, never blocks the map)
  const [albedo, setAlbedo] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(ALBEDO_URL, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      if (alive) setAlbedo(t);
      else t.dispose();
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => albedo?.dispose(), [albedo]);
  const ripple = useMemo(() => {
    const t = sandTextures(900).bump.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(900, 900);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial key={albedo ? 'tex' : 'flat'} map={albedo} color={albedo ? '#ffffff' : '#d9b27a'} bumpMap={ripple} bumpScale={0.35} roughness={0.97} metalness={0} />
    </mesh>
  );
}

export function Vegetation() {
  const shrubs = useRef<THREE.InstancedMesh>(null);
  const canopies = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const [data, setData] = useState<VegetationData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(VEGETATION_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const e = new THREE.Euler();
    const palette = ['#7a7646', '#8b8255', '#6b6a3f', '#958a5c', '#707048'];
    const rnd = mulberry32(5);
    const ns = data.shrubs.length / 5;
    const nt = data.trees.length / 4;
    if (shrubs.current) {
      for (let i = 0; i < ns; i++) {
        const [x, z, sz, h, c] = data.shrubs.slice(i * 5, i * 5 + 5);
        q.setFromEuler(e.set(0, rnd() * Math.PI, 0));
        m.compose(new THREE.Vector3(x, fieldHeight(x, z) + h * 0.35, z), q, new THREE.Vector3(sz, h, sz * (0.8 + rnd() * 0.4)));
        shrubs.current.setMatrixAt(i, m);
        shrubs.current.setColorAt(i, col.set(palette[c % palette.length]));
      }
      shrubs.current.count = ns;
      shrubs.current.instanceMatrix.needsUpdate = true;
      if (shrubs.current.instanceColor) shrubs.current.instanceColor.needsUpdate = true;
    }
    if (canopies.current && trunks.current) {
      for (let i = 0; i < nt; i++) {
        const [x, z, sz, h] = data.trees.slice(i * 4, i * 4 + 4);
        const y = fieldHeight(x, z);
        q.setFromEuler(e.set(0, rnd() * Math.PI, 0));
        m.compose(new THREE.Vector3(x, y + h, z), q, new THREE.Vector3(sz, sz * 0.42, sz * (0.85 + rnd() * 0.3)));
        canopies.current.setMatrixAt(i, m);
        canopies.current.setColorAt(i, col.set(rnd() < 0.5 ? '#667241' : '#727d48'));
        m.compose(new THREE.Vector3(x, y + h / 2, z), q, new THREE.Vector3(0.28, h, 0.28));
        trunks.current.setMatrixAt(i, m);
      }
      canopies.current.count = trunks.current.count = nt;
      canopies.current.instanceMatrix.needsUpdate = true;
      trunks.current.instanceMatrix.needsUpdate = true;
      if (canopies.current.instanceColor) canopies.current.instanceColor.needsUpdate = true;
    }
  }, [data]);

  return (
    <group visible={!!data}>
      <instancedMesh ref={shrubs} args={[undefined, undefined, N_SHRUB]} count={0} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[undefined, undefined, N_TREE]} count={0} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, N_TREE]} count={0} frustumCulled={false}>
        <cylinderGeometry args={[0.6, 1, 1, 6]} />
        <meshStandardMaterial color="#5b4a36" roughness={1} />
      </instancedMesh>
    </group>
  );
}

/** Compacted-sand track texture with two darker tyre ruts (u across, v along the track). */
let rutTex: THREE.CanvasTexture | null = null;
export function trackTexture() {
  if (rutTex) return rutTex;
  const w = 64,
    h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const rnd = mulberry32(31);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const rut = Math.exp(-(((u - 0.3) / 0.07) ** 2)) + Math.exp(-(((u - 0.7) / 0.07) ** 2));
      const edge = Math.min(u, 1 - u) < 0.08 ? 0.5 : 0; // soft sandy verges
      const n = valueNoise(x * 0.3, y * 0.08) * 0.12 + (rnd() - 0.5) * 0.08;
      const v = 1 - rut * 0.18 + n + edge * 0.1;
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, 196 * v);
      img.data[i + 1] = Math.min(255, 168 * v);
      img.data[i + 2] = Math.min(255, 124 * v);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  rutTex = new THREE.CanvasTexture(c);
  rutTex.colorSpace = THREE.SRGBColorSpace;
  rutTex.wrapS = THREE.ClampToEdgeWrapping;
  rutTex.wrapT = THREE.RepeatWrapping;
  rutTex.anisotropy = 8;
  return rutTex;
}

/** Surface flowlines from each well to the camp manifold, laid beside the tracks (as on real fields). */
export function Flowlines({ roads }: { roads: RoadPath[] }) {
  const geos = useMemo(
    () =>
      roads.map((r) => {
        const pts = r.pts.map((p, i) => {
          const q = r.pts[Math.min(i + 1, r.pts.length - 1)];
          const o = r.pts[Math.max(i - 1, 0)];
          const dx = q.x - o.x;
          const dz = q.z - o.z;
          const len = Math.hypot(dx, dz) || 1;
          const off = r.width / 2 + 3.5;
          const x = p.x + (-dz / len) * off;
          const z = p.z + (dx / len) * off;
          return new THREE.Vector3(x, fieldHeight(x, z) + 0.45, z);
        });
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r.trunk ? 0.5 : 0.3, 5, false);
      }),
    [roads],
  );
  // one draw call for the whole network
  const merged = useMemo(() => (geos.length ? mergeGeometries(geos) : null), [geos]);
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      merged?.dispose();
    },
    [geos, merged],
  );
  if (!merged) return null;
  return (
    <mesh geometry={merged}>
      <meshStandardMaterial color="#4a4640" metalness={0.5} roughness={0.55} />
    </mesh>
  );
}

/** Overhead power line poles along the trunk tracks (camp → pad clusters). */
export function PowerPoles({ roads }: { roads: RoadPath[] }) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = [];
    for (const r of roads.filter((q) => q.trunk)) {
      const curve = new THREE.CatmullRomCurve3(r.pts);
      const len = curve.getLength();
      for (let s = 30; s < len - 20; s += 70) {
        const p = curve.getPointAt(s / len);
        const t = curve.getTangentAt(s / len);
        const off = -(r.width / 2 + 9);
        out.push({ x: p.x + -t.z * off, z: p.z + t.x * off, yaw: Math.atan2(t.x, t.z) });
      }
    }
    return out;
  }, [roads]);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((sp, i) => {
      const y = fieldHeight(sp.x, sp.z);
      q.setFromEuler(new THREE.Euler(0, sp.yaw, 0));
      m.compose(new THREE.Vector3(sp.x, y + 5, sp.z), q, new THREE.Vector3(1, 1, 1));
      poles.current?.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(sp.x, y + 9.6, sp.z), q, new THREE.Vector3(1, 1, 1));
      arms.current?.setMatrixAt(i, m);
    });
    if (poles.current) {
      poles.current.count = spots.length;
      poles.current.instanceMatrix.needsUpdate = true;
    }
    if (arms.current) {
      arms.current.count = spots.length;
      arms.current.instanceMatrix.needsUpdate = true;
    }
  }, [spots]);
  const n = Math.max(1, spots.length);
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, n]} frustumCulled={false}>
        <cylinderGeometry args={[0.18, 0.26, 10, 6]} />
        <meshStandardMaterial color="#8a8680" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, n]} frustumCulled={false}>
        <boxGeometry args={[3.2, 0.18, 0.18]} />
        <meshStandardMaterial color="#5f5a52" roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
