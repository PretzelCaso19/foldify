/**
 * Apple Icon Image (.icns) writer. The file is a 4-byte 'icns' magic and big-endian u32
 * total length, followed by entries of [4-byte OSType][big-endian u32 length incl. this
 * 8-byte header][PNG data]. Only PNG-backed types are written; macOS 10.7+ reads them all.
 */
export const ICNS_TYPES = [
  { type: 'ic11', size: 32 }, // 16@2x
  { type: 'ic12', size: 64 }, // 32@2x
  { type: 'ic07', size: 128 },
  { type: 'ic13', size: 256 }, // 128@2x
  { type: 'ic08', size: 256 },
  { type: 'ic14', size: 512 }, // 256@2x
  { type: 'ic09', size: 512 },
  { type: 'ic10', size: 1024 }, // 512@2x
] as const;

export interface IcnsEntry {
  type: string;
  data: Uint8Array;
}

const ascii = (s: string) => {
  if (!/^[\x20-\x7e]{4}$/.test(s)) throw new Error(`Bad OSType "${s}"`);
  return [...s].map((ch) => ch.charCodeAt(0));
};

export function buildIcns(entries: IcnsEntry[]): Uint8Array {
  const total = 8 + entries.reduce((n, e) => n + 8 + e.data.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(ascii('icns'), 0);
  view.setUint32(4, total);
  let off = 8;
  for (const e of entries) {
    out.set(ascii(e.type), off);
    view.setUint32(off + 4, 8 + e.data.length);
    out.set(e.data, off + 8);
    off += 8 + e.data.length;
  }
  return out;
}

/** Parse an .icns into its entries, validating every length along the way. */
export function parseIcns(bytes: Uint8Array): IcnsEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (bytes.length < 8 || str(0) !== 'icns') throw new Error('Not an icns file');
  if (view.getUint32(4) !== bytes.length) throw new Error('icns length mismatch');
  const entries: IcnsEntry[] = [];
  for (let off = 8; off < bytes.length;) {
    const len = view.getUint32(off + 4);
    if (len < 8 || off + len > bytes.length) throw new Error(`Bad entry length at ${off}`);
    entries.push({ type: str(off), data: bytes.subarray(off + 8, off + len) });
    off += len;
  }
  return entries;
}
