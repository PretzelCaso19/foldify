import type { Palette } from '../../color/palette';
import { chroma, css, folderTint, hslToRgb, lighten, rgbToHsl, type RGB } from '../../color/util';
import { drawEmblem } from '../emblem';
import { FOLDER } from '../folder';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

const hueShift = (c: RGB, deg: number): RGB => {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb([(h + deg + 360) % 360, s, l]);
};

/**
 * 2–3 gradient stops: the tint plus the palette's most colorful accents (made folder-ish),
 * or hue-shifted neighbours of the tint when the image has nothing else to offer.
 */
export function gradientStops(tint: RGB, palette: Palette | null, useTintOnly: boolean): RGB[] {
  const extra = useTintOnly
    ? []
    : (palette?.accents ?? [])
        .filter((c) => chroma(c) > 0.2)
        .map(folderTint)
        .filter((c) => Math.abs(rgbToHsl(c)[0] - rgbToHsl(tint)[0]) > 18)
        .slice(0, 2);
  if (extra.length) return [tint, ...extra];
  return [lighten(hueShift(tint, -22), 0.04), tint, hueShift(tint, 28)];
}

export const gradient: Preset = {
  id: 'gradient',
  label: 'Gradient',
  autoTint: 'folder',
  render(image, palette, o) {
    const { c, ctx } = master();
    const stops = gradientStops(o.tint, palette, false);
    const make = (shade: number) => {
      const g = ctx.createLinearGradient(FOLDER.left, FOLDER.frontTop, FOLDER.right, FOLDER.bottom);
      stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), css(lighten(s, shade))));
      return g;
    };
    drawFolderBase(ctx, o.tint, { ...o, backFill: make(-0.1), frontFill: make(0) });
    drawFrontLighting(ctx, o.tint, 0.8);
    if (image) {
      const art = emblemArt(image, o);
      inFront(ctx, () => drawEmblem(ctx, art, place(art, 0.58, o), o.emblemMode, o.tint));
    }
    return c;
  },
};
