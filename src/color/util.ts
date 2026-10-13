export type RGB = [number, number, number];
export type HSL = [number, number, number];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function rgbToHsl([r, g, b]: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb([h, s, l]: HSL): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export const rgbToHex = (c: RGB) =>
  '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const css = (c: RGB, a = 1) =>
  a === 1 ? `rgb(${c.join(' ')})` : `rgb(${c.join(' ')} / ${a})`;

/** Shift HSL lightness by `amt` (−1…1). */
export function lighten(c: RGB, amt: number): RGB {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb([h, s, clamp(l + amt, 0, 1)]);
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** 0…1 spread between the strongest and weakest channel. */
export const chroma = (c: RGB) => (Math.max(...c) - Math.min(...c)) / 255;

/** Relative luminance (sRGB, approximate). */
export const luminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Normalise an arbitrary image color into a pleasant folder tint: keep the hue, keep greys
 * grey, but pull saturation and lightness into the range real folder icons live in.
 */
export function folderTint(c: RGB): RGB {
  const [h, s, l] = rgbToHsl(c);
  const sat = s < 0.08 ? s : clamp(s, 0.35, 0.85);
  return hslToRgb([h, sat, clamp(l, 0.5, 0.7)]);
}

export const DEFAULT_TINT: RGB = [92, 168, 232];
