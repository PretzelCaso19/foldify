export type Pt = [number, number];

/** sign(v) * |v|^e — the superellipse parametrisation term. */
const spow = (v: number, e: number) => (Math.abs(v) < 1e-12 ? 0 : Math.sign(v) * Math.abs(v) ** e);

/**
 * Points for one superellipse corner quadrant (|x|^n + |y|^n = 1) of radius r around
 * (cx, cy), sweeping a quarter turn from `start` (radians, canvas y-down, clockwise).
 * For n > 2 curvature falls to zero where the quadrant meets the axes, so the corner
 * joins straight edges with continuous curvature, unlike a circular arc.
 */
export function cornerPoints(
  cx: number,
  cy: number,
  r: number,
  start: number,
  n: number,
  segs: number,
): Pt[] {
  const e = 2 / n;
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = start + (i / segs) * (Math.PI / 2);
    pts.push([cx + r * spow(Math.cos(t), e), cy + r * spow(Math.sin(t), e)]);
  }
  return pts;
}

/**
 * Outline of a rectangle with continuous-curvature (superellipse) corners, clockwise from
 * the top edge. r is clamped to half the shorter side; r = min(w, h) / 2 on a square gives a
 * full superellipse.
 */
export function continuousRectPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  n = 5,
  segs = 32,
): Pt[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const corners: [number, number, number][] = [
    [x + w - rr, y + rr, -Math.PI / 2], // top-right
    [x + w - rr, y + h - rr, 0], // bottom-right
    [x + rr, y + h - rr, Math.PI / 2], // bottom-left
    [x + rr, y + rr, Math.PI], // top-left
  ];
  return dedupe(corners.flatMap(([cx, cy, a]) => cornerPoints(cx, cy, rr, a, n, segs)));
}

/** Drop consecutive (near-)duplicate points, including a closing duplicate of the first. */
export function dedupe(pts: Pt[], eps = 1e-6): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(p[0] - q[0]) > eps || Math.abs(p[1] - q[1]) > eps) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.abs(first[0] - last[0]) <= eps && Math.abs(first[1] - last[1]) <= eps)
    out.pop();
  return out;
}

/** Closed SVG path data from a polyline. */
export function pointsToPath(pts: Pt[], digits = 2): string {
  if (!pts.length) return '';
  const f = (v: number) => +v.toFixed(digits);
  return `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`;
}

export const squirclePath = (x: number, y: number, w: number, h: number, r: number, n = 5) =>
  pointsToPath(continuousRectPoints(x, y, w, h, r, n));
