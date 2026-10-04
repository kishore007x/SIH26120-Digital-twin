import { create } from 'zustand';

/** Per-viewer display preferences (accessibility bar). Stored in localStorage when available. */
export type FontScale = 0.9 | 1 | 1.1 | 1.2;
export type Contrast = 'normal' | 'high';

interface UiPrefs {
  fontScale: FontScale;
  contrast: Contrast;
  paletteOpen: boolean;
  setFontScale: (s: FontScale) => void;
  setContrast: (c: Contrast) => void;
  setPaletteOpen: (o: boolean) => void;
}

function read<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw);
    return valid(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export const useUiPrefs = create<UiPrefs>((set) => ({
  fontScale: read<FontScale>('ui.fontScale', 1, (v) => v === 0.9 || v === 1 || v === 1.1 || v === 1.2),
  contrast: read<Contrast>('ui.contrast', 'normal', (v) => v === 'normal' || v === 'high'),
  paletteOpen: false,
  setFontScale: (fontScale) => {
    write('ui.fontScale', fontScale);
    set({ fontScale });
  },
  setContrast: (contrast) => {
    write('ui.contrast', contrast);
    set({ contrast });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
