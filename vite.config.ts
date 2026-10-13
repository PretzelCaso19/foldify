import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs so the build works from any path (Pages, a subfolder, an artifact).
  base: './',
  plugins: [
    {
      // @imgly/background-removal fetches its ONNX runtime .wasm from its CDN together with
      // the model, so the copy Vite would emit is never requested — and it's 24 MB.
      name: 'drop-unused-onnx-wasm',
      apply: 'build',
      generateBundle(_, bundle) {
        for (const file of Object.keys(bundle)) if (file.endsWith('.wasm')) delete bundle[file];
      },
    },
  ],
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
