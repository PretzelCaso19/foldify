import { drawSticker } from '../emblem';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { inFront, master, place } from './shared';
import type { Preset } from './types';

/** The image as a die-cut sticker slapped on a tinted folder. */
export const sticker: Preset = {
  id: 'sticker',
  label: 'Sticker',
  autoTint: 'folder',
  render(image, _palette, o) {
    const { c, ctx } = master();
    drawFolderBase(ctx, o.tint, o);
    drawFrontLighting(ctx, o.tint);
    if (image) inFront(ctx, () => drawSticker(ctx, image, place(image, 0.52, o)));
    return c;
  },
};
