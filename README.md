# Foldify

Turn any image into a macOS **folder icon** or **app icon**. Drop in a picture and the
folder _becomes_ it: the folder takes the image's main color, and only the features (eyes,
mouth, markings) are painted onto it under the folder's own lighting. Everything runs in
the browser; images never leave your machine.

```bash
npm install
npm run dev     # local dev server
npm test        # vitest (includes an iconutil check on macOS)
npm run lint    # eslint + prettier --check
npm run build   # static site in dist/ (relative paths, host anywhere)
```

## What it does

- **Input:** drag-and-drop, file picker, or ⌘V paste. PNG, JPG, WEBP, SVG.
- **Background removal:** automatic flood-fill for plain backgrounds; optional on-device
  AI removal (`@imgly/background-removal`) for busy photos. The AI model (~44 MB) is
  downloaded once from IMG.LY's CDN when first used; the image itself is never uploaded.
- **Folder styles:** Seamless merge (default), Classic tinted, Engraved, Gradient,
  Full-bleed, Sticker, Neon, Flat, Icon pack, each shown as a live thumbnail.
- **App icons:** macOS grid (824 body, 100 px margin, continuous-curvature corners) with
  Merge / Glyph / Full-bleed fills, solid, gradient or blurred backgrounds, rotation,
  padding, gloss and shadow.
- **Preview:** editor, a 512/128/64/32/16 strip, and a mock Finder window (light/dark).
- **Export:** `.icns` written in the browser (ic07–ic14 PNG entries), a zipped `.iconset`,
  or a single PNG; plus copy-to-clipboard and "how to apply" instructions.

## Layout

- `src/render/`: squircle + folder geometry (SVG path data), presets, app icon,
  compositor. `merge.ts` lifts an image's features off its body color.
- `src/input/`: decoding, flood-fill background removal, lazy AI removal
- `src/color/`: palette extraction (k-means), color helpers
- `src/export/`: `.icns` writer, `.iconset` zip, stepwise-halving resample, PNG
- `src/ui/`: schema-driven controls, preview + size strip, preset tiles, Finder mock
- `src/state/`: single typed store; the master icon is a pure function of state

## License note

`@imgly/background-removal` is AGPL-3.0. If you deploy this publicly with AI removal
enabled, the AGPL requires offering the site's source to its users (e.g. a public repo
link), or you can remove that feature or get a commercial license from IMG.LY.
