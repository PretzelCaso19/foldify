import { downscale } from './resample';

export function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

export const pngAt = (master: HTMLCanvasElement, size: number) =>
  toBlob(size === master.width ? master : downscale(master, size));

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyPng(blob: Blob | Promise<Blob>) {
  // Passing the promise keeps Safari's user-activation window open while encoding.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
