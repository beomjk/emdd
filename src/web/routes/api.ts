import { Hono } from 'hono';
import type { GraphCache } from '../cache.js';
import { readNode, getNeighbors, getPromotionCandidates, checkConsolidation } from '../../graph/operations.js';

export function createApiRoutes(graphDir: string, cache: GraphCache): Hono {
  const api = new Hono();

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

  // GET /api/promotion-candidates
  api.get('/promotion-candidates', async (c) => {
    const candidates = await getPromotionCandidates(graphDir);
    return c.json({ candidates });
  });

  // GET /api/consolidation
  api.get('/consolidation', async (c) => {
    const result = await checkConsolidation(graphDir);
    return c.json(result);
  });

  // GET /api/clusters
  api.get('/clusters', async (c) => {
    const clusters = await cache.getClusters();
    return c.json({ clusters });
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
