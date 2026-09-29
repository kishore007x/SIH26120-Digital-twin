import type * as THREE from 'three';
import type { Linkage } from '../kinematics';

/** Objects articulated by the rig each frame. Filled by whichever model is active. */
export interface AnimTargets {
  beam?: THREE.Object3D; // positioned at saddle pivot O, rotated by β about z
  crank?: THREE.Object3D; // positioned at crank centre G, rotated by θ about z
  pitmans: { obj: THREE.Object3D; z: number; restPin?: THREE.Vector2; restEq?: THREE.Vector2 }[];
  /** Optional: parts translated vertically with the polished rod (e.g. CAD bridle/carrier bar) */
  hanger?: THREE.Object3D;
}

/**
 * Articulation manifest for a CAD-derived GLB (public/models/srp-pump.json).
 * Coordinates are in the GLB's scene units after `scale` is applied.
 */
export interface PumpModelManifest {
  version: 1;
  source?: string;
  /** Uniform scale applied to the GLB scene (e.g. 0.001 for mm → m). */
  scale: number;
  /** Translation applied after scaling so ground = y 0 and the unit plane is x/y. */
  offset: [number, number, number];
  /** Euler rotation (radians) applied to the GLB scene before scale/offset. */
  rotation: [number, number, number];
  linkage: Linkage;
  /** Node names (or name prefixes ending with '*') assigned to each articulated role. */
  roles: {
    beam: string[];
    crank: string[];
    pitman: string[];
    hanger: string[];
  };
  /** Z positions of pitman arms, in manifest coordinates (for articulation). */
  pitmanZ?: number[];
  /** Pose of the model as exported: beam angle β0 and crank-pin angle φ0 (radians). */
  rest?: { beta: number; pinAngle: number };
  /** Polished-rod clamp (carrier bar) height at the rest pose, metres. */
  carrierY0?: number;
  /** Optional 3D anchor points for equipment callouts. */
  anchors?: { motor?: [number, number, number]; gearbox?: [number, number, number] };
  /** Optional concrete foundation: [centre x, length x, width z] in metres. */
  foundation?: [number, number, number];
  /** Optional: well centre x (defaults to O.x + A). */
  wellX?: number;
  notes?: string;
}

export type ModelSource =
  | { kind: 'placeholder'; reason: string }
  | { kind: 'gltf'; url: string; manifest: PumpModelManifest | null; sizeBytes?: number };
