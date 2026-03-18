// Frontend entry point — placeholder for Phase 2
export interface DashboardState {
  graph: unknown | null;
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

console.log('EMDD Dashboard loaded');
