import { describe, expect, it } from 'vitest';
import { extractPalette } from '../src/color/palette';
import type { RGB } from '../src/color/util';

function image(parts: [RGB, number, number?][]): Uint8ClampedArray {
  const total = parts.reduce((s, [, n]) => s + n, 0);
  const out = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [c, n, a = 255] of parts) {
    for (let j = 0; j < n; j++, i += 4) out.set([...c, a], i);
  }
  return out;
}

const near = (a: RGB, b: RGB, tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe('extractPalette', () => {
  it('finds the distinct colors, sorted by population', () => {
    const p = extractPalette(
      image([
        [[220, 40, 40], 600],
        [[40, 90, 220], 300],
        [[40, 180, 80], 100],
      ]),
      { k: 3 },
    )!;
    expect(p.swatches).toHaveLength(3);
    expect(near(p.swatches[0], [220, 40, 40])).toBe(true);
    expect(near(p.swatches[1], [40, 90, 220])).toBe(true);
    expect(near(p.dominant, [220, 40, 40])).toBe(true);
  });

  it('ignores transparent, near-white and near-black pixels', () => {
    const p = extractPalette(
      image([
        [[255, 255, 255], 5000],
        [[0, 0, 0], 3000],
        [[10, 200, 10], 4000, 0], // fully transparent
        [[250, 160, 30], 200],
      ]),
    )!;
    expect(p.swatches.every((c) => near(c, [250, 160, 30]))).toBe(true);
    expect(near(p.dominant, [250, 160, 30])).toBe(true);
  });

  it('prefers a vivid color over a slightly larger grey one for dominant', () => {
    const p = extractPalette(
      image([
        [[128, 128, 128], 550],
        [[30, 120, 240], 450],
      ]),
      { k: 2 },
    )!;
    expect(near(p.swatches[0], [128, 128, 128])).toBe(true);
    expect(near(p.dominant, [30, 120, 240])).toBe(true);
    expect(p.accents.some((c) => near(c, [128, 128, 128]))).toBe(true);
  });

  it('falls back to white/black when that is all there is', () => {
    const p = extractPalette(image([[[255, 255, 255], 100]]))!;
    expect(near(p.dominant, [255, 255, 255])).toBe(true);
  });

  it('returns null for a fully transparent image and is deterministic', () => {
    expect(extractPalette(image([[[1, 2, 3], 50, 0]]))).toBeNull();
    const data = image([
      [[200, 30, 90], 300],
      [[20, 200, 190], 250],
      [[240, 220, 40], 120],
    ]);
    expect(extractPalette(data)).toEqual(extractPalette(data));
  });

  it('merges near-identical clusters such as antialiasing edges', () => {
    const p = extractPalette(
      image([
        [[255, 122, 26], 800],
        [[245, 128, 40], 60],
        [[107, 43, 217], 300],
        [[112, 50, 210], 40],
      ]),
      { k: 6 },
    )!;
    expect(p.swatches).toHaveLength(2);
  });
});
