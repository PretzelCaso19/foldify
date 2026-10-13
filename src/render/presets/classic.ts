import { lighten } from '../../color/util';
import { ctx2d, makeCanvas, path } from '../canvas';
import { drawColorEmblem, drawMonoEmblem, emblemRect } from '../emblem';
import { frontPanelPath, frontRect } from '../folder';
import { drawFolderBase, drawFrontLighting, MASTER } from '../paint';
import type { Preset } from './types';

/** The image as a sticker-like emblem sitting on top of a tinted folder. */
export const classic: Preset = {
  id: 'classic',
  label: 'Emblem',
  render(image, _palette, opts) {
    const c = makeCanvas(MASTER);
    const ctx = ctx2d(c);
    drawFolderBase(ctx, opts.tint, opts);
    drawFrontLighting(ctx, opts.tint);
    if (image) {
      const r = emblemRect(image, frontRect(), 0.56, opts.emblemScale, opts.emblemX, opts.emblemY);
      ctx.save();
      ctx.clip(path(frontPanelPath()));
      if (opts.emblemMode === 'color') drawColorEmblem(ctx, image, r);
      else drawMonoEmblem(ctx, image, r, lighten(opts.tint, -0.22));
      ctx.restore();
    }
    return c;
  },
};
