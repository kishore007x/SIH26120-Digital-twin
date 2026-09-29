// Lightweight 3D-anchored DOM labels.
// DOM elements live outside the <Canvas>; a projector inside the canvas writes
// their screen position each frame. Avoids nested React roots (drei <Html>),
// which race with React 19 during unmount.

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Entry {
  pos: THREE.Vector3;
  el: HTMLDivElement | null;
}

const registry = new Map<string, Entry>();

export interface LabelDef {
  id: string;
  pos: [number, number, number];
  content: ReactNode;
}

export function LabelLayer({ labels }: { labels: LabelDef[] }) {
  useLayoutEffect(() => {
    for (const l of labels) {
      const e = registry.get(l.id);
      if (e) e.pos.set(...l.pos);
    }
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labels.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) registry.set(l.id, { pos: new THREE.Vector3(...l.pos), el });
            else registry.delete(l.id);
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ visibility: 'hidden' }}
        >
          {l.content}
        </div>
      ))}
    </div>
  );
}

/** Mount inside <Canvas>. Projects registered anchors to screen space. */
export function LabelProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const e of registry.values()) {
      if (!e.el) continue;
      v.copy(e.pos).project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        e.el.style.visibility = 'hidden';
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      e.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      e.el.style.visibility = 'visible';
    }
  });
  return null;
}
