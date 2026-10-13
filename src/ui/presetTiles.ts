import { downscale } from '../export/resample';
import { renderFolder } from '../render/compositor';
import { PRESET_LIST } from '../render/presets';
import type { State, Store } from '../state/store';
import { h } from './controls';

const TILE = 72;

/**
 * Live thumbnails of every preset rendered from the current image. Re-rendering nine
 * 1024px masters is the expensive part, so it's debounced behind the editor preview.
 */
export function presetTiles(store: Store) {
  const tiles = PRESET_LIST.map((p) => {
    const c = h('canvas');
    c.width = c.height = TILE * 2;
    c.style.width = c.style.height = `${TILE}px`;
    const b = h('button', { type: 'button', class: 'tile' }, c, h('span', {}, p.label));
    b.addEventListener('click', () => store.update((s) => void (s.folder.preset = p.id)));
    return { id: p.id, b, c };
  });
  const el = h('div', { class: 'tiles', role: 'group' }, ...tiles.map((t) => t.b));
  el.setAttribute('aria-label', 'Folder style');

  let timer = 0;
  let lastKey = '';
  const draw = (s: State) => {
    for (const t of tiles) {
      const ctx = t.c.getContext('2d')!;
      ctx.clearRect(0, 0, t.c.width, t.c.height);
      ctx.drawImage(downscale(renderFolder(s, t.id), TILE * 2), 0, 0);
    }
  };
  return {
    el,
    sync(s: State) {
      tiles.forEach((t) => t.b.setAttribute('aria-pressed', `${s.folder.preset === t.id}`));
      // Everything except the chosen preset affects the tiles.
      const key = JSON.stringify(
        { ...s, folder: { ...s.folder, preset: 0 }, exportSize: 0 },
        (k, v) => (k === 'source' ? (v ? `${v.name}|${v.ai ? 1 : 0}` : null) : v),
      );
      if (key === lastKey) return;
      lastKey = key;
      clearTimeout(timer);
      timer = window.setTimeout(() => draw(s), 160);
    },
  };
}
