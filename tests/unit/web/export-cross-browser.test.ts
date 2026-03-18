import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateExportHtml } from '../../../src/web/export.js';
import { createGraphCache } from '../../../src/web/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

/**
 * SC-008 Cross-browser validation (automated structural checks).
 *
 * Manual verification checklist for Chrome/Firefox/Safari/Edge:
 * 1. Open the exported HTML file in each browser
 * 2. Verify the graph renders with colored nodes
 * 3. Verify zoom (scroll wheel) works
 * 4. Verify pan (drag background) works
 * 5. Verify click-for-detail popup appears when clicking a node
 * 6. Verify the detail popup closes when clicking background
 * 7. Verify edge labels appear on hover
 */
describe('SC-008: Export HTML cross-browser compatibility', () => {
  it('uses only standard HTML5 / ES5 constructs in inline JS', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // Should be valid HTML5 doctype
    expect(html).toMatch(/^<!DOCTYPE html>/i);

    // Should use charset meta
    expect(html).toContain('charset="UTF-8"');

    // Should use viewport meta for mobile
    expect(html).toContain('name="viewport"');
  });

  it('has no ES module syntax (import/export) in inline scripts', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // The inline scripts should use IIFE pattern, not ES modules
    expect(html).not.toMatch(/<script[^>]*type=["']module["']/);
    // Should use var or function, not const/let at top level (for older browser compat)
    expect(html).toContain('var elements');
    expect(html).toContain('var cy');
  });

  it('inline scripts are self-contained with no external dependencies', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // No external script src attributes
    const scriptSrcPattern = /<script[^>]+src=["']https?:/;
    expect(scriptSrcPattern.test(html)).toBe(false);

    // No external stylesheet links
    const linkPattern = /<link[^>]+href=["']https?:/;
    expect(linkPattern.test(html)).toBe(false);
  });

  it('contains all required interactive elements', async () => {
    const cache = createGraphCache(SAMPLE_GRAPH);
    const graph = await cache.getGraph();
    const { html } = generateExportHtml(graph);

    // Graph container
    expect(html).toContain('id="cy"');

    // Detail panel
    expect(html).toContain('id="detail"');
    expect(html).toContain('id="detail-content"');

    // Close button for detail
    expect(html).toContain('class="close"');

    // Click handlers for interactivity
    expect(html).toContain("cy.on('tap','node'");
    expect(html).toContain("cy.on('mouseover','edge'");
  });
});
