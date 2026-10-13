import { zipSync } from 'fflate';

/** File names iconutil expects inside a .iconset folder, with their pixel sizes. */
export const ICONSET_FILES: [name: string, size: number][] = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

/** Zip of `<name>.iconset/icon_*.png`. PNGs are already compressed, so entries are stored. */
export function buildIconsetZip(name: string, pngs: Map<number, Uint8Array>): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [file, size] of ICONSET_FILES) {
    const data = pngs.get(size);
    if (!data) throw new Error(`Missing ${size}px PNG`);
    files[`${name}.iconset/${file}`] = [data, { level: 0 }];
  }
  return zipSync(files);
}
