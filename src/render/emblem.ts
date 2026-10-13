import { css, type RGB } from '../color/util';
import { ctx2d, makeCanvas } from './canvas';
import type { Rect } from './folder';

export interface Img {
  src: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Contain-fit an image into a square of `box.h * frac * scale`, centred in `box`, then
 * shifted by (offX, offY) as fractions of the box size.
 */
export function emblemRect(
  img: Img,
  box: Rect,
  frac: number,
  scale: number,
  offX: number,
  offY: number,
): Rect {
  const side = Math.min(box.w, box.h) * frac * scale;
  const k = side / Math.max(img.width, img.height);
  const w = img.width * k;
  const h = img.height * k;
  return {
    x: box.x + (box.w - w) / 2 + offX * box.w,
    y: box.y + (box.h - h) / 2 + offY * box.h,
    w,
    h,
  };
}

/** The image recolored to a single flat color, keeping its alpha. */
export function silhouette(
  img: Img,
  w: number,
  h: number,
  color: RGB,
  alpha = 1,
): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.drawImage(img.src, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = css(color, alpha);
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Full-color emblem with a soft contact shadow. */
export function drawColorEmblem(ctx: CanvasRenderingContext2D, img: Img, r: Rect, shadow = 0.22) {
  ctx.save();
  ctx.shadowColor = `rgb(0 0 0 / ${shadow})`;
  ctx.shadowBlur = r.h * 0.05;
  ctx.shadowOffsetY = r.h * 0.018;
  ctx.drawImage(img.src, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Single-color emblem (e.g. a darker shade of the folder tint). */
export function drawMonoEmblem(ctx: CanvasRenderingContext2D, img: Img, r: Rect, color: RGB) {
  ctx.drawImage(silhouette(img, r.w, r.h, color), r.x, r.y, r.w, r.h);
}
