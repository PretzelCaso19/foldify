import type { Palette } from '../color/palette';
import type { RGB } from '../color/util';
import type { EmblemMode, Img } from '../render/emblem';

export type { EmblemMode };
export type Mode = 'folder' | 'app';
export type PresetId =
  | 'seamless'
  | 'classic'
  | 'engraved'
  | 'gradient'
  | 'fullbleed'
  | 'sticker'
  | 'neon'
  | 'flat'
  | 'iconpack';
export type AppFill = 'merge' | 'glyph' | 'bleed';
export type AppBackground = 'solid' | 'gradient' | 'blur';

export interface Variant {
  img: Img;
  palette: Palette | null;
}

export interface Source {
  name: string;
  hasAlpha: boolean;
  original: Variant;
  /** Uniform background flood-filled away; null when the background wasn't uniform. */
  cutout: Variant | null;
  /** ML background removal, filled in on request. */
  ai: Variant | null;
}

export type BgMode = 'off' | 'fast' | 'ai';

/** Where the artwork sits; folder and app icon keep their own. */
export interface Placement {
  scale: number;
  /** Offset as a fraction of the target area's width / height. */
  x: number;
  y: number;
}

export interface State {
  mode: Mode;
  source: Source | null;
  bg: BgMode;
  aiStatus: 'idle' | 'loading' | 'error';
  /** 0…1 model download progress while aiStatus is 'loading'. */
  aiProgress: number;
  /** Shared by both modes: how the image's body color merges. */
  merge: {
    /** The image's body color; null = dominant color. */
    key: RGB | null;
    tolerance: number;
    trim: number;
    interiorOnly: boolean;
  };
  emblemMode: EmblemMode;
  folder: Placement & {
    preset: PresetId;
    /** Folder color override; null = derive from the image. */
    tint: RGB | null;
    glow: number;
    glowColor: RGB | null;
    paperStrip: boolean;
  };
  app: Placement & {
    fill: AppFill;
    background: AppBackground;
    /** Background color overrides; null = derive from the image. */
    bg1: RGB | null;
    bg2: RGB | null;
    rotation: number;
    padding: number;
    gloss: boolean;
    shadow: number;
  };
  exportSize: number;
}

export const initialState = (): State => ({
  mode: 'folder',
  source: null,
  bg: 'fast',
  aiStatus: 'idle',
  aiProgress: 0,
  merge: { key: null, tolerance: 80, trim: 0.012, interiorOnly: true },
  emblemMode: 'color',
  folder: {
    preset: 'seamless',
    tint: null,
    glow: 0.55,
    glowColor: null,
    paperStrip: true,
    scale: 1,
    x: 0,
    y: 0,
  },
  app: {
    fill: 'merge',
    background: 'gradient',
    bg1: null,
    bg2: null,
    rotation: 0,
    padding: 0.14,
    gloss: false,
    shadow: 0.6,
    scale: 1,
    x: 0,
    y: 0,
  },
  exportSize: 1024,
});

function variant(s: State): Variant | null {
  const src = s.source;
  if (!src) return null;
  if (s.bg === 'ai' && src.ai) return src.ai;
  if (s.bg !== 'off' && src.cutout) return src.cutout;
  return src.original;
}

export const activeImage = (s: State): Img | null => variant(s)?.img ?? null;
export const activePalette = (s: State): Palette | null => variant(s)?.palette ?? null;

/** True when the active image has no transparency: nothing separates subject from backdrop. */
export const isOpaque = (s: State) =>
  !!s.source && variant(s) === s.source.original && !s.source.hasAlpha;

export const placement = (s: State): Placement => (s.mode === 'app' ? s.app : s.folder);

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
