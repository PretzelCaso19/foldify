import { css, lighten, type RGB } from '../color/util';
import type { AppBackground, AppFill, EmblemMode } from '../state/store';
import { ctx2d, makeCanvas, path } from './canvas';
import { drawEmblem, type Img } from './emblem';
import type { Rect } from './folder';
import { mergeFeatures, type MergeOptions } from './merge';
import { MASTER } from './paint';
import { squirclePath } from './squircle';

/**
 * macOS app icon grid on a 1024 canvas: an 824 body centred with 100px margins. The
 * continuous corner spans ~34% of the side, which reads like the system's ~185px radius.
 */
export const APP_BODY: Rect = { x: 100, y: 100, w: 824, h: 824 };
export const APP_RADIUS = 0.34 * 824;
export const APP_N = 4.6;
export const appBodyPath = () =>
  squirclePath(APP_BODY.x, APP_BODY.y, APP_BODY.w, APP_BODY.h, APP_RADIUS, APP_N);

export interface AppOptions {
  fill: AppFill;
  background: AppBackground;
  bg1: RGB;
  bg2: RGB;
  merge: MergeOptions;
  emblemMode: EmblemMode;
  scale: number;
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  /** Inset of the glyph from the body edge, as a fraction of the body. */
  padding: number;
  gloss: boolean;
  shadow: number;
  opaque: boolean;
}

/** Draw `img` centred on (cx, cy) at w×h, rotated. */
function drawRotated(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  cx: number,
  cy: number,
  w: number,
  h: number,
  deg: number,
  draw = (x: number, y: number) => ctx.drawImage(img, x, y, w, h),
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  draw(-w / 2, -h / 2);
  ctx.restore();
}

const supportsFilter = (() => {
  try {
    const ctx = makeCanvas(1).getContext('2d')!;
    ctx.filter = 'blur(2px)';
    return ctx.filter === 'blur(2px)';
  } catch {
    return false;
  }
})();

/**
 * A heavy, saturated blur of the image drawn at w×h, on a canvas with `pad` of bleed room on
 * every side (in the same units). Uses ctx.filter where available; otherwise approximates
 * it by shrinking and regrowing in smooth steps.
 */
const blurCache = new WeakMap<
  CanvasImageSource,
  { key: string; out: ReturnType<typeof blurUncached> }
>();
function blurred(img: Img, w: number, h: number) {
  const key = `${Math.round(w)}x${Math.round(h)}`;
  const hit = blurCache.get(img.src);
  if (hit?.key === key) return hit.out;
  const out = blurUncached(img, w, h);
  blurCache.set(img.src, { key, out });
  return out;
}

function blurUncached(img: Img, w: number, h: number): { canvas: HTMLCanvasElement; pad: number } {
  const pad = Math.round(Math.max(w, h) * 0.12);
  if (supportsFilter) {
    const c = makeCanvas(w + pad * 2, h + pad * 2);
    const ctx = ctx2d(c);
    ctx.filter = `blur(${Math.round(Math.max(w, h) * 0.06)}px) saturate(1.5)`;
    ctx.drawImage(img.src, pad, pad, w, h);
    return { canvas: c, pad };
  }
  let cur: HTMLCanvasElement | null = null;
  for (const side of [20, 60, 180, 540]) {
    const k = side / Math.max(w, h);
    const c = makeCanvas((w + pad * 2) * k, (h + pad * 2) * k);
    const ctx = ctx2d(c);
    if (cur) ctx.drawImage(cur, 0, 0, c.width, c.height);
    else ctx.drawImage(img.src, pad * k, pad * k, w * k, h * k);
    cur = c;
  }
  return { canvas: cur!, pad };
}

function coverSize(img: Img, box: Rect, scale: number) {
  const k = Math.max(box.w / img.width, box.h / img.height) * scale;
  return { w: img.width * k, h: img.height * k };
}

export function renderAppIcon(image: Img | null, o: AppOptions): HTMLCanvasElement {
  const c = makeCanvas(MASTER);
  const ctx = ctx2d(c);
  const body = path(appBodyPath());
  const B = APP_BODY;
  const cx = B.x + B.w / 2 + o.x * B.w;
  const cy = B.y + B.h / 2 + o.y * B.h;
  const fill = o.fill === 'merge' && o.opaque ? 'bleed' : o.fill;

  // Drop shadow beneath the body, per the macOS grid.
  ctx.save();
  ctx.shadowColor = `rgb(0 0 0 / ${0.32 * o.shadow})`;
  ctx.shadowBlur = 8 + 24 * o.shadow;
  ctx.shadowOffsetY = 4 + 10 * o.shadow;
  ctx.fillStyle = css(o.bg1);
  ctx.fill(body);
  ctx.restore();

  ctx.save();
  ctx.clip(body);
  // Background.
  if (fill === 'merge') {
    ctx.fillStyle = css(o.bg1);
    ctx.fillRect(B.x, B.y, B.w, B.h);
  } else if (fill === 'glyph' && o.background === 'blur' && image) {
    ctx.fillStyle = css(o.bg1);
    ctx.fillRect(B.x, B.y, B.w, B.h);
    const s = coverSize(image, B, 1.3);
    const { canvas, pad } = blurred(image, s.w, s.h);
    const w = s.w + pad * 2;
    const h = s.h + pad * 2;
    ctx.drawImage(canvas, B.x + (B.w - w) / 2, B.y + (B.h - h) / 2, w, h);
    ctx.fillStyle = 'rgb(255 255 255 / 0.12)';
    ctx.fillRect(B.x, B.y, B.w, B.h);
  } else if (fill === 'glyph' && o.background === 'gradient') {
    const g = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
    g.addColorStop(0, css(o.bg1));
    g.addColorStop(1, css(o.bg2));
    ctx.fillStyle = g;
    ctx.fillRect(B.x, B.y, B.w, B.h);
  } else {
    ctx.fillStyle = css(o.bg1);
    ctx.fillRect(B.x, B.y, B.w, B.h);
  }

  // Artwork.
  if (image && fill === 'bleed') {
    const s = coverSize(image, B, o.scale);
    drawRotated(ctx, image.src, cx, cy, s.w, s.h, o.rotation);
  } else if (image) {
    const art = fill === 'merge' ? mergeFeatures(image, o.merge) : image;
    if (art) {
      const inner = B.w * (1 - 2 * o.padding) * o.scale;
      const k = inner / Math.max(art.width, art.height);
      const w = art.width * k;
      const h = art.height * k;
      drawRotated(ctx, art.src, cx, cy, w, h, o.rotation, (x, y) => {
        const r = { x, y, w, h };
        if (fill === 'merge' && o.emblemMode === 'color') ctx.drawImage(art.src, x, y, w, h);
        else drawEmblem(ctx, art, r, o.emblemMode, o.bg1, { shadow: fill === 'merge' ? 0 : 0.25 });
      });
    }
  }

  // Surface lighting so artwork and body read as one piece.
  const fall = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
  fall.addColorStop(0, 'rgb(255 255 255 / 0.1)');
  fall.addColorStop(0.5, 'rgb(255 255 255 / 0)');
  fall.addColorStop(1, 'rgb(0 0 0 / 0.08)');
  ctx.fillStyle = fall;
  ctx.fillRect(B.x, B.y, B.w, B.h);
  if (o.gloss) {
    const g = ctx.createLinearGradient(0, B.y, 0, B.y + B.h * 0.55);
    g.addColorStop(0, 'rgb(255 255 255 / 0.42)');
    g.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = g;
    ctx.fillRect(B.x, B.y, B.w, B.h * 0.55);
  }
  ctx.restore();

  // Hairline edge: light on top, dark at the bottom, like the system icons.
  const edge = ctx.createLinearGradient(0, B.y, 0, B.y + B.h);
  edge.addColorStop(0, 'rgb(255 255 255 / 0.35)');
  edge.addColorStop(0.5, css(lighten(o.bg1, -0.1), 0.0));
  edge.addColorStop(1, 'rgb(0 0 0 / 0.18)');
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 4;
  ctx.stroke(body);
  ctx.restore();
  return c;
}
