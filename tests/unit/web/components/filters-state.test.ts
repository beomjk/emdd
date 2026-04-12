import { describe, it, expect, beforeEach } from 'vitest';
import { filterState } from '../../../../src/web/frontend/state/filters.svelte.js';
import type { SerializedGraph } from '../../../../src/web/types.js';

function makeGraph(
  types: string[] = ['hypothesis', 'experiment'],
  statuses: string[] = ['PROPOSED', 'TESTING'],
  edgeRelations: string[] = ['tests'],
): SerializedGraph {
  const nodes = types.flatMap((type, ti) =>
    statuses.map((status, si) => ({
      id: `n-${ti}-${si}`,
      title: `Node ${ti}-${si}`,
      type,
      status,
      tags: [],
      links: [],
    })),
  );
  const edges = edgeRelations.map((relation, i) => ({
    source: nodes[0]?.id ?? 'a',
    target: nodes[1]?.id ?? 'b',
    relation,
  }));
  return { nodes, edges, loadedAt: new Date().toISOString() };
}

describe('filterState', () => {
  beforeEach(() => {
    // Reset to a clean slate — filterState now owns its own knownTypes state
    // (no longer derived from dashboardState.graph), so reset via initFromGraph
    // on an empty graph.
    filterState.initFromGraph({ nodes: [], edges: [], loadedAt: '' });
  });

  describe('initFromGraph', () => {
    it('sets all types, statuses, edgeTypes as visible', () => {
      const graph = makeGraph();
      filterState.initFromGraph(graph);

      expect(filterState.visibleTypes).toEqual(new Set(['hypothesis', 'experiment']));
      expect(filterState.visibleStatuses).toEqual(new Set(['PROPOSED', 'TESTING']));
      expect(filterState.visibleEdgeTypes).toEqual(new Set(['tests']));
    });
  });

  describe('toggleType / toggleStatus / toggleEdgeType', () => {
    it('toggleType removes then adds type', () => {
      const graph = makeGraph();
      filterState.initFromGraph(graph);

      filterState.toggleType('hypothesis');
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);

      filterState.toggleType('hypothesis');
      expect(filterState.visibleTypes.has('hypothesis')).toBe(true);
    });

    it('toggleStatus removes then adds status', () => {
      filterState.initFromGraph(makeGraph());
      filterState.toggleStatus('PROPOSED');
      expect(filterState.visibleStatuses.has('PROPOSED')).toBe(false);
    });

    it('toggleEdgeType removes then adds edge type', () => {
      filterState.initFromGraph(makeGraph());
      filterState.toggleEdgeType('tests');
      expect(filterState.visibleEdgeTypes.has('tests')).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('restores all types/statuses/edgeTypes to visible', () => {
      const graph = makeGraph();
      filterState.initFromGraph(graph);

      filterState.toggleType('hypothesis');
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);

      filterState.resetAll();
      expect(filterState.visibleTypes).toEqual(new Set(['experiment', 'hypothesis']));
    });
  });

  describe('mergeFromGraph', () => {
    it('preserves user deselection when graph updates', () => {
      const graph1 = makeGraph(['hypothesis', 'experiment']);
      filterState.initFromGraph(graph1);

      // User deselects hypothesis
      filterState.toggleType('hypothesis');
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);

      // SSE update with same types — should preserve deselection
      const graph2 = makeGraph(['hypothesis', 'experiment']);
      filterState.mergeFromGraph(graph2);
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);
      expect(filterState.visibleTypes.has('experiment')).toBe(true);
    });

    it('adds newly discovered types as visible', () => {
      const graph1 = makeGraph(['hypothesis']);
      filterState.initFromGraph(graph1);

      // SSE update introduces 'finding' type
      const graph2 = makeGraph(['hypothesis', 'finding']);
      filterState.mergeFromGraph(graph2);
      expect(filterState.visibleTypes.has('finding')).toBe(true);
    });

    it('removes types that no longer exist in graph', () => {
      const graph1 = makeGraph(['hypothesis', 'experiment']);
      filterState.initFromGraph(graph1);

      // SSE update removes 'experiment'
      const graph2 = makeGraph(['hypothesis']);
      filterState.mergeFromGraph(graph2);
      expect(filterState.visibleTypes.has('experiment')).toBe(false);
    });

    it('detects newly-discovered types regardless of any sibling store state', () => {
      // filterState owns _knownTypes directly. It no longer needs callers
      // to invoke it before some other store's setter — any order is fine.
      const graph1 = makeGraph(['hypothesis']);
      filterState.initFromGraph(graph1);

      const graph2 = makeGraph(['hypothesis', 'finding']);
      filterState.mergeFromGraph(graph2);

      expect(filterState.visibleTypes.has('finding')).toBe(true);
      expect(filterState.allTypes).toEqual(['finding', 'hypothesis']);
    });

    it('preserves deselection even after multiple merges that add+remove types', () => {
      filterState.initFromGraph(makeGraph(['hypothesis', 'experiment']));
      filterState.toggleType('hypothesis');
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);

      // Add a new type
      filterState.mergeFromGraph(makeGraph(['hypothesis', 'experiment', 'finding']));
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);
      expect(filterState.visibleTypes.has('finding')).toBe(true);

      // Remove experiment
      filterState.mergeFromGraph(makeGraph(['hypothesis', 'finding']));
      expect(filterState.visibleTypes.has('hypothesis')).toBe(false);
      expect(filterState.visibleTypes.has('finding')).toBe(true);
      expect(filterState.allTypes).toEqual(['finding', 'hypothesis']);
    });

    it('preserves status deselection when graph updates', () => {
      filterState.initFromGraph(makeGraph(['hypothesis'], ['PROPOSED', 'TESTING']));

      filterState.toggleStatus('PROPOSED');
      expect(filterState.visibleStatuses.has('PROPOSED')).toBe(false);

      // SSE update with same statuses — should preserve deselection
      filterState.mergeFromGraph(makeGraph(['hypothesis'], ['PROPOSED', 'TESTING']));
      expect(filterState.visibleStatuses.has('PROPOSED')).toBe(false);
      expect(filterState.visibleStatuses.has('TESTING')).toBe(true);
    });

    it('adds newly discovered statuses as visible', () => {
      filterState.initFromGraph(makeGraph(['hypothesis'], ['PROPOSED']));

      filterState.mergeFromGraph(makeGraph(['hypothesis'], ['PROPOSED', 'SUPPORTED']));
      expect(filterState.visibleStatuses.has('SUPPORTED')).toBe(true);
    });

    it('preserves edgeType deselection when graph updates', () => {
      filterState.initFromGraph(makeGraph(['hypothesis'], ['PROPOSED'], ['tests', 'supports']));

      filterState.toggleEdgeType('tests');
      expect(filterState.visibleEdgeTypes.has('tests')).toBe(false);

      // SSE update with same edge types — should preserve deselection
      filterState.mergeFromGraph(makeGraph(['hypothesis'], ['PROPOSED'], ['tests', 'supports']));
      expect(filterState.visibleEdgeTypes.has('tests')).toBe(false);
      expect(filterState.visibleEdgeTypes.has('supports')).toBe(true);
    });

    it('adds newly discovered edgeTypes as visible', () => {
      filterState.initFromGraph(makeGraph(['hypothesis'], ['PROPOSED'], ['tests']));

      filterState.mergeFromGraph(makeGraph(['hypothesis'], ['PROPOSED'], ['tests', 'contradicts']));
      expect(filterState.visibleEdgeTypes.has('contradicts')).toBe(true);
    });
  });

  describe('hasActiveFilters', () => {
    it('returns false when all types/statuses/edgeTypes are visible', () => {
      const graph = makeGraph();
      filterState.initFromGraph(graph);

      expect(filterState.hasActiveFilters).toBe(false);
    });

    it('returns true when a type is deselected', () => {
      const graph = makeGraph();
      filterState.initFromGraph(graph);

      filterState.toggleType('hypothesis');
      expect(filterState.hasActiveFilters).toBe(true);
    });
  });

  describe('stripEmpty', () => {
    it('excludes empty-string statuses from allStatuses and visibleStatuses', () => {
      // Nodes without a `status` frontmatter field get coerced to '' by the
      // loader. The filter store should strip these so they never appear as
      // filter chips.
      const graph: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: '', tags: [], links: [] },
          { id: 'b', title: 'B', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      filterState.initFromGraph(graph);

      expect(filterState.allStatuses).toEqual(['PROPOSED']);
      expect(filterState.visibleStatuses).toEqual(new Set(['PROPOSED']));
      // The empty string should not appear in either list
      expect(filterState.allStatuses).not.toContain('');
      expect(filterState.visibleStatuses.has('')).toBe(false);
    });

    it('excludes empty-string statuses after mergeFromGraph', () => {
      const graph1: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      filterState.initFromGraph(graph1);

      const graph2: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
          { id: 'b', title: 'B', type: 'experiment', status: '', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      filterState.mergeFromGraph(graph2);

      expect(filterState.allStatuses).not.toContain('');
      expect(filterState.visibleStatuses.has('')).toBe(false);
    });
  });

  describe('reactivity optimization', () => {
    it('mergeFromGraph does not reassign sets when values are unchanged', () => {
      const graph: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
          { id: 'b', title: 'B', type: 'experiment', status: 'TESTING', tags: [], links: [] },
        ],
        edges: [{ source: 'a', target: 'b', relation: 'tests' }],
        loadedAt: new Date().toISOString(),
      };
      filterState.initFromGraph(graph);

      // Capture current Set references
      const prevTypes = filterState.visibleTypes;
      const prevStatuses = filterState.visibleStatuses;
      const prevEdges = filterState.visibleEdgeTypes;

      // Merge identical graph — sets should be same references (no $state trigger)
      filterState.mergeFromGraph(graph);

      expect(filterState.visibleTypes).toBe(prevTypes);
      expect(filterState.visibleStatuses).toBe(prevStatuses);
      expect(filterState.visibleEdgeTypes).toBe(prevEdges);
    });

    it('mergeFromGraph reassigns sets when values actually change', () => {
      const graph1: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      filterState.initFromGraph(graph1);
      const prevTypes = filterState.visibleTypes;

      const graph2: SerializedGraph = {
        nodes: [
          { id: 'a', title: 'A', type: 'hypothesis', status: 'PROPOSED', tags: [], links: [] },
          { id: 'b', title: 'B', type: 'experiment', status: 'TESTING', tags: [], links: [] },
        ],
        edges: [],
        loadedAt: new Date().toISOString(),
      };
      filterState.mergeFromGraph(graph2);

      // New type 'experiment' was added → new Set reference
      expect(filterState.visibleTypes).not.toBe(prevTypes);
      expect(filterState.visibleTypes.has('experiment')).toBe(true);
    });
  });
});
