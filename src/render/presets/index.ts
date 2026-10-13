import type { PresetId } from '../../state/store';
import { classic } from './classic';
import { engraved } from './engraved';
import { flat } from './flat';
import { fullBleed } from './fullbleed';
import { gradient } from './gradient';
import { iconpack } from './iconpack';
import { neon } from './neon';
import { seamless } from './seamless';
import { sticker } from './sticker';
import type { Preset } from './types';

export const PRESETS: Record<PresetId, Preset> = {
  seamless,
  classic,
  engraved,
  gradient,
  fullbleed: fullBleed,
  sticker,
  neon,
  flat,
  iconpack,
};
export const PRESET_LIST: Preset[] = Object.values(PRESETS);
