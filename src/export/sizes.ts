import { buildIcns, ICNS_TYPES } from './icns';
import { buildIconsetZip, ICONSET_FILES } from './iconset';
import { toBlob } from './png';
import { downscale } from './resample';

/** Every distinct size the exports need, as PNG bytes, each halved down from the master. */
export async function pngSet(master: HTMLCanvasElement, sizes: number[]) {
  const out = new Map<number, Uint8Array>();
  for (const size of new Set(sizes)) {
    const c = size === master.width ? master : downscale(master, size);
    out.set(size, new Uint8Array(await (await toBlob(c)).arrayBuffer()));
  }
  return out;
}

export async function icnsBlob(master: HTMLCanvasElement): Promise<Blob> {
  const pngs = await pngSet(
    master,
    ICNS_TYPES.map((t) => t.size),
  );
  const bytes = buildIcns(ICNS_TYPES.map((t) => ({ type: t.type, data: pngs.get(t.size)! })));
  return new Blob([bytes as BlobPart], { type: 'image/x-icns' });
}

export async function iconsetBlob(master: HTMLCanvasElement, name: string): Promise<Blob> {
  const pngs = await pngSet(
    master,
    ICONSET_FILES.map(([, s]) => s),
  );
  return new Blob([buildIconsetZip(name, pngs) as BlobPart], { type: 'application/zip' });
}
