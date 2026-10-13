import { describe, expect, it } from 'vitest';
import {
  continuousRectPoints,
  cornerPoints,
  pointsToPath,
  squirclePath,
} from '../src/render/squircle';
import { backPanelPoints, FOLDER, frontPanelPath } from '../src/render/folder';

describe('continuousRectPoints', () => {
  it('stays inside its bounding box and touches every edge', () => {
    const pts = continuousRectPoints(100, 100, 824, 824, 200, 5);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(100, 6);
    expect(Math.max(...xs)).toBeCloseTo(924, 6);
    expect(Math.min(...ys)).toBeCloseTo(100, 6);
    expect(Math.max(...ys)).toBeCloseTo(924, 6);
  });

  it('is point-symmetric about the centre', () => {
    const pts = continuousRectPoints(0, 0, 400, 300, 90, 5, 16);
    for (const [x, y] of pts) {
      const mirrored = pts.some(
        ([mx, my]) => Math.abs(mx - (400 - x)) < 1e-6 && Math.abs(my - (300 - y)) < 1e-6,
      );
      expect(mirrored).toBe(true);
    }
  });

  it('with r = half the side, traces a full superellipse |x|^n + |y|^n = 1', () => {
    const n = 5;
    for (const [x, y] of continuousRectPoints(-1, -1, 2, 2, 1, n)) {
      expect(Math.abs(x) ** n + Math.abs(y) ** n).toBeCloseTo(1, 6);
    }
  });

  it('with n = 2 the corners are circular arcs', () => {
    for (const [x, y] of cornerPoints(50, 50, 20, 0, 2, 12)) {
      expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(20, 6);
    }
  });

  it('meets the straight edges flatter than a circular arc (continuous curvature)', () => {
    // Deviation from the edge just inside the corner start: superellipse << circle.
    const t = 0.15;
    const devSuper = 1 - Math.cos(t) ** (2 / 5);
    const devCircle = 1 - Math.cos(t);
    const pts = cornerPoints(0, 0, 1, 0, 5, 1000);
    const near = pts.find(([, y]) => y > Math.sin(t) ** (2 / 5) - 1e-3)!;
    expect(1 - near[0]).toBeLessThan(devCircle);
    expect(devSuper).toBeLessThan(devCircle);
  });

  it('clamps an oversized radius and has no duplicate points', () => {
    const pts = continuousRectPoints(0, 0, 100, 40, 500);
    const keys = new Set(pts.map((p) => p.join(',')));
    expect(keys.size).toBe(pts.length);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(40, 6);
  });
});

describe('path output', () => {
  it('produces closed SVG path data', () => {
    const d = squirclePath(0, 0, 100, 100, 30);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(pointsToPath([])).toBe('');
  });

  it('folder panels stay within the 1024 canvas, tab above the back panel', () => {
    const back = backPanelPoints();
    expect(Math.min(...back.map((p) => p[1]))).toBeCloseTo(FOLDER.tabTop, 6);
    for (const [x, y] of back) {
      expect(x).toBeGreaterThanOrEqual(FOLDER.left - 1e-6);
      expect(x).toBeLessThanOrEqual(FOLDER.right + 1e-6);
      expect(y).toBeLessThanOrEqual(FOLDER.bottom + 1e-6);
    }
    // Right of the tab, nothing pokes above the back panel's top edge.
    const rightSide = back.filter(([x]) => x > FOLDER.tabRight + FOLDER.tabSlope / 2);
    expect(Math.min(...rightSide.map((p) => p[1]))).toBeGreaterThanOrEqual(FOLDER.backTop - 1e-6);
    expect(frontPanelPath()).toMatch(/^M.*Z$/);
  });
});
