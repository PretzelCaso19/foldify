import type { Palette } from '../color/palette';
import type { RGB } from '../color/util';
import type { Img } from '../render/emblem';

export type Mode = 'folder' | 'app';
export type EmblemMode = 'color' | 'mono' | 'engraved';
export type PresetId = 'classic';

export interface Source extends Img {
  name: string;
  hasAlpha: boolean;
}

export interface State {
  mode: Mode;
  source: Source | null;
  palette: Palette | null;
  folder: {
    preset: PresetId;
    /** null = derive from the image's dominant color. */
    tint: RGB | null;
    emblemScale: number;
    /** Emblem offset as a fraction of the front panel's width / height. */
    emblemX: number;
    emblemY: number;
    emblemMode: EmblemMode;
    paperStrip: boolean;
  };
  exportSize: number;
}

export const initialState = (): State => ({
  mode: 'folder',
  source: null,
  palette: null,
  folder: {
    preset: 'classic',
    tint: null,
    emblemScale: 1,
    emblemX: 0,
    emblemY: 0,
    emblemMode: 'color',
    paperStrip: false,
  },
  exportSize: 1024,
});

type Listener = (s: State) => void;

/**
 * One mutable store. Updates mutate in place and listeners are notified once per animation
 * frame, so dragging a slider redraws at most once per frame.
 */
export function createStore(state: State = initialState()) {
  const listeners = new Set<Listener>();
  let queued = false;
  const flush = () => {
    queued = false;
    listeners.forEach((l) => l(state));
  };
  return {
    get: () => state,
    update(fn: (s: State) => void) {
      fn(state);
      if (!queued) {
        queued = true;
        requestAnimationFrame(flush);
      }
    },
    subscribe(l: Listener) {
      listeners.add(l);
      l(state);
      return () => listeners.delete(l);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
