// Surrounding oilfield: other producing wells (animated low-poly units with
// well-site storage tanks), a tank farm, access road, desert scrub, khejri trees and rocks.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { heightAt, LEVELLED_PADS } from './Terrain';
import { mulberry32 } from './noise';
import { gravelTextures } from './textures';
import { Pumpjack, TankFarm, WellsiteTanks } from './Equipment';

function Road({ cx, from }: { cx: number; from: THREE.Vector2 }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      pts.push(new THREE.Vector2(from.x - t * 260, from.y + Math.sin(t * 3.2) * 18 * t + t * 25));
    }
    const W = 4.2;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pts.forEach((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const r = pts[Math.max(i - 1, 0)];
      const dir = new THREE.Vector2(q.x - r.x, q.y - r.y).normalize();
      const n = new THREE.Vector2(-dir.y, dir.x);
      for (const s of [-1, 1]) {
        const x = p.x + n.x * s * (W / 2);
        const z = p.y + n.y * s * (W / 2);
        pos.push(x, heightAt(x, z, cx) + 0.04, z);
        uv.push(s > 0 ? 1 : 0, i * 1.5);
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
  }, [cx, from]);
  const tex = useMemo(() => {
    const t = gravelTextures(1).map.clone();
    t.repeat.set(1, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial map={tex} color="#c9b89a" roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function Scrub({ cx, exclude }: { cx: number; exclude: (x: number, z: number) => boolean }) {
  const bushes = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rnd = mulberry32(99);
    const out: { x: number; z: number; s: number }[] = [];
    while (out.length < 14) {
      const a = rnd() * Math.PI * 2;
      const r = 30 + rnd() * 170;
      const x = cx + Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!exclude(x, z)) out.push({ x, z, s: 0.8 + rnd() * 0.6 });
    }
    return out;
  }, [cx, exclude]);
  useLayoutEffect(() => {
    const rnd = mulberry32(42);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    if (bushes.current) {
      let n = 0;
      while (n < bushes.current.count) {
        const a = rnd() * Math.PI * 2;
        const r = 14 + Math.pow(rnd(), 0.7) * 220;
        const x = cx + Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (exclude(x, z)) continue;
        const s = 0.35 + rnd() * 0.75;
        q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
        m.compose(new THREE.Vector3(x, heightAt(x, z, cx) + s * 0.35, z), q, new THREE.Vector3(s * (1 + rnd() * 0.6), s * 0.7, s));
        bushes.current.setMatrixAt(n, m);
        c.setHSL(0.12 + rnd() * 0.08, 0.18 + rnd() * 0.14, 0.26 + rnd() * 0.12);
        bushes.current.setColorAt(n, c);
        n++;
      }
      bushes.current.instanceMatrix.needsUpdate = true;
      if (bushes.current.instanceColor) bushes.current.instanceColor.needsUpdate = true;
    }
    if (rocks.current) {
      let n = 0;
      while (n < rocks.current.count) {
        const a = rnd() * Math.PI * 2;
        const r = 16 + rnd() * 160;
        const x = cx + Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (exclude(x, z)) continue;
        const s = 0.15 + rnd() * 0.45;
        q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
        m.compose(new THREE.Vector3(x, heightAt(x, z, cx) + s * 0.2, z), q, new THREE.Vector3(s * 1.4, s * 0.7, s));
        rocks.current.setMatrixAt(n, m);
        n++;
      }
      rocks.current.instanceMatrix.needsUpdate = true;
    }
  }, [cx, exclude]);
  return (
    <group>
      <instancedMesh ref={bushes} args={[undefined, undefined, 420]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 90]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#9b8a72" roughness={1} flatShading />
      </instancedMesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, heightAt(t.x, t.z, cx), t.z]} scale={t.s}>
          <mesh position={[0, 1.3, 0]} rotation={[0, 0, 0.08]} castShadow>
            <cylinderGeometry args={[0.13, 0.22, 2.6, 7]} />
            <meshStandardMaterial color="#5b4a39" roughness={1} />
          </mesh>
          {[
            [0, 3.0, 0, 1.9],
            [0.9, 2.7, 0.4, 1.3],
            [-0.8, 2.8, -0.3, 1.4],
          ].map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]} scale={[r, r * 0.45, r]} castShadow>
              <icosahedronGeometry args={[1, 2]} />
              <meshStandardMaterial color="#566040" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function FieldScenery({ cx }: { cx: number }) {
  const roadStart = useMemo(() => new THREE.Vector2(cx - 10.5, 0), [cx]);
  const wells = useMemo(() => {
    const rnd = mulberry32(2026);
    const spots = LEVELLED_PADS.filter(([, , r]) => r < 20);
    return spots.map(([dx, dz], i) => {
      const x = cx + dx;
      const z = dz;
      return { position: [x, heightAt(x, z, cx), z] as THREE.Vector3Tuple, yaw: rnd() * Math.PI * 2, spm: 6 + rnd() * 5, phase: rnd() * 6.28, key: i };
    });
  }, [cx]);
  const exclude = useMemo(() => {
    const flat = wells.map((w) => [w.position[0], w.position[2]]);
    return (x: number, z: number) => {
      if (Math.abs(x - cx) < 16 && z > -13 && z < 32) return true; // site + pipeline
      if (flat.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 14)) return true;
      if (x < cx - 10 && x > cx - 280 && Math.abs(z - (Math.sin(((cx - 10 - x) / 260) * 3.2) * 18 * ((cx - 10 - x) / 260) + ((cx - 10 - x) / 260) * 25)) < 5) return true; // road
      return false;
    };
  }, [cx, wells]);
  return (
    <group>
      {wells.map((w) => (
        <group key={w.key}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w.position[0], w.position[1] + 0.03, w.position[2]]} receiveShadow>
            <circleGeometry args={[12, 24]} />
            <meshStandardMaterial color="#b3aa9b" roughness={1} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
          <Pumpjack position={w.position} yaw={w.yaw} spm={w.spm} phase={w.phase} />
          <WellsiteTanks position={[w.position[0] - 2, w.position[1], w.position[2] + 7.5]} yaw={w.yaw} />
        </group>
      ))}
      <TankFarm position={[cx - 175, heightAt(cx - 165, -95, cx), -95]} />
      <Road cx={cx} from={roadStart} />
      <Scrub cx={cx} exclude={exclude} />
    </group>
  );
}
