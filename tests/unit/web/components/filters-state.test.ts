import { describe, it, expect, beforeEach } from 'vitest';
import { filterState } from '../../../../src/web/frontend/state/filters.svelte.js';
import { dashboardState } from '../../../../src/web/frontend/state/dashboard.svelte.js';
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
    dashboardState.graph = null;
    filterState.visibleTypes = new Set();
    filterState.visibleStatuses = new Set();
    filterState.visibleEdgeTypes = new Set();
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
      dashboardState.setGraph(graph);
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
      dashboardState.setGraph(graph1);
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
      dashboardState.setGraph(graph1);
      filterState.initFromGraph(graph1);

      // SSE update introduces 'finding' type
      const graph2 = makeGraph(['hypothesis', 'finding']);
      filterState.mergeFromGraph(graph2);
      expect(filterState.visibleTypes.has('finding')).toBe(true);
    });

    it('removes types that no longer exist in graph', () => {
      const graph1 = makeGraph(['hypothesis', 'experiment']);
      dashboardState.setGraph(graph1);
      filterState.initFromGraph(graph1);

      // SSE update removes 'experiment'
      const graph2 = makeGraph(['hypothesis']);
      filterState.mergeFromGraph(graph2);
      expect(filterState.visibleTypes.has('experiment')).toBe(false);
    });
  });

  describe('hasActiveFilters', () => {
    it('returns false when all types/statuses/edgeTypes are visible', () => {
      const graph = makeGraph();
      dashboardState.setGraph(graph);
      filterState.initFromGraph(graph);

      expect(filterState.hasActiveFilters).toBe(false);
    });

    it('returns true when a type is deselected', () => {
      const graph = makeGraph();
      dashboardState.setGraph(graph);
      filterState.initFromGraph(graph);

      filterState.toggleType('hypothesis');
      expect(filterState.hasActiveFilters).toBe(true);
    });
  });
});
