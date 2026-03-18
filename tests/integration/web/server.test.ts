import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createDashboardServer } from '../../../src/web/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

let servers: Server[] = [];

function startServer(graphDir: string, port: number): Promise<{ server: Server; port: number }> {
  const { app } = createDashboardServer(graphDir);
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port }) as unknown as Server;
    server.once('error', reject);
    server.once('listening', () => {
      server.removeAllListeners('error');
      servers.push(server);
      resolve({ server, port });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

afterEach(async () => {
  for (const s of servers) {
    await stopServer(s).catch(() => {});
  }
  servers = [];
});

describe('Server lifecycle', () => {
  it('createDashboardServer() returns app and cache', () => {
    const { app, cache } = createDashboardServer(SAMPLE_GRAPH);
    expect(app).toBeDefined();
    expect(cache).toBeDefined();
    expect(typeof cache.load).toBe('function');
    expect(typeof cache.invalidate).toBe('function');
    expect(typeof cache.getGraph).toBe('function');
    expect(typeof cache.getHealth).toBe('function');
  });

  it('starts and stops cleanly', async () => {
    const { server } = await startServer(SAMPLE_GRAPH, 19876);
    expect(server.listening).toBe(true);
    await stopServer(server);
    servers = servers.filter((s) => s !== server);
    expect(server.listening).toBe(false);
  });

  it('full request cycle: start → GET /api/graph → POST /api/refresh → verify update', async () => {
    const { server, port } = await startServer(SAMPLE_GRAPH, 19877);
    const base = `http://localhost:${port}`;

    // First fetch
    const res1 = await fetch(`${base}/api/graph`);
    expect(res1.status).toBe(200);
    const graph1 = await res1.json();
    expect(graph1.nodes.length).toBe(14);

    // Refresh
    const refreshRes = await fetch(`${base}/api/refresh`, { method: 'POST' });
    expect(refreshRes.status).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody.reloaded).toBe(true);
    expect(refreshBody.nodeCount).toBe(14);

    // Re-fetch after refresh
    const res2 = await fetch(`${base}/api/graph`);
    const graph2 = await res2.json();
    expect(graph2.nodes.length).toBe(14);
    // loadedAt should be updated
    expect(graph2.loadedAt).toBeDefined();
  });

  it('port fallback on EADDRINUSE', async () => {
    // Start first server on port
    const port = 19878;
    await startServer(SAMPLE_GRAPH, port);

    // Second server should fail on same port
    try {
      await startServer(SAMPLE_GRAPH, port);
      expect.fail('Should have thrown EADDRINUSE');
    } catch (err: any) {
      expect(err.code).toBe('EADDRINUSE');
    }
  });
});

describe('API routes via server', () => {
  it('GET / serves HTML', async () => {
    const { app } = createDashboardServer(SAMPLE_GRAPH);
    const res = await app.request('/');
    // May return 200 or 404 depending on dist/web existence, but should not crash
    expect([200, 404]).toContain(res.status);
  });

  it('GET /api/health returns health data', async () => {
    const { app } = createDashboardServer(SAMPLE_GRAPH);
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalNodes).toBe(14);
  });

  it('GET /api/clusters returns cluster data', async () => {
    const { app } = createDashboardServer(SAMPLE_GRAPH);
    const res = await app.request('/api/clusters');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('clusters');
  });

  it('GET /api/export returns HTML export', async () => {
    const { app } = createDashboardServer(SAMPLE_GRAPH);
    const res = await app.request('/api/export');
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/html');
  });
});
