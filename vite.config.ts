import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  root: 'src/web/frontend',
  plugins: [svelte({ compilerOptions: { runes: true } })],
  build: {
    outDir: '../../../dist/web',
    // IMPORTANT: must be false — tsc writes backend files (server.js, cache.js,
    // routes/static.js, etc.) to dist/web/ BEFORE vite runs. Emptying outDir
    // would wipe those and break `emdd serve` and the Playwright E2E pipeline.
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
