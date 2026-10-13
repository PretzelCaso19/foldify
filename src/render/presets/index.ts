import type { PresetId } from '../../state/store';
import { classic } from './classic';
import type { Preset } from './types';

export const PRESETS: Record<PresetId, Preset> = { classic };
export const PRESET_LIST: Preset[] = Object.values(PRESETS);
