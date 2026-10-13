import { describe, expect, it } from 'vitest';
import { removeUniformBackground } from '../src/input/bgremove';
import { alphaBounds, distanceToEdge, keepInterior, keyOut, trimEdge } from '../src/render/merge';
import type { RGB } from '../src/color/util';

/** w×h RGBA image filled by fn(x, y) → [r, g, b, a?]. */
function img(w: number, h: number, fn: (x: number, y: number) => number[]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      d.set([r, g, b, a], (y * w + x) * 4);
    }
  return d;
}
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

const WHITE = [255, 255, 255];
const YELLOW: RGB = [255, 213, 31];
const BLACK = [20, 20, 20];

/** White background, yellow disc r=12 at (16,16), black "eye" r=3 inside, white "glint" inside the eye. */
const face = (x: number, y: number) => {
  const d = Math.hypot(x - 16, y - 16);
  if (Math.hypot(x - 13, y - 14) < 1.2) return WHITE; // enclosed white
  if (Math.hypot(x - 13, y - 14) < 3) return BLACK;
  return d < 12 ? [...YELLOW] : WHITE;
};

describe('removeUniformBackground', () => {
  it('clears the border-connected background but keeps enclosed same-colored pixels', () => {
    const d = img(32, 32, face);
    expect(removeUniformBackground(d, 32, 32)).toBe(true);
    expect(alpha(d, 32, 0, 0)).toBe(0);
    expect(alpha(d, 32, 31, 16)).toBe(0);
    expect(alpha(d, 32, 16, 16)).toBe(255); // body
    expect(alpha(d, 32, 13, 14)).toBe(255); // white glint enclosed by the eye
  });

  it('refuses non-uniform borders and already-transparent images', () => {
    const noisy = img(20, 20, (x, y) => [(x * 37) % 256, (y * 91) % 256, ((x + y) * 53) % 256]);
    expect(removeUniformBackground(noisy, 20, 20)).toBe(false);
    const cut = img(20, 20, () => [0, 0, 0, 0]);
    expect(removeUniformBackground(cut, 20, 20)).toBe(false);
  });
});

describe('keyOut', () => {
  it('removes the body color, keeps distant colors, ramps in between', () => {
    const d = new Uint8ClampedArray([...YELLOW, 255, ...BLACK, 255, 255, 165, 10, 255]);
    keyOut(d, YELLOW, 80);
    expect(d[3]).toBe(0);
    expect(d[7]).toBe(255);
    expect(d[11]).toBeGreaterThan(0);
    expect(d[11]).toBeLessThan(255);
  });
});

describe('distanceToEdge / trimEdge', () => {
  it('measures distance to transparency and the image border', () => {
    const d = img(9, 9, () => [255, 0, 0]);
    const D = distanceToEdge(d, 9, 9);
    expect(D[4 * 9 + 4]).toBeCloseTo(5, 5); // centre: 5 steps to outside the image
    expect(D[0]).toBe(1);
  });

  it('erases a band around the silhouette', () => {
    const d = img(32, 32, face);
    removeUniformBackground(d, 32, 32);
    trimEdge(d, 32, 32, 2);
    expect(alpha(d, 32, 16, 4)).toBe(0); // just inside the disc's edge
    expect(alpha(d, 32, 16, 16)).toBe(255);
  });
});

describe('keepInterior + alphaBounds', () => {
  it('keeps enclosed features and drops ones that reach the silhouette', () => {
    // Yellow disc with an inner eye and a black "ear tip" sticking out of the top.
    const w = 40;
    const d = img(w, w, (x, y) => {
      if (Math.hypot(x - 15, y - 20) < 3) return BLACK; // eye
      if (x >= 19 && x <= 21 && y >= 2 && y <= 8) return BLACK; // ear tip at the edge
      if (x >= 19 && x <= 21 && y < 10) return [...YELLOW];
      return Math.hypot(x - 20, y - 22) < 14 ? [...YELLOW] : [0, 0, 0, 0];
    });
    const D = distanceToEdge(d, w, w);
    keyOut(d, YELLOW, 80);
    keepInterior(d, w, w, D, 2);
    expect(alpha(d, w, 15, 20)).toBe(255);
    expect(alpha(d, w, 20, 3)).toBe(0);
    const b = alphaBounds(d, w, w)!;
    expect(b.x).toBeGreaterThanOrEqual(12);
    expect(b.x + b.w).toBeLessThanOrEqual(19);
  });

  it('alphaBounds is null for an empty image', () => {
    expect(
      alphaBounds(
        img(4, 4, () => [0, 0, 0, 0]),
        4,
        4,
      ),
    ).toBeNull();
  });
});
