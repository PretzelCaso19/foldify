# Iconify

Turn any image into a macOS-style folder icon (and soon, app icon). Everything runs in the
browser — images never leave your machine.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run lint    # eslint + prettier --check
npm run build
```

Drop, pick, or paste (⌘V) a PNG / JPG / WEBP / SVG, tune the folder, export a PNG.

## Layout

- `src/render/` — squircle + folder geometry (SVG path data), presets, compositor
- `src/color/` — palette extraction (k-means), color helpers
- `src/export/` — stepwise-halving resample, PNG
- `src/ui/` — schema-driven controls sidebar, preview + size strip
- `src/state/` — single typed store; the master icon is a pure function of state
