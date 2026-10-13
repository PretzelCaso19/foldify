import { drawEmblem } from '../emblem';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

/** Big Sur-style folder tinted to the image, image centred on the front as an emblem. */
export const classic: Preset = {
  id: 'classic',
  label: 'Classic tinted',
  autoTint: 'folder',
  render(image, _palette, o) {
    const { c, ctx } = master();
    drawFolderBase(ctx, o.tint, o);
    drawFrontLighting(ctx, o.tint);
    if (image) {
      const art = emblemArt(image, o);
      inFront(ctx, () => drawEmblem(ctx, art, place(art, 0.56, o), o.emblemMode, o.tint));
    }
    return c;
  },
};
