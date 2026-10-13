import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildIcns, ICNS_TYPES, parseIcns } from '../src/export/icns';
import { buildIconsetZip, ICONSET_FILES } from '../src/export/iconset';

const be32 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset).getUint32(o);
const str4 = (b: Uint8Array, o: number) => String.fromCharCode(...b.subarray(o, o + 4));

describe('buildIcns', () => {
  it('writes the magic, big-endian total length, and each entry header', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array(300).fill(7);
    const out = buildIcns([
      { type: 'ic07', data: a },
      { type: 'ic10', data: b },
    ]);
    expect(str4(out, 0)).toBe('icns');
    expect(be32(out, 4)).toBe(out.length);
    expect(out.length).toBe(8 + (8 + 3) + (8 + 300));
    expect(str4(out, 8)).toBe('ic07');
    expect(be32(out, 12)).toBe(11);
    expect([...out.subarray(16, 19)]).toEqual([1, 2, 3]);
    expect(str4(out, 19)).toBe('ic10');
    expect(be32(out, 23)).toBe(308);
    // Big-endian, not little-endian: 308 = 0x00000134.
    expect([...out.subarray(23, 27)]).toEqual([0, 0, 1, 0x34]);
  });

  it('round-trips through parseIcns', () => {
    const entries = ICNS_TYPES.map((t, i) => ({
      type: t.type,
      data: new Uint8Array(i + 1).fill(i),
    }));
    const parsed = parseIcns(buildIcns(entries));
    expect(parsed.map((e) => e.type)).toEqual(entries.map((e) => e.type));
    parsed.forEach((e, i) => expect([...e.data]).toEqual([...entries[i].data]));
  });

  it('rejects malformed input', () => {
    expect(() => buildIcns([{ type: 'toolong', data: new Uint8Array() }])).toThrow();
    expect(() => parseIcns(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 8]))).toThrow();
    const bad = buildIcns([{ type: 'ic07', data: new Uint8Array(4) }]);
    new DataView(bad.buffer).setUint32(12, 999);
    expect(() => parseIcns(bad)).toThrow();
  });

  it('covers every size macOS asks for, with distinct types', () => {
    expect(new Set(ICNS_TYPES.map((t) => t.type)).size).toBe(ICNS_TYPES.length);
    expect([...new Set(ICNS_TYPES.map((t) => t.size))].sort((a, b) => a - b)).toEqual([
      32, 64, 128, 256, 512, 1024,
    ]);
  });
});

describe('buildIconsetZip', () => {
  it('contains the ten iconutil file names inside <name>.iconset/', () => {
    const pngs = new Map(
      [16, 32, 64, 128, 256, 512, 1024].map((s) => [s, new Uint8Array([s & 255])]),
    );
    const files = unzipSync(buildIconsetZip('demo', pngs));
    expect(Object.keys(files).sort()).toEqual(
      ICONSET_FILES.map(([n]) => `demo.iconset/${n}`).sort(),
    );
    expect([...files['demo.iconset/icon_16x16@2x.png']]).toEqual([32]);
  });
});

// --- Integration: compare against Apple's iconutil (macOS only). -------------------------

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (b: Uint8Array) => {
  let c = -1;
  for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
/** Minimal RGBA PNG encoder (a gradient with a disc), enough for a real fixture. */
function png(size: number): Uint8Array {
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const inside = Math.hypot(x - size / 2, y - size / 2) < size * 0.4;
      raw.set([inside ? 255 : (x * 255) / size, (y * 255) / size, 128, inside ? 255 : 200], i);
    }
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, size);
  new DataView(ihdr.buffer).setUint32(4, size);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, (o += p.length) - p.length);
  return out;
}

let hasIconutil = false;
try {
  execFileSync('which', ['iconutil']);
  hasIconutil = process.platform === 'darwin';
} catch {
  /* not macOS */
}

describe.runIf(hasIconutil)('against iconutil', () => {
  it('iconutil reads our .icns back into a complete, correctly sized iconset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'foldify-'));
    try {
      const pngs = new Map([32, 64, 128, 256, 512, 1024].map((s) => [s, png(s)]));
      const ours = buildIcns(ICNS_TYPES.map((t) => ({ type: t.type, data: pngs.get(t.size)! })));
      writeFileSync(join(dir, 'ours.icns'), ours);
      execFileSync('iconutil', [
        '-c',
        'iconset',
        join(dir, 'ours.icns'),
        '-o',
        join(dir, 'back.iconset'),
      ]);
      const files = readdirSync(join(dir, 'back.iconset')).sort();
      expect(files).toEqual(
        ICONSET_FILES.map(([n]) => n)
          .filter((n) => n !== 'icon_16x16.png' && n !== 'icon_32x32.png') // no ic04/ic05 written
          .sort(),
      );
      for (const [name, size] of ICONSET_FILES) {
        if (!files.includes(name)) continue;
        const info = execFileSync('sips', [
          '-g',
          'pixelWidth',
          join(dir, 'back.iconset', name),
        ]).toString();
        expect(info).toContain(`pixelWidth: ${size}`);
      }

      // iconutil's own .icns for the same PNGs uses exactly the same PNG entry types and sizes.
      // (It re-encodes PNGs and adds legacy ARGB ic04/ic05 + an 'info' plist, so bytes differ.)
      const set = join(dir, 'src.iconset');
      execFileSync('mkdir', [set]);
      for (const [name, size] of ICONSET_FILES) writeFileSync(join(set, name), png(size));
      execFileSync('iconutil', ['-c', 'icns', set, '-o', join(dir, 'apple.icns')]);
      const apple = parseIcns(new Uint8Array(readFileSync(join(dir, 'apple.icns'))));
      const isPng = (d: Uint8Array) => d[0] === 0x89 && str4(d, 1).startsWith('PNG');
      const width = (d: Uint8Array) => be32(d, 16);
      const applePng = apple.filter((e) => isPng(e.data));
      expect(applePng.map((e) => e.type).sort()).toEqual(ICNS_TYPES.map((t) => t.type).sort());
      for (const e of parseIcns(ours)) {
        expect(width(e.data)).toBe(width(applePng.find((a) => a.type === e.type)!.data));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
