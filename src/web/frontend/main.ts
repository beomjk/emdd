import type { SerializedGraph } from '../types.js';

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

async function refresh(): Promise<void> {
  await fetch('/api/refresh', { method: 'POST' });
  const graph = await fetchGraph();
  state.graph = graph;
  render(graph);
  showToast(`Refreshed at ${new Date().toLocaleTimeString()}`);
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

function render(graph: SerializedGraph): void {
  const emptyState = document.getElementById('empty-state')!;
  const cy = document.getElementById('cy')!;

  if (graph.nodes.length === 0) {
    emptyState.classList.remove('hidden');
    cy.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    cy.classList.remove('hidden');
    // Cytoscape rendering will be wired in Phase 3 (T021)
  }
}

async function init(): Promise<void> {
  const graph = await fetchGraph();
  state.graph = graph;
  render(graph);

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn?.addEventListener('click', refresh);
}

init().catch(console.error);
