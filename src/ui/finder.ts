import { DEFAULT_TINT, type RGB } from '../color/util';
import { downscale } from '../export/resample';
import { renderAppIcon } from '../render/appicon';
import { classic } from '../render/presets/classic';
import type { State } from '../state/store';
import { h } from './controls';

const FOLDERS = ['Documents', 'Downloads', 'Projects', 'Music', 'Photos'];
const APPS: [string, RGB, RGB][] = [
  ['Notes', [255, 214, 92], [246, 178, 40]],
  ['Mail', [96, 180, 255], [24, 112, 240]],
  ['Studio', [255, 120, 110], [222, 52, 76]],
  ['Weather', [120, 200, 255], [60, 120, 230]],
  ['Terminal', [70, 70, 76], [24, 24, 28]],
];

let genericFolder: HTMLCanvasElement | null = null;
const genericApps = new Map<string, HTMLCanvasElement>();

function neighbour(mode: State['mode'], i: number): { name: string; icon: HTMLCanvasElement } {
  if (mode === 'folder') {
    genericFolder ??= classic.render(null, null, {
      tint: DEFAULT_TINT,
      merge: { key: DEFAULT_TINT, tolerance: 0, trim: 0, interiorOnly: false },
      glow: 0,
      glowColor: null,
      scale: 1,
      x: 0,
      y: 0,
      emblemMode: 'color',
      paperStrip: true,
      opaque: false,
    });
    return { name: FOLDERS[i % FOLDERS.length], icon: genericFolder };
  }
  const [name, bg1, bg2] = APPS[i % APPS.length];
  let icon = genericApps.get(name);
  if (!icon) {
    icon = renderAppIcon(null, {
      fill: 'glyph',
      background: 'gradient',
      bg1,
      bg2,
      merge: { key: bg1, tolerance: 0, trim: 0, interiorOnly: false },
      emblemMode: 'color',
      scale: 1,
      x: 0,
      y: 0,
      rotation: 0,
      padding: 0.1,
      gloss: false,
      shadow: 0.6,
      opaque: false,
    });
    genericApps.set(name, icon);
  }
  return { name, icon };
}

/** A mock Finder window showing the icon among generic neighbours, light or dark. */
export function mountFinder(root: HTMLElement) {
  let theme: 'light' | 'dark' = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  let size = 80;
  const grid = h('div', { class: 'finder-grid' });
  const title = h('span', { class: 'finder-title' });
  const themeBtns = (['light', 'dark'] as const).map((t) => {
    const b = h('button', { type: 'button', textContent: t === 'light' ? 'Light' : 'Dark' });
    b.addEventListener('click', () => {
      theme = t;
      paint();
    });
    return [t, b] as const;
  });
  const sizeInput = h('input', {
    type: 'range',
    min: '32',
    max: '128',
    step: '8',
    value: `${size}`,
  });
  sizeInput.setAttribute('aria-label', 'Icon size');
  sizeInput.addEventListener('input', () => {
    size = +sizeInput.value;
    paint();
  });
  const win = h(
    'div',
    { class: 'finder-window' },
    h(
      'div',
      { class: 'finder-bar' },
      h('span', { class: 'lights' }, h('i'), h('i'), h('i')),
      title,
    ),
    h(
      'div',
      { class: 'finder-body' },
      h(
        'nav',
        { class: 'finder-side' },
        h('b', {}, 'Favorites'),
        ...['Recents', 'Applications', 'Desktop', 'Documents', 'Downloads'].map((n) =>
          h('span', {}, n),
        ),
      ),
      grid,
    ),
  );
  const seg = h('div', { class: 'segmented' }, ...themeBtns.map(([, b]) => b));
  root.append(
    h(
      'div',
      { class: 'finder-tools' },
      seg,
      h('label', { class: 'finder-size' }, 'Icon size', sizeInput),
    ),
    win,
  );

  let last: { master: HTMLCanvasElement; s: State } | null = null;
  const icon = (src: HTMLCanvasElement) => {
    const c = h('canvas');
    const px = Math.round(size * devicePixelRatio);
    c.width = c.height = px;
    c.style.width = c.style.height = `${size}px`;
    c.getContext('2d')!.drawImage(downscale(src, px), 0, 0);
    return c;
  };
  function paint() {
    win.dataset.theme = theme;
    themeBtns.forEach(([t, b]) => b.setAttribute('aria-pressed', `${t === theme}`));
    if (!last) return;
    const { master, s } = last;
    title.textContent = s.mode === 'folder' ? 'Documents' : 'Applications';
    const name = s.source?.name ?? (s.mode === 'folder' ? 'My Folder' : 'My App');
    const items = [0, 1, 2].map((i) => neighbour(s.mode, i));
    const mine = { name, icon: master };
    const all = [items[0], items[1], mine, items[2], neighbour(s.mode, 3), neighbour(s.mode, 4)];
    grid.style.setProperty('--icon', `${size}px`);
    grid.replaceChildren(
      ...all.map((it) =>
        h(
          'figure',
          { class: it === mine ? 'finder-item selected' : 'finder-item' },
          h('div', { class: 'finder-icon' }, icon(it.icon)),
          h('figcaption', {}, it.name),
        ),
      ),
    );
  }
  paint();
  return (master: HTMLCanvasElement, s: State) => {
    last = { master, s };
    if (root.offsetParent) paint();
  };
}
