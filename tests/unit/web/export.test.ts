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

  it('preserves an explicit empty edge filter as zero exported edges', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { edgeCount, html } = generateExportHtml(graph, { edgeTypes: [] });

    expect(edgeCount).toBe(0);
    expect(html).toContain('0 edges');
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

  it('defaults exported HTML to the light theme', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    expect(html).toContain('data-theme="light"');
  });

  it('applies dark theme styling when requested', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph, { theme: 'dark' });

    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('#0f172a');
  });

  it('renders grouped-region container treatment when clusters are provided', () => {
    const graph = {
      nodes: [
        { id: 'hyp-001', title: 'Hypothesis 1', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
      ],
      edges: [],
      loadedAt: new Date().toISOString(),
    };
    const { html } = generateExportHtml(graph as any, {
      theme: 'dark',
      clusters: [
        { id: 'cluster-1', label: 'Manual Group', nodeIds: ['hyp-001'], isManual: true },
      ],
    });

    expect(html).toContain('"isCluster":true');
    expect(html).toContain('"parent":"cluster-1"');
    expect(html).toContain("node[?isCluster]");
    expect(html).toContain('Manual Group');
  });

  describe('XSS prevention', () => {
    it('escapes HTML in node titles to prevent innerHTML injection', () => {
      const xssPayload = '<img src=x onerror=alert(document.cookie)>';
      const graph = {
        nodes: [
          { id: 'hyp-001', title: xssPayload, type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      const { html } = generateExportHtml(graph as any);

      // The raw payload must not appear unescaped in the inline script
      expect(html).not.toContain("'+d.title+'");
      // The esc() function must be present
      expect(html).toContain('function esc(');
      // Title should be in JSON data (escaped by JSON.stringify), not raw HTML
      expect(html).not.toContain(`<h3>${xssPayload}</h3>`);
    });

    it('escapes </script> sequences in JSON data to prevent script breakout', () => {
      const graph = {
        nodes: [
          { id: 'hyp-001', title: '</script><script>alert(1)</script>', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      const { html } = generateExportHtml(graph as any);

      // The literal </script> must not appear inside the script block's JSON data
      // It should be escaped to <\/script>
      const scriptBlocks = html.match(/<script[\s\S]*?<\/script>/g) ?? [];
      for (const block of scriptBlocks) {
        const inner = block.slice(block.indexOf('>') + 1, block.lastIndexOf('</script>'));
        expect(inner).not.toContain('</script>');
      }
    });

    it('escapes tags containing XSS payloads', () => {
      const graph = {
        nodes: [
          { id: 'hyp-001', title: 'safe', type: 'hypothesis', status: 'PROPOSED', tags: ['<b>xss</b>'], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      const { html } = generateExportHtml(graph as any);

      // The esc() function should sanitize tags in the tap handler
      expect(html).toContain('esc(d.tags.join');
    });
  });
});
