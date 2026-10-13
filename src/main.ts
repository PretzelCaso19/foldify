import './styles.css';
import { hexToRgb, type RGB } from './color/util';
import { copyPng, download, pngAt } from './export/png';
import { icnsBlob, iconsetBlob } from './export/sizes';
import { removeBackgroundAI } from './input/aibg';
import { ACCEPT_ATTR, loadImage, UnsupportedImageError } from './input/load';
import { renderMaster, resolveAppBg, resolveKey, resolveTint } from './render/compositor';
import {
  activePalette,
  createStore,
  isOpaque,
  placement,
  type AppBackground,
  type AppFill,
  type BgMode,
  type EmblemMode,
  type Mode,
  type State,
} from './state/store';
import { h, renderControls, type Section } from './ui/controls';
import { mountFinder } from './ui/finder';
import { presetTiles } from './ui/presetTiles';
import { mountPreview } from './ui/preview';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const store = createStore();
const stageEl = $<HTMLElement>('#stage');
const fileInput = $<HTMLInputElement>('#file');
fileInput.accept = ACCEPT_ATTR;

let toastTimer = 0;
function toast(msg: string, kind: 'info' | 'error' = 'info') {
  const t = $<HTMLElement>('#toast');
  t.textContent = msg;
  t.dataset.kind = kind;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 4000);
}

async function ingest(file: File | null | undefined) {
  if (!file) return;
  try {
    const source = await loadImage(file);
    store.update((s) => {
      s.source = source;
      s.bg = 'fast';
      s.aiStatus = 'idle';
      s.merge.key = s.folder.tint = s.app.bg1 = s.app.bg2 = null;
      for (const p of [s.folder, s.app]) p.x = p.y = 0;
      s.folder.scale = s.app.scale = 1;
      s.app.rotation = 0;
    });
  } catch (e) {
    toast(
      e instanceof UnsupportedImageError ? e.message : 'Something went wrong reading that image.',
      'error',
    );
    if (!(e instanceof UnsupportedImageError)) console.error(e);
  }
}

async function setBackground(mode: BgMode) {
  const s = store.get();
  if (mode !== 'ai' || s.source?.ai) return store.update((st) => void (st.bg = mode));
  const src = s.source;
  if (!src || s.aiStatus === 'loading') return;
  store.update((st) => {
    st.aiStatus = 'loading';
    st.aiProgress = 0;
  });
  try {
    const ai = await removeBackgroundAI(src.original.img, (f) =>
      store.update((st) => void (st.aiProgress = f)),
    );
    store.update((st) => {
      if (st.source !== src) return; // a different image was loaded meanwhile
      src.ai = ai;
      st.bg = 'ai';
      st.aiStatus = 'idle';
      st.merge.key = null;
    });
  } catch (e) {
    console.error(e);
    store.update((st) => void (st.aiStatus = 'error'));
    toast('AI background removal failed to load. Check your connection and try again.', 'error');
  }
}

// Input: picker, drag-and-drop anywhere, ⌘V.
document
  .querySelectorAll('[data-pick]')
  .forEach((b) => b.addEventListener('click', () => fileInput.click()));
fileInput.addEventListener('change', () => {
  void ingest(fileInput.files?.[0]);
  fileInput.value = '';
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  stageEl.classList.add('drop-over');
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) stageEl.classList.remove('drop-over');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  stageEl.classList.remove('drop-over');
  void ingest(e.dataTransfer?.files[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === 'file');
  if (item) {
    e.preventDefault();
    void ingest(item.getAsFile());
  }
});

// Rendering: master is a pure function of state; everything else reads from it.
let master = renderMaster(store.get());
const showPreview = mountPreview($<HTMLCanvasElement>('#preview'), $('#strip'), store);
const showFinder = mountFinder($('#finder-view'));

// Toolbar: mode + view.
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
modeBtns.forEach((b) =>
  b.addEventListener('click', () => store.update((s) => void (s.mode = b.dataset.mode as Mode))),
);
type View = 'editor' | 'finder';
const viewBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
let view: View = 'editor';
function showView(v: View) {
  view = v;
  viewBtns.forEach((b) => b.setAttribute('aria-pressed', `${b.dataset.view === v}`));
  $('#editor-view').hidden = v !== 'editor';
  $('#finder-view').hidden = v !== 'finder';
  if (v === 'finder') showFinder(master, store.get());
  else showPreview(master);
}
viewBtns.forEach((b) => b.addEventListener('click', () => showView(b.dataset.view as View)));

store.subscribe((s) => {
  master = renderMaster(s);
  if (view === 'editor') showPreview(master);
  else showFinder(master, s);
  stageEl.classList.toggle('has-image', !!s.source);
  $('#source-name').textContent = s.source ? s.source.name : '';
  modeBtns.forEach((b) => b.setAttribute('aria-pressed', `${b.dataset.mode === s.mode}`));
});
showView('editor');

// Export + how-to.
const baseName = () => {
  const s = store.get();
  const stem = s.source?.name ?? (s.mode === 'app' ? 'app' : 'folder');
  return `${stem}-${s.mode === 'app' ? 'icon' : 'folder'}`;
};
const howto = $<HTMLDialogElement>('#howto');
function openHowto() {
  $('#howto-cli').textContent = `fileicon set ~/path/to/target ~/Downloads/${baseName()}.icns`;
  if (!howto.open) howto.showModal();
}
async function exporting(label: string, run: () => Promise<void>) {
  try {
    await run();
    openHowto();
  } catch (e) {
    console.error(e);
    toast(`Couldn't export ${label}.`, 'error');
  }
}
async function copy() {
  try {
    await copyPng(pngAt(master, 1024));
    toast('Copied. In Finder: Get Info → click the icon → ⌘V');
  } catch {
    toast('The browser blocked clipboard access. Download the PNG instead.', 'error');
  }
}
$('#howto-copy').addEventListener('click', copy);
$('#howto-close').addEventListener('click', () => howto.close());
howto.addEventListener('click', (e) => e.target === howto && howto.close());
$('#howto-cli-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#howto-cli').textContent ?? '');
  toast('Command copied');
});

// Sidebar.
const isFolder = (s: State) => s.mode === 'folder';
const isApp = (s: State) => s.mode === 'app';
/** Is the body-color merge in play right now? */
const merging = (s: State) =>
  !!s.source &&
  !isOpaque(s) &&
  (isFolder(s) ? s.folder.preset === 'seamless' : s.app.fill === 'merge');
/** Does the current style place the artwork as a separate emblem/glyph? */
const placesArtwork = (s: State) => {
  if (isFolder(s)) {
    const p = s.folder.preset;
    return !['sticker', 'fullbleed', 'engraved'].includes(p) && !(p === 'seamless' && isOpaque(s));
  }
  return s.app.fill !== 'bleed' && !(s.app.fill === 'merge' && isOpaque(s));
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

function bgNote(s: State): string {
  if (!s.source) return '';
  if (s.aiStatus === 'loading')
    return s.aiProgress < 1
      ? `Downloading the on-device model (first time only)… ${Math.round(s.aiProgress * 100)}%`
      : 'Cutting out your image on this device…';
  if (s.aiStatus === 'error') return 'AI removal failed — check your connection.';
  if (s.bg === 'ai') return 'Cut out on this device — your image was not uploaded.';
  if (s.bg === 'fast' && !s.source.cutout)
    return s.source.hasAlpha
      ? 'Already transparent.'
      : 'No plain background found. Try AI remove for photos.';
  return '';
}
const noteText = h('span');
const noteBar = h('progress', { max: 1 });
const noteEl = h('div', { class: 'row row-stack hint bg-note' }, noteText, noteBar);

const tiles = presetTiles(store);
const sections: Section[] = [
  {
    title: 'Folder style',
    visible: isFolder,
    controls: [
      { kind: 'custom', label: '', el: tiles.el, sync: tiles.sync },
      {
        kind: 'toggle',
        label: 'Paper strip',
        get: (s) => s.folder.paperStrip,
        set: (s, v) => void (s.folder.paperStrip = v),
      },
      {
        kind: 'slider',
        label: 'Glow',
        visible: (s) => s.folder.preset !== 'flat',
        min: 0,
        max: 1,
        step: 0.01,
        get: (s) => s.folder.glow,
        set: (s, v) => void (s.folder.glow = v),
      },
      {
        kind: 'color',
        label: 'Glow color',
        visible: (s) =>
          s.folder.preset !== 'flat' && (s.folder.glow > 0 || s.folder.preset === 'neon'),
        get: (s) => s.folder.glowColor ?? resolveTint(s),
        set: (s, v) => void (s.folder.glowColor = hexToRgb(v)),
        auto: {
          get: (s) => s.folder.glowColor === null,
          set: (s) => void (s.folder.glowColor = null),
        },
      },
    ],
  },
  {
    title: 'App icon style',
    visible: isApp,
    controls: [
      {
        kind: 'segmented',
        label: 'Fill',
        options: [
          ['merge', 'Merge'],
          ['glyph', 'Glyph'],
          ['bleed', 'Full-bleed'],
        ],
        get: (s) => s.app.fill,
        set: (s, v) => {
          s.app.fill = v as AppFill;
          s.app.bg1 = s.app.bg2 = null;
        },
      },
      {
        kind: 'segmented',
        label: 'Background',
        visible: (s) => s.app.fill === 'glyph',
        options: [
          ['solid', 'Solid'],
          ['gradient', 'Gradient'],
          ['blur', 'Blurred'],
        ],
        get: (s) => s.app.background,
        set: (s, v) => void (s.app.background = v as AppBackground),
      },
      {
        kind: 'color',
        label: 'Background color',
        visible: (s) =>
          s.app.fill !== 'bleed' && !(s.app.fill === 'glyph' && s.app.background === 'blur'),
        get: (s) => resolveAppBg(s)[0],
        set: (s, v) => {
          s.app.bg1 = hexToRgb(v);
          if (s.app.fill === 'merge') s.app.bg2 = s.app.bg1;
        },
        auto: {
          get: (s) => s.app.bg1 === null,
          set: (s) => void (s.app.bg1 = s.app.bg2 = null),
        },
      },
      {
        kind: 'color',
        label: 'Gradient end',
        visible: (s) => s.app.fill === 'glyph' && s.app.background === 'gradient',
        get: (s) => resolveAppBg(s)[1],
        set: (s, v) => void (s.app.bg2 = hexToRgb(v)),
      },
      {
        kind: 'toggle',
        label: 'Gloss highlight',
        get: (s) => s.app.gloss,
        set: (s, v) => void (s.app.gloss = v),
      },
      {
        kind: 'slider',
        label: 'Shadow',
        min: 0,
        max: 1,
        step: 0.01,
        get: (s) => s.app.shadow,
        set: (s, v) => void (s.app.shadow = v),
      },
    ],
  },
  {
    title: 'Image',
    visible: (s) => !!s.source,
    controls: [
      {
        kind: 'segmented',
        label: 'Background',
        options: [
          ['off', 'Keep'],
          ['fast', 'Remove'],
          ['ai', 'AI remove'],
        ],
        get: (s) => (s.aiStatus === 'loading' ? 'ai' : s.bg),
        set: (_s, v) => void setBackground(v as BgMode),
      },
      {
        kind: 'custom',
        label: '',
        el: noteEl,
        visible: (s) => !!bgNote(s),
        sync: (s) => {
          noteText.textContent = bgNote(s);
          noteBar.hidden = s.aiStatus !== 'loading';
          noteBar.value = s.aiProgress;
        },
      },
      {
        kind: 'swatches',
        label: 'Main color',
        get: (s) => activePalette(s)?.swatches ?? [],
        active: resolveKey,
        set: (s, c: RGB) => {
          s.merge.key = c;
          s.folder.tint = s.app.bg1 = s.app.bg2 = null;
        },
      },
      {
        kind: 'slider',
        label: 'Merge strength',
        visible: merging,
        min: 0,
        max: 200,
        step: 1,
        format: (v) => (v ? `${Math.round(v / 2)}%` : 'Off'),
        get: (s) => s.merge.tolerance,
        set: (s, v) => void (s.merge.tolerance = v),
      },
      {
        kind: 'slider',
        label: 'Trim outline',
        visible: merging,
        min: 0,
        max: 0.04,
        step: 0.001,
        format: (v) => (v ? `${(v * 100).toFixed(1)}%` : 'Off'),
        get: (s) => s.merge.trim,
        set: (s, v) => void (s.merge.trim = v),
      },
      {
        kind: 'toggle',
        label: 'Inner features only',
        visible: (s) => merging(s) && s.merge.tolerance > 0,
        get: (s) => s.merge.interiorOnly,
        set: (s, v) => void (s.merge.interiorOnly = v),
      },
    ],
  },
  {
    title: 'Color',
    visible: isFolder,
    controls: [
      {
        kind: 'color',
        label: 'Folder color',
        get: resolveTint,
        set: (s, v) => void (s.folder.tint = hexToRgb(v)),
        auto: { get: (s) => s.folder.tint === null, set: (s) => void (s.folder.tint = null) },
      },
    ],
  },
  {
    title: 'Placement',
    visible: (s) => !!s.source,
    controls: [
      {
        kind: 'segmented',
        label: 'Render as',
        visible: placesArtwork,
        options: [
          ['color', 'Full color'],
          ['mono', 'Mono'],
          ['engraved', 'Engraved'],
        ],
        get: (s) => s.emblemMode,
        set: (s, v) => void (s.emblemMode = v as EmblemMode),
      },
      {
        kind: 'slider',
        label: 'Scale',
        min: 0.3,
        max: 3,
        step: 0.01,
        get: (s) => placement(s).scale,
        set: (s, v) => void (placement(s).scale = v),
      },
      {
        kind: 'slider',
        label: 'Horizontal offset',
        min: -0.6,
        max: 0.6,
        step: 0.005,
        format: pct,
        get: (s) => placement(s).x,
        set: (s, v) => void (placement(s).x = v),
      },
      {
        kind: 'slider',
        label: 'Vertical offset',
        min: -0.6,
        max: 0.6,
        step: 0.005,
        format: pct,
        get: (s) => placement(s).y,
        set: (s, v) => void (placement(s).y = v),
      },
      {
        kind: 'slider',
        label: 'Rotation',
        visible: isApp,
        min: -180,
        max: 180,
        step: 1,
        format: (v) => `${v}°`,
        get: (s) => s.app.rotation,
        set: (s, v) => void (s.app.rotation = v),
      },
      {
        kind: 'slider',
        label: 'Padding',
        visible: (s) => isApp(s) && placesArtwork(s),
        min: 0,
        max: 0.35,
        step: 0.005,
        format: pct,
        get: (s) => s.app.padding,
        set: (s, v) => void (s.app.padding = v),
      },
      {
        kind: 'buttons',
        label: '',
        buttons: [
          {
            label: 'Reset placement',
            run: () =>
              store.update((s) => {
                const p = placement(s);
                p.x = p.y = 0;
                p.scale = 1;
                s.app.rotation = 0;
              }),
          },
        ],
      },
    ],
  },
  {
    title: 'Export',
    controls: [
      {
        kind: 'buttons',
        label: '',
        buttons: [
          {
            label: 'Download .icns',
            primary: true,
            run: () =>
              exporting('.icns', async () =>
                download(await icnsBlob(master), `${baseName()}.icns`),
              ),
          },
          {
            label: '.iconset (zip)',
            run: () =>
              exporting('the iconset', async () =>
                download(await iconsetBlob(master, baseName()), `${baseName()}.iconset.zip`),
              ),
          },
        ],
      },
      {
        kind: 'select',
        label: 'PNG size',
        options: [1024, 512, 256, 128, 64, 32, 16].map((n) => [`${n}`, `${n} × ${n}`]),
        get: (s) => `${s.exportSize}`,
        set: (s, v) => void (s.exportSize = +v),
      },
      {
        kind: 'buttons',
        label: '',
        buttons: [
          {
            label: 'Download PNG',
            run: () =>
              exporting('the PNG', async () => {
                const size = store.get().exportSize;
                download(await pngAt(master, size), `${baseName()}-${size}.png`);
              }),
          },
          { label: 'Copy PNG', run: copy },
          { label: 'How to apply', run: openHowto },
        ],
      },
    ],
  },
];
renderControls($('#controls'), sections, store);
