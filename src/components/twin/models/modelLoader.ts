// Model-loader abstraction.
//
// Resolves which pumping-unit model the viewer should render:
//   1. /models/srp-pump.glb (+ optional /models/srp-pump.json articulation manifest)
//   2. otherwise the procedural DIGITAL TWIN PLACEHOLDER
//
// Dropping a new GLB (and manifest) into public/models/ is all that is needed
// to replace the placeholder — no application code changes.

import { useEffect, useState } from 'react';
import type { ModelSource, PumpModelManifest } from './types';

export const MODEL_URL = '/models/srp-pump.glb';
export const MANIFEST_URL = '/models/srp-pump.json';

let cached: Promise<ModelSource> | null = null;

async function probe(): Promise<ModelSource> {
  try {
    const res = await fetch(MODEL_URL, { method: 'HEAD', cache: 'no-cache' });
    const ct = res.headers.get('content-type') ?? '';
    // Dev servers return index.html (text/html) for unknown paths — treat as missing.
    if (!res.ok || ct.includes('text/html')) {
      return { kind: 'placeholder', reason: 'No CAD model found at /models/srp-pump.glb' };
    }
    let manifest: PumpModelManifest | null = null;
    try {
      const m = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (m.ok && (m.headers.get('content-type') ?? '').includes('json')) manifest = (await m.json()) as PumpModelManifest;
    } catch {
      manifest = null;
    }
    const len = Number(res.headers.get('content-length'));
    return { kind: 'gltf', url: MODEL_URL, manifest, sizeBytes: Number.isFinite(len) && len > 0 ? len : undefined };
  } catch {
    return { kind: 'placeholder', reason: 'CAD model probe failed (offline or blocked)' };
  }
}

export function resolveModelSource(): Promise<ModelSource> {
  if (!cached) cached = probe();
  return cached;
}

export function useModelSource(): ModelSource | null {
  const [src, setSrc] = useState<ModelSource | null>(null);
  useEffect(() => {
    let alive = true;
    resolveModelSource().then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, []);
  return src;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}
