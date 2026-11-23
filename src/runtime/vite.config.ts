import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

/** KaTeX ships woff2 + woff + ttf; keep only woff2 so the single-file bundle stays small. */
function katexWoff2Only(): Plugin {
  return {
    name: 'katex-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('katex') || !id.endsWith('.css')) return;
      return code.replace(/,\s*url\([^)]+\.woff\) format\("woff"\)/g, '').replace(/,\s*url\([^)]+\.ttf\) format\("truetype"\)/g, '');
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [katexWoff2Only(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL('../../dist-runtime', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    target: 'es2022',
  },
});
