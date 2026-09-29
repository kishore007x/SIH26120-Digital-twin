// Shared oilfield equipment models used by the well-site scene and the 3D field view.
// Mirrors how the field is operated: SRP units, crude stored in tanks at each
// well location, tanker (bowser) evacuation, mobile steam generators for CSS,
// workover rigs for well maintenance.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const UNIT_BLUE = '#2f5f9e';

function horseheadShape() {
  const s = new THREE.Shape();
  const A = 2.4;
  for (let i = 0; i <= 12; i++) {
    const a = -0.6 + (0.9 * i) / 12;
    const p = [A * Math.cos(a), A * Math.sin(a)];
    if (i === 0) s.moveTo(p[0], p[1]);
    else s.lineTo(p[0], p[1]);
  }
  s.lineTo(1.75, 0.4);
  s.lineTo(1.9, -0.9);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false });
  g.translate(0, 0, -0.2);
  return g;
}
let hhGeom: THREE.ExtrudeGeometry | null = null;

/** Low-poly animated beam pumping unit. `spm` may be a number or a live getter. */
export function Pumpjack({
  position,
  yaw,
  spm,
  phase = 0,
  running = true,
  scale = 1,
}: {
  position: THREE.Vector3Tuple;
  yaw: number;
  spm: number | (() => number);
  phase?: number;
  running?: boolean;
  scale?: number;
}) {
  const beam = useRef<THREE.Group>(null);
  const crank = useRef<THREE.Group>(null);
  const theta = useRef(phase);
  const hh = useMemo(() => (hhGeom ??= horseheadShape()), []);
  useFrame((_, dt) => {
    if (!running) return;
    const s = typeof spm === 'function' ? spm() : spm;
    theta.current += Math.min(dt, 0.1) * (s / 60) * Math.PI * 2;
    if (crank.current) crank.current.rotation.z = -theta.current;
    if (beam.current) beam.current.rotation.z = 0.32 * Math.sin(theta.current);
  });
  const mat = <meshStandardMaterial color={UNIT_BLUE} metalness={0.35} roughness={0.55} />;
  return (
    <group position={position} rotation={[0, yaw, 0]} scale={scale}>
      <mesh position={[-0.8, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.3, 1.5]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.7} />
      </mesh>
      {[0.45, -0.45].map((z) => (
        <group key={z}>
          <mesh position={[0.35, 2.6, z]} rotation={[0, 0, 0.16]} castShadow>
            <boxGeometry args={[0.18, 5.1, 0.18]} />
            {mat}
          </mesh>
          <mesh position={[-0.55, 2.6, z]} rotation={[0, 0, -0.2]} castShadow>
            <boxGeometry args={[0.18, 5.1, 0.18]} />
            {mat}
          </mesh>
        </group>
      ))}
      <group ref={beam} position={[0, 5.2, 0]}>
        <mesh position={[-0.2, 0.25, 0]} castShadow>
          <boxGeometry args={[5, 0.4, 0.3]} />
          {mat}
        </mesh>
        <mesh geometry={hh} castShadow>
          {mat}
        </mesh>
      </group>
      <group ref={crank} position={[-2.4, 1.6, 0]}>
        {[0.55, -0.55].map((z) => (
          <mesh key={z} position={[0.3, 0, z]} castShadow>
            <boxGeometry args={[1.6, 0.35, 0.15]} />
            <meshStandardMaterial color="#2d3136" roughness={0.7} />
          </mesh>
        ))}
      </group>
      <mesh position={[-2.4, 1.0, 0]} castShadow>
        <boxGeometry args={[1.1, 1.1, 0.8]} />
        <meshStandardMaterial color="#5f7489" roughness={0.6} />
      </mesh>
      <mesh position={[2.35, 2.9, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 4.4, 4]} />
        <meshStandardMaterial color="#2a2f35" />
      </mesh>
      <mesh position={[2.35, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 1.0, 10]} />
        <meshStandardMaterial color="#5e6a74" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Horizontal crude storage tanks at the well location, on saddles, with a small bund. */
export function WellsiteTanks({ position, yaw = 0, count = 2 }: { position: THREE.Vector3Tuple; yaw?: number; count?: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.4, count * 3 + 1]} />
        <meshStandardMaterial color="#c2b8a5" roughness={1} />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const z = (i - (count - 1) / 2) * 3;
        return (
          <group key={i} position={[0, 0, z]}>
            {[-2, 2].map((x) => (
              <mesh key={x} position={[x, 0.6, 0]} castShadow>
                <boxGeometry args={[0.35, 0.8, 1.8]} />
                <meshStandardMaterial color="#8c8f91" roughness={0.8} />
              </mesh>
            ))}
            <mesh position={[0, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
              <cylinderGeometry args={[1.15, 1.15, 6.2, 24]} />
              <meshStandardMaterial color="#ece9e1" roughness={0.55} metalness={0.25} />
            </mesh>
            {[-3.1, 3.1].map((x) => (
              <mesh key={x} position={[x, 1.95, 0]} rotation={[0, 0, Math.PI / 2]}>
                <sphereGeometry args={[1.15, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#e2ded4" roughness={0.55} metalness={0.25} side={THREE.DoubleSide} />
              </mesh>
            ))}
            <mesh position={[1.2, 3.25, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.25, 0.3, 12]} />
              <meshStandardMaterial color="#8a8f93" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Workover / pulling rig over a well under maintenance. */
export function WorkoverRig({ position, yaw = 0 }: { position: THREE.Vector3Tuple; yaw?: number }) {
  const legs = useMemo(() => {
    const out: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [];
    const H = 18;
    const base = [
      [-0.9, -0.9],
      [0.9, -0.9],
      [0.9, 0.9],
      [-0.9, 0.9],
    ];
    base.forEach(([x, z]) => out.push([[x, 1.6, z], [x * 0.35, H, z * 0.35]]));
    for (let k = 1; k < 7; k++) {
      const y = 1.6 + (k * (H - 1.6)) / 7;
      const s = 1 - (0.65 * (y - 1.6)) / (H - 1.6);
      out.push([[-0.9 * s, y, -0.9 * s], [0.9 * s, y, 0.9 * s]]);
      out.push([[0.9 * s, y, -0.9 * s], [-0.9 * s, y, 0.9 * s]]);
    }
    return out;
  }, []);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* carrier truck */}
      <mesh position={[-6, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[11, 1.6, 2.5]} />
        <meshStandardMaterial color="#b8412e" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[-11.2, 2.2, 0]} castShadow>
        <boxGeometry args={[1.6, 1.8, 2.5]} />
        <meshStandardMaterial color="#d8d6cf" roughness={0.5} />
      </mesh>
      {[-10, -7, -4, -2].map((x) => (
        <mesh key={x} position={[x, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 2.7, 14]} />
          <meshStandardMaterial color="#1f2124" roughness={0.9} />
        </mesh>
      ))}
      {/* mast (raised, slight lean over the well) */}
      <group rotation={[0, 0, -0.06]}>
        {legs.map(([a, b], i) => {
          const va = new THREE.Vector3(...a);
          const vb = new THREE.Vector3(...b);
          const d = vb.clone().sub(va);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
          return (
            <mesh key={i} position={va.add(vb).multiplyScalar(0.5)} quaternion={q} castShadow>
              <cylinderGeometry args={[0.07, 0.07, d.length(), 5]} />
              <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.5} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Mobile steam generator (trailer-mounted) with an animated steam plume, for CSS injection. */
export function SteamGenerator({ position, yaw = 0 }: { position: THREE.Vector3Tuple; yaw?: number }) {
  const puffs = useRef<THREE.Group>(null);
  const N = 10;
  useFrame(({ clock }) => {
    if (!puffs.current) return;
    const t = clock.elapsedTime;
    puffs.current.children.forEach((c, i) => {
      const u = (t * 0.25 + i / N) % 1;
      c.position.set(u * 3.5, 4.3 + u * 9, u * 1.5);
      c.scale.setScalar(0.6 + u * 3.2);
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - u);
    });
  });
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 2.8, 2.5]} />
        <meshStandardMaterial color="#e3e0d6" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.2, 1.26]}>
        <planeGeometry args={[12, 0.35]} />
        <meshStandardMaterial color="#1f4e8c" />
      </mesh>
      <mesh position={[0, 3.8, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.6, 12]} />
        <meshStandardMaterial color="#6d7175" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-4.5, -3, 3, 4.5].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 2.6, 12]} />
          <meshStandardMaterial color="#1f2124" roughness={0.9} />
        </mesh>
      ))}
      <group ref={puffs}>
        {Array.from({ length: N }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Crude tanker (bowser) — body only; motion is applied by the caller. */
export const TankerTruck = ({ color = '#d9d6cc' }: { color?: string }) => (
  <group>
    <mesh position={[3.4, 1.6, 0]} castShadow>
      <boxGeometry args={[2.2, 2.2, 2.4]} />
      <meshStandardMaterial color="#1f4e8c" roughness={0.5} metalness={0.3} />
    </mesh>
    <mesh position={[-1.3, 1.85, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[1.15, 1.15, 7.2, 20]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
    </mesh>
    {[-3.6, -2.4, 0.6, 3.4].map((x) => (
      <mesh key={x} position={[x, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 2.3, 12]} />
        <meshStandardMaterial color="#1f2124" roughness={0.9} />
      </mesh>
    ))}
  </group>
);

/** Field camp / early production facility: control room, stores, parking, flare. */
export function FieldCamp({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[130, 90]} />
        <meshStandardMaterial color="#b5ac9c" roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {[
        [-35, -20, 18, 8],
        [-35, -5, 18, 8],
        [-12, -22, 12, 7],
        [30, -25, 24, 10],
      ].map(([x, z, w, d], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 3.4, d]} />
            <meshStandardMaterial color={i === 3 ? '#c9c4b8' : '#ecebe4'} roughness={0.7} />
          </mesh>
          <mesh position={[0, 3.5, 0]} castShadow>
            <boxGeometry args={[w + 0.4, 0.2, d + 0.4]} />
            <meshStandardMaterial color={i === 3 ? '#8b8f92' : '#1f4e8c'} roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[10 + i * 11, 0, 18]}>
          <mesh position={[0, 4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[4.5, 4.5, 8, 28]} />
            <meshStandardMaterial color="#e9e6dc" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 8.3, 0]} castShadow>
            <coneGeometry args={[4.55, 0.7, 28]} />
            <meshStandardMaterial color="#d6d2c6" roughness={0.6} metalness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[26, 0.45, 18]} receiveShadow>
        <boxGeometry args={[52, 0.9, 16]} />
        <meshStandardMaterial color="#c8bfae" roughness={1} />
      </mesh>
      <mesh position={[55, 12, -35]} castShadow>
        <cylinderGeometry args={[0.45, 0.7, 24, 12]} />
        <meshStandardMaterial color="#8a8e91" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* parked tankers */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-20 + i * 5, 0, 28]} rotation={[0, Math.PI / 2, 0]}>
          <TankerTruck />
        </group>
      ))}
    </group>
  );
}

export function TankFarm({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[i * 10, 0, (i % 2) * 3]}>
          <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[4, 4, 7, 32]} />
            <meshStandardMaterial color="#e9e6dc" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 7.25, 0]} castShadow>
            <coneGeometry args={[4.05, 0.6, 32]} />
            <meshStandardMaterial color="#d6d2c6" roughness={0.6} metalness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[10, 0.4, 1.5]} receiveShadow>
        <boxGeometry args={[34, 0.8, 14]} />
        <meshStandardMaterial color="#c8bfae" roughness={1} />
      </mesh>
    </group>
  );
}
