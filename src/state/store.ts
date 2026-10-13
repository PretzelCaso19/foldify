import type { Palette } from '../color/palette';
import type { RGB } from '../color/util';
import type { Img } from '../render/emblem';

export type Mode = 'folder' | 'app';
export type EmblemMode = 'color' | 'mono';
export type PresetId = 'seamless' | 'fullbleed' | 'classic';

export interface Source {
  name: string;
  hasAlpha: boolean;
  original: Img;
  /** Background flood-filled away; null when the background wasn't uniform. */
  cutout: Img | null;
  palettes: { original: Palette | null; cutout: Palette | null };
}

export interface State {
  mode: Mode;
  source: Source | null;
  removeBg: boolean;
  folder: {
    preset: PresetId;
    /** Folder color override; null = derive from the image. */
    tint: RGB | null;
    /** The image's "body" color to merge into the folder; null = dominant color. */
    key: RGB | null;
    /** RGB distance keyed out around the body color (0 = no merging). */
    mergeTolerance: number;
    /** Outer outline trim, as a fraction of the image's longer side. */
    trim: number;
    /** Drop features that touch the subject's outer edge (ear tips, limbs, outline bits). */
    interiorOnly: boolean;
    glow: number;
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
  removeBg: true,
  folder: {
    preset: 'seamless',
    tint: null,
    key: null,
    mergeTolerance: 80,
    trim: 0.012,
    interiorOnly: true,
    glow: 0.55,
    emblemScale: 1,
    emblemX: 0,
    emblemY: 0,
    emblemMode: 'color',
    paperStrip: true,
  },
  exportSize: 1024,
});

export const activeImage = (s: State): Img | null =>
  s.source ? (s.removeBg && s.source.cutout) || s.source.original : null;

/** True when the active image has no transparency: nothing separates subject from backdrop. */
export const isOpaque = (s: State) =>
  !!s.source && !s.source.hasAlpha && !(s.removeBg && s.source.cutout);

export const activePalette = (s: State): Palette | null =>
  s.source
    ? s.removeBg && s.source.cutout
      ? s.source.palettes.cutout
      : s.source.palettes.original
    : null;

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
