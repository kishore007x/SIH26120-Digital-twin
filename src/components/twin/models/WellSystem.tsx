// Wellhead, bridle, polished rod and the depth-compressed downhole system.
// Shared by the placeholder and CAD-derived surface units.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHighlight, useSelectable } from '../selection';
import type { ComponentKey } from '../rig';
import type { Linkage } from '../kinematics';
import { useTwin } from '../../../store/twinStore';
import { THERMAL } from '../../../services/modelConfig';

export const DOWNHOLE = {
  pumpTop: -12.2,
  pumpBottom: -16.1,
  plungerLen: 1.2,
  resTop: -14.9,
  resBottom: -17.9,
  bottom: -19.2,
  carrierY0: 3.4,
  polishedLen: 4.8,
};

function Mat({ k, color, metal = 0.4, rough = 0.5, opacity }: { k: ComponentKey; color: string; metal?: number; rough?: number; opacity?: number }) {
  const hl = useHighlight(k);
  return <meshStandardMaterial color={color} metalness={metal} roughness={rough} transparent={opacity !== undefined} opacity={opacity ?? 1} depthWrite={opacity === undefined} {...hl} />;
}

const loadColor = new THREE.Color();
function colorForLoad(load: number, out: THREE.Color) {
  if (load >= 90) return out.set('#d23a2e');
  if (load >= 80) return out.set('#e07a1f');
  if (load >= 70) return out.set('#d9a22b');
  return out.set('#9aa6b0');
}

const COLD = new THREE.Color('#5a7ea6');
const HOT = new THREE.Color('#e5792b');
export function thermalColor(t: number, out: THREE.Color) {
  // map reservoir temperature (cold, steel blue) → 90 °C (hot, orange)
  const k = Math.min(1, Math.max(0, (t - THERMAL.tReservoir) / 45));
  return out.copy(COLD).lerp(HOT, Math.pow(k, 0.8));
}

interface Props {
  L: Linkage;
  wellX: number;
  showDownhole: boolean;
  cutaway: boolean;
  betaRef: React.MutableRefObject<number>;
  betaZero: number;
  hideSurfaceHanger?: boolean;
  carrierY0?: number;
  /** Rod displacement at mid-stroke relative to betaZero; keeps the plunger centred in the barrel. */
  midOffset?: number;
}

export function WellSystem({ L, wellX, showDownhole, cutaway, betaRef, betaZero, hideSurfaceHanger, carrierY0, midOffset = 0 }: Props) {
  const cY0 = carrierY0 ?? DOWNHOLE.carrierY0;
  const plungerTop = -13.4 - midOffset;
  const carrier = useRef<THREE.Group>(null);
  const rods = useRef<THREE.Group>(null);
  const wires = useRef<THREE.Group>(null);
  const rodMat = useRef<THREE.MeshStandardMaterial>(null);
  const polMat = useRef<THREE.MeshStandardMaterial>(null);
  const pumpMat = useRef<THREE.MeshStandardMaterial>(null);
  const resMat = useRef<THREE.MeshStandardMaterial>(null);
  const haloMat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const tmp = useMemo(() => new THREE.Color(), []);

  const selBridle = useSelectable('bridle');
  const selPol = useSelectable('polishedRod');
  const selWh = useSelectable('wellhead');
  const selRod = useSelectable('rodString');
  const selTub = useSelectable('tubing');
  const selPump = useSelectable('pump');
  const selBore = useSelectable('wellbore');
  const selRes = useSelectable('reservoir');

  const hlRod = useHighlight('rodString');
  const hlPol = useHighlight('polishedRod');
  const hlPump = useHighlight('pump');
  const hlRes = useHighlight('reservoir');

  const pivotY = L.O[1];

  useFrame((state) => {
    const s = useTwin.getState();
    const disp = L.A * (betaRef.current - betaZero);
    const cy = cY0 + disp;
    if (carrier.current) carrier.current.position.y = cy;
    if (rods.current) rods.current.position.y = disp;
    if (wires.current) {
      const len = pivotY - cy;
      wires.current.position.y = cy + len / 2;
      wires.current.scale.y = len;
    }
    const load = s.computed.sample.rodLoad;
    const pred = s.computed.forecast.rodLoadCurrentSpm.value;
    const worst = Math.max(load, pred);
    colorForLoad(load, loadColor);
    if (rodMat.current && hlRod.emissiveIntensity === 0) {
      rodMat.current.color.copy(loadColor);
      rodMat.current.emissive.copy(loadColor).multiplyScalar(load >= 80 ? 0.35 : load >= 70 ? 0.15 : 0);
    }
    if (polMat.current && hlPol.emissiveIntensity === 0) {
      colorForLoad(Math.max(load, worst >= 80 ? 80 : load), tmp);
      polMat.current.color.copy(tmp);
      const pulse = worst >= 80 ? 0.35 + 0.25 * Math.sin(state.clock.elapsedTime * 5) : 0;
      polMat.current.emissive.copy(tmp).multiplyScalar(pulse);
    }
    const fill = s.computed.sample.pumpFillage;
    const pumpOff = fill < 82 || s.computed.forecast.fillageCurrentSpm < 82;
    if (pumpMat.current && hlPump.emissiveIntensity === 0) {
      pumpMat.current.color.set(pumpOff ? '#d08a2a' : '#7d8a96');
      pumpMat.current.emissive.set(pumpOff ? '#d08a2a' : '#000000');
      pumpMat.current.emissiveIntensity = pumpOff ? 0.3 + 0.2 * Math.sin(state.clock.elapsedTime * 4) : 0;
    }
    const T = s.computed.sample.temperature;
    if (resMat.current && hlRes.emissiveIntensity === 0) thermalColor(T - 12, resMat.current.color);
    if (haloMat.current) {
      thermalColor(T + 6, haloMat.current.color);
      haloMat.current.emissive.copy(haloMat.current.color).multiplyScalar(0.25);
    }
    if (halo.current) {
      // heated-zone radius grows with excess temperature above reservoir (visual exaggeration)
      const r = 0.6 + 0.35 * Math.max(0, T - 60);
      halo.current.scale.set(r, ((DOWNHOLE.resTop - DOWNHOLE.resBottom) / 2) * 0.92, 1);
    }
    if (beacon.current) {
      const risk = s.computed.risk;
      const col = risk === 'CRITICAL' || risk === 'HIGH' ? '#e0452f' : risk === 'MODERATE' ? '#f0a92a' : '#4bbf66';
      beacon.current.color.set(col);
      beacon.current.emissive.set(col);
      beacon.current.emissiveIntensity = risk === 'HIGH' || risk === 'CRITICAL' ? 0.6 + 0.6 * Math.max(0, Math.sin(state.clock.elapsedTime * 6)) : 0.8;
    }
  });

  const perfs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 18; i++) {
      const y = DOWNHOLE.resTop - 0.35 - (i % 9) * 0.3;
      const a = (i < 9 ? 0 : Math.PI) + (i % 2) * 0.4;
      out.push([Math.cos(a) * 0.21, y, Math.sin(a) * 0.21]);
    }
    return out;
  }, []);

  const casingOpacity = cutaway ? 0.28 : 1;

  return (
    <group>
      {/* ---------- surface hanger: bridle wires (+ carrier bar unless the CAD model supplies one) ---------- */}
      {(
        <group {...selBridle}>
          <group ref={wires} position={[wellX, cY0, 0]}>
            {[0.09, -0.09].map((z) => (
              <mesh key={z} position={[0, 0, z]}>
                <cylinderGeometry args={[0.014, 0.014, 1, 6]} />
                <Mat k="bridle" color="#2a2f35" metal={0.8} rough={0.35} />
              </mesh>
            ))}
          </group>
          <group ref={carrier} position={[wellX, cY0, 0]} visible={!hideSurfaceHanger}>
            <mesh castShadow>
              <boxGeometry args={[0.16, 0.1, 0.42]} />
              <Mat k="bridle" color="#3b4450" metal={0.6} />
            </mesh>
            {/* load cell */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.1, 14]} />
              <meshStandardMaterial color="#e2b13c" metalness={0.3} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
              <Mat k="bridle" color="#3b4450" metal={0.6} />
            </mesh>
          </group>
        </group>
      )}

      {/* ---------- moving rod column: polished rod + rod string + plunger ---------- */}
      <group ref={rods}>
        <mesh position={[wellX, cY0 - DOWNHOLE.polishedLen / 2, 0]} {...selPol}>
          <cylinderGeometry args={[0.028, 0.028, DOWNHOLE.polishedLen, 10]} />
          <meshStandardMaterial ref={polMat} color="#9aa6b0" metalness={0.9} roughness={0.2} {...(hlPol.emissiveIntensity ? hlPol : {})} />
        </mesh>
        {showDownhole && (
          <group {...selRod}>
            {(() => {
              const top = cY0 - DOWNHOLE.polishedLen;
              const bottom = plungerTop;
              return (
                <mesh position={[wellX, (top + bottom) / 2, 0]}>
                  <cylinderGeometry args={[0.022, 0.022, top - bottom, 8]} />
                  <meshStandardMaterial ref={rodMat} color="#9aa6b0" metalness={0.7} roughness={0.35} {...(hlRod.emissiveIntensity ? hlRod : {})} />
                </mesh>
              );
            })()}
            {/* rod couplings */}
            {Array.from({ length: 10 }, (_, i) => (
              <mesh key={i} position={[wellX, -1.9 - midOffset - i * 1.15, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 0.08, 8]} />
                <meshStandardMaterial color="#6d7780" metalness={0.7} roughness={0.35} />
              </mesh>
            ))}
            {/* plunger + travelling valve */}
            <group {...selPump}>
              <mesh position={[wellX, plungerTop - DOWNHOLE.plungerLen / 2, 0]}>
                <cylinderGeometry args={[0.068, 0.068, DOWNHOLE.plungerLen, 16]} />
                <meshStandardMaterial color="#c9ced3" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[wellX, plungerTop - DOWNHOLE.plungerLen - 0.05, 0]}>
                <sphereGeometry args={[0.05, 12, 8]} />
                <meshStandardMaterial color="#2c3238" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          </group>
        )}
      </group>

      {/* ---------- wellhead ---------- */}
      <group position={[wellX, 0, 0]} {...selWh}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.34, 0.3, 20]} />
          <Mat k="wellhead" color="#5e6a74" metal={0.6} />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.3, 20]} />
          <Mat k="wellhead" color="#6b7782" metal={0.6} />
        </mesh>
        {/* flange rings */}
        {[0.3, 0.6].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 20]} />
            <Mat k="wellhead" color="#4d5760" metal={0.6} />
          </mesh>
        ))}
        {/* flow tee */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.6, 16]} />
          <Mat k="wellhead" color="#6b7782" metal={0.6} />
        </mesh>
        <mesh position={[0, 0.95, 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.8, 14]} />
          <Mat k="wellhead" color="#6b7782" metal={0.6} />
        </mesh>
        {/* wing valve + handwheel */}
        <mesh position={[0, 0.95, 0.55]} castShadow>
          <boxGeometry args={[0.18, 0.2, 0.18]} />
          <Mat k="wellhead" color="#8a2f2a" />
        </mesh>
        <mesh position={[0, 1.15, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.015, 6, 18]} />
          <Mat k="wellhead" color="#b43a30" />
        </mesh>
        {/* flowline to GGS */}
        <mesh position={[0, 0.95, 3.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 5, 12]} />
          <meshStandardMaterial color="#4b555e" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* stuffing box */}
        <mesh position={[0, 1.32, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.22, 16]} />
          <Mat k="wellhead" color="#40484f" metal={0.6} />
        </mesh>
        {/* pressure gauge */}
        <mesh position={[0.18, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 18]} />
          <meshStandardMaterial color="#f2f2ee" />
        </mesh>
      </group>

      {/* status beacon on the unit */}
      <mesh position={[L.O[0] + 0.05, L.O[1] - 0.55, 0.42]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial ref={beacon} color="#4bbf66" emissive="#4bbf66" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>

      {/* ---------- downhole (depth-compressed schematic) ---------- */}
      {showDownhole && (
        <group>
          <group {...selBore}>
            {/* surface casing */}
            <mesh position={[wellX, -2, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 4, 24, 1, true]} />
              <Mat k="wellbore" color="#6b747c" opacity={cutaway ? 0.22 : undefined} />
            </mesh>
            {/* production casing */}
            <mesh position={[wellX, (DOWNHOLE.bottom + 0) / 2, 0]}>
              <cylinderGeometry args={[0.22, 0.22, -DOWNHOLE.bottom, 24, 1, true]} />
              <meshStandardMaterial color="#7a838b" metalness={0.5} roughness={0.5} transparent opacity={casingOpacity} side={THREE.DoubleSide} depthWrite={!cutaway} />
            </mesh>
            {perfs.map((p, i) => (
              <mesh key={i} position={[wellX + p[0], p[1], p[2]]}>
                <sphereGeometry args={[0.035, 8, 6]} />
                <meshBasicMaterial color="#1b1f23" />
              </mesh>
            ))}
          </group>
          <group {...selTub}>
            <mesh position={[wellX, (0.2 + DOWNHOLE.pumpTop) / 2, 0]}>
              <cylinderGeometry args={[0.095, 0.095, 0.2 - DOWNHOLE.pumpTop, 16, 1, true]} />
              <meshStandardMaterial color="#8d969e" metalness={0.5} roughness={0.45} transparent opacity={cutaway ? 0.35 : 1} side={THREE.DoubleSide} depthWrite={!cutaway} />
            </mesh>
          </group>
          <group {...selPump}>
            {/* pump barrel */}
            <mesh position={[wellX, (DOWNHOLE.pumpTop + DOWNHOLE.pumpBottom) / 2, 0]}>
              <cylinderGeometry args={[0.1, 0.1, DOWNHOLE.pumpTop - DOWNHOLE.pumpBottom, 20, 1, true]} />
              <meshStandardMaterial ref={pumpMat} color="#7d8a96" metalness={0.6} roughness={0.35} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} {...(hlPump.emissiveIntensity ? hlPump : {})} />
            </mesh>
            {/* standing valve */}
            <mesh position={[wellX, DOWNHOLE.pumpBottom + 0.05, 0]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <meshStandardMaterial color="#2c3238" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[wellX, DOWNHOLE.pumpBottom - 0.35, 0]}>
              <cylinderGeometry args={[0.07, 0.05, 0.6, 12]} />
              <meshStandardMaterial color="#59626b" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
          {/* reservoir + heated zone (cutaway block on the far half) */}
          <group {...selRes}>
            <mesh position={[wellX, (DOWNHOLE.resTop + DOWNHOLE.resBottom) / 2, -4]}>
              <boxGeometry args={[22, DOWNHOLE.resTop - DOWNHOLE.resBottom, 8]} />
              <meshStandardMaterial ref={resMat} color="#b98a52" roughness={0.95} {...(hlRes.emissiveIntensity ? hlRes : {})} />
            </mesh>
            <mesh ref={halo} position={[wellX, (DOWNHOLE.resTop + DOWNHOLE.resBottom) / 2, 0.02]}>
              <circleGeometry args={[1, 48]} />
              <meshStandardMaterial ref={haloMat} color="#e5792b" transparent opacity={0.55} roughness={0.9} depthWrite={false} />
            </mesh>
          </group>
          <Strata wellX={wellX} />
        </group>
      )}
    </group>
  );
}

const STRATA = [
  { top: -0.02, bottom: -2.2, color: '#d9c7a0', name: 'Aeolian sand / alluvium' },
  { top: -2.2, bottom: -6.5, color: '#9c9486', name: 'Shale' },
  { top: -6.5, bottom: -10.4, color: '#c2ad86', name: 'Sandstone' },
  { top: -10.4, bottom: DOWNHOLE.resTop, color: '#8a857b', name: 'Cap shale' },
  { top: DOWNHOLE.resBottom, bottom: DOWNHOLE.bottom, color: '#7b776f', name: 'Base' },
];

function Strata({ wellX }: { wellX: number }) {
  return (
    <group>
      {STRATA.map((s) => (
        <mesh key={s.name} position={[wellX, (s.top + s.bottom) / 2, -4]} receiveShadow>
          <boxGeometry args={[22, s.top - s.bottom, 8]} />
          <meshStandardMaterial color={s.color} roughness={1} />
        </mesh>
      ))}
      {/* depth scale break marks */}
      {[-5.5, -9.2].map((y) => (
        <mesh key={y} position={[wellX + 0.7, y, 0.01]} rotation={[0, 0, 0.35]}>
          <planeGeometry args={[0.6, 0.05]} />
          <meshBasicMaterial color="#1d242b" />
        </mesh>
      ))}
    </group>
  );
}

