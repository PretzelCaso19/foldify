import type { Palette } from '../../color/palette';
import type { RGB } from '../../color/util';
import type { EmblemMode, PresetId } from '../../state/store';
import type { Img } from '../emblem';

export interface PresetOptions {
  /** Final folder color, already resolved from the override or the image. */
  tint: RGB;
  /** The image's body color, resolved (merged into the folder by Seamless). */
  key: RGB;
  mergeTolerance: number;
  trim: number;
  interiorOnly: boolean;
  glow: number;
  emblemScale: number;
  emblemX: number;
  emblemY: number;
  emblemMode: EmblemMode;
  paperStrip: boolean;
  /** The image has no transparency (e.g. a photo); there's no subject to merge. */
  opaque: boolean;
}

/** A preset is a pure function: same inputs, same 1024×1024 canvas. */
export interface Preset {
  id: PresetId;
  label: string;
  render(image: Img | null, palette: Palette | null, opts: PresetOptions): HTMLCanvasElement;
}
