import type { Palette } from '../../color/palette';
import type { RGB } from '../../color/util';
import type { EmblemMode, PresetId } from '../../state/store';
import type { Img } from '../emblem';
import type { MergeOptions } from '../merge';

export interface PresetOptions {
  /** Main color, already resolved from the override or the image (neon: the accent). */
  tint: RGB;
  merge: MergeOptions;
  glow: number;
  glowColor: RGB | null;
  scale: number;
  x: number;
  y: number;
  emblemMode: EmblemMode;
  paperStrip: boolean;
  /** The image has no transparency (e.g. a photo); there's no subject to lift out. */
  opaque: boolean;
}

/** A preset is a pure function: same inputs, same 1024×1024 canvas. */
export interface Preset {
  id: PresetId;
  label: string;
  /** Color used for the folder when the user hasn't picked one. */
  autoTint: 'body' | 'folder' | 'accent';
  render(image: Img | null, palette: Palette | null, opts: PresetOptions): HTMLCanvasElement;
}
