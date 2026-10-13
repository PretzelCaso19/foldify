import { css, lighten } from '../../color/util';
import { drawEmblem } from '../emblem';
import { FOLDER } from '../folder';
import { drawFolderBase, drawFrontLighting } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

/** Icon-theme style: darker back tab, white paper peeking out, soft vertical front gradient. */
export const iconpack: Preset = {
  id: 'iconpack',
  label: 'Icon pack',
  autoTint: 'folder',
  render(image, _palette, o) {
    const { c, ctx } = master();
    const front = ctx.createLinearGradient(0, FOLDER.frontTop, 0, FOLDER.bottom);
    front.addColorStop(0, css(lighten(o.tint, 0.08)));
    front.addColorStop(1, css(lighten(o.tint, -0.07)));
    drawFolderBase(ctx, o.tint, {
      ...o,
      backFill: css(lighten(o.tint, -0.18)),
      frontFill: front,
    });
    drawFrontLighting(ctx, o.tint, 0.5);
    if (image) {
      const art = emblemArt(image, o);
      inFront(ctx, () =>
        drawEmblem(ctx, art, place(art, 0.48, o), o.emblemMode, o.tint, { shadow: 0.15 }),
      );
    }
    return c;
  },
};
