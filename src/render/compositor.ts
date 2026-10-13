import type { Palette } from '../color/palette';
import {
  chroma,
  clamp,
  DEFAULT_TINT,
  folderTint,
  hslToRgb,
  mix,
  rgbToHsl,
  type RGB,
} from '../color/util';
import { activeImage, activePalette, isOpaque, type State } from '../state/store';
import { renderAppIcon } from './appicon';
import { PRESETS } from './presets';

/** The image's body color: explicit pick, else the palette's dominant color. */
export function resolveKey(s: State): RGB {
  return s.merge.key ?? activePalette(s)?.dominant ?? DEFAULT_TINT;
}

/** Keep the true body color (that's what makes a merge seamless), just not near-black. */
export const bodyTint = (c: RGB): RGB => {
  const [h, sat, l] = rgbToHsl(c);
  return hslToRgb([h, sat, clamp(l, 0.22, 0.9)]);
};

/** The most colorful swatch, pushed to a bright, saturated neon. */
export function neonAccent(palette: Palette | null, fallback: RGB): RGB {
  const best = [...(palette?.swatches ?? [fallback])].sort((a, b) => chroma(b) - chroma(a))[0];
  const [h, sat] = rgbToHsl(chroma(best) < 0.08 ? fallback : best);
  return hslToRgb([h, Math.max(sat, 0.85), 0.58]);
}

export function resolveTint(s: State): RGB {
  if (s.folder.tint) return s.folder.tint;
  const key = resolveKey(s);
  switch (PRESETS[s.folder.preset].autoTint) {
    case 'body':
      return s.source ? bodyTint(key) : DEFAULT_TINT;
    case 'accent':
      return neonAccent(activePalette(s), s.source ? folderTint(key) : DEFAULT_TINT);
    default:
      return s.source ? folderTint(key) : DEFAULT_TINT;
  }
}

const WHITE: RGB = [255, 255, 255];

/** App icon background colors: the body color for merge, a pale wash for glyphs. */
export function resolveAppBg(s: State): [RGB, RGB] {
  const key = resolveKey(s);
  const fill = s.app.fill;
  const auto: [RGB, RGB] =
    fill === 'glyph'
      ? [mix(folderTint(key), WHITE, 0.78), mix(folderTint(key), WHITE, 0.5)]
      : [bodyTint(key), bodyTint(key)];
  return [s.app.bg1 ?? auto[0], s.app.bg2 ?? auto[1]];
}

/** Render one folder preset from state (used for the editor and the preset tiles). */
export function renderFolder(s: State, preset = s.folder.preset): HTMLCanvasElement {
  const f = s.folder;
  const st = preset === f.preset ? s : { ...s, folder: { ...f, preset } };
  return PRESETS[preset].render(activeImage(s), activePalette(s), {
    tint: resolveTint(st),
    merge: { ...s.merge, key: resolveKey(s) },
    glow: f.glow,
    glowColor: f.glowColor,
    scale: f.scale,
    x: f.x,
    y: f.y,
    emblemMode: s.emblemMode,
    paperStrip: f.paperStrip,
    opaque: isOpaque(s),
  });
}

export function renderApp(s: State): HTMLCanvasElement {
  const a = s.app;
  const [bg1, bg2] = resolveAppBg(s);
  return renderAppIcon(activeImage(s), {
    fill: a.fill,
    background: a.background,
    bg1,
    bg2,
    merge: { ...s.merge, key: resolveKey(s) },
    emblemMode: s.emblemMode,
    scale: a.scale,
    x: a.x,
    y: a.y,
    rotation: a.rotation,
    padding: a.padding,
    gloss: a.gloss,
    shadow: a.shadow,
    opaque: isOpaque(s),
  });
}

/** The 1024×1024 master icon. A pure function of state. */
export const renderMaster = (s: State) => (s.mode === 'app' ? renderApp(s) : renderFolder(s));
