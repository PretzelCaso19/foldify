import { drawEmblem, type Img } from '../emblem';
import { frontRect, type Rect } from '../folder';
import { mergeFeatures } from '../merge';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { renderFullBleed } from './fullbleed';
import { inFront, master } from './shared';
import type { Preset } from './types';

/** Contain-fit into most of the panel, centred, then scaled and offset. */
export function fitFeatures(
  img: Img,
  panel: Rect,
  scale: number,
  offX: number,
  offY: number,
): Rect {
  const k = Math.min((panel.w * 0.8 * scale) / img.width, (panel.h * 0.74 * scale) / img.height);
  const w = img.width * k;
  const h = img.height * k;
  return {
    x: panel.x + (panel.w - w) / 2 + offX * panel.w,
    y: panel.y + (panel.h - h) / 2 + offY * panel.h,
    w,
    h,
  };
}

/**
 * The folder becomes the subject: its body takes the image's main color, that color is
 * keyed out of the image, and only the remaining features (eyes, mouth, markings…) are
 * painted onto the front panel — under the same lighting, so they read as part of it.
 */
export const seamless: Preset = {
  id: 'seamless',
  label: 'Seamless merge',
  autoTint: 'body',
  render(image, _palette, o) {
    // A photo has no subject to lift out — the merge is the photo becoming the panel.
    if (o.opaque) return renderFullBleed(image, o);
    const { c, ctx } = master();
    drawFolderBase(ctx, o.tint, o);
    const features = image && mergeFeatures(image, o.merge);
    if (features) {
      const r = fitFeatures(features, frontRect(), o.scale, o.x, o.y);
      inFront(ctx, () => {
        if (o.emblemMode === 'color') ctx.drawImage(features.src, r.x, r.y, r.w, r.h);
        else drawEmblem(ctx, features, r, o.emblemMode, o.tint);
      });
    }
    drawFrontLighting(ctx, o.tint);
    return c;
  },
};
