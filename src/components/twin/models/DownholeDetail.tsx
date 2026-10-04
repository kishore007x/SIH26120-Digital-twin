// Detailed downhole completion + thermal view (depth-compressed schematic).
//
// Adds to WellSystem: cement sheaths, casing / tubing collars, casing shoe, tubing anchor,
// seating nipple, gas anchor, annular dynamic fluid level, perforation tunnels with
// animated reservoir inflow, and — in THERMAL mode — false-colour strata, a heated
// produced-fluid column inside the tubing and the CSS heated-zone plume.
// Values come from the simulated twin state and the simplified thermal profile model.

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTwin } from '../../../store/twinStore';
import { THERMAL } from '../../../services/modelConfig';
import { PROFILE, fluidTemperature, geothermal, radialTemperature, thermalRGB } from '../../../services/thermalProfile';
import { DOWNHOLE } from './WellSystem';

/** Scene y (depth-compressed) → true depth in metres. */
export function sceneYToDepth(y: number) {
  if (y >= DOWNHOLE.pumpTop) return (-y / -DOWNHOLE.pumpTop) * PROFILE.pumpDepthM;
  if (y >= DOWNHOLE.resTop) return PROFILE.pumpDepthM + ((DOWNHOLE.pumpTop - y) / (DOWNHOLE.pumpTop - DOWNHOLE.resTop)) * (PROFILE.resTopM - PROFILE.pumpDepthM);
  if (y >= DOWNHOLE.resBottom) return PROFILE.resTopM + ((DOWNHOLE.resTop - y) / (DOWNHOLE.resTop - DOWNHOLE.resBottom)) * (PROFILE.resBottomM - PROFILE.resTopM);
  return PROFILE.resBottomM + (DOWNHOLE.resBottom - y) * 10;
}
export function depthToSceneY(m: number) {
  return m <= PROFILE.pumpDepthM ? (-m / PROFILE.pumpDepthM) * -DOWNHOLE.pumpTop : DOWNHOLE.pumpTop;
}

/** Simulated dynamic fluid level (m) from pump fillage: fuller pump ↔ more submergence. */
export function dynamicFluidLevelM(fillage: number) {
  const submergence = Math.max(15, (fillage - 60) * 6);
  return PROFILE.pumpDepthM - submergence;
}

/** Width / depth of the geological cut-away block (scene units). */
export const SECTION_W = 120;
export const SECTION_D = 16;

/**
 * Rotates its children about the well axis so the cut face (local z = 0, block toward −z)
 * always faces the camera — the downhole section reads from any orbit angle.
 */
export function FacingSection({ wellX, children }: { wellX: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ camera }, dt) => {
    if (!g.current) return;
    const dx = camera.position.x - wellX;
    const dz = camera.position.z;
    if (dx * dx + dz * dz < 0.25) return; // camera on the well axis: keep the current orientation
    const goal = Math.atan2(dx, dz);
    let d = goal - g.current.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.current.rotation.y += d * (1 - Math.exp(-dt * 5));
  });
  return (
    <group ref={g} position={[wellX, 0, 0]}>
      <group position={[-wellX, 0, 0]}>{children}</group>
    </group>
  );
}

/** metres per scene unit in the horizontal (radial) direction of the cut face */
export const RADIAL_M_PER_UNIT = 2.5;

const tmpColor = new THREE.Color();
const setThermal = (t: number, out: THREE.Color) => {
  const [r, g, b] = thermalRGB(t);
  return out.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
};

export function DownholeDetail({ wellX, cutaway, thermal }: { wellX: number; cutaway: boolean; thermal: boolean }) {
  const fluidLevel = useTwin((s) => Math.round(dynamicFluidLevelM(s.computed.sample.pumpFillage) / 5) * 5);
  const levelY = depthToSceneY(fluidLevel);
  const annTop = levelY;
  const annBottom = DOWNHOLE.resTop;

  return (
    <group>
      {/* cement sheaths (outside surface + production casing) */}
      <mesh position={[wellX, -2, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 4, 24, 1, true]} />
        <meshStandardMaterial color="#b9b4aa" roughness={1} transparent opacity={cutaway ? 0.18 : 0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[wellX, (DOWNHOLE.bottom - 3.5) / 2 - 0.2, 0]}>
        <cylinderGeometry args={[0.27, 0.27, -DOWNHOLE.bottom - 3.5, 24, 1, true]} />
        <meshStandardMaterial color="#aaa59b" roughness={1} transparent opacity={cutaway ? 0.14 : 0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* surface casing shoe */}
      <mesh position={[wellX, -4.02, 0]}>
        <cylinderGeometry args={[0.33, 0.3, 0.12, 24]} />
        <meshStandardMaterial color="#4d565e" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* production casing collars */}
      {Array.from({ length: 12 }, (_, i) => -0.8 - i * 1.45)
        .filter((y) => y > DOWNHOLE.bottom + 0.3)
        .map((y) => (
          <mesh key={`cc${y}`} position={[wellX, y, 0]}>
            <cylinderGeometry args={[0.235, 0.235, 0.07, 24, 1, true]} />
            <meshStandardMaterial color="#5c656d" metalness={0.6} roughness={0.4} transparent opacity={cutaway ? 0.5 : 1} side={THREE.DoubleSide} />
          </mesh>
        ))}
      {/* tubing collars */}
      {Array.from({ length: 10 }, (_, i) => -0.6 - i * 1.15).map((y) => (
        <mesh key={`tc${y}`} position={[wellX, y, 0]}>
          <cylinderGeometry args={[0.108, 0.108, 0.07, 16]} />
          <meshStandardMaterial color="#6f7880" metalness={0.6} roughness={0.35} transparent opacity={cutaway ? 0.55 : 1} />
        </mesh>
      ))}
      {/* tubing anchor / catcher with slips */}
      <group position={[wellX, DOWNHOLE.pumpTop + 0.9, 0]}>
        <mesh>
          <cylinderGeometry args={[0.13, 0.13, 0.4, 16]} />
          <meshStandardMaterial color="#39424b" metalness={0.6} roughness={0.4} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.17, 0, Math.sin((k * Math.PI) / 2) * 0.17]} rotation={[0, (-k * Math.PI) / 2, 0]}>
            <boxGeometry args={[0.05, 0.28, 0.07]} />
            <meshStandardMaterial color="#c9a13a" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* seating nipple / hold-down at barrel bottom */}
      <mesh position={[wellX, DOWNHOLE.pumpBottom + 0.18, 0]}>
        <cylinderGeometry args={[0.115, 0.115, 0.14, 16]} />
        <meshStandardMaterial color="#c9a13a" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* gas anchor (perforated dip tube) below pump */}
      <GasAnchor wellX={wellX} />
      {/* annular fluid (casing–tubing annulus) up to the dynamic fluid level */}
      {annTop > annBottom && (
        <mesh position={[wellX, (annTop + annBottom) / 2, 0]}>
          <cylinderGeometry args={[0.212, 0.212, annTop - annBottom, 24, 1, true]} />
          <meshStandardMaterial color={thermal ? '#e0a040' : '#5a3a1a'} transparent opacity={cutaway ? 0.35 : 0} side={THREE.DoubleSide} depthWrite={false} roughness={0.2} />
        </mesh>
      )}
      <mesh position={[wellX, levelY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.212, 32]} />
        <meshStandardMaterial color="#e2b13c" emissive="#e2b13c" emissiveIntensity={0.4} side={THREE.DoubleSide} transparent opacity={cutaway ? 0.9 : 0} />
      </mesh>
      {thermal && <FluidColumn wellX={wellX} />}
      {/* planar section content turns with the cut face */}
      <FacingSection wellX={wellX}>
        <Perforations wellX={wellX} />
        <Inflow wellX={wellX} thermal={thermal} />
        {thermal && <HeatPlume wellX={wellX} />}
        {thermal && <ThermalStrata wellX={wellX} />}
      </FacingSection>
    </group>
  );
}

function GasAnchor({ wellX }: { wellX: number }) {
  const holes = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i % 4) * (Math.PI / 2) + (i > 5 ? Math.PI / 4 : 0);
      out.push([Math.cos(a) * 0.072, DOWNHOLE.pumpBottom - 0.25 - Math.floor(i / 4) * 0.18, Math.sin(a) * 0.072]);
    }
    return out;
  }, []);
  return (
    <group>
      {holes.map((p, i) => (
        <mesh key={i} position={[wellX + p[0], p[1], p[2]]}>
          <sphereGeometry args={[0.018, 6, 4]} />
          <meshBasicMaterial color="#15191c" />
        </mesh>
      ))}
    </group>
  );
}

function Perforations({ wellX }: { wellX: number }) {
  const tunnels = useMemo(() => {
    const out: { y: number; side: number }[] = [];
    for (let i = 0; i < 8; i++) out.push({ y: DOWNHOLE.resTop - 0.35 - i * 0.34, side: i % 2 ? 1 : -1 });
    return out;
  }, []);
  return (
    <group>
      {tunnels.map((t, i) => (
        <mesh key={i} position={[wellX + t.side * 0.55, t.y, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.012, 0.66, 8]} />
          <meshStandardMaterial color="#231a12" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Oil droplets flowing from the reservoir toward the perforations; speed follows the oil rate. */
function Inflow({ wellX, thermal }: { wellX: number; thermal: boolean }) {
  const N = 60;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ side: i % 2 ? 1 : -1, y: DOWNHOLE.resTop - 0.25 - ((i * 0.618) % 1) * (DOWNHOLE.resTop - DOWNHOLE.resBottom - 0.5), p: (i * 0.37) % 1 })), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    const s = useTwin.getState();
    const oil = s.computed.sample.oil;
    const tNear = s.computed.sample.temperature;
    const speed = 0.05 + 0.006 * oil * Math.min(1.5, Math.max(0.3, 1 / (s.computed.sample.viscosity / 380)));
    if (!mesh.current) return;
    seeds.forEach((sd, i) => {
      sd.p -= speed * Math.min(dt, 0.1);
      if (sd.p < 0) sd.p += 1;
      const r = 0.3 + sd.p * 8;
      const yy = sd.y + (0.5 - sd.p) * 0.05 * Math.sin(i);
      m.makeTranslation(wellX + sd.side * r, yy, 0.06);
      const k = 0.6 + 0.6 * (1 - sd.p);
      m.scale(new THREE.Vector3(k, k, k));
      mesh.current!.setMatrixAt(i, m);
      if (thermal) mesh.current!.setColorAt(i, setThermal(radialTemperature(r * RADIAL_M_PER_UNIT, tNear), tmpColor));
      else mesh.current!.setColorAt(i, tmpColor.set('#3a2412'));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[0.045, 8, 6]} />
      <meshStandardMaterial roughness={0.3} metalness={0.1} />
    </instancedMesh>
  );
}

/** Produced fluid inside the tubing, coloured by the Ramey-type temperature profile. */
function FluidColumn({ wellX }: { wellX: number }) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.075, 0.075, -DOWNHOLE.pumpTop, 12, 48, false);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const last = useRef(-1);
  useFrame(() => {
    const s = useTwin.getState();
    const t = s.computed.sample.temperature;
    const oil = s.computed.sample.oil;
    const key = Math.round(t * 5) + Math.round(oil) * 1000;
    if (key === last.current) return;
    last.current = key;
    const pos = geo.attributes.position;
    const col = geo.attributes.color as THREE.BufferAttribute;
    const half = -DOWNHOLE.pumpTop / 2;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) - half; // 0 at top … pumpTop at bottom
      setThermal(fluidTemperature(sceneYToDepth(y), t, oil), tmpColor);
      col.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    col.needsUpdate = true;
  });
  return (
    <mesh geometry={geo} position={[wellX, DOWNHOLE.pumpTop / 2, 0]}>
      <meshStandardMaterial vertexColors emissive="#ffffff" emissiveIntensity={0.08} roughness={0.4} />
    </mesh>
  );
}

/** CSS heated zone on the reservoir cut face (radial Gaussian around the wellbore). */
function HeatPlume({ wellX }: { wellX: number }) {
  const W = 70; // heated zone is near-well; beyond this the far-field reservoir rock shows
  const H = DOWNHOLE.resTop - DOWNHOLE.resBottom;
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 700;
    c.height = 40;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, tex: t };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const last = useRef(-1);
  useFrame(() => {
    const tNear = useTwin.getState().computed.sample.temperature;
    const key = Math.round(tNear * 5);
    if (key === last.current) return;
    last.current = key;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let x = 0; x < canvas.width; x++) {
      const rM = Math.abs((x / (canvas.width - 1) - 0.5) * W) * RADIAL_M_PER_UNIT;
      for (let y = 0; y < canvas.height; y++) {
        const edge = Math.min(y, canvas.height - 1 - y) / (canvas.height / 2); // cooler toward cap/base rock
        const t = THERMAL.tReservoir + (radialTemperature(rM, tNear) - THERMAL.tReservoir) * (0.75 + 0.25 * Math.min(1, edge * 2));
        const [r, g, b] = thermalRGB(t);
        const o = (y * canvas.width + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // isotherm lines at 50 / 60 / 70 °C
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.setLineDash([4, 3]);
    for (const iso of [50, 60, 70]) {
      if (tNear <= iso) continue;
      const rM = PROFILE.heatedRadiusM * Math.sqrt(Math.log((tNear - THERMAL.tReservoir) / (iso - THERMAL.tReservoir)));
      const dx = (rM / RADIAL_M_PER_UNIT / W) * canvas.width;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 + sgn * dx, 0);
        ctx.lineTo(canvas.width / 2 + sgn * dx, canvas.height);
        ctx.stroke();
      }
    }
    tex.needsUpdate = true;
  });
  return (
    <mesh position={[wellX, (DOWNHOLE.resTop + DOWNHOLE.resBottom) / 2, 0.012]}>
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** Rock layers recoloured by the undisturbed geothermal temperature at their mid-depth. */
function ThermalStrata({ wellX }: { wellX: number }) {
  const bands = useMemo(() => {
    const out: { top: number; bottom: number; color: THREE.Color }[] = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const top = (i / n) * DOWNHOLE.resTop;
      const bottom = ((i + 1) / n) * DOWNHOLE.resTop;
      out.push({ top, bottom, color: setThermal(geothermal(sceneYToDepth((top + bottom) / 2)), new THREE.Color()) });
    }
    out.push({ top: DOWNHOLE.resBottom, bottom: DOWNHOLE.bottom, color: setThermal(geothermal(PROFILE.resBottomM + 10), new THREE.Color()) });
    return out;
  }, []);
  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} position={[wellX, (b.top + b.bottom) / 2, 0.008]}>
          <planeGeometry args={[SECTION_W, b.top - b.bottom + 0.01]} />
          <meshBasicMaterial color={b.color} toneMapped={false} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  );
}
