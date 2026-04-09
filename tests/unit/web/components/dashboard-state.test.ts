import { describe, it, expect, beforeEach } from 'vitest';
import { dashboardState } from '../../../../src/web/frontend/state/dashboard.svelte.js';
import type { SerializedGraph } from '../../../../src/web/types.js';

function makeGraph(nodeCount = 2): SerializedGraph {
  return {
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `hyp-${String(i + 1).padStart(3, '0')}`,
      title: `Hypothesis ${i + 1}`,
      type: 'hypothesis',
      status: 'PROPOSED',
      tags: [],
      links: [],
    })),
    edges: [],
    loadedAt: new Date().toISOString(),
  };
}

describe('dashboardState', () => {
  beforeEach(() => {
    dashboardState.graph = null;
    dashboardState.selectedNodeId = null;
    dashboardState.layout = 'force';
    dashboardState.theme = 'light';
    dashboardState.error = null;
  });

  it('setGraph stores graph data', () => {
    const graph = makeGraph();
    dashboardState.setGraph(graph);
    expect(dashboardState.graph).toStrictEqual(graph);
    expect(dashboardState.graph!.nodes).toHaveLength(2);
  });

  it('selectNode and deselectNode manage selectedNodeId', () => {
    dashboardState.setGraph(makeGraph());
    dashboardState.selectNode('hyp-001');
    expect(dashboardState.selectedNodeId).toBe('hyp-001');

    dashboardState.deselectNode();
    expect(dashboardState.selectedNodeId).toBeNull();
  });

  it('selectedNode derives from graph + selectedNodeId', () => {
    const graph = makeGraph();
    dashboardState.setGraph(graph);

    expect(dashboardState.selectedNode).toBeUndefined();

    dashboardState.selectNode('hyp-001');
    expect(dashboardState.selectedNode?.id).toBe('hyp-001');

    dashboardState.selectNode('nonexistent');
    expect(dashboardState.selectedNode).toBeUndefined();
  });

  it('toggleTheme switches between light and dark', () => {
    expect(dashboardState.theme).toBe('light');
    dashboardState.toggleTheme();
    expect(dashboardState.theme).toBe('dark');
    dashboardState.toggleTheme();
    expect(dashboardState.theme).toBe('light');
  });

  it('setLayout changes layout mode', () => {
    expect(dashboardState.layout).toBe('force');
    dashboardState.setLayout('hierarchical');
    expect(dashboardState.layout).toBe('hierarchical');
  });

  it('error can be set and cleared', () => {
    expect(dashboardState.error).toBeNull();
    dashboardState.error = 'Something went wrong';
    expect(dashboardState.error).toBe('Something went wrong');
    dashboardState.error = null;
    expect(dashboardState.error).toBeNull();
  });
});
