import './styles.css';
import { hexToRgb } from './color/util';
import { copyPng, download, pngAt } from './export/png';
import { ACCEPT_ATTR, loadImage, UnsupportedImageError } from './input/load';
import { renderMaster, resolveTint } from './render/compositor';
import { PRESET_LIST } from './render/presets';
import { createStore, type EmblemMode, type PresetId } from './state/store';
import { renderControls, type Section } from './ui/controls';
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
  toastTimer = window.setTimeout(() => (t.hidden = true), 3600);
}

async function ingest(file: File | null | undefined) {
  if (!file) return;
  try {
    const { source, palette } = await loadImage(file);
    store.update((s) => {
      s.source = source;
      s.palette = palette;
      s.folder.emblemX = s.folder.emblemY = 0;
    });
  } catch (e) {
    toast(
      e instanceof UnsupportedImageError ? e.message : 'Something went wrong reading that image.',
      'error',
    );
    if (!(e instanceof UnsupportedImageError)) console.error(e);
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
store.subscribe((s) => {
  master = renderMaster(s);
  showPreview(master);
  stageEl.classList.toggle('has-image', !!s.source);
  $('#source-name').textContent = s.source ? s.source.name : '';
});

const filename = (size: number) => `${store.get().source?.name ?? 'folder'}-folder-${size}.png`;

const sections: Section[] = [
  {
    title: 'Style',
    controls: [
      {
        kind: 'select',
        label: 'Preset',
        options: PRESET_LIST.map((p) => [p.id, p.label]),
        get: (s) => s.folder.preset,
        set: (s, v) => void (s.folder.preset = v as PresetId),
      },
      {
        kind: 'toggle',
        label: 'Paper strip',
        get: (s) => s.folder.paperStrip,
        set: (s, v) => void (s.folder.paperStrip = v),
      },
    ],
  },
  {
    title: 'Color',
    controls: [
      {
        kind: 'color',
        label: 'Folder tint',
        get: resolveTint,
        set: (s, v) => void (s.folder.tint = hexToRgb(v)),
        auto: { get: (s) => s.folder.tint === null, set: (s) => void (s.folder.tint = null) },
      },
      {
        kind: 'swatches',
        label: 'From image',
        get: (s) => s.palette?.swatches ?? [],
        active: resolveTint,
        set: (s, c) => void (s.folder.tint = c),
      },
    ],
  },
  {
    title: 'Emblem',
    visible: (s) => !!s.source,
    controls: [
      {
        kind: 'segmented',
        label: 'Render as',
        options: [
          ['color', 'Full color'],
          ['mono', 'Monochrome'],
        ],
        get: (s) => s.folder.emblemMode,
        set: (s, v) => void (s.folder.emblemMode = v as EmblemMode),
      },
      {
        kind: 'slider',
        label: 'Scale',
        min: 0.3,
        max: 1.6,
        step: 0.01,
        get: (s) => s.folder.emblemScale,
        set: (s, v) => void (s.folder.emblemScale = v),
      },
      {
        kind: 'slider',
        label: 'Horizontal offset',
        min: -0.5,
        max: 0.5,
        step: 0.005,
        get: (s) => s.folder.emblemX,
        set: (s, v) => void (s.folder.emblemX = v),
      },
      {
        kind: 'slider',
        label: 'Vertical offset',
        min: -0.5,
        max: 0.5,
        step: 0.005,
        get: (s) => s.folder.emblemY,
        set: (s, v) => void (s.folder.emblemY = v),
      },
      {
        kind: 'buttons',
        label: '',
        buttons: [
          {
            label: 'Reset position',
            run: () =>
              store.update((s) => {
                s.folder.emblemX = s.folder.emblemY = 0;
                s.folder.emblemScale = 1;
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
            primary: true,
            run: async () => {
              const size = store.get().exportSize;
              download(await pngAt(master, size), filename(size));
            },
          },
          {
            label: 'Copy PNG',
            run: async () => {
              try {
                await copyPng(pngAt(master, 1024));
                toast('Copied. In Finder: Get Info → click the icon → ⌘V');
              } catch {
                toast('Clipboard access was blocked by the browser.', 'error');
              }
            },
          },
        ],
      },
    ],
  },
];
renderControls($('#controls'), sections, store);
