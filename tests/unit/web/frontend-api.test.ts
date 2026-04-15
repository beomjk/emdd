import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Dynamically import so we can mock fetch before any module-level side effects
let fetchGraph: typeof import('../../../src/web/frontend/lib/api.js').fetchGraph;
let fetchNodeDetail: typeof import('../../../src/web/frontend/lib/api.js').fetchNodeDetail;
let fetchNeighbors: typeof import('../../../src/web/frontend/lib/api.js').fetchNeighbors;
let fetchHealth: typeof import('../../../src/web/frontend/lib/api.js').fetchHealth;
let fetchPromotionCandidates: typeof import('../../../src/web/frontend/lib/api.js').fetchPromotionCandidates;
let fetchConsolidation: typeof import('../../../src/web/frontend/lib/api.js').fetchConsolidation;
let fetchClusters: typeof import('../../../src/web/frontend/lib/api.js').fetchClusters;
let fetchExportHtml: typeof import('../../../src/web/frontend/lib/api.js').fetchExportHtml;
let triggerRefresh: typeof import('../../../src/web/frontend/lib/api.js').triggerRefresh;

const mockFetch = vi.fn();

beforeEach(async () => {
  globalThis.fetch = mockFetch;
  // Clear module cache to re-import fresh
  vi.resetModules();
  const mod = await import('../../../src/web/frontend/lib/api.js');
  fetchGraph = mod.fetchGraph;
  fetchNodeDetail = mod.fetchNodeDetail;
  fetchNeighbors = mod.fetchNeighbors;
  fetchHealth = mod.fetchHealth;
  fetchPromotionCandidates = mod.fetchPromotionCandidates;
  fetchConsolidation = mod.fetchConsolidation;
  fetchClusters = mod.fetchClusters;
  fetchExportHtml = mod.fetchExportHtml;
  triggerRefresh = mod.triggerRefresh;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch (via fetchGraph)', () => {
  it('returns parsed JSON on success', async () => {
    const data = { nodes: [], edges: [], loadedAt: '2026-01-01' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchGraph();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith('/api/graph', undefined);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(fetchGraph()).rejects.toThrow('404 Not Found');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchGraph()).rejects.toThrow('Failed to fetch');
  });
});

describe('AbortSignal forwarding', () => {
  it('forwards signal via RequestInit to fetch', async () => {
    const data = { nodes: [], edges: [], loadedAt: '2026-01-01' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const controller = new AbortController();
    await fetchGraph({ signal: controller.signal });
    expect(mockFetch).toHaveBeenCalledWith('/api/graph', { signal: controller.signal });
  });

  it('forwards signal for fetchClusters', async () => {
    const data = { clusters: [] };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const controller = new AbortController();
    await fetchClusters({ signal: controller.signal });
    expect(mockFetch).toHaveBeenCalledWith('/api/clusters', { signal: controller.signal });
  });

  it('forwards signal for triggerRefresh (merged with method: POST)', async () => {
    const data = { reloaded: true, loadedAt: '2026-01-01', nodeCount: 5 };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const controller = new AbortController();
    await triggerRefresh({ signal: controller.signal });
    expect(mockFetch).toHaveBeenCalledWith('/api/refresh', { method: 'POST', signal: controller.signal });
  });

  it('forwards init for fetchExportHtml', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html></html>') });
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html></html>') });

    const controller = new AbortController();
    await fetchExportHtml('force', undefined, undefined, undefined, 'dark', { signal: controller.signal });
    const callInit = mockFetch.mock.calls[0][1];
    expect(callInit).toEqual({ signal: controller.signal });
  });
});

describe('fetchNodeDetail', () => {
  it('encodes node ID in URL', async () => {
    const data = { id: 'hyp-001', title: 'Test', type: 'hypothesis', body: null };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    await fetchNodeDetail('hyp-001');
    expect(mockFetch).toHaveBeenCalledWith('/api/node/hyp-001', undefined);
  });
});

describe('fetchNeighbors', () => {
  it('passes depth as query param', async () => {
    // Contract: server returns NeighborNode[] objects with `.id`, not string[]
    // See commit 8a7b963 — the prior CRITICAL bug was treating these as strings.
    const data = {
      center: 'hyp-001',
      depth: 3,
      neighbors: [
        { id: 'exp-001', type: 'experiment', title: 'Exp 1', status: 'PLANNED', distance: 1 },
        { id: 'fnd-001', type: 'finding', title: 'Finding 1', status: 'CONFIRMED', distance: 2 },
      ],
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchNeighbors('hyp-001', 3);
    expect(result.neighbors).toHaveLength(2);
    // Each neighbor MUST have an `id` field that callers can read.
    expect(result.neighbors[0].id).toBe('exp-001');
    expect(result.neighbors[1].id).toBe('fnd-001');
    // Pin the mapping pattern used in App.svelte selectNode
    const ids = result.neighbors.map((n) => n.id);
    expect(ids).toEqual(['exp-001', 'fnd-001']);
    expect(mockFetch).toHaveBeenCalledWith('/api/neighbors/hyp-001?depth=3', undefined);
  });

  it('handles empty neighbors array', async () => {
    const data = { center: 'hyp-001', depth: 2, neighbors: [] };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchNeighbors('hyp-001', 2);
    expect(result.neighbors).toEqual([]);
  });
});

describe('fetchExportHtml', () => {
  it('returns text response with layout, filter, and theme params', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html>export</html>') });

    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html>export</html>') });
    const result = await fetchExportHtml('force', ['hypothesis'], ['PROPOSED'], ['supports'], 'dark');
    expect(result).toBe('<html>export</html>');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('layout=force');
    expect(url).toContain('types=hypothesis');
    expect(url).toContain('statuses=PROPOSED');
    expect(url).toContain('edgeTypes=supports');
    expect(url).toContain('theme=dark');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(fetchExportHtml('force')).rejects.toThrow('500 Internal Server Error');
  });
});

describe('triggerRefresh', () => {
  it('sends POST request', async () => {
    const data = { reloaded: true, loadedAt: '2026-01-01', nodeCount: 5 };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await triggerRefresh();
    expect(result.reloaded).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/refresh', { method: 'POST' });
  });
});

describe('fetchHealth', () => {
  it('hits /api/health and returns parsed payload', async () => {
    const data = { totalNodes: 10, gapCount: 2 };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchHealth();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith('/api/health', undefined);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(fetchHealth()).rejects.toThrow('503 Service Unavailable');
  });
});

describe('fetchPromotionCandidates', () => {
  it('hits /api/promotion-candidates and returns the candidates envelope', async () => {
    const data = { candidates: [{ id: 'hyp-001', reason: 'confidence' }] };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchPromotionCandidates();
    expect(result.candidates).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/promotion-candidates', undefined);
  });

  it('throws on server error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(fetchPromotionCandidates()).rejects.toThrow('500 Internal Server Error');
  });
});

describe('fetchConsolidation', () => {
  it('hits /api/consolidation and returns the check result', async () => {
    const data = { orphanedFindings: [], deferredItems: [], duplicateClusters: [] };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchConsolidation();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith('/api/consolidation', undefined);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(fetchConsolidation()).rejects.toThrow('404 Not Found');
  });
});

describe('fetchClusters', () => {
  it('hits /api/clusters and returns the clusters envelope', async () => {
    const data = {
      clusters: [
        { id: 'cluster-1', label: 'Test', nodeIds: ['hyp-001'], isManual: false },
      ],
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });

    const result = await fetchClusters();
    expect(result.clusters).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/clusters', undefined);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    await expect(fetchClusters()).rejects.toThrow('500 Internal Server Error');
  });
});

describe('api module does not import dashboardState', () => {
  it('module source has no dashboardState import', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/web/frontend/lib/api.ts', 'utf-8');
    expect(source).not.toContain('dashboardState');
  });
});
