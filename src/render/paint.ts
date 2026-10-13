import { css, lighten, mix, type RGB } from '../color/util';
import { path } from './canvas';
import { backPanelPath, FOLDER, frontPanelPath, frontRect, paperPath, paperRect } from './folder';

export const MASTER = 1024;

type Fill = string | CanvasGradient;

export interface BaseOptions {
  paperStrip: boolean;
  /** 0…1 colored outer glow; 0 = a plain ground shadow. */
  glow: number;
  /** Glow color; defaults to the tint. */
  glowColor?: RGB | null;
  /** No gradients, highlights or shadows. */
  flat?: boolean;
  backFill?: Fill;
  frontFill?: Fill;
}

/**
 * Folder up to and including the front panel's fill — no lighting yet, so artwork can be
 * laid onto the panel and then lit together with it.
 */
export function drawFolderBase(ctx: CanvasRenderingContext2D, tint: RGB, o: BaseOptions) {
  const back = path(backPanelPath());
  const front = path(frontPanelPath());
  const f = frontRect();

  if (o.glow > 0) {
    ctx.save();
    ctx.shadowColor = css(lighten(o.glowColor ?? tint, 0.08), Math.min(1, 0.5 + o.glow * 0.5));
    ctx.shadowBlur = 30 + 70 * o.glow;
    ctx.fillStyle = css(o.glowColor ?? tint);
    ctx.fill(back);
    ctx.fill(front);
    ctx.restore();
  }
  if (!o.flat) {
    ctx.save();
    ctx.shadowColor = `rgb(0 0 0 / ${0.28 - o.glow * 0.12})`;
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = css(lighten(tint, -0.12));
    ctx.fill(back);
    ctx.fill(front);
    ctx.restore();
  }

  // Back panel: a touch darker than the front, lit from the top.
  if (o.backFill) ctx.fillStyle = o.backFill;
  else if (o.flat) ctx.fillStyle = css(lighten(tint, -0.12));
  else {
    const bg = ctx.createLinearGradient(0, FOLDER.tabTop, 0, FOLDER.frontTop + 40);
    bg.addColorStop(0, css(lighten(tint, -0.04)));
    bg.addColorStop(1, css(lighten(tint, -0.11)));
    ctx.fillStyle = bg;
  }
  ctx.fill(back);
  if (!o.flat) {
    ctx.save();
    ctx.clip(back);
    ctx.strokeStyle = 'rgb(255 255 255 / 0.28)';
    ctx.lineWidth = 6;
    ctx.translate(0, 3);
    ctx.stroke(back);
    ctx.restore();
  }

  if (o.paperStrip) {
    const p = paperRect();
    ctx.save();
    if (o.flat) ctx.fillStyle = '#ffffff';
    else {
      const pg = ctx.createLinearGradient(0, p.y, 0, f.y);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, '#eceef2');
      ctx.fillStyle = pg;
      ctx.shadowColor = 'rgb(0 0 0 / 0.12)';
      ctx.shadowBlur = 8;
    }
    ctx.fill(path(paperPath()));
    ctx.restore();
  }

  // Front panel: soft shadow onto what's behind it, then its fill.
  ctx.save();
  if (!o.flat) {
    ctx.shadowColor = 'rgb(0 0 0 / 0.16)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = -2;
  }
  ctx.fillStyle = o.frontFill ?? css(tint);
  ctx.fill(front);
  ctx.restore();
}

/**
 * Light the front panel — and anything already painted on it — as one surface: a gentle
 * top-to-bottom falloff, a bright top hairline, and a darker bottom lip.
 */
export function drawFrontLighting(ctx: CanvasRenderingContext2D, tint: RGB, strength = 1) {
  const f = frontRect();
  ctx.save();
  ctx.clip(path(frontPanelPath()));
  ctx.globalAlpha = strength;
  const fall = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  fall.addColorStop(0, 'rgb(255 255 255 / 0.16)');
  fall.addColorStop(0.5, 'rgb(255 255 255 / 0)');
  fall.addColorStop(1, 'rgb(0 0 0 / 0.07)');
  ctx.fillStyle = fall;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  const hl = ctx.createLinearGradient(0, f.y, 0, f.y + 26);
  hl.addColorStop(0, 'rgb(255 255 255 / 0.55)');
  hl.addColorStop(0.18, 'rgb(255 255 255 / 0.18)');
  hl.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = hl;
  ctx.fillRect(f.x, f.y, f.w, 26);
  const sh = ctx.createLinearGradient(0, f.y + f.h - 18, 0, f.y + f.h);
  sh.addColorStop(0, css(mix(tint, [0, 0, 0], 0.12), 0));
  sh.addColorStop(1, css(mix(tint, [0, 0, 0], 0.18), 0.9));
  ctx.fillStyle = sh;
  ctx.fillRect(f.x, f.y + f.h - 18, f.w, 18);
  ctx.restore();
}

/** Stroke the visible folder outline (back panel + front panel). */
export function strokeFolder(ctx: CanvasRenderingContext2D, color: Fill, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke(path(backPanelPath()));
  ctx.stroke(path(frontPanelPath()));
  ctx.restore();
}
