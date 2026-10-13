import { drawEmblem } from '../emblem';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

/** Like the native folder glyphs: the emblem pressed into the panel, one color. */
export const engraved: Preset = {
  id: 'engraved',
  label: 'Engraved',
  autoTint: 'folder',
  render(image, _palette, o) {
    const { c, ctx } = master();
    drawFolderBase(ctx, o.tint, o);
    if (image) {
      const art = emblemArt(image, { ...o, emblemMode: 'engraved' });
      inFront(ctx, () => drawEmblem(ctx, art, place(art, 0.5, o), 'engraved', o.tint));
    }
    drawFrontLighting(ctx, o.tint);
    return c;
  },
};
