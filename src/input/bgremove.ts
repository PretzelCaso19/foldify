import type { RGB } from '../color/util';

export interface BgOptions {
  /** RGB distance within which a pixel counts as background. */
  tolerance?: number;
  /** Fraction of border pixels that must match for the background to count as uniform. */
  uniformity?: number;
}

const dist = (d: Uint8ClampedArray, i: number, c: RGB) =>
  Math.hypot(d[i] - c[0], d[i + 1] - c[1], d[i + 2] - c[2]);

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * Fast background removal for near-uniform backgrounds (white studio shots, flat colors):
 * flood-fill inward from the image border through pixels close to the border's median
 * color, make them transparent, and feather the boundary ring. Enclosed regions of the
 * same color (e.g. the whites of eyes) are untouched because the fill can't reach them.
 * Mutates `data`; returns false (and leaves it alone) when the border isn't uniform.
 */
export function removeUniformBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opts: BgOptions = {},
): boolean {
  const { tolerance: tol = 32, uniformity = 0.8 } = opts;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const opaque = border.filter((p) => data[p * 4 + 3] >= 250);
  if (opaque.length < border.length * 0.5) return false; // already cut out
  const bg: RGB = [0, 1, 2].map((ch) => median(opaque.map((p) => data[p * 4 + ch]))) as RGB;
  const matching = opaque.filter((p) => dist(data, p * 4, bg) <= tol).length;
  if (matching < opaque.length * uniformity) return false;

  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const p of opaque) {
    if (!isBg[p] && dist(data, p * 4, bg) <= tol) {
      isBg[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    const visit = (q: number) => {
      if (!isBg[q] && dist(data, q * 4, bg) <= tol) {
        isBg[q] = 1;
        queue[tail++] = q;
      }
    };
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }
  if (!tail) return false;

  // Feather: pixels touching the background fade by how much of the background they contain.
  const fade = new Float32Array(w * h).fill(1);
  for (let p = 0; p < w * h; p++) {
    if (isBg[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    let touches = false;
    for (let dy = -1; dy <= 1 && !touches; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && isBg[ny * w + nx]) {
          touches = true;
          break;
        }
      }
    }
    if (touches) fade[p] = Math.min(1, Math.max(0, (dist(data, p * 4, bg) - tol) / (tol * 2)));
  }
  for (let p = 0; p < w * h; p++) {
    data[p * 4 + 3] = isBg[p] ? 0 : Math.round(data[p * 4 + 3] * fade[p]);
  }
  return true;
}
