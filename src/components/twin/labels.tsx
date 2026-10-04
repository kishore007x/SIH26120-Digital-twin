// Lightweight 3D-anchored DOM labels.
// DOM elements live outside the <Canvas>; a projector inside the canvas writes
// their screen position each frame. Avoids nested React roots (drei <Html>),
// which race with React 19 during unmount.
//
// De-cluttering: labels never sit on top of each other.
//  - 'nudge': the label is moved up until it clears labels already placed (callouts).
//  - 'tag':   the element marked [data-tag] inside the label is hidden when it would
//             collide (map pins keep their true position; only the ID chip hides).
// Obstacles that labels must also avoid: any [data-label-obstacle] element in the same
// viewport (HUD panels, toolbars) and every [data-body] element (e.g. other map pins).
// Labels that would leave the viewport are hidden. Higher `priority` labels are placed first;
// priority ≥ 200 is always shown (selected / hovered item).

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type Declutter = 'nudge' | 'tag' | 'none';

interface Entry {
  pos: THREE.Vector3;
  el: HTMLDivElement | null;
  order: number;
  priority: number;
  declutter: Declutter;
  dy: number;
  x: number;
  y: number;
  shown: boolean;
}

const registry = new Map<string, Entry>();
let seq = 0;

export interface LabelDef {
  id: string;
  pos: [number, number, number];
  content: ReactNode;
  priority?: number;
  declutter?: Declutter;
}

export function LabelLayer({ labels }: { labels: LabelDef[] }) {
  useLayoutEffect(() => {
    for (const [id, e] of registry) if (!e.el || !e.el.isConnected) registry.delete(id);
    for (const l of labels) {
      const e = registry.get(l.id);
      if (e) {
        e.pos.set(...l.pos);
        e.priority = l.priority ?? 0;
        e.declutter = l.declutter ?? 'nudge';
      }
    }
  });
  return (
    <div className="pointer-events-none absolute inset-0 isolate overflow-hidden">
      {labels.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            // React calls inline refs with null → el on every render: keep the entry (order, offset) and just swap the element
            const prev = registry.get(l.id);
            if (el) {
              if (prev) {
                if (prev.el !== el) prev.el = el;
                prev.pos.set(...l.pos);
              } else registry.set(l.id, { pos: new THREE.Vector3(...l.pos), el, order: seq++, priority: l.priority ?? 0, declutter: l.declutter ?? 'nudge', dy: 0, x: 0, y: 0, shown: false });
            } else if (prev) prev.el = null;
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ visibility: 'hidden', zIndex: 1000 + (l.priority ?? 0) }}
        >
          {l.content}
        </div>
      ))}
    </div>
  );
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}
const hit = (a: Box, c: Box, pad = 2) => a.l < c.r + pad && a.r > c.l - pad && a.t < c.b + pad && a.b > c.t - pad;

/** Mount inside <Canvas>. Projects registered anchors to screen space and de-clutters them. */
export function LabelProjector() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const live: Entry[] = [];
    for (const e of registry.values()) {
      if (!e.el) continue;
      v.copy(e.pos).project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        e.el.style.visibility = 'hidden';
        e.shown = false;
        continue;
      }
      e.x = ((v.x + 1) / 2) * size.width;
      e.y = ((1 - v.y) / 2) * size.height;
      e.el.style.transform = `translate(${e.x.toFixed(1)}px, ${(e.y + e.dy).toFixed(1)}px)`;
      e.el.style.visibility = 'visible';
      e.shown = true;
      live.push(e);
    }
    if (live.length < 2) return;

    // measure (one layout pass), then place in priority order
    // Boxes are computed from the projected anchor plus the label's offset inside its wrapper
    // (relative measurement), so a transform written this frame can't produce a stale box.
    const layerEl = live[0].el!.parentElement!;
    const lr = layerEl.getBoundingClientRect();
    const z = layerEl.offsetWidth ? lr.width / layerEl.offsetWidth : 1; // text-size zoom
    const items = live
      .filter((e) => e.declutter !== 'none')
      .map((e) => {
        const target = (e.declutter === 'tag' ? e.el!.querySelector<HTMLElement>('[data-tag]') : (e.el!.firstElementChild as HTMLElement)) ?? e.el!;
        const r = target.getBoundingClientRect();
        const w = e.el!.getBoundingClientRect();
        const ox = lr.left + e.x * z + (r.left - w.left);
        const oy = lr.top + e.y * z + (r.top - w.top);
        return { e, target, box: { l: ox, r: ox + r.width, t: oy, b: oy + r.height } as Box };
      })
      .sort((a, c) => c.e.priority - a.e.priority || a.e.order - c.e.order);

    const layer = live[0].el!.parentElement;
    const container = (layer?.closest('[data-label-scope]') as HTMLElement | null) ?? layer?.parentElement;
    const cb = container?.getBoundingClientRect();
    const placed: (Box & { owner?: Entry })[] = [];
    if (container) {
      container.querySelectorAll<HTMLElement>('[data-label-obstacle]').forEach((o) => {
        const r = o.getBoundingClientRect();
        if (r.width > 0) placed.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
      });
    }
    for (const e of live) {
      const body = e.el!.querySelector<HTMLElement>('[data-body]');
      if (!body) continue;
      const r = body.getBoundingClientRect();
      const w = e.el!.getBoundingClientRect();
      const ox = lr.left + e.x * z + (r.left - w.left);
      const oy = lr.top + (e.y + e.dy) * z + (r.top - w.top);
      placed.push({ l: ox + 3, r: ox + r.width - 3, t: oy + 2, b: oy + r.height - 4, owner: e });
    }
    const outside = (b: Box) => !!cb && (b.l < cb.left + 2 || b.r > cb.right - 2 || b.t < cb.top + 2 || b.b > cb.bottom - 2);
    for (const it of items) {
      if (it.box.r - it.box.l < 1) continue;
      if (it.e.declutter === 'tag') {
        const must = it.e.priority >= 200;
        const clash = !must && (outside(it.box) || placed.some((p) => p.owner !== it.e && hit(it.box, p)));
        it.target.style.visibility = clash ? 'hidden' : '';
        if (!clash) placed.push({ ...it.box, owner: it.e });
        continue;
      }
      // find a free spot: step upwards past blockers, else try below the anchor
      const at = (dy: number) => ({ ...it.box, t: it.box.t + dy, b: it.box.b + dy });
      const blocker = (dy: number) => {
        const bx = at(dy);
        return outside(bx) ? bx : placed.find((q) => q.owner !== it.e && hit(bx, q));
      };
      const h = it.box.b - it.box.t;
      let dy = 0;
      let free = !blocker(0);
      for (let k = 0; k < 4 && !free; k++) {
        const o = blocker(dy)!;
        dy = o.t - it.box.b - 4;
        free = !blocker(dy);
      }
      if (!free) {
        for (const c of [h + 30, 2 * h + 34, -(h + 6), -(2 * h + 12)]) {
          if (!blocker(c)) {
            dy = c;
            free = true;
            break;
          }
        }
      }
      if (!free) dy = 0;
      if (Math.abs(dy / z - it.e.dy) > 0.5) {
        it.e.dy = dy / z;
        it.e.el!.style.transform = `translate(${it.e.x.toFixed(1)}px, ${(it.e.y + it.e.dy).toFixed(1)}px)`;
      }
      const fb = at(dy);
      const firstChild = it.e.el!.firstElementChild as HTMLElement | null;
      // callouts (priority ≥ 0) always show; optional labels hide when there is no free spot
      if (firstChild) firstChild.style.visibility = !free && (it.e.priority < 0 || outside(fb)) && it.e.priority < 200 ? 'hidden' : '';
      placed.push({ ...fb, owner: it.e });
    }
  });
  return null;
}
