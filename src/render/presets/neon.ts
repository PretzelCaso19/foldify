import { css, lighten } from '../../color/util';
import { drawEmblem } from '../emblem';
import { FOLDER } from '../folder';
import { drawFolderBase, strokeFolder } from '../paint';
import { emblemArt, inFront, master, place } from './shared';
import type { Preset } from './types';

/** Black folder outlined and glowing in the image's accent color. */
export const neon: Preset = {
  id: 'neon',
  label: 'Neon',
  autoTint: 'accent',
  render(image, _palette, o) {
    const { c, ctx } = master();
    const accent = o.tint;
    const glow = o.glowColor ?? accent;
    const front = ctx.createLinearGradient(0, FOLDER.frontTop, 0, FOLDER.bottom);
    front.addColorStop(0, '#1d1d22');
    front.addColorStop(1, '#09090b');
    drawFolderBase(ctx, [24, 24, 28], {
      ...o,
      glow: Math.max(o.glow, 0.35),
      glowColor: glow,
      backFill: '#121216',
      frontFill: front,
    });
    // The tube: a soft wide pass for bloom, then a bright core.
    ctx.save();
    ctx.shadowColor = css(glow);
    ctx.shadowBlur = 26;
    strokeFolder(ctx, css(glow, 0.9), 7);
    ctx.restore();
    strokeFolder(ctx, css(lighten(accent, 0.25)), 3);
    if (image) {
      const art = emblemArt(image, o);
      const mode = o.emblemMode;
      inFront(ctx, () =>
        drawEmblem(ctx, art, place(art, 0.54, o), mode, [30, 30, 34], {
          glow: mode === 'engraved' ? undefined : glow,
        }),
      );
    }
    return c;
  },
};
