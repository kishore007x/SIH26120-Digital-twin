// Realistic 3D aerial view of the field: dune terrain, well pads with SRP units
// and well-site tanks, workover rigs, CSS steam generators, sand tracks, tanker
// traffic and the field camp. Well positions are schematic (not surveyed).
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MapControls, Sky } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { Crosshair, Globe2, Sparkles } from 'lucide-react';
import type { Well } from '../../types';
import { useTwin } from '../../store/twinStore';
import { STATUS_COLOR } from '../../lib/format';
import type { WellDisplay } from '../field/useLiveWell';
import { WellHoverCard } from '../field/WellHoverCard';
import { LabelLayer, LabelProjector, type LabelDef } from '../twin/labels';
import { FieldCamp, Pumpjack, SteamGenerator, TankerTruck, WellsiteTanks, WorkoverRig } from '../twin/environment/Equipment';
import { gravelTextures } from '../twin/environment/textures';
import { mulberry32 } from '../twin/environment/noise';
import { buildRoads, fieldHeight, initLayout, roadGeometry, toWorld, WORLD_SIZE, type RoadPath } from './fieldWorld';
import { fbm } from '../twin/environment/noise';

const HAZE = '#d8cdb8';
const SUN = new THREE.Vector3(0.62, 0.42, 0.5).normalize(); // ~28° elevation: long shading on dunes
/** Wells shown with a mobile steam generator (CSS injection / soak) — demonstration. */
export const CSS_INJECTION_WELLS = ['W-03', 'W-06'];

/** Simplified desert: smooth sand-colour gradient, no texture detail (map-style overview). */
function FieldTerrain() {
  const geometry = useMemo(() => {
    const seg = 200;
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const light = new THREE.Color('#ead8b6');
    const warm = new THREE.Color('#d8b98a');
    const deep = new THREE.Color('#c79e6c');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, fieldHeight(x, z));
      // broad gradient: pale around the operating area, warmer and deeper toward the edges,
      // with very soft large-scale variation
      const r = Math.min(1, Math.hypot(x / 2600, z / 2100));
      const soft = fbm(x * 0.0007 + 3, z * 0.0007, 3);
      const t = Math.min(1, Math.max(0, r * 0.85 + (soft - 0.5) * 0.5));
      if (t < 0.5) c.lerpColors(light, warm, t / 0.5);
      else c.lerpColors(warm, deep, (t - 0.5) / 0.5);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

/** Map-style landmark pin (teardrop) with a pumpjack glyph, coloured by well status. */
function LandmarkPin({ color, selected, pulse }: { color: string; selected: boolean; pulse: boolean }) {
  const s = selected ? 34 : 26;
  return (
    <svg width={s} height={s * 1.3} viewBox="0 0 40 52" className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-110 ${pulse ? 'pulse' : ''}`}>
      <path d="M20 51C20 51 3 31 3 19.5A17 17 0 0 1 37 19.5C37 31 20 51 20 51Z" fill={color} stroke={selected ? '#0f2340' : '#ffffff'} strokeWidth={selected ? 3 : 2} />
      <circle cx="20" cy="19.5" r="11.5" fill="#ffffff" />
      {/* pumpjack glyph */}
      <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 26h16" />
        <path d="M17 26l3-8 3 8" />
        <path d="M12 16.5l14-3" />
        <path d="M25.5 13.2c1.6.5 2.3 2 2 3.6" />
        <path d="M27.4 16.9v6" />
      </g>
    </svg>
  );
}

/** Keeps the compass and scale bar in sync with the camera (writes straight to the DOM). */
function MapHud({ compass, scale, scaleLabel }: { compass: React.RefObject<HTMLDivElement | null>; scale: React.RefObject<HTMLDivElement | null>; scaleLabel: React.RefObject<HTMLSpanElement | null> }) {
  const { camera, size, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; size: { width: number; height: number }; controls: { target: THREE.Vector3 } | null };
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  useFrame(() => {
    const target = controls?.target ?? new THREE.Vector3();
    // screen direction of true north (−z in field coordinates)
    v.a.copy(target).project(camera);
    v.b.copy(target).add(new THREE.Vector3(0, 0, -100)).project(camera);
    const ang = Math.atan2(v.b.x - v.a.x, (v.b.y - v.a.y) * (size.height / size.width));
    if (compass.current) compass.current.style.transform = `rotate(${(ang * 180) / Math.PI}deg)`;
    // metres per pixel at the target
    const d = camera.position.distanceTo(target);
    const mpp = (2 * d * Math.tan(((camera.fov / 2) * Math.PI) / 180)) / size.height;
    const raw = mpp * 110;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 5, 10].map((k) => k * pow).find((n) => n >= raw * 0.6) ?? raw;
    if (scale.current) scale.current.style.width = `${Math.round(nice / mpp)}px`;
    if (scaleLabel.current) scaleLabel.current.textContent = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
  });
  return null;
}

function Roads({ roads }: { roads: RoadPath[] }) {
  const geoms = useMemo(() => roads.map(roadGeometry), [roads]);
  return (
    <group>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial color={roads[i].trunk ? '#a8987c' : '#b3a488'} roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </group>
  );
}

function Truck({ road, speed, offset }: { road: RoadPath; speed: number; offset: number }) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(road.pts), [road]);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3() }), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const len = curve.getLength();
    const s = ((clock.elapsedTime * speed) / len + offset) % 2;
    const u = s < 1 ? s : 2 - s; // out and back
    curve.getPointAt(Math.min(0.999, Math.max(0.001, u)), tmp.p);
    curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), tmp.t);
    if (s >= 1) tmp.t.negate();
    ref.current.position.set(tmp.p.x, tmp.p.y - 0.2, tmp.p.z);
    ref.current.rotation.y = Math.atan2(-tmp.t.z, tmp.t.x);
  });
  return (
    <group ref={ref}>
      <TankerTruck />
    </group>
  );
}

function WellSite({ well, wellId }: { well: Well; wellId: string }) {
  const [x, z] = toWorld(well.x, well.y);
  const y = fieldHeight(x, z);
  const rnd = useMemo(() => mulberry32(well.id.charCodeAt(2) * 97 + well.id.charCodeAt(3)), [well.id]);
  const yaw = useMemo(() => rnd() * Math.PI * 2, [rnd]);
  const gravel = useMemo(() => gravelTextures(3).map, []);
  const live = well.id === wellId;
  const producing = well.status === 'PRODUCING' || well.status === 'AT_RISK';
  const steam = CSS_INJECTION_WELLS.includes(well.id);
  const spm = live ? () => useTwin.getState().spm : well.spm || 8;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const local = (lx: number, lz: number): THREE.Vector3Tuple => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, yaw]} position={[x, y + 0.06, z]} receiveShadow>
        <planeGeometry args={[46, 38]} />
        <meshStandardMaterial map={gravel} roughness={1} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {well.status === 'MAINTENANCE' ? (
        <WorkoverRig position={local(2.4, 0)} yaw={yaw} />
      ) : (
        <Pumpjack position={[x, y, z]} yaw={yaw} spm={spm} phase={rnd() * 6} running={producing} />
      )}
      <WellsiteTanks position={local(-4, 12)} yaw={yaw} />
      {steam && <SteamGenerator position={local(4, -11)} yaw={yaw} />}
    </group>
  );
}

/** Exposes camera + controls to DOM buttons (zoom). */
function CameraHandle({ handle }: { handle: React.MutableRefObject<{ camera: THREE.Camera; target: THREE.Vector3 } | null> }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3 } | null };
  useEffect(() => {
    handle.current = controls ? { camera, target: controls.target } : null;
  });
  return null;
}

interface Flight {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  seq: number;
}

function CameraFlight({ flight }: { flight: Flight }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const active = useRef(false);
  const t = useRef(0);
  useEffect(() => {
    active.current = true;
    t.current = 0;
  }, [flight.seq]);
  useFrame((_, dt) => {
    if (!active.current || !controls) return;
    t.current += dt;
    const k = 1 - Math.pow(0.02, dt);
    camera.position.lerp(flight.pos, k);
    controls.target.lerp(flight.target, k);
    controls.update();
    if (camera.position.distanceTo(flight.pos) < 1 || t.current > 4) active.current = false;
  });
  return null;
}

const FOV = 40;
/** Top-down view centred on the field, high enough to frame every well. */
function topView(wells: Well[], aspect: number): Omit<Flight, 'seq'> {
  const pts = wells.map((w) => toWorld(w.x, w.y));
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const w = Math.max(...xs) - Math.min(...xs) + 260;
  const d = Math.max(...zs) - Math.min(...zs) + 260;
  const t = Math.tan(((FOV / 2) * Math.PI) / 180);
  const h = Math.max(d / (2 * t), w / (2 * t * Math.max(0.5, aspect)));
  // tiny z offset keeps the controls' up-vector well defined when looking straight down
  return { pos: new THREE.Vector3(cx, h, cz + 0.01), target: new THREE.Vector3(cx, 0, cz) };
}

export default function FieldView3D({ wells, displays, selectedId }: { wells: Well[]; displays: Record<string, WellDisplay>; selectedId: string }) {
  const nav = useNavigate();
  useMemo(() => initLayout(wells), [wells]);
  const roads = useMemo(() => buildRoads(wells), [wells]);
  const trunks = roads.filter((r) => r.trunk);
  const [hover, setHover] = useState<string | null>(null);
  const compass = useRef<HTMLDivElement>(null);
  const scaleBar = useRef<HTMLDivElement>(null);
  const scaleLabel = useRef<HTMLSpanElement>(null);
  const cam = useRef<{ camera: THREE.Camera; target: THREE.Vector3 } | null>(null);
  const zoom = (factor: number) => {
    const c = cam.current;
    if (!c) return;
    const off = c.camera.position.clone().sub(c.target).multiplyScalar(factor);
    if (off.length() < 25 || off.length() > 7000) return;
    setFlight((f) => ({ pos: c.target.clone().add(off), target: c.target.clone(), seq: f.seq + 1 }));
  };
  const [realistic, setRealistic] = useState(() => {
    try {
      return localStorage.getItem('twin.quality') !== 'performance';
    } catch {
      return true;
    }
  });
  const box = useRef<HTMLDivElement>(null);
  const overview = () => topView(wells, box.current ? box.current.clientWidth / Math.max(1, box.current.clientHeight) : 1.5);
  const initial = useMemo(() => topView(wells, 1.5), [wells]);
  const [flight, setFlight] = useState<Flight>({ ...initial, seq: 0 });
  useEffect(() => {
    setFlight((f) => ({ ...overview(), seq: f.seq + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flyTo = (id: string) => {
    const w = wells.find((v) => v.id === id);
    if (!w) return;
    const [x, z] = toWorld(w.x, w.y);
    const y = fieldHeight(x, z);
    setFlight((f) => ({ pos: new THREE.Vector3(x + 70, y + 55, z + 90), target: new THREE.Vector3(x, y + 4, z), seq: f.seq + 1 }));
  };

  const labels: LabelDef[] = wells.map((w) => {
    const [x, z] = toWorld(w.x, w.y);
    const d = displays[w.id];
    const liveRisk = d.risk === 'HIGH' || d.risk === 'CRITICAL';
    const status = w.status === 'PRODUCING' && liveRisk ? 'AT_RISK' : w.status;
    const sel = w.id === selectedId;
    return {
      id: `pin-${w.id}`,
      pos: [x, fieldHeight(x, z) + 2, z],
      content: (
        <button
          className="group pointer-events-auto flex -translate-x-1/2 -translate-y-full flex-col items-center"
          onMouseEnter={() => setHover(w.id)}
          onMouseLeave={() => setHover((h) => (h === w.id ? null : h))}
          onClick={() => nav(`/well/${w.id}`)}
          aria-label={`Open ${w.id}`}
        >
          <span className={`num mb-[1px] whitespace-nowrap rounded-[2px] px-1 text-[9.5px] leading-[13px] font-semibold shadow-sm ${sel ? 'bg-navy-900 text-white' : 'bg-white/90 text-navy-900'}`}>
            {w.id}
            {sel ? ' · TWIN' : ''}
          </span>
          <LandmarkPin color={STATUS_COLOR[status]} selected={sel} pulse={status === 'AT_RISK'} />
        </button>
      ),
    };
  });
  labels.push({
    id: 'pin-camp',
    pos: [0, fieldHeight(0, 0) + 30, 0],
    content: <div className="-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[2px] bg-navy-900/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white shadow">FIELD CAMP · TANKS · TANKER BAY</div>,
  });

  const hoverWell = hover ? wells.find((w) => w.id === hover) : null;

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden rounded-[2px] bg-[#d8cdb8]">
      <Canvas shadows={false} dpr={[1, 1.5]} camera={{ position: initial.pos.toArray(), fov: FOV, near: 1, far: 40000 }} gl={{ antialias: !realistic, powerPreference: 'high-performance' }}>
        <color attach="background" args={[HAZE]} />
        <Sky distance={30000} sunPosition={SUN.clone().multiplyScalar(1000).toArray()} turbidity={3.2} rayleigh={3} mieCoefficient={0.004} mieDirectionalG={0.8} />
        <fog attach="fog" args={[HAZE, 2200, 9000]} />
        <Suspense fallback={null}>
          <Environment files="/env/goegap_1k.hdr" environmentIntensity={0.5} />
        </Suspense>
        <hemisphereLight args={['#dfe8f2', '#b89a70', 0.25]} />
        <directionalLight position={SUN.clone().multiplyScalar(1000).toArray()} intensity={2.2} color="#fff3e0" />
        <FieldTerrain />
        <Roads roads={roads} />
        <FieldCamp position={[0, fieldHeight(0, 0), 0]} />
        {wells.map((w) => (
          <WellSite key={w.id} well={w} wellId={selectedId} />
        ))}
        {trunks.slice(0, 4).map((r, i) => (
          <Truck key={i} road={r} speed={9 + i * 2} offset={i * 0.37} />
        ))}
        <MapControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={1.35} minDistance={25} maxDistance={7000} target={initial.target.toArray()} />
        <CameraFlight flight={flight} />
        <LabelProjector />
        <MapHud compass={compass} scale={scaleBar} scaleLabel={scaleLabel} />
        <CameraHandle handle={cam} />
        {realistic && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO aoRadius={4} distanceFalloff={1} intensity={2} quality="low" halfRes />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.35} />
          </EffectComposer>
        )}
      </Canvas>
      <LabelLayer labels={labels} />

      {/* controls */}
      <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
        <button className="btn px-2 py-1 text-[11px]" onClick={() => setFlight((f) => ({ ...overview(), seq: f.seq + 1 }))}>
          <Globe2 size={12} /> TOP VIEW
        </button>
        <button className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => flyTo(selectedId)}>
          <Crosshair size={12} /> FLY TO {selectedId}
        </button>
        <button
          className={`btn px-2 py-1 text-[11px] ${realistic ? 'btn-primary' : ''}`}
          onClick={() =>
            setRealistic((v) => {
              try {
                localStorage.setItem('twin.quality', v ? 'performance' : 'realistic');
              } catch {
                /* ignore */
              }
              return !v;
            })
          }
        >
          <Sparkles size={12} /> {realistic ? 'REALISTIC' : 'PERFORMANCE'}
        </button>
      </div>
      <div className="pointer-events-none absolute right-2 bottom-2 max-w-[380px] rounded-[3px] border border-[#c6ced6] bg-white/90 px-2 py-1 text-[10px] leading-snug text-ink-3 shadow-sm">
        Representative Thar-desert terrain · well positions schematic (not surveyed) · equipment per field practice: SRP units, well-site tanks, tanker evacuation, mobile steam generators (CSS), workover rigs. Drag = pan · right-drag = rotate · wheel = zoom · click a pin to open its twin.
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-center gap-2">
        <div className="relative h-14 w-14 rounded-full border border-[#c6ced6] bg-white/92 shadow-md" title="North">
          <div ref={compass} className="absolute inset-0">
            <svg viewBox="0 0 56 56" className="h-full w-full">
              <path d="M28 6 L34 28 L28 25 L22 28 Z" fill="#b3261e" />
              <path d="M28 50 L22 28 L28 31 L34 28 Z" fill="#9aa3ab" />
            </svg>
            <span className="absolute top-[1px] left-1/2 -translate-x-1/2 text-[9px] font-bold text-crit">N</span>
            <span className="absolute bottom-[1px] left-1/2 -translate-x-1/2 text-[8px] font-semibold text-ink-3">S</span>
            <span className="absolute top-1/2 left-[3px] -translate-y-1/2 text-[8px] font-semibold text-ink-3">W</span>
            <span className="absolute top-1/2 right-[3px] -translate-y-1/2 text-[8px] font-semibold text-ink-3">E</span>
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-[3px] border border-[#c6ced6] bg-white shadow-md">
          <button className="flex h-8 w-8 items-center justify-center hover:bg-[#f0f3f6]" onClick={() => zoom(0.6)} aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <div className="h-px bg-line" />
          <button className="flex h-8 w-8 items-center justify-center hover:bg-[#f0f3f6]" onClick={() => zoom(1.6)} aria-label="Zoom out">
            <Minus size={15} />
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-[2px] bg-white/85 px-1.5 pt-0.5 pb-1 shadow-sm">
        <span ref={scaleLabel} className="num block text-[10px] text-ink-2">1 km</span>
        <div ref={scaleBar} className="h-[5px] border-x-2 border-b-2 border-ink" style={{ width: 100 }} />
      </div>
      {hoverWell && (
        <div className="pointer-events-none absolute bottom-12 left-2 z-20">
          <WellHoverCard well={hoverWell} d={displays[hoverWell.id]} note={CSS_INJECTION_WELLS.includes(hoverWell.id) ? 'Shut-in for CSS: mobile steam generator on location (steam injection / soak) — demonstration.' : undefined} />
        </div>
      )}
    </div>
  );
}
