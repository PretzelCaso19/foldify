import { rgbToHex, type RGB } from '../color/util';
import { makeCanvas } from './canvas';
import type { Img } from './emblem';

const smoothstep = (a: number, b: number, x: number) => {
  if (b <= a) return x >= b ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Chroma-key `key` out of the image: pixels within `tolerance` (RGB distance) of the body
 * color fade to transparent, with a soft ramp so anti-aliased edges blend into whatever
 * surface of that color sits underneath. Mutates `data`.
 */
export function keyOut(data: Uint8ClampedArray, key: RGB, tolerance: number, softness = 0.5) {
  const hi = tolerance;
  const lo = tolerance * (1 - softness);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const d = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    if (d < hi) data[i + 3] = Math.round(data[i + 3] * smoothstep(lo, hi, d));
  }
}

/**
 * Chamfer distance (in px) from each pixel to the nearest transparent pixel or the image
 * edge, measured on the alpha mask.
 */
export function distanceToEdge(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const D = new Float32Array(w * h);
  const BIG = 1e9;
  for (let p = 0; p < w * h; p++) D[p] = data[p * 4 + 3] < 128 ? 0 : BIG;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : D[y * w + x]);
  const S = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!D[p]) continue;
      D[p] = Math.min(
        D[p],
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + S,
        at(x + 1, y - 1) + S,
      );
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (!D[p]) continue;
      D[p] = Math.min(
        D[p],
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + S,
        at(x - 1, y + 1) + S,
      );
    }
  }
  return D;
}

/**
 * Erase a band `px` wide around the subject's silhouette — removes the outer outline of
 * cartoon art so it doesn't trace a ring on the folder. Mutates `data`.
 */
export function trimEdge(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  px: number,
  D = distanceToEdge(data, w, h),
) {
  if (px <= 0) return;
  for (let p = 0; p < w * h; p++) {
    const a = Math.min(1, Math.max(0, D[p] - px));
    if (a < 1) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * a);
  }
}

/**
 * Drop every connected blob (8-connected, alpha ≥ threshold) that reaches within `margin` px
 * of the subject's silhouette, keeping only features enclosed by the body — eyes, mouth,
 * markings — and discarding ear tips, limbs and outline remnants. `D` is the distance map
 * of the subject *before* keying. Mutates `data`.
 */
export function keepInterior(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  D: Float32Array,
  margin: number,
  threshold = 8,
) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blob: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] < threshold) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    blob.length = 0;
    let touchesEdge = false;
    while (top) {
      const p = stack[--top];
      blob.push(p);
      if (D[p] <= margin) touchesEdge = true;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!seen[q] && data[q * 4 + 3] >= threshold) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    if (touchesEdge) for (const p of blob) data[p * 4 + 3] = 0;
  }
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounding box of pixels with alpha ≥ threshold, or null if there are none. */
export function alphaBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 24,
): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export interface MergeOptions {
  key: RGB;
  tolerance: number;
  /** Outline trim as a fraction of the image's longer side. */
  trim: number;
  /** Keep only features enclosed by the body (see keepInterior). */
  interiorOnly: boolean;
}

const MAX = 1024;
const cache = new WeakMap<CanvasImageSource, Map<string, Img | null>>();

/**
 * The image's "features": everything that isn't the body color, outline trimmed, cropped
 * to what's left. Memoised per image + options because sliders re-render every frame.
 */
export function mergeFeatures(img: Img, o: MergeOptions): Img | null {
  const id = `${rgbToHex(o.key)}|${o.tolerance}|${o.trim}|${o.interiorOnly}`;
  let byImg = cache.get(img.src);
  if (!byImg) cache.set(img.src, (byImg = new Map()));
  if (byImg.has(id)) return byImg.get(id)!;
  if (byImg.size > 24) byImg.clear();

  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const c = makeCanvas(img.width * k, img.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img.src, 0, 0, c.width, c.height);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const trimPx = o.trim * Math.max(c.width, c.height);
  const D = distanceToEdge(im.data, c.width, c.height);
  trimEdge(im.data, c.width, c.height, trimPx, D);
  if (o.tolerance > 0) {
    keyOut(im.data, o.key, o.tolerance);
    // Only meaningful once the body is keyed away; otherwise the body itself touches the edge.
    if (o.interiorOnly) {
      const before = im.data.slice();
      keepInterior(im.data, c.width, c.height, D, trimPx + 2);
      // Nothing enclosed (e.g. a bare logo shape)? Keep the edge features instead of nothing.
      if (!alphaBounds(im.data, c.width, c.height)) im.data.set(before);
    }
  }
  const b = alphaBounds(im.data, c.width, c.height);
  let out: Img | null = null;
  if (b) {
    ctx.putImageData(im, 0, 0);
    const crop = makeCanvas(b.w, b.h);
    crop.getContext('2d')!.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    out = { src: crop, width: b.w, height: b.h };
  }
  byImg.set(id, out);
  return out;
}
