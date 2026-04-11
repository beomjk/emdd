import type { SerializedGraph } from '../../types.js';

let _visibleTypes = $state(new Set<string>());
let _visibleStatuses = $state(new Set<string>());
let _visibleEdgeTypes = $state(new Set<string>());

// `_allTypes/_allStatuses/_allEdgeTypes` are owned by the filter store
// rather than derived from dashboardState.graph. Deriving them from another
// store created a hidden temporal-ordering constraint: mergeFromGraph had
// to execute before setGraph or it would misread "previously known" types
// and drop filter auto-visibility. Owning the state here removes that
// coupling — callers can update in any order.
let _allTypes = $state<string[]>([]);
let _allStatuses = $state<string[]>([]);
let _allEdgeTypes = $state<string[]>([]);
const _hasActiveFilters = $derived(
  _visibleTypes.size < _allTypes.length ||
  _visibleStatuses.size < _allStatuses.length ||
  _visibleEdgeTypes.size < _allEdgeTypes.length,
);

function uniqueSorted<T>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

export const filterState = {
  get visibleTypes() { return _visibleTypes; },
  set visibleTypes(v: Set<string>) { _visibleTypes = v; },

  get visibleStatuses() { return _visibleStatuses; },
  set visibleStatuses(v: Set<string>) { _visibleStatuses = v; },

  get visibleEdgeTypes() { return _visibleEdgeTypes; },
  set visibleEdgeTypes(v: Set<string>) { _visibleEdgeTypes = v; },

  get allTypes(): string[] { return _allTypes; },
  get allStatuses(): string[] { return _allStatuses; },
  get allEdgeTypes(): string[] { return _allEdgeTypes; },
  get hasActiveFilters(): boolean { return _hasActiveFilters; },

  toggleType(type: string) {
    const next = new Set(_visibleTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    _visibleTypes = next;
  },
  toggleStatus(status: string) {
    const next = new Set(_visibleStatuses);
    if (next.has(status)) next.delete(status); else next.add(status);
    _visibleStatuses = next;
  },
  toggleEdgeType(type: string) {
    const next = new Set(_visibleEdgeTypes);
    if (next.has(type)) next.delete(type); else next.add(type);
    _visibleEdgeTypes = next;
  },
  resetAll() {
    _visibleTypes = new Set(_allTypes);
    _visibleStatuses = new Set(_allStatuses);
    _visibleEdgeTypes = new Set(_allEdgeTypes);
  },
  initFromGraph(graph: SerializedGraph) {
    const types = uniqueSorted(graph.nodes.map((n) => n.type));
    const statuses = uniqueSorted(graph.nodes.map((n) => n.status));
    const edges = uniqueSorted(graph.edges.map((e) => e.relation));
    _allTypes = types;
    _allStatuses = statuses;
    _allEdgeTypes = edges;
    _visibleTypes = new Set(types);
    _visibleStatuses = new Set(statuses);
    _visibleEdgeTypes = new Set(edges);
  },
  mergeFromGraph(graph: SerializedGraph) {
    const prevKnownTypes = new Set(_allTypes);
    const prevKnownStatuses = new Set(_allStatuses);
    const prevKnownEdges = new Set(_allEdgeTypes);

    const incomingTypes = new Set(graph.nodes.map((n) => n.type));
    const incomingStatuses = new Set(graph.nodes.map((n) => n.status));
    const incomingEdges = new Set(graph.edges.map((e) => e.relation));

    // Add newly discovered values to visible sets, preserve user deselections
    const nextTypes = new Set(_visibleTypes);
    for (const t of incomingTypes) {
      if (!prevKnownTypes.has(t)) nextTypes.add(t);
    }
    for (const t of nextTypes) {
      if (!incomingTypes.has(t)) nextTypes.delete(t);
    }
    _visibleTypes = nextTypes;

    const nextStatuses = new Set(_visibleStatuses);
    for (const s of incomingStatuses) {
      if (!prevKnownStatuses.has(s)) nextStatuses.add(s);
    }
    for (const s of nextStatuses) {
      if (!incomingStatuses.has(s)) nextStatuses.delete(s);
    }
    _visibleStatuses = nextStatuses;

    const nextEdges = new Set(_visibleEdgeTypes);
    for (const e of incomingEdges) {
      if (!prevKnownEdges.has(e)) nextEdges.add(e);
    }
    for (const e of nextEdges) {
      if (!incomingEdges.has(e)) nextEdges.delete(e);
    }
    _visibleEdgeTypes = nextEdges;

    _allTypes = uniqueSorted(incomingTypes);
    _allStatuses = uniqueSorted(incomingStatuses);
    _allEdgeTypes = uniqueSorted(incomingEdges);
  },
};
