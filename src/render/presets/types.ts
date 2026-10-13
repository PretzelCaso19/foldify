import type { Palette } from '../../color/palette';
import type { RGB } from '../../color/util';
import type { EmblemMode, PresetId } from '../../state/store';
import type { Img } from '../emblem';

export interface PresetOptions {
  /** Final folder tint, already resolved from the override or the palette. */
  tint: RGB;
  emblemScale: number;
  emblemX: number;
  emblemY: number;
  emblemMode: EmblemMode;
  paperStrip: boolean;
}

/** A preset is a pure function: same inputs, same 1024×1024 canvas. */
export interface Preset {
  id: PresetId;
  label: string;
  render(image: Img | null, palette: Palette | null, opts: PresetOptions): HTMLCanvasElement;
}
