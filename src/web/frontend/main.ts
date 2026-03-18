import type { SerializedGraph } from '../types.js';
import { renderGraph, highlightNeighbors, clearHighlights, getCy } from './graph.js';
import { showDetailPanel, hideDetailPanel, setDepthChangeHandler, getCurrentDepth } from './detail-panel.js';
import { renderFilters, setFilterChangeHandler } from './filters.js';
import { renderSearchBar } from './search.js';
import { renderHealthSidebar } from './sidebar.js';

export interface DashboardState {
  graph: SerializedGraph | null;
  selectedNodeId: string | null;
  visibleTypes: Set<string>;
  visibleStatuses: Set<string>;
  visibleEdgeTypes: Set<string>;
  layout: 'force' | 'hierarchical';
}

export const state: DashboardState = {
  graph: null,
  selectedNodeId: null,
  visibleTypes: new Set(),
  visibleStatuses: new Set(),
  visibleEdgeTypes: new Set(),
  layout: 'force',
};

async function fetchGraph(): Promise<SerializedGraph> {
  const res = await fetch('/api/graph');
  return res.json();
}

async function fetchNeighbors(nodeId: string, depth: number): Promise<string[]> {
  const res = await fetch(`/api/neighbors/${nodeId}?depth=${depth}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.neighbors ?? []).map((n: { id: string }) => n.id);
}

async function selectNode(nodeId: string): Promise<void> {
  state.selectedNodeId = nodeId;
  await showDetailPanel(nodeId);

  const depth = getCurrentDepth();
  const neighborIds = await fetchNeighbors(nodeId, depth);
  highlightNeighbors(neighborIds, nodeId);
}

function deselectNode(): void {
  state.selectedNodeId = null;
  hideDetailPanel();
  clearHighlights();
}

function showToast(message: string): void {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

async function refresh(): Promise<void> {
  await fetch('/api/refresh', { method: 'POST' });
  const graph = await fetchGraph();
  state.graph = graph;
  renderDashboard(graph);
  showToast(`Refreshed at ${new Date().toLocaleTimeString()}`);
}

function extractUniqueValues(graph: SerializedGraph): {
  types: string[];
  statuses: string[];
  edgeTypes: string[];
} {
  const types = new Set<string>();
  const statuses = new Set<string>();
  const edgeTypes = new Set<string>();

  for (const node of graph.nodes) {
    types.add(node.type);
    if (node.status) statuses.add(node.status);
  }
  for (const edge of graph.edges) {
    edgeTypes.add(edge.relation);
  }

  return {
    types: [...types].sort(),
    statuses: [...statuses].sort(),
    edgeTypes: [...edgeTypes].sort(),
  };
}

function renderDashboard(graph: SerializedGraph): void {
  const emptyState = document.getElementById('empty-state')!;
  const cyContainer = document.getElementById('cy')!;

  if (graph.nodes.length === 0) {
    emptyState.classList.remove('hidden');
    cyContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  cyContainer.classList.remove('hidden');

  renderGraph(cyContainer, graph, {
    onNodeClick: (id) => selectNode(id),
    onNodeSelect: (id) => selectNode(id),
    onBackgroundClick: () => deselectNode(),
  });

  // Render filters in sidebar
  const sidebar = document.getElementById('sidebar')!;
  const { types, statuses, edgeTypes } = extractUniqueValues(graph);
  renderFilters(sidebar, types, statuses, edgeTypes);

  // Render health sidebar above filters
  renderHealthSidebar(sidebar, {
    onNodeClick: (id) => selectNode(id),
  }).catch(console.error);

  // Sync filter state
  state.visibleTypes = new Set(types);
  state.visibleStatuses = new Set(statuses);
  state.visibleEdgeTypes = new Set(edgeTypes);
}

// Filter change handler — sync state
setFilterChangeHandler((filterState) => {
  state.visibleTypes = filterState.visibleTypes;
  state.visibleStatuses = filterState.visibleStatuses;
  state.visibleEdgeTypes = filterState.visibleEdgeTypes;
});

// Depth change handler — re-fetch neighbors for selected node
setDepthChangeHandler(async (depth) => {
  if (!state.selectedNodeId) return;
  const neighborIds = await fetchNeighbors(state.selectedNodeId, depth);
  highlightNeighbors(neighborIds, state.selectedNodeId);
});

async function init(): Promise<void> {
  const graph = await fetchGraph();
  state.graph = graph;
  renderDashboard(graph);

  // Render search bar
  const searchContainer = document.getElementById('search-bar')!;
  renderSearchBar(searchContainer);

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn?.addEventListener('click', refresh);
}

init().catch(console.error);
