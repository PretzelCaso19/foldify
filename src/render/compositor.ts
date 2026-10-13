import { DEFAULT_TINT, folderTint, type RGB } from '../color/util';
import type { State } from '../state/store';
import { PRESETS } from './presets';

export function resolveTint(s: State): RGB {
  return s.folder.tint ?? (s.palette ? folderTint(s.palette.dominant) : DEFAULT_TINT);
}

/** The 1024×1024 master icon. A pure function of state. */
export function renderMaster(s: State): HTMLCanvasElement {
  const f = s.folder;
  return PRESETS[f.preset].render(s.source, s.palette, {
    tint: resolveTint(s),
    emblemScale: f.emblemScale,
    emblemX: f.emblemX,
    emblemY: f.emblemY,
    emblemMode: f.emblemMode,
    paperStrip: f.paperStrip,
  });
}
