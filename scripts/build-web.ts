import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const frontendDir = resolve(root, 'src/web/frontend');
const outDir = resolve(root, 'dist/web');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [resolve(frontendDir, 'main.ts')],
  bundle: true,
  outfile: resolve(outDir, 'bundle.js'),
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: process.argv.includes('--minify'),
  sourcemap: process.argv.includes('--sourcemap'),
});

cpSync(resolve(frontendDir, 'index.html'), resolve(outDir, 'index.html'));
cpSync(resolve(frontendDir, 'styles.css'), resolve(outDir, 'styles.css'));

console.log('Built frontend → dist/web/');
