import { Hono } from 'hono';
import { createApiRoutes } from './routes/api.js';
import { createStaticRoutes } from './routes/static.js';
import { createGraphCache, type GraphCache } from './cache.js';
import { createFileWatcher, type FileWatcher } from './watcher.js';
import { createSSEManager, type SSEManager } from './sse.js';

export function createDashboardServer(graphDir: string): {
  app: Hono;
  cache: GraphCache;
  watcher: FileWatcher;
  sseManager: SSEManager;
} {
  const cache = createGraphCache(graphDir);
  const sseManager = createSSEManager();
  const watcher = createFileWatcher(graphDir);
  const app = new Hono();

  // Reject requests from non-localhost Host headers to prevent DNS rebinding.
  // The server binds to 127.0.0.1, but a rebinding attacker can point their
  // own domain to loopback — the Host check is the second line of defense.
  app.use('*', async (c, next) => {
    const raw = c.req.header('Host') ?? '';
    const host = raw.replace(/:\d+$/, '');
    // Allow localhost, 127.0.0.1, and missing Host (internal test requests).
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return c.text('Forbidden', 403);
    }
    await next();
  });

  // Wire watcher to cache invalidation + SSE broadcast
  watcher.on('change', async () => {
    cache.invalidate();
    await sseManager.broadcast('graph-updated', JSON.stringify({
      timestamp: new Date().toISOString(),
    }));
  });

  const api = createApiRoutes(graphDir, cache, sseManager);
  app.route('/api', api);

  const staticRoutes = createStaticRoutes();
  app.route('/', staticRoutes);

  return { app, cache, watcher, sseManager };
}
