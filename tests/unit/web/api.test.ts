import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { createApiRoutes } from '../../../src/web/routes/api.js';
import { createGraphCache } from '../../../src/web/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');
const INVALID_GRAPH = path.resolve(__dirname, '../../fixtures/graph-with-invalid');

// Helper to make requests to the Hono app
function createApp(graphDir: string) {
  const cache = createGraphCache(graphDir);
  const app = new Hono();
  const api = createApiRoutes(graphDir, cache);
  app.route('/api', api);
  return { app, cache };
}

async function fetchJson(app: Hono, path: string) {
  const res = await app.request(path);
  return { status: res.status, body: await res.json() };
}

describe('GET /api/graph', () => {
  it('returns SerializedGraph shape', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/graph');

    expect(status).toBe(200);
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('edges');
    expect(body).toHaveProperty('loadedAt');
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
    expect(body.nodes.length).toBe(14);
  });
});

describe('GET /api/node/:id', () => {
  it('returns node detail for valid node', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/node/hyp-001');

    expect(status).toBe(200);
    expect(body.id).toBe('hyp-001');
    expect(body.title).toBe('Surface Defect Detection via CNN');
    expect(body.type).toBe('hypothesis');
    expect(body.status).toBe('TESTING');
    expect(body).toHaveProperty('body');
    expect(typeof body.body).toBe('string');
    expect(body.body.length).toBeGreaterThan(0);
    expect(Array.isArray(body.tags)).toBe(true);
    expect(Array.isArray(body.links)).toBe(true);
  });

  it('returns 404 for nonexistent node', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/node/nonexistent-999');

    expect(status).toBe(404);
    expect(body.error).toBe('Node not found');
  });

  it('returns invalid node from cache with parseError (FR-026)', async () => {
    const { app } = createApp(INVALID_GRAPH);
    // Load graph first so cache is populated
    await fetchJson(app, '/api/graph');

    const { status, body } = await fetchJson(app, '/api/node/hyp-002');
    expect(status).toBe(200);
    expect(body.invalid).toBe(true);
    expect(body.body).toBeNull();
    expect(body).toHaveProperty('parseError');
  });

  it('returns full body for valid node in invalid-graph fixture', async () => {
    const { app } = createApp(INVALID_GRAPH);
    await fetchJson(app, '/api/graph');

    const { status, body } = await fetchJson(app, '/api/node/hyp-001');
    expect(status).toBe(200);
    expect(body.invalid).toBeFalsy();
    expect(typeof body.body).toBe('string');
  });
});

describe('GET /api/neighbors/:id', () => {
  it('returns neighbor set with depth param', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001?depth=1');

    expect(status).toBe(200);
    expect(body.center).toBe('hyp-001');
    expect(body.depth).toBe(1);
    expect(Array.isArray(body.neighbors)).toBe(true);
  });

  it('defaults depth to 2 when not specified', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001');

    expect(status).toBe(200);
    expect(body.depth).toBe(2);
  });

  it('clamps depth to max 3', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001?depth=10');

    expect(status).toBe(200);
    expect(body.depth).toBe(3);
  });

  it('returns 404 for nonexistent node', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/nonexistent-999');

    expect(status).toBe(404);
    expect(body.error).toBe('Node not found');
  });

  it('depth=abc → defaults to 2', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001?depth=abc');

    expect(status).toBe(200);
    expect(body.depth).toBe(2);
  });

  it('depth=0 → falls back to 2 (0 is falsy)', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001?depth=0');

    expect(status).toBe(200);
    expect(body.depth).toBe(2);
  });

  it('depth=-1 → clamps to min 1', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/neighbors/hyp-001?depth=-1');

    expect(status).toBe(200);
    expect(body.depth).toBe(1);
  });
});

describe('GET /api/health', () => {
  it('returns HealthReport shape', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/health');

    expect(status).toBe(200);
    expect(body).toHaveProperty('totalNodes');
    expect(body).toHaveProperty('totalEdges');
    expect(body).toHaveProperty('byType');
    expect(body).toHaveProperty('statusDistribution');
    expect(body).toHaveProperty('avgConfidence');
    expect(body).toHaveProperty('linkDensity');
    expect(body).toHaveProperty('openQuestions');
    expect(body).toHaveProperty('gaps');
    expect(body).toHaveProperty('gapDetails');
    expect(body).toHaveProperty('deferredItems');
    expect(body.totalNodes).toBe(14);
  });

  it('statusDistribution is nested Record<string, Record<string, number>>', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { body } = await fetchJson(app, '/api/health');

    expect(typeof body.statusDistribution).toBe('object');
    // e.g. { hypothesis: { TESTING: 1, PROPOSED: 1 }, ... }
    for (const [type, statuses] of Object.entries(body.statusDistribution)) {
      expect(typeof type).toBe('string');
      expect(typeof statuses).toBe('object');
      for (const [status, count] of Object.entries(statuses as Record<string, number>)) {
        expect(typeof status).toBe('string');
        expect(typeof count).toBe('number');
      }
    }
  });

  it('gapDetails is an array', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { body } = await fetchJson(app, '/api/health');
    expect(Array.isArray(body.gapDetails)).toBe(true);
  });

  it('avgConfidence is number or null', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { body } = await fetchJson(app, '/api/health');
    expect(body.avgConfidence === null || typeof body.avgConfidence === 'number').toBe(true);
  });

  it('deferredItems is an array', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { body } = await fetchJson(app, '/api/health');
    expect(Array.isArray(body.deferredItems)).toBe(true);
  });
});

describe('GET /api/clusters', () => {
  it('returns VisualCluster array', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/clusters');

    expect(status).toBe(200);
    expect(body).toHaveProperty('clusters');
    expect(Array.isArray(body.clusters)).toBe(true);
    for (const c of body.clusters) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('nodeIds');
      expect(c).toHaveProperty('isManual');
    }
  });
});

describe('GET /api/export', () => {
  it('returns text/html content', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const res = await app.request('/api/export');

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('EMDD Graph Export');
  });

  it('exports with types and statuses query params', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const res = await app.request('/api/export?types=hypothesis,finding&statuses=PROPOSED,TESTING');

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('exports with layout=hierarchical', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const res = await app.request('/api/export?layout=hierarchical');

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
  });
});

describe('GET /api/promotion-candidates', () => {
  it('returns candidates array with correct shape', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/promotion-candidates');

    expect(status).toBe(200);
    expect(body).toHaveProperty('candidates');
    expect(Array.isArray(body.candidates)).toBe(true);
    for (const c of body.candidates) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('confidence');
      expect(c).toHaveProperty('supports');
      expect(c).toHaveProperty('reason');
      expect(['confidence', 'de_facto', 'both']).toContain(c.reason);
    }
  });
});

describe('GET /api/consolidation', () => {
  it('returns full CheckResult shape', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const { status, body } = await fetchJson(app, '/api/consolidation');

    expect(status).toBe(200);
    expect(body).toHaveProperty('triggers');
    expect(body).toHaveProperty('promotionCandidates');
    expect(body).toHaveProperty('orphanFindings');
    expect(body).toHaveProperty('deferredItems');
    expect(Array.isArray(body.triggers)).toBe(true);
    expect(Array.isArray(body.promotionCandidates)).toBe(true);
    expect(Array.isArray(body.orphanFindings)).toBe(true);
    expect(Array.isArray(body.deferredItems)).toBe(true);
  });
});

describe('POST /api/refresh', () => {
  it('returns reloaded status', async () => {
    const { app } = createApp(SAMPLE_GRAPH);
    const res = await app.request('/api/refresh', { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reloaded).toBe(true);
    expect(body).toHaveProperty('loadedAt');
    expect(body).toHaveProperty('nodeCount');
    expect(body.nodeCount).toBe(14);
  });
});

describe('Invalid node pipeline (FR-026)', () => {
  it('GET /api/graph includes invalid nodes with invalid flag', async () => {
    const { app } = createApp(INVALID_GRAPH);
    const { body } = await fetchJson(app, '/api/graph');

    const invalidNodes = body.nodes.filter((n: any) => n.invalid === true);
    expect(invalidNodes.length).toBeGreaterThan(0);

    for (const n of invalidNodes) {
      expect(typeof n.parseError).toBe('string');
    }
  });
});
