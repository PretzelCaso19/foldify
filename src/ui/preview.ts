import { downscale } from '../export/resample';
import { ctx2d } from '../render/canvas';
import { frontRect } from '../render/folder';
import { MASTER } from '../render/presets/classic';
import type { Store } from '../state/store';
import { h } from './controls';

export const STRIP_SIZES = [512, 128, 64, 32, 16];
const STRIP_MAX = 176;

/** Paint `src` into a canvas sized to its CSS box at device resolution. */
function paint(canvas: HTMLCanvasElement, src: HTMLCanvasElement, cssSize: number) {
  const px = Math.round(cssSize * devicePixelRatio);
  if (canvas.width !== px) canvas.width = canvas.height = px;
  canvas.style.width = canvas.style.height = `${cssSize}px`;
  const ctx = ctx2d(canvas);
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(px < src.width / 1.5 ? downscale(src, px) : src, 0, 0, px, px);
}

export function mountPreview(stage: HTMLCanvasElement, strip: HTMLElement, store: Store) {
  const tiles = STRIP_SIZES.map((size) => {
    const c = h('canvas');
    c.setAttribute('aria-label', `${size} pixel preview`);
    strip.append(
      h(
        'figure',
        { class: 'strip-tile' },
        h('div', { class: 'strip-box' }, c),
        h('figcaption', {}, size > STRIP_MAX ? `${size} (scaled)` : `${size} px`),
      ),
    );
    return { size, c };
  });

  let last: HTMLCanvasElement | null = null;
  const draw = () => {
    if (!last) return;
    const wrap = stage.parentElement!;
    const pad = 48;
    paint(
      stage,
      last,
      Math.max(160, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight) - pad)),
    );
    // 512 won't fit the strip at 1:1, so it's scaled to the strip height; the rest are real size.
    for (const t of tiles) paint(t.c, last, Math.min(t.size, STRIP_MAX));
  };

  // Drag the emblem directly on the preview.
  let drag: { x: number; y: number; ex: number; ey: number } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!store.get().source) return;
    const f = store.get().folder;
    drag = { x: e.clientX, y: e.clientY, ex: f.emblemX, ey: f.emblemY };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const d = drag;
    const k = MASTER / stage.getBoundingClientRect().width;
    const fr = frontRect();
    const clampOff = (v: number) => Math.max(-0.5, Math.min(0.5, v));
    store.update((s) => {
      s.folder.emblemX = clampOff(d.ex + ((e.clientX - d.x) * k) / fr.w);
      s.folder.emblemY = clampOff(d.ey + ((e.clientY - d.y) * k) / fr.h);
    });
  });
  const end = () => {
    drag = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  new ResizeObserver(draw).observe(stage.parentElement!);
  return (master: HTMLCanvasElement) => {
    last = master;
    draw();
  };
}
