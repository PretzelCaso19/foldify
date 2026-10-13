import { palette, asImg } from './load';
import { makeCanvas } from '../render/canvas';
import type { Img } from '../render/emblem';
import type { Variant } from '../state/store';

/**
 * Heavy-path background removal with an on-device ML model (@imgly/background-removal).
 * The library and its model are only fetched the first time someone turns this on; the
 * image itself is processed locally and never uploaded.
 */
export async function removeBackgroundAI(
  img: Img,
  onProgress: (fraction: number) => void = () => {},
): Promise<Variant> {
  const { removeBackground } = await import('@imgly/background-removal');
  const c = makeCanvas(img.width, img.height);
  c.getContext('2d')!.drawImage(img.src, 0, 0);
  const input = await new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'),
  );
  // Per-file download progress; combine into one overall fraction.
  const files = new Map<string, [number, number]>();
  const out = await removeBackground(input, {
    // The quantized model is ~44 MB vs ~88 MB for the default, with near-identical masks.
    model: 'isnet_quint8',
    device: 'cpu',
    output: { format: 'image/png' },
    progress: (key, current, total) => {
      if (!key.startsWith('fetch:')) return;
      files.set(key, [current, total]);
      let done = 0;
      let all = 0;
      for (const [c, t] of files.values()) {
        done += c;
        all += t;
      }
      if (all) onProgress(done / all);
    },
  });
  const bmp = await createImageBitmap(out);
  const result = makeCanvas(bmp.width, bmp.height);
  result.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return { img: asImg(result), palette: palette(result) };
}
