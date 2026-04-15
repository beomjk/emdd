import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { GraphCache } from '../cache.js';
import type { SSEManager } from '../sse.js';
import { readNode, getNeighbors } from '../../graph/operations.js';
import { generateExportHtml } from '../export.js';
import type { LayoutMode, VisualCluster } from '../types.js';
import { resolveGraphTheme } from '../visual-state.js';

export function createApiRoutes(graphDir: string, cache: GraphCache, sseManager?: SSEManager): Hono {
  const api = new Hono();

  function parseLayoutMode(layout?: string): LayoutMode {
    return layout === 'hierarchical' ? 'hierarchical' : 'force';
  }

  function parseListParam(searchParams: URLSearchParams, key: string): string[] | undefined {
    if (!searchParams.has(key)) return undefined;
    const raw = searchParams.get(key) ?? '';
    return raw === '' ? [] : raw.split(',').filter(Boolean);
  }

  // GET /api/graph
  api.get('/graph', async (c) => {
    const graph = await cache.getGraph();
    return c.json(graph);
  });

  // GET /api/health
  api.get('/health', async (c) => {
    const health = await cache.getHealth();
    return c.json(health);
  });

  // GET /api/node/:id
  api.get('/node/:id', async (c) => {
    const id = c.req.param('id');

    // Check cached graph first for invalid nodes (FR-026)
    const graph = await cache.getGraph();
    const cachedNode = graph.nodes.find((n) => n.id === id);
    if (cachedNode?.invalid) {
      return c.json({
        id: cachedNode.id,
        type: cachedNode.type,
        title: cachedNode.title,
        invalid: true,
        parseError: cachedNode.parseError,
        body: null,
      });
    }

    const node = await readNode(graphDir, id);
    if (!node) {
      return c.json({ error: 'Node not found', id }, 404);
    }
    return c.json({
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status,
      confidence: node.confidence,
      tags: node.tags,
      links: node.links.map((l) => ({ target: l.target, relation: l.relation })),
      body: node.body,
      created: node.meta.created ? String(node.meta.created) : undefined,
      updated: node.meta.updated ? String(node.meta.updated) : undefined,
    });
  });

  // GET /api/neighbors/:id
  api.get('/neighbors/:id', async (c) => {
    const id = c.req.param('id');
    const depthParam = c.req.query('depth');
    const depth = Math.min(Math.max(parseInt(depthParam ?? '2', 10) || 2, 1), 3);

    try {
      const neighbors = await getNeighbors(graphDir, id, depth);
      return c.json({ center: id, depth, neighbors });
    } catch {
      return c.json({ error: 'Node not found', id }, 404);
    }
  });

  // GET /api/promotion-candidates (cached — invalidated on graph reload)
  api.get('/promotion-candidates', async (c) => {
    const candidates = await cache.getPromotionCandidates();
    return c.json({ candidates });
  });

  // GET /api/consolidation (cached — invalidated on graph reload)
  api.get('/consolidation', async (c) => {
    const result = await cache.getConsolidation();
    return c.json(result);
  });

  // GET /api/export
  api.get('/export', async (c) => {
    const graph = await cache.getGraph();
    let clusters: VisualCluster[] = [];
    try {
      clusters = await cache.getClusters();
    } catch (err) {
      console.warn('[emdd] cluster export failed, falling back to export without clusters:', err);
    }
    const searchParams = new URL(c.req.url).searchParams;
    const layout = parseLayoutMode(searchParams.get('layout') ?? undefined);
    const theme = resolveGraphTheme(searchParams.get('theme') ?? undefined);
    const types = parseListParam(searchParams, 'types');
    const statuses = parseListParam(searchParams, 'statuses');
    const edgeTypes = parseListParam(searchParams, 'edgeTypes');

    const { html } = generateExportHtml(graph, {
      layout,
      theme,
      types,
      statuses,
      edgeTypes,
      clusters,
    });
    return c.html(html);
  });

  // GET /api/clusters
  api.get('/clusters', async (c) => {
    const clusters = await cache.getClusters();
    return c.json({ clusters });
  });

  // GET /api/events (SSE)
  api.get('/events', (c) => {
    if (!sseManager) {
      return c.json({ error: 'SSE not available' }, 503);
    }
    return streamSSE(c, async (stream) => {
      sseManager.addClient(stream);

      await stream.writeSSE({ event: 'connected', data: JSON.stringify({ timestamp: new Date().toISOString() }) });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(async () => {
        try {
          await stream.writeSSE({ event: 'heartbeat', data: '' });
        } catch {
          clearInterval(heartbeat);
          sseManager.removeClient(stream);
        }
      }, 30_000);

      // Keep stream open until client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat);
          sseManager.removeClient(stream);
          resolve();
        });
      });
    });
  });

  // POST /api/refresh
  api.post('/refresh', async (c) => {
    cache.invalidate();
    const graph = await cache.getGraph();
    return c.json({
      reloaded: true,
      loadedAt: graph.loadedAt,
      nodeCount: graph.nodes.length,
    });
  });

  return api;
}
