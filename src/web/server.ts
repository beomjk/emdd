import { Hono } from 'hono';
import { createApiRoutes } from './routes/api.js';
import { createStaticRoutes } from './routes/static.js';
import { createGraphCache, type GraphCache } from './cache.js';

export function createDashboardServer(graphDir: string): { app: Hono; cache: GraphCache } {
  const cache = createGraphCache(graphDir);
  const app = new Hono();

  const api = createApiRoutes(graphDir, cache);
  app.route('/api', api);

  const staticRoutes = createStaticRoutes();
  app.route('/', staticRoutes);

  return { app, cache };
}
