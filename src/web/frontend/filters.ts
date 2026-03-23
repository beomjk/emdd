import { getCy } from './graph.js';
import { NODE_COLORS } from './constants.js';

interface FilterState {
  visibleTypes: Set<string>;
  visibleStatuses: Set<string>;
  visibleEdgeTypes: Set<string>;
}

let filterState: FilterState = {
  visibleTypes: new Set(),
  visibleStatuses: new Set(),
  visibleEdgeTypes: new Set(),
};

let onFilterChange: ((state: FilterState) => void) | null = null;

export function setFilterChangeHandler(handler: (state: FilterState) => void): void {
  onFilterChange = handler;
}

export function getFilterState(): FilterState {
  return filterState;
}

function createToggleButton(
  label: string,
  active: boolean,
  color: string | null,
  onClick: (nowActive: boolean) => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'filter-btn';
  btn.textContent = label;
  btn.dataset.filterColor = color ?? '#555';
  const applyStyle = (el: HTMLButtonElement, isActive: boolean) => {
    const c = el.dataset.filterColor ?? '#555';
    el.style.cssText = `
      padding: 2px 8px; margin: 2px; border-radius: 3px; cursor: pointer;
      font-size: 11px; border: 1px solid ${color ?? '#ccc'};
      background: ${isActive ? c : '#fff'};
      color: ${isActive ? '#fff' : '#555'};
      opacity: ${isActive ? '1' : '0.5'};
    `;
  };
  applyStyle(btn, active);
  btn.addEventListener('click', () => {
    const nowActive = btn.style.opacity === '0.5';
    applyStyle(btn, nowActive);
    onClick(nowActive);
  });
  return btn;
}

function applyFilters(): void {
  const cy = getCy();
  if (!cy) return;

  cy.batch(() => {
    cy.nodes().forEach((node) => {
      // Skip cluster compound nodes — they follow their children's visibility
      if (node.data('isCluster')) return;
      const type = node.data('type') as string;
      const status = node.data('status') as string;
      const typeVisible = filterState.visibleTypes.has(type);
      const statusVisible = !status || filterState.visibleStatuses.has(status);
      node.style('display', typeVisible && statusVisible ? 'element' : 'none');
    });

    cy.edges().forEach((edge) => {
      const relation = edge.data('relation') as string;
      const src = edge.source();
      const tgt = edge.target();
      const edgeVisible = filterState.visibleEdgeTypes.has(relation);
      const srcVisible = src.style('display') !== 'none';
      const tgtVisible = tgt.style('display') !== 'none';
      edge.style('display', edgeVisible && srcVisible && tgtVisible ? 'element' : 'none');
    });
  });

  onFilterChange?.(filterState);
}

export function renderFilters(
  container: HTMLElement,
  types: string[],
  statuses: string[],
  edgeTypes: string[],
): void {
  // Initialize all as visible
  filterState.visibleTypes = new Set(types);
  filterState.visibleStatuses = new Set(statuses);
  filterState.visibleEdgeTypes = new Set(edgeTypes);

  container.innerHTML = '';

  // Type filters
  const typeSection = document.createElement('div');
  typeSection.className = 'filter-section';
  typeSection.innerHTML = '<span class="filter-label">Types</span>';
  for (const type of types) {
    const btn = createToggleButton(type, true, NODE_COLORS[type as import('../../graph/types.js').NodeType] ?? null, (active) => {
      if (active) filterState.visibleTypes.add(type);
      else filterState.visibleTypes.delete(type);
      applyFilters();
    });
    typeSection.appendChild(btn);
  }
  container.appendChild(typeSection);

  // Status filters
  if (statuses.length > 0) {
    const statusSection = document.createElement('div');
    statusSection.className = 'filter-section';
    statusSection.innerHTML = '<span class="filter-label">Status</span>';
    for (const status of statuses) {
      const btn = createToggleButton(status, true, null, (active) => {
        if (active) filterState.visibleStatuses.add(status);
        else filterState.visibleStatuses.delete(status);
        applyFilters();
      });
      statusSection.appendChild(btn);
    }
    container.appendChild(statusSection);
  }

  // Edge type filters
  if (edgeTypes.length > 0) {
    const edgeSection = document.createElement('div');
    edgeSection.className = 'filter-section';
    edgeSection.innerHTML = '<span class="filter-label">Edges</span>';
    for (const et of edgeTypes) {
      const btn = createToggleButton(et, true, null, (active) => {
        if (active) filterState.visibleEdgeTypes.add(et);
        else filterState.visibleEdgeTypes.delete(et);
        applyFilters();
      });
      edgeSection.appendChild(btn);
    }
    container.appendChild(edgeSection);
  }

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset Filters';
  resetBtn.className = 'filter-reset-btn';
  resetBtn.style.cssText = `
    margin-top: 8px; padding: 4px 12px; border: 1px solid #ccc;
    border-radius: 4px; background: #fff; cursor: pointer;
    font-size: 11px; width: 100%;
  `;
  resetBtn.addEventListener('click', () => {
    filterState.visibleTypes = new Set(types);
    filterState.visibleStatuses = new Set(statuses);
    filterState.visibleEdgeTypes = new Set(edgeTypes);
    // Reset all buttons visually to active state
    container.querySelectorAll('.filter-btn').forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const c = el.dataset.filterColor ?? '#555';
      el.style.background = c;
      el.style.color = '#fff';
      el.style.opacity = '1';
    });
    applyFilters();
  });
  container.appendChild(resetBtn);
}
