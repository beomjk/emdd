import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

export function createStaticRoutes(): Hono {
  const app = new Hono();
  // In dev (tsx): __dirname = src/web/routes → go up to project root, then dist/web
  // In prod (node): __dirname = dist/web/routes → go up to dist/web
  const prodDir = path.resolve(__dirname, '..');
  const devDir = path.resolve(__dirname, '../../../dist/web');
  const webDir = fs.existsSync(path.join(prodDir, 'index.html')) ? prodDir : devDir;

  function serveFile(filePath: string, mimeType: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return new Response(content, {
        headers: { 'Content-Type': `${mimeType}; charset=utf-8` },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  }

  app.get('/', (c) => {
    return serveFile(path.join(webDir, 'index.html'), 'text/html');
  });

  app.get('/:file{.+\\.(js|css)}', (c) => {
    const file = c.req.param('file');
    const resolved = path.resolve(webDir, file);
    // Prevent path traversal — resolved path must stay within webDir
    if (!resolved.startsWith(webDir + path.sep) && resolved !== webDir) {
      return new Response('Forbidden', { status: 403 });
    }
    const ext = path.extname(resolved);
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
    return serveFile(resolved, mimeType);
  });

  return app;
}
