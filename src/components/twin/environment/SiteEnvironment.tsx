// Realistic Thar-desert well-site environment for the 3D twin:
// physical sky + sun, HDRI image-based lighting (CC0 "Goegap", Poly Haven),
// dune terrain, well pad & site furniture, distant producing wells, haze and AO.
import { Suspense, useMemo } from 'react';
import { Environment, Sky } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { SiteProps } from './SiteProps';
import { FieldScenery } from './FieldScenery';

export const HAZE = '#d6cbb6';

/** Late-morning sun from the south-east (elevation â‰ˆ 42Â°). */
export const SUN_DIR = new THREE.Vector3(0.55, 0.72, 0.42).normalize();

export function SiteEnvironment({ wellX, wellId, underground, realistic }: { wellX: number; wellId: string; underground: boolean; realistic: boolean }) {
  const cx = wellX - 3.2;
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(400), []);
  const lightPos = useMemo(() => SUN_DIR.clone().multiplyScalar(30).add(new THREE.Vector3(cx, 0, 0)), [cx]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(cx, 0, 0);
    return o;
  }, [cx]);

  return (
    <>
      <group visible={!underground}>
        <Sky distance={4500} sunPosition={sunPos.toArray()} turbidity={3.2} rayleigh={3} mieCoefficient={0.004} mieDirectionalG={0.8} />
      </group>
      <fog attach="fog" args={[HAZE, 110, 650]} />
      <Suspense fallback={null}>
        <Environment files="/env/goegap_1k.hdr" environmentIntensity={0.45} />
      </Suspense>
      <hemisphereLight args={['#dfe8f2', '#b89a70', 0.2]} />
      <primitive object={target} />
      <directionalLight
        position={lightPos.toArray()}
        target={target}
        intensity={2.15}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />
      {/* hidden, not unmounted, below ground: rebuilding terrain + scenery on every switch caused the stutter */}
      <group visible={!underground}>
        <Terrain cx={cx} />
        <SiteProps wellX={wellX} wellId={wellId} showPad />
        <FieldScenery cx={cx} />
      </group>
      {realistic && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={1.4} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.3} darkness={0.35} />
        </EffectComposer>
      )}
    </>
  );
}
