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
