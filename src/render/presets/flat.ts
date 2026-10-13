import { drawEmblem } from '../emblem';
import { drawFolderBase } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

/** Two flat tones, crisp edges, no gradients or shadows. */
export const flat: Preset = {
  id: 'flat',
  label: 'Flat',
  autoTint: 'folder',
  render(image, _palette, o) {
    const { c, ctx } = master();
    drawFolderBase(ctx, o.tint, { ...o, glow: 0, flat: true });
    if (image) {
      const art = emblemArt(image, o);
      inFront(ctx, () =>
        drawEmblem(ctx, art, place(art, 0.54, o), o.emblemMode, o.tint, { flat: true }),
      );
    }
    return c;
  },
};
