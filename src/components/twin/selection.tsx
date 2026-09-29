import { createContext, useContext } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentKey } from './rig';

export interface SelectionCtx {
  selected: ComponentKey | null;
  hovered: ComponentKey | null;
  select: (k: ComponentKey | null) => void;
  hover: (k: ComponentKey | null) => void;
}

export const Selection = createContext<SelectionCtx>({ selected: null, hovered: null, select: () => {}, hover: () => {} });

export function useSelection() {
  return useContext(Selection);
}

/** Pointer handlers that make a group selectable as one equipment component. */
export function useSelectable(key: ComponentKey) {
  const s = useSelection();
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      s.select(key);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      s.hover(key);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      s.hover(null);
      document.body.style.cursor = '';
    },
  };
}

/** Emissive highlight for selected / hovered components. */
export function useHighlight(key: ComponentKey) {
  const s = useSelection();
  if (s.selected === key) return { emissive: '#3a78d4', emissiveIntensity: 0.55 };
  if (s.hovered === key) return { emissive: '#5a8fd8', emissiveIntensity: 0.25 };
  return { emissive: '#000000', emissiveIntensity: 0 };
}
