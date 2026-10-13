import { chroma, type RGB } from './util';

export interface Palette {
  /** The most prominent vivid color: population weighted toward chroma. */
  dominant: RGB;
  /** Up to four further colors, by population. */
  accents: RGB[];
  /** All cluster centroids sorted by population (dominant may be anywhere in here). */
  swatches: RGB[];
}

export interface PaletteOptions {
  k?: number;
  seed?: number;
  iterations?: number;
  /** Clusters closer than this (RGB distance) merge — removes antialiasing in-betweens. */
  mergeDistance?: number;
}

/** Deterministic PRNG so the same image always yields the same palette. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const isNearWhite = (c: RGB) => c[0] > 235 && c[1] > 235 && c[2] > 235;
const isNearBlack = (c: RGB) => c[0] < 20 && c[1] < 20 && c[2] < 20;

/**
 * k-means (k-means++ seeding) over RGBA pixel data, ideally from a small downsample.
 * Transparent pixels are always ignored; near-white and near-black ones are ignored unless
 * they make up practically the whole image. Returns null when there are no opaque pixels.
 */
export function extractPalette(data: Uint8ClampedArray, opts: PaletteOptions = {}): Palette | null {
  const { k = 6, seed = 1, iterations = 12, mergeDistance = 48 } = opts;
  const opaque: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 128) opaque.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!opaque.length) return null;
  const colorful = opaque.filter((c) => !isNearWhite(c) && !isNearBlack(c));
  const pixels = colorful.length >= Math.max(16, opaque.length * 0.02) ? colorful : opaque;

  const rand = mulberry32(seed);
  const centroids: RGB[] = [pixels[Math.floor(rand() * pixels.length)]];
  const d = new Float64Array(pixels.length);
  while (centroids.length < k) {
    let sum = 0;
    for (let i = 0; i < pixels.length; i++) {
      d[i] = Math.min(...centroids.map((c) => dist2(pixels[i], c)));
      sum += d[i];
    }
    if (sum === 0) break; // fewer distinct colors than k
    let target = rand() * sum;
    let idx = 0;
    while (idx < pixels.length - 1 && (target -= d[idx]) > 0) idx++;
    centroids.push([...pixels[idx]]);
  }

  const assign = new Int32Array(pixels.length);
  const counts = new Array<number>(centroids.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    const sums = centroids.map(() => [0, 0, 0]);
    counts.fill(0);
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dd = dist2(pixels[i], centroids[c]);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      assign[i] = best;
      counts[best]++;
      sums[best][0] += pixels[i][0];
      sums[best][1] += pixels[i][1];
      sums[best][2] += pixels[i][2];
    }
    for (let c = 0; c < centroids.length; c++) {
      if (counts[c]) centroids[c] = sums[c].map((v) => v / counts[c]) as RGB;
    }
  }

  const sorted = centroids
    .map((c, i) => ({ color: c.map(Math.round) as RGB, count: counts[i] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  // Fold each smaller cluster into a larger one it's visually indistinct from.
  const clusters: typeof sorted = [];
  for (const c of sorted) {
    const into = clusters.find((m) => dist2(m.color, c.color) < mergeDistance ** 2);
    if (into) into.count += c.count;
    else clusters.push({ ...c });
  }
  clusters.sort((a, b) => b.count - a.count);
  const total = pixels.length;
  // Slivers (edge blends, specks) aren't useful swatches.
  const kept = clusters.filter((c, i) => i < 2 || c.count / total >= 0.02);
  clusters.length = 0;
  clusters.push(...kept);
  const score = (c: (typeof clusters)[number]) => (c.count / total) * (0.25 + chroma(c.color));
  const dominant = clusters.reduce((a, b) => (score(b) > score(a) ? b : a)).color;
  return {
    dominant,
    accents: clusters
      .map((c) => c.color)
      .filter((c) => c !== dominant)
      .slice(0, 4),
    swatches: clusters.map((c) => c.color),
  };
}
