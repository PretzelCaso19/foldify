import type { RGB } from '../color/util';
import { rgbToHex } from '../color/util';
import type { State, Store } from '../state/store';

/**
 * The sidebar is data: each control declares how to read and write state. One renderer
 * builds the DOM once and `sync` keeps it current, so dragging a slider never rebuilds it.
 */
type Get<T> = (s: State) => T;
type Set<T> = (s: State, v: T) => void;
interface Base {
  label: string;
  visible?: Get<boolean>;
}
export type Control =
  | (Base & {
      kind: 'slider';
      get: Get<number>;
      set: Set<number>;
      min: number;
      max: number;
      step: number;
      format?: (v: number) => string;
    })
  | (Base & { kind: 'toggle'; get: Get<boolean>; set: Set<boolean> })
  | (Base & { kind: 'segmented'; options: [string, string][]; get: Get<string>; set: Set<string> })
  | (Base & { kind: 'select'; options: [string, string][]; get: Get<string>; set: Set<string> })
  | (Base & {
      kind: 'color';
      get: Get<RGB>;
      set: Set<string>;
      auto?: { get: Get<boolean>; set: Set<boolean> };
    })
  | (Base & { kind: 'swatches'; get: Get<RGB[]>; active: Get<RGB>; set: Set<RGB> })
  | (Base & { kind: 'buttons'; buttons: { label: string; primary?: boolean; run: () => void }[] })
  | (Base & { kind: 'custom'; el: HTMLElement; sync?: (s: State) => void });

export interface Section {
  title: string;
  controls: Control[];
  visible?: Get<boolean>;
}

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
) => {
  const el = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) el.className = cls;
  Object.assign(el, rest);
  el.append(...children);
  return el;
};

const sameColor = (a: RGB, b: RGB) => rgbToHex(a) === rgbToHex(b);

function build(c: Control, store: Store): { el: HTMLElement; sync: (s: State) => void } {
  const update = (fn: (s: State) => void) => store.update(fn);
  const label = h('span', { class: 'row-label' }, c.label);
  switch (c.kind) {
    case 'slider': {
      const input = h('input', {
        type: 'range',
        min: `${c.min}`,
        max: `${c.max}`,
        step: `${c.step}`,
      });
      const out = h('output', { class: 'row-value' });
      input.setAttribute('aria-label', c.label);
      input.addEventListener('input', () => update((s) => c.set(s, +input.value)));
      const fmt = c.format ?? ((v: number) => `${Math.round(v * 100)}%`);
      return {
        el: h(
          'div',
          { class: 'row row-slider' },
          h('div', { class: 'row-head' }, label, out),
          input,
        ),
        sync: (s) => {
          const v = c.get(s);
          if (document.activeElement !== input || +input.value !== v) input.value = `${v}`;
          out.textContent = fmt(v);
        },
      };
    }
    case 'toggle': {
      const input = h('input', { type: 'checkbox', class: 'switch' });
      input.setAttribute('role', 'switch');
      input.addEventListener('change', () => update((s) => c.set(s, input.checked)));
      return {
        el: h('label', { class: 'row' }, label, input),
        sync: (s) => void (input.checked = c.get(s)),
      };
    }
    case 'segmented': {
      const btns = c.options.map(([value, text]) => {
        const b = h('button', { type: 'button', textContent: text });
        b.addEventListener('click', () => update((s) => c.set(s, value)));
        return [value, b] as const;
      });
      const group = h('div', { class: 'segmented' }, ...btns.map(([, b]) => b));
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', c.label);
      return {
        el: h('div', { class: 'row row-stack' }, label, group),
        sync: (s) => btns.forEach(([v, b]) => b.setAttribute('aria-pressed', `${c.get(s) === v}`)),
      };
    }
    case 'select': {
      const sel = h(
        'select',
        {},
        ...c.options.map(([value, text]) => h('option', { value }, text)),
      );
      sel.setAttribute('aria-label', c.label);
      sel.addEventListener('change', () => update((s) => c.set(s, sel.value)));
      return {
        el: h('label', { class: 'row' }, label, sel),
        sync: (s) => void (sel.value = c.get(s)),
      };
    }
    case 'color': {
      const input = h('input', { type: 'color', class: 'color-well' });
      input.setAttribute('aria-label', c.label);
      input.addEventListener('input', () => update((s) => c.set(s, input.value)));
      const right = h('div', { class: 'row-right' });
      let autoBtn: HTMLButtonElement | undefined;
      if (c.auto) {
        const auto = c.auto;
        autoBtn = h('button', { type: 'button', class: 'chip', textContent: 'Auto' });
        autoBtn.title = 'Use the dominant color from the image';
        autoBtn.addEventListener('click', () => update((s) => auto.set(s, true)));
        right.append(autoBtn);
      }
      right.append(input);
      return {
        el: h('div', { class: 'row' }, label, right),
        sync: (s) => {
          input.value = rgbToHex(c.get(s));
          autoBtn?.setAttribute('aria-pressed', `${c.auto!.get(s)}`);
        },
      };
    }
    case 'swatches': {
      const wrap = h('div', { class: 'swatches' });
      let last = '';
      return {
        el: h('div', { class: 'row row-stack' }, label, wrap),
        sync: (s) => {
          const colors = c.get(s);
          const key = colors.map(rgbToHex).join() + rgbToHex(c.active(s));
          if (key === last) return;
          last = key;
          wrap.replaceChildren(
            ...colors.map((col) => {
              const b = h('button', { type: 'button', class: 'swatch' });
              b.style.background = rgbToHex(col);
              b.title = rgbToHex(col);
              b.setAttribute('aria-label', `Tint ${rgbToHex(col)}`);
              b.setAttribute('aria-pressed', `${sameColor(col, c.active(s))}`);
              b.addEventListener('click', () => update((st) => c.set(st, col)));
              return b;
            }),
          );
          if (!colors.length)
            wrap.append(h('span', { class: 'hint' }, 'Add an image to extract colors'));
        },
      };
    }
    case 'buttons':
      return {
        el: h(
          'div',
          { class: 'row row-buttons' },
          ...c.buttons.map((b) => {
            const el = h('button', {
              type: 'button',
              class: b.primary ? 'btn primary' : 'btn',
              textContent: b.label,
            });
            el.addEventListener('click', b.run);
            return el;
          }),
        ),
        sync: () => {},
      };
    case 'custom':
      return { el: c.el, sync: c.sync ?? (() => {}) };
  }
}

export function renderControls(root: HTMLElement, sections: Section[], store: Store) {
  const syncs: ((s: State) => void)[] = [];
  for (const sec of sections) {
    const group = h('div', { class: 'group' });
    const el = h('section', { class: 'section' }, h('h2', {}, sec.title), group);
    for (const c of sec.controls) {
      const built = build(c, store);
      group.append(built.el);
      syncs.push((s) => {
        built.el.hidden = c.visible ? !c.visible(s) : false;
        if (!built.el.hidden) built.sync(s);
      });
    }
    if (sec.visible) syncs.push((s) => void (el.hidden = !sec.visible!(s)));
    root.append(el);
  }
  store.subscribe((s) => syncs.forEach((f) => f(s)));
}

export { h };
