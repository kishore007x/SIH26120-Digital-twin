// Well-site furniture around the pumping unit: gravel pad, fence, signage,
// site cabin, power line, flowline to well-site tanks, tanker, floodlight mast, windsock.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { chainLinkTexture, gravelTextures, signTexture } from './textures';
import { heightAt } from './Terrain';
import { TankerTruck, WellsiteTanks } from './Equipment';

const GALV = '#a9adb0';
const CONCRETE = '#a29d93';

function Beam({ a, b, r = 0.03, color = GALV, castShadow = true }: { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; r?: number; color?: string; castShadow?: boolean }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len: d.length() };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow={castShadow}>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.45} />
    </mesh>
  );
}

/** Sagging cable between two points. */
function Cable({ a, b, sag = 0.6 }: { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; sag?: number }) {
  const geom = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = va.clone().lerp(vb, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4, false);
  }, [a, b, sag]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#2b2b2b" roughness={0.6} />
    </mesh>
  );
}

function Fence({ x0, x1, z0, z1, gate }: { x0: number; x1: number; z0: number; z1: number; gate: [number, number] }) {
  const H = 1.9;
  const sides = useMemo(() => {
    // segments as [ax, az, bx, bz]; gate is an opening on the x0 side between z = gate[0]..gate[1]
    return [
      [x0, z0, x1, z0],
      [x1, z0, x1, z1],
      [x1, z1, x0, z1],
      [x0, z1, x0, gate[1]],
      [x0, gate[0], x0, z0],
    ] as [number, number, number, number][];
  }, [x0, x1, z0, z1, gate]);
  return (
    <group>
      {sides.map(([ax, az, bx, bz], i) => {
        const len = Math.hypot(bx - ax, bz - az);
        const ang = Math.atan2(bz - az, bx - ax);
        const posts = Math.max(1, Math.round(len / 2.5));
        const tex = chainLinkTexture(len / 0.12, H / 0.12);
        return (
          <group key={i} position={[ax, 0, az]} rotation={[0, -ang, 0]}>
            <mesh position={[len / 2, H / 2 + 0.05, 0]}>
              <planeGeometry args={[len, H]} />
              <meshStandardMaterial color="#9ea3a6" metalness={0.5} roughness={0.5} alphaMap={tex} alphaTest={0.5} side={THREE.DoubleSide} />
            </mesh>
            {Array.from({ length: posts + 1 }, (_, k) => (
              <Beam key={k} a={[(k / posts) * len, 0, 0]} b={[(k / posts) * len, H + 0.15, 0]} r={0.035} />
            ))}
            <Beam a={[0, H + 0.1, 0]} b={[len, H + 0.1, 0]} r={0.022} castShadow={false} />
          </group>
        );
      })}
    </group>
  );
}

function Cabin({ position }: { position: THREE.Vector3Tuple }) {
  return (
    <group position={position} rotation={[0, 0.12, 0]}>
      {/* skids */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.1, s * 1.05]} castShadow receiveShadow>
          <boxGeometry args={[6.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#4a4d50" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 2.7, 2.45]} />
        <meshStandardMaterial color="#ecebe4" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 2.95, 0]} castShadow>
        <boxGeometry args={[6.15, 0.12, 2.6]} />
        <meshStandardMaterial color="#c8c6bd" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* blue band */}
      <mesh position={[0, 0.55, 1.231]}>
        <planeGeometry args={[6, 0.35]} />
        <meshStandardMaterial color="#a8401a" roughness={0.6} />
      </mesh>
      {/* windows + door on the +z face */}
      {[-1.8, 0.4].map((x) => (
        <mesh key={x} position={[x, 1.9, 1.232]}>
          <planeGeometry args={[1.1, 0.8]} />
          <meshStandardMaterial color="#5b6f82" roughness={0.1} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[2.1, 1.3, 1.232]}>
        <planeGeometry args={[0.9, 2.0]} />
        <meshStandardMaterial color="#8a8f93" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* AC unit */}
      <mesh position={[-1.8, 1.0, 1.4]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.35]} />
        <meshStandardMaterial color="#d9d8d2" roughness={0.6} />
      </mesh>
      {/* steps */}
      <mesh position={[2.1, 0.18, 1.6]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.36, 0.6]} />
        <meshStandardMaterial color="#6d7073" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function PowerPole({ x, z, cx }: { x: number; z: number; cx: number }) {
  const y0 = heightAt(x, z, cx);
  return (
    <group position={[x, y0, z]}>
      <mesh position={[0, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 9, 10]} />
        <meshStandardMaterial color="#9a978f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 8.6, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, 2.4]} />
        <meshStandardMaterial color="#7d7a73" roughness={0.8} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[0, 8.8, k * 1.0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.25, 8]} />
          <meshStandardMaterial color="#6f5a3c" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Windsock({ position }: { position: THREE.Vector3Tuple }) {
  const sock = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!sock.current) return;
    const t = clock.elapsedTime;
    sock.current.rotation.y = 0.6 + Math.sin(t * 0.35) * 0.25;
    sock.current.rotation.z = -0.25 + Math.sin(t * 1.7) * 0.06;
  });
  return (
    <group position={position}>
      <Beam a={[0, 0, 0]} b={[0, 6, 0]} r={0.04} />
      <group ref={sock} position={[0, 5.9, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.3 + i * 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2 - i * 0.035, 0.2 - (i + 1) * 0.035, 0.3, 12, 1, true]} />
            <meshStandardMaterial color={i % 2 ? '#f2f2ee' : '#e0621f'} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function SiteProps({ wellX, wellId, showPad }: { wellX: number; wellId: string; showPad: boolean }) {
  const pcx = wellX - 3.2;
  const x0 = pcx - 10.5;
  const x1 = pcx + 13;
  const z0 = -8.4;
  const z1 = 9.6;
  const gravel = useMemo(() => gravelTextures(5).map, []);
  const sign = useMemo(() => signTexture([`WELL ${wellId}  ·  BAGHEWALA FIELD`, 'Heavy oil · CSS + sucker rod pump', 'Digital twin demonstration site', 'PPE REQUIRED · NO SMOKING · H2S AWARENESS']), [wellId]);
  const poles = useMemo(() => Array.from({ length: 8 }, (_, k) => ({ x: x0 - 3 - k * 32, z: -13 - k * 1.5 })), [x0]);
  const panel: THREE.Vector3Tuple = [x0 + 2.2, 0, z0 + 1.6];

  return (
    <group>
      {showPad && (
        <group>
          {/* gravel pad with low berm */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pcx + 1.25, 0.01, 0.6]} receiveShadow>
            <planeGeometry args={[26.5, 21]} />
            <meshStandardMaterial map={gravel} roughness={0.95} />
          </mesh>
          {/* oil-stained ground around the wellhead */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wellX, 0.02, 0]}>
            <circleGeometry args={[1.6, 32]} />
            <meshStandardMaterial color="#3a342c" transparent opacity={0.45} roughness={0.7} depthWrite={false} />
          </mesh>
          {/* concrete cellar ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wellX, 0.03, 0]} receiveShadow>
            <ringGeometry args={[0.4, 0.9, 32]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.9} />
          </mesh>
          {/* unit foundation plinth */}
          <mesh position={[pcx + 0.2, 0.06, 0]} receiveShadow castShadow>
            <boxGeometry args={[7.8, 0.12, 3.0]} />
            <meshStandardMaterial color={CONCRETE} roughness={0.9} />
          </mesh>
        </group>
      )}

      <Fence x0={x0} x1={x1} z0={z0} z1={z1} gate={[-2.5, 2.5]} />

      {/* signboard outside the front fence */}
      <group position={[pcx + 5.5, 0, z1 + 1.3]} rotation={[0, -0.25, 0]}>
        <Beam a={[-1.2, 0, 0]} b={[-1.2, 2.6, 0]} r={0.05} />
        <Beam a={[1.2, 0, 0]} b={[1.2, 2.6, 0]} r={0.05} />
        <mesh position={[0, 2.05, 0.06]} castShadow>
          <boxGeometry args={[2.8, 1.4, 0.05]} />
          <meshStandardMaterial color="#e8e6de" />
        </mesh>
        <mesh position={[0, 2.05, 0.09]}>
          <planeGeometry args={[2.72, 1.32]} />
          <meshStandardMaterial map={sign} roughness={0.6} />
        </mesh>
      </group>

      {/* MCC / VFD panel on a plinth + service cable from the power line */}
      <group position={panel}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[1.8, 0.2, 1.0]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[1.5, 1.9, 0.6]} />
          <meshStandardMaterial color="#d7d9d2" roughness={0.55} metalness={0.25} />
        </mesh>
        <mesh position={[0, 2.25, 0]} castShadow>
          <boxGeometry args={[1.8, 0.08, 0.95]} />
          <meshStandardMaterial color="#9fa4a8" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0.35, 1.5, 0.305]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshBasicMaterial color="#0f3d29" />
        </mesh>
      </group>
      {poles.map((p, i) => (
        <PowerPole key={i} x={p.x} z={p.z} cx={pcx} />
      ))}
      {poles.slice(0, -1).map((p, i) =>
        [-1, 0, 1].map((k) => {
          const q = poles[i + 1];
          return <Cable key={`${i}${k}`} a={[p.x, heightAt(p.x, p.z, pcx) + 8.9, p.z + k]} b={[q.x, heightAt(q.x, q.z, pcx) + 8.9, q.z + k]} sag={0.9} />;
        }),
      )}
      <Cable a={[poles[0].x, 8.4, poles[0].z]} b={[panel[0], 2.2, panel[2]]} sag={0.8} />

      {/* flowline to the well-site storage tanks (crude is stored at the well and evacuated by tanker) */}
      <group>
        <Beam a={[wellX, 0.95, 5.75]} b={[wellX + 2.7, 0.95, 5.75]} r={0.06} color="#4b555e" />
        <Beam a={[wellX + 2.7, 0.95, 5.75]} b={[wellX + 2.7, 1.9, 5.75]} r={0.06} color="#4b555e" />
        <WellsiteTanks position={[wellX + 5, 0, 4.6]} yaw={Math.PI / 2} />
        {/* tanker loading point */}
        <Beam a={[wellX + 5, 0.5, 8.5]} b={[wellX + 5, 0.5, 11.2]} r={0.06} color="#4b555e" />
        <mesh position={[wellX + 5, 0.8, 11.3]} castShadow>
          <boxGeometry args={[0.35, 0.6, 0.35]} />
          <meshStandardMaterial color="#8a2f2a" roughness={0.5} />
        </mesh>
      </group>

      {/* crude tanker (bowser) waiting outside the gate */}
      <group position={[x0 - 6, 0, -3.5]}>
        <TankerTruck />
      </group>

      {/* floodlight mast */}
      <group position={[x1 - 0.8, 0, z0 + 0.8]}>
        <Beam a={[0, 0, 0]} b={[0, 7.5, 0]} r={0.07} />
        <mesh position={[-0.25, 7.5, 0.25]} rotation={[0.5, 0.8, 0]} castShadow>
          <boxGeometry args={[0.6, 0.35, 0.15]} />
          <meshStandardMaterial color="#6f7478" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      <Cabin position={[x0 - 6, 0, 5]} />
      <Windsock position={[x0 - 2.5, 0, 11]} />
    </group>
  );
}
