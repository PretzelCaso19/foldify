import type { PresetId } from '../../state/store';
import { classic } from './classic';
import { fullBleed } from './fullbleed';
import { seamless } from './seamless';
import type { Preset } from './types';

export const PRESETS: Record<PresetId, Preset> = { seamless, fullbleed: fullBleed, classic };
export const PRESET_LIST: Preset[] = Object.values(PRESETS);
