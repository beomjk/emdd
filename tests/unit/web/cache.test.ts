import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphCache } from '../../../src/web/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

describe('GraphCache', () => {
  it('load() returns a SerializedGraph', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.load();

    expect(graph).toHaveProperty('nodes');
    expect(graph).toHaveProperty('edges');
    expect(graph).toHaveProperty('loadedAt');
    expect(graph.nodes.length).toBe(14);
    expect(typeof graph.loadedAt).toBe('string');
  });

  it('getGraph() returns cached reference on repeated calls', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const first = await cache.getGraph();
    const second = await cache.getGraph();
    expect(first).toBe(second); // same reference
  });

  it('invalidate() triggers fresh load on next getGraph()', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const first = await cache.getGraph();

    cache.invalidate();
    const second = await cache.getGraph();

    expect(first).not.toBe(second); // different reference
    expect(second.nodes.length).toBe(first.nodes.length);
  });

  it('getHealth() returns a HealthReport', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const health = await cache.getHealth();

    expect(health).toHaveProperty('totalNodes');
    expect(health).toHaveProperty('totalEdges');
    expect(health).toHaveProperty('byType');
    expect(health).toHaveProperty('statusDistribution');
    expect(health).toHaveProperty('avgConfidence');
    expect(health).toHaveProperty('gaps');
    expect(health).toHaveProperty('gapDetails');
    expect(health.totalNodes).toBe(14);
  });

  it('getHealth() returns cached reference on repeated calls', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const first = await cache.getHealth();
    const second = await cache.getHealth();
    expect(first).toBe(second);
  });

  it('invalidate() clears health cache too', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const first = await cache.getHealth();
    cache.invalidate();
    const second = await cache.getHealth();
    expect(first).not.toBe(second);
  });

  it('getRawGraph() returns a Graph with Map-based nodes', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const raw = await cache.getRawGraph();
    expect(raw.nodes).toBeInstanceOf(Map);
    expect(raw.nodes.size).toBe(14);
  });

  it('getClusters() returns VisualCluster array', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const clusters = await cache.getClusters();
    expect(Array.isArray(clusters)).toBe(true);
    // sample-graph may or may not produce clusters — just verify shape
    for (const c of clusters) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('label');
      expect(c).toHaveProperty('nodeIds');
      expect(c).toHaveProperty('isManual');
    }
  });

  it('load() invalidates health and cluster caches', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const health1 = await cache.getHealth();
    const clusters1 = await cache.getClusters();

    // Reload forces health and clusters to be re-fetched
    await cache.load();
    const health2 = await cache.getHealth();
    const clusters2 = await cache.getClusters();

    expect(health1).not.toBe(health2);
    expect(clusters1).not.toBe(clusters2);
  });

  it('serialized nodes have expected shape', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();

    const node = graph.nodes.find((n) => n.id === 'hyp-001');
    expect(node).toBeDefined();
    expect(node!.type).toBe('hypothesis');
    expect(node!.title).toBe('Surface Defect Detection via CNN');
    expect(node!.status).toBe('TESTING');
    expect(Array.isArray(node!.tags)).toBe(true);
    expect(Array.isArray(node!.links)).toBe(true);
  });
});
