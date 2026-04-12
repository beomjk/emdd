import { type Page, type Locator, expect } from '@playwright/test';
import path from 'node:path';

/** Absolute path to the sample-graph fixture directory (14 nodes). */
export const SAMPLE_GRAPH_DIR = path.resolve(
  import.meta.dirname,
  '../../fixtures/sample-graph',
);

// ─── Selectors ──────────────────────────────────────────────────
export const sel = {
  // Layout
  toolbar: '.toolbar',
  mainArea: '.main-area',
  loadingState: '.loading-state',
  errorState: '.error-state',
  emptyState: '.empty-state',

  // Graph canvas
  graphCanvas: '.graph-canvas',
  cyContainer: '.cy-container',
  perfHint: '.perf-hint',
  legend: '.legend',

  // Tooltip
  tooltip: '.node-tooltip',
  tooltipTitle: '.node-tooltip-title',

  // Detail panel
  detailPanel: '.detail-panel',
  detailPanelOpen: '.detail-panel.open',
  detailClose: '.detail-close',
  detailTitle: '.detail-title',
  detailId: '.detail-id',
  badgeType: '.badge-type',
  badgeStatus: '.badge-status',
  hopBtn: '.hop-btn',
  hopBtnActive: '.hop-btn.active',
  linkTarget: '.link-target',
  invalidWarning: '.invalid-warning',
  confidenceBar: '.confidence-bar',

  // Filters
  filters: '.filters',
  filterSectionTypes: '.filter-section-types',
  filterSectionStatuses: '.filter-section-statuses',
  filterSectionEdges: '.filter-section-edges',
  filterBtn: '.filter-btn',
  filterBtnActive: '.filter-btn.active',
  resetBtn: '.reset-btn',

  // Search
  searchBar: '.search-bar',
  searchInput: '.search-bar input[type="text"]',
  matchList: '.match-list',
  matchItem: '.match-item',
  matchItemActive: '.match-item.active',
  matchCount: '.match-count',
  navBtn: '.nav-btn',

  // Health sidebar
  healthSidebar: '.health-sidebar',
  sidebarLoading: '.sidebar-loading',
  metricValue: '.metric-value',
  metricLabel: '.metric-label',
  typeBarRow: '.type-bar-row',
  nodeLink: '.node-link',
  gapItem: '.gap-item',
  promoItem: '.promo-item',

  // Theme
  themeToggle: '.theme-toggle',

  // Layout selector
  layoutSelector: '.layout-selector select',

  // Export & Refresh — Svelte migration unified these under .toolbar-btn,
  // so we target them by aria-label for a semantic, stable selector.
  exportBtn: 'button[aria-label="Export"]',
  refreshBtn: 'button[aria-label="Refresh"]',

  // Toast
  toast: '.toast',
  errorToast: '.error-toast',
} as const;

// ─── Known fixture data ─────────────────────────────────────────
export const FIXTURE = {
  nodeCount: 14,
  nodeIds: [
    'hyp-001', 'hyp-002',
    'exp-001',
    'fnd-001', 'fnd-002', 'fnd-003', 'fnd-004', 'fnd-005',
    'knw-001',
    'qst-001',
    'epi-001', 'epi-002', 'epi-003',
    'dec-001',
  ],
  types: ['decision', 'episode', 'experiment', 'finding', 'hypothesis', 'knowledge', 'question'],
  /** A node with known links for testing navigation */
  linkedNode: {
    id: 'exp-001',
    title: 'CNN Baseline Experiment',
    type: 'experiment',
    status: 'COMPLETED',
  },
  /** A node with confidence for testing the bar */
  confidenceNode: {
    id: 'fnd-001',
    title: 'CNN Achieves 92% Accuracy',
    type: 'finding',
    status: 'VALIDATED',
    confidence: 0.85,
  },
} as const;

// ─── Page Object Helpers ────────────────────────────────────────

/** Wait for the graph to finish loading and rendering. */
export async function waitForGraphReady(page: Page): Promise<void> {
  // Wait for loading state to disappear
  await page.locator(sel.loadingState).waitFor({ state: 'hidden', timeout: 10_000 });
  // Wait for graph canvas to appear
  await page.locator(sel.graphCanvas).waitFor({ state: 'visible', timeout: 10_000 });
  // Give Cytoscape a moment to complete initial layout
  await page.waitForTimeout(1000);
}

/** Get the number of Cytoscape nodes currently rendered (excluding cluster parents). */
export async function getCyNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
    if (!cy) return 0;
    return cy.nodes('[!isCluster]').length;
  });
}

/** Get IDs of all visible Cytoscape nodes (display !== none). */
export async function getVisibleNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
    if (!cy) return [];
    return cy.nodes('[!isCluster]')
      .filter((n: any) => n.visible())
      .map((n: any) => n.id());
  });
}

/** Click a Cytoscape node by its ID using the Cytoscape API. */
export async function clickCyNode(page: Page, nodeId: string): Promise<void> {
  await page.evaluate((id) => {
    const cy = (document.querySelector('.cy-container') as any)?._cyreg?.cy;
    if (!cy) throw new Error('Cytoscape not found');
    const node = cy.getElementById(id);
    if (node.empty()) throw new Error(`Node ${id} not found`);
    node.emit('tap');
  }, nodeId);
}

/** Get the current theme from the document element's data-theme attribute. */
export async function getTheme(page: Page): Promise<string> {
  return page.evaluate(
    () => document.documentElement.dataset.theme ?? 'light',
  );
}
