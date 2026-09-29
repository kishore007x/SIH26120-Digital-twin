// Reusable 3D viewer for the well + sucker-rod-pump digital twin.
// Geometry lives in ./models; this component owns the scene, camera, rig
// animation and model selection (CAD GLB when available, else placeholder).

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import { HAZE, SiteEnvironment } from './environment/SiteEnvironment';
import { LabelProjector } from './labels';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PlaceholderPumpUnit } from './models/PlaceholderPumpUnit';
import { GltfPumpUnit } from './models/GltfPumpUnit';
import { WellSystem } from './models/WellSystem';
import type { AnimTargets, ModelSource } from './models/types';
import { linkState, type Linkage } from './kinematics';
import { PLACEHOLDER_LINKAGE, rangeFor, rig, type ComponentKey } from './rig';
import { Selection, type SelectionCtx } from './selection';
import { useTwin } from '../../store/twinStore';
import { EquipmentOverlay } from './EquipmentOverlay';

export type ViewMode = 'surface' | 'full' | 'downhole';
export type CameraPreset = 'iso' | 'side' | 'front' | 'top' | 'downhole' | 'pump';

export const CAMERA_PRESETS: Record<CameraPreset, { label: string; pos: [number, number, number]; target: [number, number, number] }> = {
  iso: { label: 'ISO', pos: [10.5, 7.5, 12.5], target: [0, 3.2, 0] },
  side: { label: 'SIDE', pos: [0.3, 3.6, 15.5], target: [0, 3.2, 0] },
  front: { label: 'FRONT', pos: [15, 4.2, 0.4], target: [0, 3.2, 0] },
  top: { label: 'TOP', pos: [0.2, 19, 0.6], target: [0, 1, 0] },
  downhole: { label: 'DOWNHOLE', pos: [9.5, -4.5, 19], target: [3, -9.5, -1] },
  pump: { label: 'PUMP', pos: [5.6, -12.4, 4.6], target: [3, -14.2, 0] },
};

export interface ViewerProps {
  source: ModelSource;
  viewMode: ViewMode;
  cutaway: boolean;
  labels: boolean;
  camera: { preset: CameraPreset; seq: number };
  selection: SelectionCtx;
  onModelError: (msg: string) => void;
  /** High-quality mode: ambient occlusion + SMAA post-processing. */
  realistic: boolean;
  wellId: string;
}

/** Presets are authored for a well at x = 3 m; shift them to the active model's well position. */
export function presetFor(preset: CameraPreset, wellX: number) {
  const p = CAMERA_PRESETS[preset];
  const dx = wellX - 3;
  return { pos: [p.pos[0] + dx, p.pos[1], p.pos[2]] as [number, number, number], target: [p.target[0] + dx, p.target[1], p.target[2]] as [number, number, number] };
}

function CameraRig({ preset, seq, wellX }: { preset: CameraPreset; seq: number; wellX: number }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const anim = useRef({ active: true, t: 0 });
  const goal = useMemo(() => {
    const p = presetFor(preset, wellX);
    return { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
  }, [preset, wellX]);
  useEffect(() => {
    anim.current = { active: true, t: 0 };
  }, [preset, seq]);
  useFrame((_, dt) => {
    if (!anim.current.active || !controls) return;
    anim.current.t += dt;
    const k = 1 - Math.pow(0.0015, dt);
    camera.position.lerp(goal.pos, k);
    controls.target.lerp(goal.target, k);
    controls.update();
    if (camera.position.distanceTo(goal.pos) < 0.02 || anim.current.t > 2.5) anim.current.active = false;
  });
  return null;
}

/** Drives crank angle from simulated SPM and articulates whichever model is mounted. */
function RigDriver({ L, targets, betaRef, restBeta, restPinAngle }: { L: Linkage; targets: AnimTargets; betaRef: React.MutableRefObject<number>; restBeta: number; restPinAngle: number }) {
  const range = rangeFor(L);
  const thetaBottom = useMemo(() => {
    let best = 0;
    let bmin = Infinity;
    for (let i = 0; i < 360; i++) {
      const th = (i / 360) * Math.PI * 2;
      const b = linkState(L, range, th).beta;
      if (b < bmin) {
        bmin = b;
        best = th;
      }
    }
    return best;
  }, [L, range]);
  const v2 = useMemo(() => ({ a: new THREE.Vector2(), b: new THREE.Vector2() }), []);
  useFrame((_, dt) => {
    const s = useTwin.getState();
    if (rig.resetRequested) {
      rig.theta = thetaBottom;
      rig.resetRequested = false;
      rig.strokesCompleted = 0;
    }
    if (s.animationPlaying) {
      const d = 2 * Math.PI * (s.spm / 60) * Math.min(dt, 0.1);
      const before = Math.floor(rig.theta / (2 * Math.PI));
      rig.theta += d;
      if (Math.floor(rig.theta / (2 * Math.PI)) > before) rig.strokesCompleted++;
    }
    const st = linkState(L, range, rig.theta);
    rig.state = st;
    betaRef.current = st.beta;
    if (targets.beam) targets.beam.rotation.z = st.beta - restBeta;
    if (targets.crank) targets.crank.rotation.z = L.dir * rig.theta - restPinAngle;
    for (const p of targets.pitmans) {
      if (!p?.obj) continue;
      const ang = Math.atan2(st.eq[1] - st.pin[1], st.eq[0] - st.pin[0]);
      if (p.restPin && p.restEq) {
        v2.a.copy(p.restEq).sub(p.restPin);
        p.obj.position.set(st.pin[0], st.pin[1], 0);
        p.obj.rotation.z = ang - Math.atan2(v2.a.y, v2.a.x);
      } else {
        p.obj.position.set(st.pin[0], st.pin[1], p.z);
        p.obj.rotation.z = ang - Math.PI / 2;
      }
    }
    if (targets.hanger) targets.hanger.position.y = L.A * (st.beta - restBeta);
  });
  return null;
}

function Ground({ translucent, foundation, wellX }: { translucent: boolean; foundation: [number, number, number]; wellX: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[70, 64]} />
        <meshStandardMaterial color="#d8cbb0" roughness={1} transparent={translucent} opacity={translucent ? 0.28 : 1} depthWrite={!translucent} />
      </mesh>
      {/* concrete foundation */}
      <mesh position={[foundation[0], 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[foundation[1], foundation[2]]} />
        <meshStandardMaterial color="#b7b4ac" roughness={0.95} transparent={translucent} opacity={translucent ? 0.4 : 1} />
      </mesh>
      {/* cellar */}
      <mesh position={[wellX, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.8, 32]} />
        <meshStandardMaterial color="#9f9a90" roughness={0.9} transparent={translucent} opacity={translucent ? 0.4 : 1} />
      </mesh>
    </group>
  );
}

class ModelErrorBoundary extends Component<{ onError: (m: string) => void; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    this.props.onError(err instanceof Error ? err.message : String(err));
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneContent({ source, viewMode, cutaway, onModelError, realistic, wellId }: Omit<ViewerProps, 'camera' | 'selection' | 'labels'>) {
  const targets = useMemo<AnimTargets>(() => ({ pitmans: [] }), []);
  const betaRef = useRef(0);
  const g = sceneGeometry(source);
  const manifest = g.manifest;
  const range = rangeFor(g.L);
  const showSurface = viewMode !== 'downhole';
  const showDownhole = viewMode !== 'surface';

  return (
    <>
      <RigDriver L={g.L} targets={targets} betaRef={betaRef} restBeta={g.restBeta} restPinAngle={g.restPin} />
      <group visible={showSurface}>
        {source.kind === 'gltf' ? (
          <ModelErrorBoundary onError={onModelError} fallback={null}>
            <Suspense fallback={null}>
              <GltfPumpUnit url={source.url} manifest={manifest} targets={targets} />
            </Suspense>
          </ModelErrorBoundary>
        ) : (
          <PlaceholderPumpUnit L={PLACEHOLDER_LINKAGE} targets={targets} />
        )}
      </group>
      <WellSystem
        L={g.L}
        wellX={g.wellX}
        showDownhole={showDownhole}
        cutaway={cutaway}
        betaRef={betaRef}
        betaZero={g.restBeta}
        midOffset={g.L.A * ((range.betaMin + range.betaMax) / 2 - g.restBeta)}
        hideSurfaceHanger={!!manifest?.roles.hanger?.length}
        carrierY0={manifest?.carrierY0}
      />
      {showDownhole && <Ground translucent foundation={g.foundation} wellX={g.wellX} />}
      <SiteEnvironment wellX={g.wellX} wellId={wellId} underground={showDownhole} realistic={realistic} />
      <LabelProjector />
    </>
  );
}

function CadLoading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-[3px] border border-[#c6ced6] bg-white/95 px-3 py-2 text-[12px] text-ink-2 shadow">
        Loading CAD model (srp-pump.glb)… <span className="num font-semibold">{progress.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function sceneGeometry(source: ModelSource) {
  const manifest = source.kind === 'gltf' ? source.manifest : null;
  const L = manifest?.linkage ?? PLACEHOLDER_LINKAGE;
  return {
    manifest,
    L,
    wellX: manifest?.wellX ?? L.O[0] + L.A,
    restBeta: manifest?.rest?.beta ?? 0,
    restPin: manifest?.rest?.pinAngle ?? 0,
    foundation: manifest?.foundation ?? ([-1.4, 7.4, 2.6] as [number, number, number]),
    anchors: {
      motor: manifest?.anchors?.motor ?? ([-3.95, 1.75, 0.3] as [number, number, number]),
      gearbox: manifest?.anchors?.gearbox ?? ([L.G[0], L.G[1] + 1.2, 0.6] as [number, number, number]),
    },
  };
}

export function DigitalTwinModelViewer(props: ViewerProps) {
  const g = sceneGeometry(props.source);
  const p = presetFor('iso', g.wellX);
  return (
    <Selection.Provider value={props.selection}>
      <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: p.pos, fov: 42, near: 0.1, far: 5000 }}
        gl={{ antialias: !props.realistic, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => props.selection.select(null)}
      >
        <color attach="background" args={[HAZE]} />
        <SceneContent {...props} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxDistance={90}
          minDistance={2}
          maxPolarAngle={props.viewMode === 'surface' ? Math.PI / 2 - 0.04 : Math.PI}
          target={p.target}
        />
        <CameraRig preset={props.camera.preset} seq={props.camera.seq} wellX={g.wellX} />
      </Canvas>
      {props.labels && <EquipmentOverlay L={g.L} wellX={g.wellX} anchors={g.anchors} surface={props.viewMode !== 'downhole'} downhole={props.viewMode !== 'surface'} />}
      {props.source.kind === 'gltf' && <CadLoading />}
      </div>
    </Selection.Provider>
  );
}

export type { ComponentKey };
