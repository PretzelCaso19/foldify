import { lighten } from '../../color/util';
import { ctx2d, makeCanvas, path } from '../canvas';
import { drawMonoEmblem, type Img } from '../emblem';
import { frontPanelPath, frontRect, type Rect } from '../folder';
import { mergeFeatures } from '../merge';
import { drawFolderBase, drawFrontLighting, MASTER } from '../paint';
import { renderFullBleed } from './fullbleed';
import type { Preset } from './types';

/** Contain-fit into a box that's `fw` × `fh` of the panel, centred, then offset. */
function fitFeatures(img: Img, panel: Rect, scale: number, offX: number, offY: number): Rect {
  const bw = panel.w * 0.8 * scale;
  const bh = panel.h * 0.74 * scale;
  const k = Math.min(bw / img.width, bh / img.height);
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
  render(image, _palette, opts) {
    // A photo has no subject to lift out — the merge is the photo becoming the panel.
    if (opts.opaque) return renderFullBleed(image, opts);
    const c = makeCanvas(MASTER);
    const ctx = ctx2d(c);
    drawFolderBase(ctx, opts.tint, opts);
    const features =
      image &&
      mergeFeatures(image, {
        key: opts.key,
        tolerance: opts.mergeTolerance,
        trim: opts.trim,
        interiorOnly: opts.interiorOnly,
      });
    if (features) {
      const r = fitFeatures(features, frontRect(), opts.emblemScale, opts.emblemX, opts.emblemY);
      ctx.save();
      ctx.clip(path(frontPanelPath()));
      if (opts.emblemMode === 'color') ctx.drawImage(features.src, r.x, r.y, r.w, r.h);
      else drawMonoEmblem(ctx, features, r, lighten(opts.tint, -0.3));
      ctx.restore();
    }
    drawFrontLighting(ctx, opts.tint);
    return c;
  },
};
