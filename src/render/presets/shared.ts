import { ctx2d, makeCanvas, path } from '../canvas';
import { emblemRect, type Img } from '../emblem';
import { frontPanelPath, frontRect } from '../folder';
import { mergeFeatures } from '../merge';
import { MASTER } from '../paint';
import type { PresetOptions } from './types';

export function master() {
  const c = makeCanvas(MASTER);
  return { c, ctx: ctx2d(c) };
}

/**
 * What to draw as the emblem. Single-color modes need a shape; a photo has none, so for
 * those we lift its features off the dominant color instead of stamping a rectangle.
 */
export function emblemArt(image: Img, o: PresetOptions): Img {
  if (!o.opaque || o.emblemMode === 'color') return image;
  return mergeFeatures(image, { ...o.merge, interiorOnly: false }) ?? image;
}

export const place = (img: Img, frac: number, o: PresetOptions) =>
  emblemRect(img, frontRect(), frac, o.scale, o.x, o.y);

export function inFront(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.clip(path(frontPanelPath()));
  draw();
  ctx.restore();
}
