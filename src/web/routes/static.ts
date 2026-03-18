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
  const webDir = path.resolve(__dirname, '../../web');

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
    const ext = path.extname(file);
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
    return serveFile(path.join(webDir, file), mimeType);
  });

  return app;
}
