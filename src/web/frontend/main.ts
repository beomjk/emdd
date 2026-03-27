import type { SerializedGraph } from '../types.js';
import { NODE_COLORS, STATUS_BORDER_LEGEND } from './constants.js';
import { renderGraph, highlightNeighbors, clearHighlights, getCy } from './graph.js';
import { showDetailPanel, hideDetailPanel, setDepthChangeHandler, getCurrentDepth } from './detail-panel.js';
import { renderFilters, setFilterChangeHandler } from './filters.js';
import { renderSearchBar } from './search.js';
import { renderHealthSidebar } from './sidebar.js';
import { applyClusters, zoomToCluster } from './clusters.js';
import { switchLayout } from './graph.js';
import type { LayoutMode } from './graph.js';
import { initTheme, toggleTheme } from './theme.js';
import { connectSSE, setGraphUpdatedHandler } from './live-reload.js';

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

  // Apply cluster visualization
  const cyInstance = getCy();
  if (cyInstance) {
    applyClusters(cyInstance, {
      onClusterClick: (cluster) => {
        if (cyInstance) zoomToCluster(cyInstance, cluster);
      },
    }).catch(console.error);
  }

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

  // Render legend
  renderLegend();

  // Theme toggle
  initTheme();
  const themeBtn = document.getElementById('theme-btn');
  themeBtn?.addEventListener('click', toggleTheme);

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn?.addEventListener('click', refresh);

  // Export button — download standalone HTML
  const exportBtn = document.getElementById('export-btn');
  exportBtn?.addEventListener('click', async () => {
    const params = new URLSearchParams();
    params.set('layout', state.layout);
    if (state.visibleTypes.size > 0 && state.graph) {
      const allTypes = new Set(state.graph.nodes.map((n) => n.type));
      if (state.visibleTypes.size < allTypes.size) {
        params.set('types', [...state.visibleTypes].join(','));
      }
    }
    if (state.visibleStatuses.size > 0 && state.graph) {
      const allStatuses = new Set(state.graph.nodes.map((n) => n.status).filter(Boolean));
      if (state.visibleStatuses.size < allStatuses.size) {
        params.set('statuses', [...state.visibleStatuses].join(','));
      }
    }
    const res = await fetch(`/api/export?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-dashboard.html';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Render layout selector dropdown
  const layoutSelector = document.getElementById('layout-selector');
  if (layoutSelector) {
    const select = document.createElement('select');
    select.id = 'layout-select';
    select.title = 'Switch graph layout';
    const forceOpt = document.createElement('option');
    forceOpt.value = 'force';
    forceOpt.textContent = 'Force-directed';
    forceOpt.selected = true;
    const hierOpt = document.createElement('option');
    hierOpt.value = 'hierarchical';
    hierOpt.textContent = 'Hierarchical';
    select.appendChild(forceOpt);
    select.appendChild(hierOpt);
    select.addEventListener('change', () => {
      const mode = select.value as LayoutMode;
      state.layout = mode;
      switchLayout(mode);
    });
    layoutSelector.appendChild(select);
  }

  // SSE live reload
  setGraphUpdatedHandler(async () => {
    const updatedGraph = await fetchGraph();
    state.graph = updatedGraph;
    const previouslySelected = state.selectedNodeId;
    renderDashboard(updatedGraph);
    showToast('Graph updated');
    if (previouslySelected && updatedGraph.nodes.some((n) => n.id === previouslySelected)) {
      await selectNode(previouslySelected);
    }
  });
  connectSSE();
}

function renderLegend(): void {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;

  const existing = canvas.querySelector('.legend');
  if (existing) existing.remove();

  const legend = document.createElement('div');
  legend.className = 'legend';

  const typeColors: [string, string][] = Object.entries(NODE_COLORS).map(
    ([type, color]) => [type.charAt(0).toUpperCase() + type.slice(1), color],
  );

  const statusBorders = STATUS_BORDER_LEGEND;

  // Node types heading
  const typeHeading = document.createElement('div');
  typeHeading.className = 'legend-heading';
  typeHeading.textContent = 'Node Types';
  legend.appendChild(typeHeading);

  for (const [label, color] of typeColors) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-color';
    dot.style.backgroundColor = color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(label));
    legend.appendChild(item);
  }

  // Toggle for status borders
  const sep = document.createElement('hr');
  sep.className = 'legend-separator';
  legend.appendChild(sep);

  const statusHeading = document.createElement('div');
  statusHeading.className = 'legend-heading';
  statusHeading.textContent = 'Status Borders';
  legend.appendChild(statusHeading);

  const details = document.createElement('div');
  details.className = 'legend-details';

  for (const [label, style, color, width] of statusBorders) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sample = document.createElement('span');
    sample.className = 'legend-border-sample';
    sample.style.borderTop = `${width}px ${style} ${color}`;
    item.appendChild(sample);
    item.appendChild(document.createTextNode(label));
    details.appendChild(item);
  }

  legend.appendChild(details);
  canvas.appendChild(legend);
}

init().catch(console.error);
