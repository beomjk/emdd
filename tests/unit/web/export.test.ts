import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateExportHtml } from '../../../src/web/export.js';
import { createGraphCache } from '../../../src/web/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

describe('generateExportHtml', () => {
  it('returns HTML with inline Cytoscape.js', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html, nodeCount, edgeCount } = generateExportHtml(graph);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('cytoscape');
    expect(html).toContain('EMDD Graph Export');
    expect(nodeCount).toBe(14);
    expect(edgeCount).toBeGreaterThan(0);
  });

  it('embeds graph data as JSON', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // Should contain node IDs embedded as JSON data
    expect(html).toContain('hyp-001');
    expect(html).toContain('exp-001');
  });

  it('does not contain sidebar, search, or filter controls', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    expect(html).not.toContain('id="sidebar"');
    expect(html).not.toContain('id="search-bar"');
    expect(html).not.toContain('id="filter');
    expect(html).not.toContain('id="timeline"');
  });

  it('generates standalone HTML with no external requests', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // Should not have external script/link/img tags with http(s) URLs
    const externalPattern = /(src|href)=["']https?:\/\//;
    expect(externalPattern.test(html)).toBe(false);
  });

  it('filters by type when types option is provided', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { nodeCount } = generateExportHtml(graph, { types: ['hypothesis'] });

    const hypCount = graph.nodes.filter((n) => n.type === 'hypothesis').length;
    expect(nodeCount).toBe(hypCount);
    expect(nodeCount).toBeLessThan(14);
  });

  it('filters by status when statuses option is provided', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { nodeCount } = generateExportHtml(graph, { statuses: ['TESTING'] });

    const testingCount = graph.nodes.filter((n) => n.status === 'TESTING').length;
    expect(nodeCount).toBe(testingCount);
  });

  it('applies hierarchical layout config', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph, { layout: 'hierarchical' });

    expect(html).toContain("name: 'dagre'");
    expect(html).toContain('rankDir');
  });

  it('applies force layout config by default', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    expect(html).toContain("name: 'fcose'");
  });
});
