import { lighten, type RGB } from '../../color/util';
import { ctx2d, makeCanvas, path } from '../canvas';
import type { Img } from '../emblem';
import { frontPanelPath, frontRect } from '../folder';
import { drawFolderBase, drawFrontLighting, MASTER } from '../paint';
import type { Preset, PresetOptions } from './types';

/** The image cover-fitted into the front panel, under the panel's own lighting. */
export function renderFullBleed(image: Img | null, opts: PresetOptions): HTMLCanvasElement {
  const c = makeCanvas(MASTER);
  const ctx = ctx2d(c);
  // The back panel is a darker shade of the image so the photo reads as the folder's face.
  const back: RGB = lighten(opts.tint, -0.12);
  drawFolderBase(ctx, back, opts);
  if (image) {
    const f = frontRect();
    const k = Math.max(f.w / image.width, f.h / image.height) * opts.emblemScale;
    const w = image.width * k;
    const h = image.height * k;
    ctx.save();
    ctx.clip(path(frontPanelPath()));
    ctx.drawImage(
      image.src,
      f.x + (f.w - w) / 2 + opts.emblemX * f.w,
      f.y + (f.h - h) / 2 + opts.emblemY * f.h,
      w,
      h,
    );
    ctx.restore();
  }
  drawFrontLighting(ctx, opts.tint);
  return c;
}

export const fullBleed: Preset = {
  id: 'fullbleed',
  label: 'Full-bleed',
  render: (image, _palette, opts) => renderFullBleed(image, opts),
};
