// Realistic 3D aerial view of the field: dune terrain, well pads with SRP units
// and well-site tanks, workover rigs, CSS steam generators, sand tracks, tanker
// traffic and the field camp. Well positions are schematic (not surveyed).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Detailed, MapControls, Sky } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Crosshair, Expand, Flame, GitBranch, Globe2, Minus, Plus, RotateCcw, RotateCw, Shrink, Sparkles, X } from 'lucide-react';
import type { Well } from '../../types';
import { useTwin } from '../../store/twinStore';
import { STATUS_COLOR } from '../../lib/format';
import type { WellDisplay } from '../field/useLiveWell';
import { WellHoverCard } from '../field/WellHoverCard';
import { LabelLayer, LabelProjector, type LabelDef } from '../twin/labels';
import { FarWellSite, FieldCamp, Pumpjack, SteamGenerator, TankerTruck, WellsiteTanks, WorkoverRig } from '../twin/environment/Equipment';
import { gravelTextures } from '../twin/environment/textures';
import { useAdaptiveQuality } from '../twin/adaptiveQuality';
import { mulberry32 } from '../twin/environment/noise';
import { buildRoads, fieldHeight, initLayout, roadGeometry, toWorld, type RoadPath } from './fieldWorld';
import { Flowlines, PowerPoles, RealisticTerrain, Vegetation, trackTexture } from './RealisticTerrain';

const HAZE = '#e6caa0'; // warm Thar haze
const SUN = new THREE.Vector3(0.66, 0.34, 0.5).normalize(); // ~22° elevation: golden-hour shading on dunes
/** Wells shown with a mobile steam generator (CSS injection / soak) — demonstration. */
export const CSS_INJECTION_WELLS = ['W-03', 'W-06'];

/** Map-style landmark pin (teardrop) with a pumpjack glyph, coloured by well status. */
function LandmarkPin({ color, selected, pulse }: { color: string; selected: boolean; pulse: boolean }) {
  const s = selected ? 34 : 26;
  return (
    <svg data-body width={s} height={s * 1.3} viewBox="0 0 40 52" className={`drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-110 ${pulse ? 'pulse' : ''}`}>
      <path d="M20 51C20 51 3 31 3 19.5A17 17 0 0 1 37 19.5C37 31 20 51 20 51Z" fill={color} stroke={selected ? '#3f160e' : '#ffffff'} strokeWidth={selected ? 3 : 2} />
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
  // trunk and spur tracks merged into one mesh each (two draw calls for the network)
  const geoms = useMemo(
    () =>
      [true, false].map((trunk) => {
        const parts = roads.filter((r) => !!r.trunk === trunk).map(roadGeometry);
        const g = parts.length ? mergeGeometries(parts) : null;
        parts.forEach((p) => p.dispose());
        return { trunk, g };
      }),
    [roads],
  );
  useEffect(() => () => geoms.forEach(({ g }) => g?.dispose()), [geoms]);
  const tex = useMemo(trackTexture, []);
  return (
    <group>
      {geoms.map(({ trunk, g }) =>
        g ? (
          <mesh key={String(trunk)} geometry={g} receiveShadow>
            <meshStandardMaterial map={tex} color={trunk ? '#e9dcc6' : '#f3e8d6'} roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} />
          </mesh>
        ) : null,
      )}
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
  const rel = (lx: number, lz: number): THREE.Vector3Tuple => [lx * c + lz * s, 0, -lx * s + lz * c];
  const local = (lx: number, lz: number): THREE.Vector3Tuple => {
    const r = rel(lx, lz);
    return [x + r[0], y, z + r[2]];
  };
  const phase = useMemo(() => rnd() * 6, [rnd]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, yaw]} position={[x, y + 0.06, z]} receiveShadow>
        <planeGeometry args={[46, 38]} />
        <meshStandardMaterial map={gravel} roughness={1} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
      {well.status === 'MAINTENANCE' ? (
        <>
          <WorkoverRig position={local(2.4, 0)} yaw={yaw} />
          <WellsiteTanks position={local(-4, 12)} yaw={yaw} />
        </>
      ) : (
        // ~30 meshes up close; one merged mesh once the site is a few pixels across
        <Detailed distances={[0, SITE_LOD_DISTANCE]} position={[x, y, z]}>
          <group>
            <Pumpjack position={[0, 0, 0]} yaw={yaw} spm={spm} phase={phase} running={producing} />
            <WellsiteTanks position={rel(-4, 12)} yaw={yaw} />
          </group>
          <FarWellSite position={[0, 0, 0]} yaw={yaw} />
        </Detailed>
      )}
      {steam && (
        <Detailed distances={[0, SITE_LOD_DISTANCE]} position={local(4, -11)}>
          <SteamGenerator position={[0, 0, 0]} yaw={yaw} />
          <group />
        </Detailed>
      )}
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

/**
 * Camera-driven focus: when the camera comes close to a well (map centre within reach and
 * zoomed in), that well becomes the focused well — the side panel and card follow it.
 */
function ProximityFocus({ wells, focusId, onFocus }: { wells: Well[]; focusId?: string | null; onFocus: (id: string) => void }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3 } | null };
  const pts = useMemo(() => wells.map((w) => ({ id: w.id, p: toWorld(w.x, w.y) })), [wells]);
  const acc = useRef(0);
  const last = useRef(focusId ?? null);
  useEffect(() => {
    last.current = focusId ?? null;
  }, [focusId]);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25 || !controls) return;
    acc.current = 0;
    const t = controls.target;
    const dist = camera.position.distanceTo(t);
    if (dist > 650) return; // only when zoomed in toward the wells
    let best: string | null = null;
    let bd = Math.max(60, dist * 0.35);
    for (const w of pts) {
      const d = Math.hypot(w.p[0] - t.x, w.p[1] - t.z);
      if (d < bd) {
        bd = d;
        best = w.id;
      }
    }
    if (best && best !== last.current) {
      last.current = best;
      onFocus(best);
    }
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
/** Camera distance (m) beyond which a well site switches to its one-mesh stand-in. */
const SITE_LOD_DISTANCE = 650;
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

export default function FieldView3D({
  wells,
  displays,
  selectedId,
  focusId,
  onFocus,
}: {
  wells: Well[];
  displays: Record<string, WellDisplay>;
  selectedId: string;
  /** Well highlighted on the map (clicking a pin focuses it here instead of leaving the page). */
  focusId?: string | null;
  onFocus?: (id: string | null) => void;
}) {
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
  /** Orbit around the current target: yaw (deg) about the vertical, tilt (deg) toward the horizon. */
  const orbit = (yawDeg: number, tiltDeg: number) => {
    const c = cam.current;
    if (!c) return;
    const off = c.camera.position.clone().sub(c.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += (yawDeg * Math.PI) / 180;
    sph.phi = Math.min(1.3, Math.max(0.02, sph.phi + (tiltDeg * Math.PI) / 180));
    setFlight((f) => ({ pos: c.target.clone().add(new THREE.Vector3().setFromSpherical(sph)), target: c.target.clone(), seq: f.seq + 1 }));
  };
  const northUp = () => {
    const c = cam.current;
    if (!c) return;
    const d = c.camera.position.distanceTo(c.target);
    setFlight((f) => ({ pos: c.target.clone().add(new THREE.Vector3(0, d, 0.01)), target: c.target.clone(), seq: f.seq + 1 }));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const c = cam.current;
    if (!c) return;
    const k = e.key.toLowerCase();
    if (k === '+' || k === '=') return zoom(0.7);
    if (k === '-' || k === '_') return zoom(1.4);
    if (k === 'q') return orbit(-20, 0);
    if (k === 'e') return orbit(20, 0);
    const dirs: Record<string, [number, number]> = { arrowup: [0, 1], w: [0, 1], arrowdown: [0, -1], s: [0, -1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    const dir = dirs[k];
    if (!dir) return;
    e.preventDefault();
    const fwd = c.target.clone().sub(c.camera.position).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const step = Math.max(25, c.camera.position.distanceTo(c.target) * 0.18);
    const mv = fwd.multiplyScalar(dir[1] * step).add(right.multiplyScalar(dir[0] * step));
    setFlight((f) => ({ pos: c.camera.position.clone().add(mv), target: c.target.clone().add(mv), seq: f.seq + 1 }));
  };
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else box.current?.requestFullscreen?.().catch(() => undefined);
  };
  const [realistic, setRealistic] = useState(() => {
    try {
      return localStorage.getItem('twin.quality') !== 'performance';
    } catch {
      return true;
    }
  });
  const box = useRef<HTMLDivElement>(null);
  const quality = useAdaptiveQuality(1.5);
  // post-processing shaders compile after the map is on screen, not before the first frame
  const [postReady, setPostReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setPostReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
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
    setFlight((f) => ({ pos: new THREE.Vector3(x + 55, y + 70, z + 85), target: new THREE.Vector3(x, y + 4, z), seq: f.seq + 1 }));
  };

  const labels: LabelDef[] = wells.map((w) => {
    const [x, z] = toWorld(w.x, w.y);
    const d = displays[w.id];
    const liveRisk = d.risk === 'HIGH' || d.risk === 'CRITICAL';
    const status = w.status === 'PRODUCING' && liveRisk ? 'AT_RISK' : w.status;
    const sel = w.id === (focusId ?? selectedId);
    const twin = w.id === selectedId;
    return {
      id: `pin-${w.id}`,
      declutter: 'tag' as const,
      priority: hover === w.id ? 300 : sel ? 200 : status === 'AT_RISK' ? 100 : status === 'PRODUCING' ? 50 : 10,
      pos: [x, fieldHeight(x, z) + 2, z],
      content: (
        <button
          className="group pointer-events-auto flex -translate-x-1/2 -translate-y-full flex-col items-center"
          onMouseEnter={() => setHover(w.id)}
          onMouseLeave={() => setHover((h) => (h === w.id ? null : h))}
          onClick={() => {
            if (onFocus) {
              onFocus(w.id);
              flyTo(w.id);
            } else nav(`/well/${w.id}`);
          }}
          onDoubleClick={() => nav(`/well/${w.id}`)}
          aria-label={`Open ${w.id}`}
          title={onFocus ? `${w.id} — click to focus, double-click to open its twin` : `Open ${w.id}`}
        >
          <span data-tag className={`num mb-[1px] whitespace-nowrap rounded-[2px] px-1 text-[9.5px] leading-[13px] font-semibold shadow-sm ${sel ? 'bg-navy-900 text-white' : 'bg-white/90 text-navy-900'}`}>
            {w.id}
            {twin ? ' · TWIN' : ''}
          </span>
          <LandmarkPin color={STATUS_COLOR[status]} selected={sel} pulse={status === 'AT_RISK'} />
        </button>
      ),
    };
  });
  labels.push({
    id: 'pin-camp',
    priority: -10,
    pos: [0, fieldHeight(0, 0) + 30, 0],
    content: <div className="-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[2px] bg-navy-900/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white shadow">FIELD CAMP · TANKS · TANKER BAY</div>,
  });

  const hoverWell = hover ? wells.find((w) => w.id === hover) : null;
  const focusWell = focusId ? wells.find((w) => w.id === focusId) ?? null : null;

  return (
    <div ref={box} data-label-scope tabIndex={0} onKeyDown={onKey} aria-label="Interactive field map. Arrow keys or W A S D move, plus and minus zoom, Q and E rotate. Moving close to a well focuses it." className="relative h-full w-full overflow-hidden rounded-[2px] bg-[#d8cdb8] outline-none focus-visible:ring-4 focus-visible:ring-[#e8a33d]">
      <Canvas resize={{ offsetSize: true }} shadows={false} dpr={quality.dpr} camera={{ position: initial.pos.toArray(), fov: FOV, near: 1, far: 40000 }} gl={{ antialias: !realistic, powerPreference: 'high-performance' }}>
        {quality.monitor}
        <color attach="background" args={[HAZE]} />
        <Sky distance={30000} sunPosition={SUN.clone().multiplyScalar(1000).toArray()} turbidity={7} rayleigh={1.6} mieCoefficient={0.006} mieDirectionalG={0.85} />
        <fog attach="fog" args={[HAZE, 2200, 9000]} />
        <hemisphereLight args={['#f3dcc0', '#b0804a', 0.85]} />
        <ambientLight intensity={0.25} color="#fff1dc" />
        <directionalLight position={SUN.clone().multiplyScalar(1000).toArray()} intensity={2.6} color="#ffe2b8" />
        <RealisticTerrain />
        <Vegetation />
        <Flowlines roads={roads} />
        <PowerPoles roads={roads} />
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
        {onFocus && <ProximityFocus wells={wells} focusId={focusId} onFocus={onFocus} />}
        {realistic && postReady && quality.allowPost && (
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
      <div data-label-obstacle className="absolute top-2 left-2 flex flex-wrap gap-1.5">
        <button className="btn px-2 py-1 text-[11px]" onClick={() => setFlight((f) => ({ ...overview(), seq: f.seq + 1 }))}>
          <Globe2 size={12} /> TOP VIEW
        </button>
        <button className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => flyTo(focusId ?? selectedId)}>
          <Crosshair size={12} /> FLY TO {focusId ?? selectedId}
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
      <div
        data-label-obstacle
        className="absolute right-2 bottom-2 rounded-full border border-[#dccab5] bg-white/92 px-2.5 py-1 text-[10.5px] text-ink-2 shadow-sm"
        title="Representative Thar-desert terrain · well positions schematic (not surveyed) · equipment per field practice: SRP units, well-site tanks, tanker evacuation, mobile steam generators (CSS), workover rigs."
      >
        Drag / arrows = move · right-drag, Q/E = rotate · wheel, +/− = zoom · move close to a well to focus it
      </div>
      <div data-label-obstacle className="absolute top-2 right-2 flex flex-col items-center gap-2">
        <div className="relative h-14 w-14 rounded-full border border-[#dccab5] bg-white/92 shadow-md" title="North">
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
        <div className="flex flex-col overflow-hidden rounded-[3px] border border-[#dccab5] bg-white shadow-md">
          <button className="flex h-8 w-8 items-center justify-center hover:bg-[#f7eee3]" onClick={() => zoom(0.6)} aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <div className="h-px bg-line" />
          <button className="flex h-8 w-8 items-center justify-center hover:bg-[#f7eee3]" onClick={() => zoom(1.6)} aria-label="Zoom out">
            <Minus size={15} />
          </button>
        </div>
      </div>
      <div data-label-obstacle className="pointer-events-none absolute bottom-2 left-2 rounded-[2px] bg-white/85 px-1.5 pt-0.5 pb-1 shadow-sm">
        <span ref={scaleLabel} className="num block text-[10px] text-ink-2">1 km</span>
        <div ref={scaleBar} className="h-[5px] border-x-2 border-b-2 border-ink" style={{ width: 100 }} />
      </div>
      {/* camera controls */}
      <div data-label-obstacle className="absolute top-[150px] right-2 flex flex-col overflow-hidden rounded-[10px] border border-[#dccab5] bg-white/92 shadow-md">
        {[
          { icon: <RotateCcw size={14} />, label: 'Rotate left', fn: () => orbit(-30, 0) },
          { icon: <RotateCw size={14} />, label: 'Rotate right', fn: () => orbit(30, 0) },
          { icon: <span className="text-[11px] font-bold">3D</span>, label: 'Tilt toward horizon', fn: () => orbit(0, 15) },
          { icon: <span className="text-[11px] font-bold">2D</span>, label: 'Tilt to top-down', fn: () => orbit(0, -15) },
          { icon: <Compass size={14} />, label: 'North up, look straight down', fn: northUp },
          { icon: fullscreen ? <Shrink size={14} /> : <Expand size={14} />, label: fullscreen ? 'Exit full screen' : 'Full screen', fn: toggleFullscreen },
        ].map((b, i) => (
          <button key={b.label} onClick={b.fn} aria-label={b.label} title={b.label} className={`flex h-8 w-8 items-center justify-center text-ink-2 hover:bg-[#f6ede2] ${i ? 'border-t border-line' : ''}`}>
            {b.icon}
          </button>
        ))}
      </div>
      {focusWell && !hoverWell && (
        <div data-label-obstacle className="absolute bottom-12 left-2 z-20 rounded-[6px] shadow-xl">
          <WellHoverCard well={focusWell} d={displays[focusWell.id]} />
          <div className="flex flex-wrap gap-1 rounded-b-[4px] border border-t-0 border-navy-700 bg-white p-1.5">
            <button className="btn btn-primary px-2 py-1 text-[11px]" onClick={() => nav(`/well/${focusWell.id}`)}>
              Open twin <ArrowRight size={12} />
            </button>
            <button className="btn px-2 py-1 text-[11px]" onClick={() => nav(`/well/${focusWell.id}?view=thermal`)} title="Thermal view">
              <Flame size={12} /> Thermal
            </button>
            <button className="btn px-2 py-1 text-[11px]" onClick={() => nav(`/well/${focusWell.id}/causal`)} title="Causal analysis">
              <GitBranch size={12} />
            </button>
            <button className="btn ml-auto px-2 py-1 text-[11px]" onClick={() => onFocus?.(null)} aria-label="Close well card">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {hoverWell && (
        <div className="pointer-events-none absolute bottom-12 left-2 z-20">
          <WellHoverCard well={hoverWell} d={displays[hoverWell.id]} note={CSS_INJECTION_WELLS.includes(hoverWell.id) ? 'Shut-in for CSS: mobile steam generator on location (steam injection / soak) — demonstration.' : undefined} />
        </div>
      )}
    </div>
  );
}
