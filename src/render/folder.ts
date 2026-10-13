import { cornerPoints, dedupe, pointsToPath, squirclePath, type Pt } from './squircle';

/**
 * Original folder geometry on a 1024 canvas: a back panel with a tab on the left, an
 * optional paper sheet, and a front panel. Proportions approximate a modern macOS folder
 * silhouette; nothing here is traced from Apple artwork.
 */
export interface FolderGeometry {
  left: number;
  right: number;
  tabTop: number;
  tabRight: number;
  /** Horizontal run of the S-curve from the tab down to the back panel's top edge. */
  tabSlope: number;
  backTop: number;
  frontTop: number;
  bottom: number;
  radius: number;
  /** Superellipse exponent for every corner. */
  n: number;
}

export const FOLDER: FolderGeometry = {
  left: 84,
  right: 940,
  tabTop: 150,
  tabRight: 392,
  tabSlope: 64,
  backTop: 200,
  frontTop: 262,
  bottom: 872,
  radius: 46,
  n: 4,
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, segs: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    pts.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
  return pts;
}

export function backPanelPoints(g: FolderGeometry = FOLDER): Pt[] {
  const { left: L, right: R, tabTop, tabRight, tabSlope: s, backTop, bottom, n } = g;
  const r = Math.min(g.radius, (backTop - tabTop) * 1.2);
  const segs = 24;
  const half = s / 2;
  return dedupe([
    ...cornerPoints(L + r, tabTop + r, r, Math.PI, n, segs), // tab top-left
    ...cubic(
      [tabRight - half, tabTop],
      [tabRight - half * 0.1, tabTop],
      [tabRight + half * 0.1, backTop],
      [tabRight + half, backTop],
      segs,
    ),
    ...cornerPoints(R - g.radius, backTop + g.radius, g.radius, -Math.PI / 2, n, segs),
    ...cornerPoints(R - g.radius, bottom - g.radius, g.radius, 0, n, segs),
    ...cornerPoints(L + g.radius, bottom - g.radius, g.radius, Math.PI / 2, n, segs),
  ]);
}

export const backPanelPath = (g: FolderGeometry = FOLDER) => pointsToPath(backPanelPoints(g));

export function frontRect(g: FolderGeometry = FOLDER): Rect {
  return { x: g.left, y: g.frontTop, w: g.right - g.left, h: g.bottom - g.frontTop };
}

export function frontPanelPath(g: FolderGeometry = FOLDER): string {
  const f = frontRect(g);
  return squirclePath(f.x, f.y, f.w, f.h, g.radius, g.n);
}

/** Paper sheet tucked between the panels; its top peeks out above the front panel. */
export function paperRect(g: FolderGeometry = FOLDER): Rect {
  const inset = 30;
  const top = g.backTop + 22;
  return { x: g.left + inset, y: top, w: g.right - g.left - inset * 2, h: g.frontTop - top + 80 };
}

export const paperPath = (g: FolderGeometry = FOLDER) => {
  const p = paperRect(g);
  return squirclePath(p.x, p.y, p.w, p.h, 18, g.n);
};
