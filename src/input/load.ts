import { extractPalette } from '../color/palette';
import { removeUniformBackground } from './bgremove';
import { ctx2d, makeCanvas } from '../render/canvas';
import { downscale } from '../export/resample';
import type { Source } from '../state/store';

export const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const ACCEPT_ATTR = [...ACCEPT, '.svg'].join(',');
/** Large enough for a full-bleed 1024 master with headroom for zoom. */
const MAX_SIDE = 1536;

export class UnsupportedImageError extends Error {}

const isSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

async function decodeSvg(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([await file.text()], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // SVGs without width/height report 0 or 300×150; rasterise crisply at MAX_SIDE.
    const iw = img.naturalWidth || MAX_SIDE;
    const ih = img.naturalHeight || MAX_SIDE;
    const k = MAX_SIDE / Math.max(iw, ih);
    const c = makeCanvas(iw * k, ih * k);
    ctx2d(c).drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeRaster(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = downscale(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k));
  bmp.close();
  return c;
}

function pixels(c: HTMLCanvasElement, side: number) {
  const k = Math.min(1, side / Math.max(c.width, c.height));
  const s = makeCanvas(c.width * k, c.height * k);
  const ctx = s.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(c, 0, 0, s.width, s.height);
  return { canvas: s, ctx, image: ctx.getImageData(0, 0, s.width, s.height) };
}

/** A copy of the image with its uniform background removed, or null if it has none. */
function cutout(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const { canvas, ctx, image } = pixels(c, 1024);
  if (!removeUniformBackground(image.data, canvas.width, canvas.height)) return null;
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export const palette = (c: HTMLCanvasElement) => extractPalette(pixels(c, 64).image.data);
export const asImg = (c: HTMLCanvasElement) => ({ src: c, width: c.width, height: c.height });

export async function loadImage(file: File): Promise<Source> {
  if (!ACCEPT.includes(file.type) && !isSvg(file)) {
    throw new UnsupportedImageError(
      `${file.name || 'That file'} isn't a supported image. Use PNG, JPG, WEBP or SVG.`,
    );
  }
  let canvas: HTMLCanvasElement;
  try {
    canvas = isSvg(file) ? await decodeSvg(file) : await decodeRaster(file);
  } catch {
    throw new UnsupportedImageError(`Couldn't read ${file.name || 'that image'} — is it damaged?`);
  }
  const alpha = pixels(canvas, 256).image.data;
  let hasAlpha = false;
  for (let i = 3; i < alpha.length; i += 4) {
    if (alpha[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  const cut = hasAlpha ? null : cutout(canvas);
  return {
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
    hasAlpha,
    original: { img: asImg(canvas), palette: palette(canvas) },
    cutout: cut && { img: asImg(cut), palette: palette(cut) },
    ai: null,
  };
}
