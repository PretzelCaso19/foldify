import { ctx2d, makeCanvas } from '../render/canvas';

/**
 * Downscale by repeated halving, then one final high-quality step. A single large
 * drawImage reduction drops detail and aliases thin lines; halving keeps them.
 */
export function downscale(
  src: HTMLCanvasElement | ImageBitmap | HTMLImageElement,
  w: number,
  h = w,
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= w && ch / 2 >= h) {
    cw = Math.round(cw / 2);
    ch = Math.round(ch / 2);
    const next = makeCanvas(cw, ch);
    ctx2d(next).drawImage(cur, 0, 0, cw, ch);
    cur = next;
  }
  if (cw === w && ch === h && cur instanceof HTMLCanvasElement) return cur;
  const out = makeCanvas(w, h);
  ctx2d(out).drawImage(cur, 0, 0, w, h);
  return out;
}
