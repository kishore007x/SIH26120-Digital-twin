// CAD-derived pumping unit (GLB) with manifest-driven articulation.
//
// Geometry is preserved as supplied. When a manifest is present, nodes listed
// under each role are re-parented (world transform preserved) under pivot
// groups so the shared rig can drive beam, crank, pitman and hanger motion.

import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AnimTargets, PumpModelManifest } from './types';
import { pinAt, equalizerAt } from '../kinematics';
import { useSelection } from '../selection';
import type { ComponentKey } from '../rig';

function matches(name: string, patterns: string[]) {
  return patterns.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));
}

const ROLE_COMPONENT: Record<string, ComponentKey> = { beam: 'beam', crank: 'crank', pitman: 'pitman', hanger: 'bridle' };

export interface GltfRest {
  beta: number;
  pinAngle: number;
}

export function GltfPumpUnit({ url, manifest, targets }: { url: string; manifest: PumpModelManifest | null; targets: AnimTargets }) {
  const gltf = useGLTF(url);
  const sel = useSelection();

  const root = useMemo(() => {
    const root = new THREE.Group();
    const scene = gltf.scene.clone(true);
    const m = manifest;
    if (m) {
      scene.rotation.set(...m.rotation);
      scene.scale.setScalar(m.scale);
      scene.position.set(...m.offset);
    } else {
      // No manifest: auto-fit to ~8 m tall, sit on the ground, centred.
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const s = 8 / Math.max(size.y, 1e-6);
      scene.scale.setScalar(s);
      const b2 = new THREE.Box3().setFromObject(scene);
      const c = b2.getCenter(new THREE.Vector3());
      scene.position.set(-c.x, -b2.min.y, -c.z);
    }
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && 'emissive' in mat) mesh.material = mat.clone();
      }
    });
    root.add(scene);
    root.updateMatrixWorld(true);

    if (m) {
      const L = m.linkage;
      const rest: GltfRest = m.rest ?? { beta: 0, pinAngle: 0 };
      const collect = (patterns: string[]) => {
        const out: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if (o !== scene && o.name && matches(o.name, patterns) && !out.some((p) => isAncestor(p, o))) out.push(o);
        });
        return out;
      };
      const mk = (name: string, x: number, y: number) => {
        const g = new THREE.Group();
        g.name = name;
        g.position.set(x, y, 0);
        root.add(g);
        g.updateMatrixWorld(true);
        return g;
      };
      const beamPivot = mk('__beam_pivot', L.O[0], L.O[1]);
      const crankPivot = mk('__crank_pivot', L.G[0], L.G[1]);
      const pin0 = pinAt(L, rest.pinAngle * L.dir);
      const eq0 = equalizerAt(L, rest.beta);
      const pitPivot = mk('__pitman_pivot', pin0[0], pin0[1]);
      const hanger = mk('__hanger', 0, 0);
      const tag = (objs: THREE.Object3D[], role: string, pivot: THREE.Object3D) => {
        for (const o of objs) {
          pivot.attach(o);
          o.traverse((c) => (c.userData.component = ROLE_COMPONENT[role]));
        }
      };
      tag(collect(m.roles.beam), 'beam', beamPivot);
      tag(collect(m.roles.crank), 'crank', crankPivot);
      tag(collect(m.roles.pitman), 'pitman', pitPivot);
      tag(collect(m.roles.hanger), 'hanger', hanger);
      // Static equipment: tag by location so click-inspection works on the CAD model.
      // The optimised GLB pre-groups static parts and tags the group via node extras.
      const box = new THREE.Box3();
      const c = new THREE.Vector3();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.component) return;
        const inherited = findTagged(mesh.parent, scene);
        if (inherited) {
          mesh.userData.component = inherited;
          return;
        }
        box.setFromObject(mesh).getCenter(c);
        const k: ComponentKey = c.y < 0.3 ? 'base' : c.x < L.G[0] - 0.9 ? 'motor' : c.x < L.G[0] + 0.45 && c.y < L.G[1] + 0.6 ? 'gearbox' : 'sampson';
        mesh.userData.component = k;
      });
      root.userData.rest = rest;
      root.userData.pitmanRest = { pin: new THREE.Vector2(...pin0), eq: new THREE.Vector2(...eq0) };
      root.userData.pivots = { beamPivot, crankPivot, pitPivot, hanger };
    }
    return root;
  }, [gltf, manifest]);

  useLayoutEffect(() => {
    const p = root.userData.pivots as { beamPivot: THREE.Object3D; crankPivot: THREE.Object3D; pitPivot: THREE.Object3D; hanger: THREE.Object3D } | undefined;
    if (!p) return;
    targets.beam = p.beamPivot;
    targets.crank = p.crankPivot;
    targets.hanger = p.hanger;
    const pr = root.userData.pitmanRest as { pin: THREE.Vector2; eq: THREE.Vector2 };
    targets.pitmans = [{ obj: p.pitPivot, z: 0, restPin: pr.pin, restEq: pr.eq }];
    return () => {
      targets.beam = undefined;
      targets.crank = undefined;
      targets.hanger = undefined;
      targets.pitmans = [];
    };
  }, [root, targets]);

  // Highlight selected role
  useLayoutEffect(() => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !('emissive' in mat)) return;
      const k = mesh.userData.component as ComponentKey | undefined;
      const on = k && (k === sel.selected || k === sel.hovered);
      mat.emissive.set(on ? '#3a78d4' : '#000000');
      mat.emissiveIntensity = on ? (k === sel.selected ? 0.5 : 0.25) : 0;
    });
  }, [root, sel.selected, sel.hovered]);

  return (
    <primitive
      object={root}
      onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        e.stopPropagation();
        const k = (e.object.userData.component as ComponentKey | undefined) ?? findComponent(e.object);
        sel.select(k ?? 'base');
      }}
    />
  );
}

function findComponent(o: THREE.Object3D | null): ComponentKey | undefined {
  while (o) {
    const k = o.userData?.component as ComponentKey | undefined;
    if (k) return k;
    const n = (o.name || '').toLowerCase();
    if (n.includes('gear')) return 'gearbox';
    if (n.includes('motor')) return 'motor';
    if (n.includes('sampson') || n.includes('ladder')) return 'sampson';
    if (n.includes('base') || n.includes('skid')) return 'base';
    o = o.parent;
  }
  return undefined;
}

function findTagged(o: THREE.Object3D | null, stop: THREE.Object3D): ComponentKey | undefined {
  while (o && o !== stop) {
    const k = o.userData?.component as ComponentKey | undefined;
    if (k) return k;
    o = o.parent;
  }
  return undefined;
}

function isAncestor(a: THREE.Object3D, b: THREE.Object3D) {
  let p = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}
