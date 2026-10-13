import { css, lighten, mix, type RGB } from '../../color/util';
import { ctx2d, makeCanvas, path } from '../canvas';
import { drawColorEmblem, drawMonoEmblem, emblemRect } from '../emblem';
import { backPanelPath, FOLDER, frontPanelPath, frontRect, paperPath, paperRect } from '../folder';
import type { Preset } from './types';

export const MASTER = 1024;

/** Back panel, optional paper, and a softly lit front panel — shared by several presets. */
export function drawTintedFolder(ctx: CanvasRenderingContext2D, tint: RGB, paperStrip: boolean) {
  const back = path(backPanelPath());
  const front = path(frontPanelPath());
  const f = frontRect();

  // Ground shadow under the whole folder.
  ctx.save();
  ctx.shadowColor = 'rgb(0 0 0 / 0.28)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = css(lighten(tint, -0.12));
  ctx.fill(back);
  ctx.fill(front);
  ctx.restore();

  // Back panel: a touch darker than the front, lit from the top.
  const bg = ctx.createLinearGradient(0, FOLDER.tabTop, 0, FOLDER.frontTop + 40);
  bg.addColorStop(0, css(lighten(tint, -0.04)));
  bg.addColorStop(1, css(lighten(tint, -0.11)));
  ctx.fillStyle = bg;
  ctx.fill(back);
  // Thin highlight along the back panel's top edge.
  ctx.save();
  ctx.clip(back);
  ctx.strokeStyle = 'rgb(255 255 255 / 0.28)';
  ctx.lineWidth = 6;
  ctx.translate(0, 3);
  ctx.stroke(back);
  ctx.restore();

  if (paperStrip) {
    const p = paperRect();
    const pg = ctx.createLinearGradient(0, p.y, 0, f.y);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(1, '#e9ebef');
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.12)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = pg;
    ctx.fill(path(paperPath()));
    ctx.restore();
  }

  // Front panel: soft shadow onto what's behind it, then a gentle vertical gradient.
  ctx.save();
  ctx.shadowColor = 'rgb(0 0 0 / 0.16)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = -2;
  ctx.fillStyle = css(tint);
  ctx.fill(front);
  ctx.restore();
  const fg = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  fg.addColorStop(0, css(lighten(tint, 0.07)));
  fg.addColorStop(0.55, css(tint));
  fg.addColorStop(1, css(lighten(tint, -0.05)));
  ctx.fillStyle = fg;
  ctx.fill(front);

  ctx.save();
  ctx.clip(front);
  // Top highlight: a bright hairline fading into the panel.
  const hl = ctx.createLinearGradient(0, f.y, 0, f.y + 26);
  hl.addColorStop(0, 'rgb(255 255 255 / 0.55)');
  hl.addColorStop(0.18, 'rgb(255 255 255 / 0.18)');
  hl.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(f.x, f.y, f.w, 26);
  // Bottom edge: slightly darker, as if the panel has thickness.
  const sh = ctx.createLinearGradient(0, f.y + f.h - 18, 0, f.y + f.h);
  sh.addColorStop(0, css(mix(tint, [0, 0, 0], 0.12), 0));
  sh.addColorStop(1, css(mix(tint, [0, 0, 0], 0.18), 0.9));
  ctx.fillStyle = sh;
  ctx.fillRect(f.x, f.y + f.h - 18, f.w, 18);
  ctx.restore();
}

export const classic: Preset = {
  id: 'classic',
  label: 'Classic tinted',
  render(image, _palette, opts) {
    const c = makeCanvas(MASTER);
    const ctx = ctx2d(c);
    drawTintedFolder(ctx, opts.tint, opts.paperStrip);
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
