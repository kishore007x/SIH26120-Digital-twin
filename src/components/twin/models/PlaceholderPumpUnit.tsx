// DIGITAL TWIN PLACEHOLDER — procedural conventional beam pumping unit.
// Proportions follow the supplied CAD reference renders (skid base, four-leg
// Sampson post with caged ladder, rear gear reducer, crank counterweights).
// Replaced automatically by /models/srp-pump.glb when present (see ModelLoader).

import { useMemo } from 'react';
import * as THREE from 'three';
import { useHighlight, useSelectable } from '../selection';
import type { ComponentKey } from '../rig';
import type { Linkage } from '../kinematics';
import type { AnimTargets } from './types';

const BLUE = '#2f5f9e';
const BLUE_DARK = '#244b7e';
const STEEL = '#8a949e';
const DARK = '#3a3f45';
const CW = '#2d3136';

function Mat({ k, color, metal = 0.35, rough = 0.55 }: { k: ComponentKey; color: string; metal?: number; rough?: number }) {
  const hl = useHighlight(k);
  return <meshStandardMaterial color={color} metalness={metal} roughness={rough} {...hl} />;
}

/** Box between two points (used for legs, braces, rails). */
function Strut({ a, b, w = 0.14, d = 0.14, k, color }: { a: [number, number, number]; b: [number, number, number]; w?: number; d?: number; k: ComponentKey; color: string }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow receiveShadow>
      <boxGeometry args={[w, len, d]} />
      <Mat k={k} color={color} />
    </mesh>
  );
}

function IBeam({ from, to, z, h = 0.34, k }: { from: number; to: number; z: number; h?: number; k: ComponentKey }) {
  const len = to - from;
  const cx = (from + to) / 2;
  return (
    <group position={[cx, 0, z]}>
      <mesh position={[0, h - 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.05, 0.24]} />
        <Mat k={k} color={DARK} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, h - 0.1, 0.035]} />
        <Mat k={k} color={DARK} />
      </mesh>
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[len, 0.05, 0.24]} />
        <Mat k={k} color={DARK} />
      </mesh>
    </group>
  );
}

function Base() {
  const sel = useSelectable('base');
  return (
    <group {...sel}>
      <IBeam from={-4.5} to={1.7} z={0.85} k="base" />
      <IBeam from={-4.5} to={1.7} z={-0.85} k="base" />
      {[-4.3, -3.2, -1.6, -0.2, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.3, 1.7]} />
          <Mat k="base" color={DARK} />
        </mesh>
      ))}
      {/* anchor plates */}
      {[-4.4, 1.6].map((x) =>
        [0.85, -0.85].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.01, z]} receiveShadow>
            <boxGeometry args={[0.4, 0.02, 0.4]} />
            <Mat k="base" color={STEEL} />
          </mesh>
        )),
      )}
    </group>
  );
}

function SampsonPost() {
  const sel = useSelectable('sampson');
  const top = 5.92;
  return (
    <group {...sel}>
      <Strut k="sampson" color={BLUE} a={[1.05, 0.34, 0.8]} b={[0.14, top, 0.24]} w={0.2} d={0.2} />
      <Strut k="sampson" color={BLUE} a={[1.05, 0.34, -0.8]} b={[0.14, top, -0.24]} w={0.2} d={0.2} />
      <Strut k="sampson" color={BLUE} a={[-1.45, 0.34, 0.8]} b={[-0.14, top, 0.24]} w={0.2} d={0.2} />
      <Strut k="sampson" color={BLUE} a={[-1.45, 0.34, -0.8]} b={[-0.14, top, -0.24]} w={0.2} d={0.2} />
      {/* braces */}
      <Strut k="sampson" color={BLUE_DARK} a={[0.62, 3.0, 0.53]} b={[-0.8, 3.0, 0.53]} w={0.08} d={0.08} />
      <Strut k="sampson" color={BLUE_DARK} a={[0.62, 3.0, -0.53]} b={[-0.8, 3.0, -0.53]} w={0.08} d={0.08} />
      <Strut k="sampson" color={BLUE_DARK} a={[0.9, 1.2, 0.72]} b={[-0.8, 4.4, 0.4]} w={0.07} d={0.07} />
      <Strut k="sampson" color={BLUE_DARK} a={[0.9, 1.2, -0.72]} b={[-0.8, 4.4, -0.4]} w={0.07} d={0.07} />
      {/* cap + saddle bearing pedestal */}
      <mesh position={[0, top + 0.06, 0]} castShadow>
        <boxGeometry args={[0.6, 0.12, 0.7]} />
        <Mat k="sampson" color={BLUE_DARK} />
      </mesh>
      <mesh position={[0, 6.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.62, 20]} />
        <Mat k="sampson" color={STEEL} metal={0.7} rough={0.3} />
      </mesh>
      <Ladder />
    </group>
  );
}

function Ladder() {
  const a: [number, number, number] = [1.55, 0.0, 0];
  const b: [number, number, number] = [0.42, 5.75, 0];
  const rungs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 1; i < 19; i++) {
      const t = i / 19;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hoops = [2.3, 3.0, 3.7, 4.4, 5.1];
  return (
    <group>
      <Strut k="sampson" color={STEEL} a={[a[0], a[1], 0.24]} b={[b[0], b[1], 0.24]} w={0.04} d={0.05} />
      <Strut k="sampson" color={STEEL} a={[a[0], a[1], -0.24]} b={[b[0], b[1], -0.24]} w={0.04} d={0.05} />
      {rungs.map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.48, 6]} />
          <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {hoops.map((y) => {
        const t = (y - a[1]) / (b[1] - a[1]);
        const x = a[0] + (b[0] - a[0]) * t;
        return (
          <mesh key={y} position={[x + 0.3, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38, 0.018, 6, 28, Math.PI * 1.5]} />
            <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function horseheadGeometry(A: number) {
  const s = new THREE.Shape();
  const a0 = -0.64;
  const a1 = 0.3;
  const inner = A - 0.85;
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const p = [A * Math.cos(a), A * Math.sin(a)];
    if (i === 0) s.moveTo(p[0], p[1]);
    else s.lineTo(p[0], p[1]);
  }
  s.lineTo(inner * Math.cos(a1) - 0.1, inner * Math.sin(a1));
  s.lineTo(inner * Math.cos(a0) + 0.35, inner * Math.sin(a0) + 0.45);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.56, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.28);
  return g;
}

function BeamAssembly({ L, targets }: { L: Linkage; targets: AnimTargets }) {
  const selBeam = useSelectable('beam');
  const selHead = useSelectable('horsehead');
  const selEq = useSelectable('equalizer');
  const hh = useMemo(() => horseheadGeometry(L.A), [L.A]);
  return (
    <group
      position={[L.O[0], L.O[1], 0]}
      ref={(o) => {
        targets.beam = o ?? undefined;
      }}
    >
      <group {...selBeam}>
        <mesh position={[-0.05, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.5, 0.46, 0.34]} />
          <Mat k="beam" color={BLUE} />
        </mesh>
        {/* flanges */}
        <mesh position={[-0.05, 0.56, 0]} castShadow>
          <boxGeometry args={[5.5, 0.04, 0.42]} />
          <Mat k="beam" color={BLUE_DARK} />
        </mesh>
        <mesh position={[-0.05, 0.08, 0]} castShadow>
          <boxGeometry args={[5.5, 0.04, 0.42]} />
          <Mat k="beam" color={BLUE_DARK} />
        </mesh>
        {/* saddle */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.7, 0.14, 0.5]} />
          <Mat k="beam" color={BLUE_DARK} />
        </mesh>
      </group>
      <group {...selHead}>
        <mesh geometry={hh} castShadow receiveShadow>
          <Mat k="horsehead" color={BLUE} />
        </mesh>
      </group>
      <group {...selEq} position={[-L.C, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.34, 1.7]} />
          <Mat k="equalizer" color={BLUE_DARK} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 1.85, 14]} />
          <Mat k="equalizer" color={STEEL} metal={0.7} rough={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Cranks({ L, targets }: { L: Linkage; targets: AnimTargets }) {
  const sel = useSelectable('crank');
  const crankShape = useMemo(() => {
    const s = new THREE.Shape();
    // crank arm from shaft to pin, with counterweight lobe on the opposite side
    s.moveTo(-0.22, -0.2);
    s.lineTo(L.R + 0.18, -0.13);
    s.absarc(L.R + 0.12, 0, 0.16, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-0.22, 0.2);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    g.translate(0, 0, -0.06);
    return g;
  }, [L.R]);
  const cwShape = useMemo(() => {
    const s = new THREE.Shape();
    const r0 = 0.45;
    const r1 = 1.28;
    const a = 0.55;
    s.absarc(0, 0, r1, Math.PI - a, Math.PI + a, false);
    s.lineTo(-r0 * Math.cos(a), -r0 * Math.sin(a));
    s.absarc(0, 0, r0, Math.PI + a, Math.PI - a, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
    g.translate(0, 0, -0.1);
    return g;
  }, []);
  return (
    <group
      position={[L.G[0], L.G[1], 0]}
      ref={(o) => {
        targets.crank = o ?? undefined;
      }}
      {...sel}
    >
      {[0.64, -0.64].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh geometry={crankShape} castShadow>
            <Mat k="crank" color={BLUE_DARK} />
          </mesh>
          <mesh geometry={cwShape} position={[0, 0, z > 0 ? 0.1 : -0.1]} castShadow>
            <Mat k="crank" color={CW} rough={0.7} />
          </mesh>
          {/* crank pin */}
          <mesh position={[L.R, 0, z > 0 ? 0.1 : -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.26, 12]} />
            <Mat k="crank" color={STEEL} metal={0.8} rough={0.25} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 1.5, 16]} />
        <Mat k="crank" color={STEEL} metal={0.8} rough={0.25} />
      </mesh>
    </group>
  );
}

function Pitmans({ L, targets }: { L: Linkage; targets: AnimTargets }) {
  const sel = useSelectable('pitman');
  return (
    <group {...sel}>
      {[0.8, -0.8].map((z, i) => (
        <group
          key={z}
          ref={(o) => {
            if (o) targets.pitmans[i] = { obj: o, z };
          }}
        >
          <mesh position={[0, L.P / 2, 0]} castShadow>
            <boxGeometry args={[0.12, L.P - 0.2, 0.1]} />
            <Mat k="pitman" color={BLUE_DARK} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.14, 14]} />
            <Mat k="pitman" color={STEEL} metal={0.7} rough={0.3} />
          </mesh>
          <mesh position={[0, L.P, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.14, 14]} />
            <Mat k="pitman" color={STEEL} metal={0.7} rough={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GearboxAndMotor({ L }: { L: Linkage }) {
  const selG = useSelectable('gearbox');
  const selM = useSelectable('motor');
  const [gx, gy] = L.G;
  return (
    <group>
      <group {...selG}>
        {/* pedestal frame */}
        <mesh position={[gx, (0.34 + gy - 0.55) / 2 + 0.17, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, gy - 0.55 - 0.34 + 0.34, 1.15]} />
          <Mat k="gearbox" color={DARK} />
        </mesh>
        {/* gear reducer housing */}
        <mesh position={[gx - 0.1, gy + 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.35, 1.2, 0.95]} />
          <Mat k="gearbox" color="#5f7489" />
        </mesh>
        <mesh position={[gx - 0.1, gy + 0.68, 0]} castShadow>
          <boxGeometry args={[1.45, 0.06, 1.05]} />
          <Mat k="gearbox" color="#4c5f72" />
        </mesh>
        {/* input sheave */}
        <mesh position={[gx - 0.55, gy + 0.3, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.12, 24]} />
          <Mat k="gearbox" color={STEEL} metal={0.6} />
        </mesh>
      </group>
      <group {...selM}>
        {/* motor base + motor */}
        <mesh position={[-3.95, 0.55, 0.0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.42, 1.0]} />
          <Mat k="motor" color={DARK} />
        </mesh>
        <mesh position={[-3.95, 1.08, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.85, 24]} />
          <Mat k="motor" color="#6b7a86" />
        </mesh>
        {/* cooling fins */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[-3.95, 1.08, 0.4 - i * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.365, 0.365, 0.02, 24]} />
            <Mat k="motor" color="#5b6873" />
          </mesh>
        ))}
        {/* belt guard */}
        <mesh position={[-3.3, 1.72, -0.72]} rotation={[0, 0, Math.atan2(gy + 0.3 - 1.08, gx - 0.55 + 3.95)]} castShadow>
          <boxGeometry args={[1.95, 0.85, 0.16]} />
          <Mat k="motor" color="#c79a2c" rough={0.6} />
        </mesh>
        {/* VFD panel */}
        <group position={[-4.9, 0, 1.6]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[0.6, 1.2, 0.35]} />
            <Mat k="motor" color="#d9dcd6" />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <Mat k="motor" color={DARK} />
          </mesh>
          <mesh position={[0.02, 1.15, 0.18]}>
            <planeGeometry args={[0.3, 0.16]} />
            <meshBasicMaterial color="#123b2a" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function PlaceholderPumpUnit({ L, targets }: { L: Linkage; targets: AnimTargets }) {
  return (
    <group>
      <Base />
      <SampsonPost />
      <BeamAssembly L={L} targets={targets} />
      <Cranks L={L} targets={targets} />
      <Pitmans L={L} targets={targets} />
      <GearboxAndMotor L={L} />
    </group>
  );
}
