import { css, lighten, luminance, mix, rgbToHex, type RGB } from '../color/util';
import { ctx2d, makeCanvas } from './canvas';
import type { Rect } from './folder';

export interface Img {
  src: CanvasImageSource;
  width: number;
  height: number;
}

export type EmblemMode = 'color' | 'mono' | 'engraved';

/**
 * Contain-fit an image into a square of `min(box.w, box.h) * frac * scale`, centred in
 * `box`, then shifted by (offX, offY) as fractions of the box size.
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

const memo = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement>>();
/** Per-image memo for derived rasters; sliders re-render every frame. */
function cached(img: Img, key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let m = memo.get(img.src);
  if (!m) memo.set(img.src, (m = new Map()));
  let c = m.get(key);
  if (!c) {
    if (m.size > 48) m.clear();
    m.set(key, (c = make()));
  }
  return c;
}

const px = (v: number) => Math.max(1, Math.round(v));

/** The image recolored to a single flat color, keeping its alpha. */
export function silhouette(img: Img, w: number, h: number, color: RGB, alpha = 1) {
  return cached(img, `sil|${px(w)}x${px(h)}|${rgbToHex(color)}|${alpha}`, () => {
    const c = makeCanvas(px(w), px(h));
    const ctx = ctx2d(c);
    ctx.drawImage(img.src, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = css(color, alpha);
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  });
}

/**
 * Duotone: each pixel's luminance picks a color between `dark` and `light`. Unlike a flat
 * silhouette this keeps interior detail (a bolt inside a circle stays visible).
 */
export function duotone(img: Img, w: number, h: number, dark: RGB, light: RGB, steps = 0) {
  return cached(img, `duo|${px(w)}x${px(h)}|${rgbToHex(dark)}|${rgbToHex(light)}|${steps}`, () => {
    const c = makeCanvas(px(w), px(h));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.src, 0, 0, c.width, c.height);
    const im = ctx.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const lum = luminance([d[i], d[i + 1], d[i + 2]]);
      // steps > 1 posterises into hard bands (flat style); 0 keeps a smooth ramp.
      const t = steps > 1 ? Math.min(steps - 1, Math.floor(lum * steps)) / (steps - 1) : lum;
      const [r, g, b] = mix(dark, light, t);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(im, 0, 0);
    return c;
  });
}

/** Debossed into the surface: bottom-edge highlight, recessed duotone fill, inner shadow. */
function drawEngraved(ctx: CanvasRenderingContext2D, img: Img, r: Rect, tint: RGB) {
  const w = px(r.w);
  const h = px(r.h);
  const unit = Math.max(1.5, Math.max(r.w, r.h) / 170);
  ctx.drawImage(silhouette(img, w, h, [255, 255, 255], 0.5), r.x, r.y + unit, r.w, r.h);

  const layer = makeCanvas(w, h);
  const lc = ctx2d(layer);
  lc.drawImage(duotone(img, w, h, lighten(tint, -0.22), lighten(tint, -0.1)), 0, 0);
  // A frame with a glyph-shaped hole; its offset shadow lands inside the glyph's top edges.
  const pad = Math.ceil(unit * 8);
  const hole = makeCanvas(w + pad * 2, h + pad * 2);
  const hc = ctx2d(hole);
  hc.fillStyle = '#000';
  hc.fillRect(0, 0, hole.width, hole.height);
  hc.globalCompositeOperation = 'destination-out';
  hc.drawImage(img.src, pad, pad, w, h);
  lc.globalCompositeOperation = 'source-atop';
  lc.shadowColor = css(lighten(tint, -0.5), 0.75);
  lc.shadowBlur = unit * 2.5;
  lc.shadowOffsetY = unit * 1.6;
  lc.drawImage(hole, -pad, -pad);
  ctx.drawImage(layer, r.x, r.y, r.w, r.h);
}

export interface EmblemStyle {
  /** Contact shadow strength for full-color emblems (0 = none). */
  shadow?: number;
  /** Colored glow around the emblem (neon). */
  glow?: RGB;
  /** Flat look: mono becomes one solid shade, no shadows. */
  flat?: boolean;
}

/** Draw an emblem in any of the three modes, shaded to sit on a surface of `tint`. */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  img: Img,
  r: Rect,
  mode: EmblemMode,
  tint: RGB,
  style: EmblemStyle = {},
) {
  if (mode === 'engraved') return drawEngraved(ctx, img, r, tint);
  ctx.save();
  if (style.glow) {
    ctx.shadowColor = css(style.glow, 0.95);
    ctx.shadowBlur = Math.max(r.w, r.h) * 0.08;
  } else if (!style.flat && (style.shadow ?? 0.22) > 0) {
    ctx.shadowColor = `rgb(0 0 0 / ${style.shadow ?? 0.22})`;
    ctx.shadowBlur = r.h * 0.05;
    ctx.shadowOffsetY = r.h * 0.018;
  }
  if (mode === 'color') ctx.drawImage(img.src, r.x, r.y, r.w, r.h);
  else if (style.glow) ctx.drawImage(silhouette(img, r.w, r.h, style.glow), r.x, r.y, r.w, r.h);
  else if (style.flat) {
    const art = duotone(img, r.w, r.h, lighten(tint, -0.38), lighten(tint, -0.18), 2);
    ctx.drawImage(art, r.x, r.y, r.w, r.h);
  } else {
    const art = duotone(img, r.w, r.h, lighten(tint, -0.42), lighten(tint, -0.12));
    ctx.drawImage(art, r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

/** Die-cut sticker: a white border grown around the silhouette, a small drop shadow. */
export function drawSticker(ctx: CanvasRenderingContext2D, img: Img, r: Rect) {
  const border = Math.max(4, Math.max(r.w, r.h) * 0.045);
  const pad = Math.ceil(border) + 2;
  const w = px(r.w);
  const h = px(r.h);
  const sil = silhouette(img, w, h, [255, 255, 255]);
  const cut = makeCanvas(w + pad * 2, h + pad * 2);
  const cc = ctx2d(cut);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    cc.drawImage(sil, pad + Math.cos(a) * border, pad + Math.sin(a) * border);
  }
  cc.drawImage(sil, pad, pad);
  ctx.save();
  ctx.shadowColor = 'rgb(0 0 0 / 0.3)';
  ctx.shadowBlur = border * 1.4;
  ctx.shadowOffsetY = border * 0.5;
  ctx.drawImage(cut, r.x - pad, r.y - pad);
  ctx.restore();
  ctx.drawImage(img.src, r.x, r.y, r.w, r.h);
}
