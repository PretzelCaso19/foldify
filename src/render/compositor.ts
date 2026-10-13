import { clamp, DEFAULT_TINT, folderTint, hslToRgb, rgbToHsl, type RGB } from '../color/util';
import { activeImage, activePalette, isOpaque, type State } from '../state/store';
import { PRESETS } from './presets';

/** The image's body color: explicit pick, else the palette's dominant color. */
export function resolveKey(s: State): RGB {
  return s.folder.key ?? activePalette(s)?.dominant ?? DEFAULT_TINT;
}

/** Keep the true body color (that's what makes the merge seamless), just not near-black. */
const bodyTint = (c: RGB): RGB => {
  const [h, sat, l] = rgbToHsl(c);
  return hslToRgb([h, sat, clamp(l, 0.22, 0.9)]);
};

export function resolveTint(s: State): RGB {
  if (s.folder.tint) return s.folder.tint;
  if (!s.source) return DEFAULT_TINT;
  return s.folder.preset === 'classic' ? folderTint(resolveKey(s)) : bodyTint(resolveKey(s));
}

/** The 1024×1024 master icon. A pure function of state. */
export function renderMaster(s: State): HTMLCanvasElement {
  const f = s.folder;
  return PRESETS[f.preset].render(activeImage(s), activePalette(s), {
    tint: resolveTint(s),
    key: resolveKey(s),
    mergeTolerance: f.mergeTolerance,
    trim: f.trim,
    interiorOnly: f.interiorOnly,
    glow: f.glow,
    emblemScale: f.emblemScale,
    emblemX: f.emblemX,
    emblemY: f.emblemY,
    emblemMode: f.emblemMode,
    paperStrip: f.paperStrip,
    opaque: isOpaque(s),
  });
}
