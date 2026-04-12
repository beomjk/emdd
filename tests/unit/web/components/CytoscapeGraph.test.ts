import { render, waitFor } from '@testing-library/svelte';
import { vi, type Mock } from 'vitest';

// ── Mock cytoscape ──────────────────────────────────────────────────
function createMockCyInstance() {
  const listeners = new Map<string, Function[]>();
  const elements = new Map<string, { data: Record<string, unknown>; style: Record<string, string> }>();

  const mockEle = (id: string) => ({
    id: () => id,
    length: elements.has(id) ? 1 : 0,
    data: vi.fn((d?: Record<string, unknown>) => {
      if (d && elements.has(id)) Object.assign(elements.get(id)!.data, d);
      return elements.get(id)?.data ?? {};
    }),
    style: vi.fn((key?: string, val?: string) => {
      if (key && val && elements.has(id)) elements.get(id)!.style[key] = val;
      return elements.get(id)?.style[key] ?? '';
    }),
    remove: vi.fn(() => { elements.delete(id); }),
    animate: vi.fn(),
    position: vi.fn(() => ({ x: 0, y: 0 })),
    renderedPosition: vi.fn(() => ({ x: 100, y: 100 })),
    scratch: vi.fn(),
    source: vi.fn(() => mockEle(id)),
    target: vi.fn(() => mockEle(id)),
    isChild: vi.fn(() => false),
    move: vi.fn(),
    children: vi.fn(() => ({ some: () => false })),
    removeClass: vi.fn().mockReturnThis(),
    addClass: vi.fn().mockReturnThis(),
    some: vi.fn(() => false),
    forEach: vi.fn(),
  });

  const childrenCollection = { move: vi.fn() };
  const nodesCollection = {
    forEach: vi.fn(),
    some: vi.fn(() => false),
    remove: vi.fn(),
    length: 0,
    // Compound cluster parents expose children() — used by applyClustersToGraph
    // to orphan descendants before removing the parent (regression guard for
    // the cluster-cascade bug fixed in the deep-review cycle).
    children: vi.fn(() => childrenCollection),
    filter: vi.fn(() => nodesCollection),
  };
  const edgesCollection = { forEach: vi.fn(), remove: vi.fn() };
  const elementsCollection = {
    removeClass: vi.fn().mockReturnThis(),
    forEach: vi.fn(),
  };

  const inst: Record<string, unknown> = {
    on: vi.fn((evt: string, selectorOrFn: string | Function, fn?: Function) => {
      const handler = fn ?? selectorOrFn;
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt)!.push(handler as Function);
      return inst;
    }),
    off: vi.fn(() => inst),
    add: vi.fn(({ data }: { group: string; data: Record<string, unknown> }) => {
      elements.set(data.id as string, { data, style: {} });
    }),
    getElementById: vi.fn((id: string) => mockEle(id)),
    nodes: vi.fn(() => nodesCollection),
    edges: vi.fn(() => edgesCollection),
    elements: vi.fn(() => elementsCollection),
    batch: vi.fn((fn: Function) => fn()),
    layout: vi.fn(() => ({ run: vi.fn(), on: vi.fn().mockReturnThis() })),
    animate: vi.fn(),
    destroy: vi.fn(),
    style: vi.fn(() => ({ fromJson: vi.fn().mockReturnValue({ update: vi.fn() }) })),
    extent: vi.fn(() => ({ x1: 0, y1: 0, x2: 100, y2: 100, w: 100, h: 100 })),
    _listeners: listeners,
    _elements: elements,
    _nodesCollection: nodesCollection,
    _edgesCollection: edgesCollection,
  };
  return inst;
}

let mockCyInstance: ReturnType<typeof createMockCyInstance>;

const cytoscapeFactory = vi.fn(() => {
  mockCyInstance = createMockCyInstance();
  return mockCyInstance;
});
(cytoscapeFactory as Record<string, unknown>).use = vi.fn();

vi.mock('cytoscape', () => {
  const factory = vi.fn(() => {
    mockCyInstance = createMockCyInstance();
    return mockCyInstance;
  });
  (factory as Record<string, unknown>).use = vi.fn();
  return { default: factory };
});

vi.mock('../../../../src/web/frontend/lib/api.js', () => ({
  fetchClusters: vi.fn().mockResolvedValue({ clusters: [] }),
}));

import cytoscape from 'cytoscape';
import { mount, unmount } from 'svelte';
import { fetchClusters } from '../../../../src/web/frontend/lib/api.js';
import CytoscapeGraph from '../../../../src/web/frontend/components/CytoscapeGraph.svelte';
import { makeNode, makeEdge, makeGraph } from '../../../fixtures/component-fixtures.js';

const mockCytoscape = cytoscape as unknown as Mock;
const mockFetchClusters = fetchClusters as Mock;

// ── Helpers ─────────────────────────────────────────────────────────
function renderGraph(overrides: Record<string, unknown> = {}) {
  const graph = makeGraph(
    [
      makeNode({ id: 'hyp-001', title: 'Hypothesis 1', type: 'hypothesis', status: 'PROPOSED' }),
      makeNode({ id: 'exp-001', title: 'Experiment 1', type: 'experiment', status: 'PLANNED' }),
    ],
    [makeEdge({ source: 'hyp-001', target: 'exp-001', relation: 'tested_by' })],
  );

  const defaults = {
    graph,
    layout: 'force' as const,
    theme: 'light',
    visibleTypes: new Set(['hypothesis', 'experiment']),
    visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
    visibleEdgeTypes: new Set(['tested_by']),
    selectedNodeId: null,
    neighborIds: [] as string[],
    onNodeClick: vi.fn(),
    onBackgroundClick: vi.fn(),
  };

  return render(CytoscapeGraph, { props: { ...defaults, ...overrides } });
}

// ── Tests ───────────────────────────────────────────────────────────
describe('CytoscapeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchClusters.mockResolvedValue({ clusters: [] });
  });

  it('creates a cytoscape instance on mount', async () => {
    renderGraph();
    await waitFor(() => {
      expect(mockCytoscape).toHaveBeenCalled();
    });
  });

  it('registers node click event handler', async () => {
    const onNodeClick = vi.fn();
    renderGraph({ onNodeClick });
    await waitFor(() => {
      expect(mockCyInstance.on).toHaveBeenCalledWith(
        'tap',
        'node[!isCluster]',
        expect.any(Function),
      );
    });
  });

  it('registers background click event handler', async () => {
    renderGraph();
    await waitFor(() => {
      expect(mockCyInstance.on).toHaveBeenCalledWith(
        'tap',
        expect.any(Function),
      );
    });
  });

  it('registers edge hover events', async () => {
    renderGraph();
    await waitFor(() => {
      expect(mockCyInstance.on).toHaveBeenCalledWith(
        'mouseover',
        'edge',
        expect.any(Function),
      );
      expect(mockCyInstance.on).toHaveBeenCalledWith(
        'mouseout',
        'edge',
        expect.any(Function),
      );
    });
  });

  it('calls layout.run() on initial render', async () => {
    const mockLayout = { run: vi.fn(), on: vi.fn().mockReturnThis() };
    renderGraph();
    await waitFor(() => {
      expect(mockCyInstance.layout).toHaveBeenCalled();
    });
  });

  it('calls batch() for graph data sync', async () => {
    renderGraph();
    await waitFor(() => {
      expect(mockCyInstance.batch).toHaveBeenCalled();
    });
  });

  it('fetches clusters on initial render', async () => {
    renderGraph();
    await waitFor(() => {
      expect(mockFetchClusters).toHaveBeenCalled();
    });
  });

  it('renders graph canvas container', () => {
    const { container } = renderGraph();
    expect(container.querySelector('.graph-canvas')).not.toBeNull();
    expect(container.querySelector('.cy-container')).not.toBeNull();
  });

  it('destroys cytoscape instance on unmount', async () => {
    const { unmount } = renderGraph();
    await waitFor(() => {
      expect(mockCytoscape).toHaveBeenCalled();
    });
    unmount();
    expect(mockCyInstance.destroy).toHaveBeenCalled();
  });

  // ── Filter visibility effect ─────────────────────────────────────
  describe('filter visibility effect', () => {
    function createMockNode(id: string, type: string, status: string) {
      const styles: Record<string, string> = {};
      const ele: Record<string, unknown> = {
        id: () => id,
        data: vi.fn((key?: string) => {
          if (key === 'type') return type;
          if (key === 'status') return status;
          return undefined;
        }),
        style: vi.fn((key?: string, val?: string) => {
          if (key && val !== undefined) { styles[key] = val; return ele; }
          return styles[key] ?? '';
        }),
        _styles: styles,
      };
      return ele;
    }

    function createMockEdge(id: string, relation: string, srcNode: Record<string, unknown>, tgtNode: Record<string, unknown>) {
      const styles: Record<string, string> = {};
      const ele: Record<string, unknown> = {
        id: () => id,
        data: vi.fn((key?: string) => {
          if (key === 'relation') return relation;
          return undefined;
        }),
        style: vi.fn((key?: string, val?: string) => {
          if (key && val !== undefined) { styles[key] = val; return ele; }
          return styles[key] ?? '';
        }),
        source: vi.fn(() => srcNode),
        target: vi.fn(() => tgtNode),
        _styles: styles,
      };
      return ele;
    }

    it('hides nodes when their type is removed from visibleTypes', async () => {
      const hypNode = createMockNode('hyp-001', 'hypothesis', 'PROPOSED');
      const expNode = createMockNode('exp-001', 'experiment', 'PLANNED');

      const { rerender } = renderGraph();
      await waitFor(() => expect(mockCyInstance.batch).toHaveBeenCalled());

      // Configure mock to iterate over our elements
      (mockCyInstance.nodes as Mock).mockImplementation((selector?: string) => {
        if (selector === '[?isCluster]') return { forEach: vi.fn(), some: vi.fn(() => false) };
        return { forEach: vi.fn((cb: Function) => [hypNode, expNode].forEach(cb)), some: vi.fn(() => false) };
      });
      (mockCyInstance.edges as Mock).mockReturnValue({ forEach: vi.fn() });
      (mockCyInstance.batch as Mock).mockClear();

      // Rerender with only hypothesis type visible → triggers filter effect
      const graph = makeGraph(
        [makeNode({ id: 'hyp-001' }), makeNode({ id: 'exp-001', type: 'experiment', status: 'PLANNED' })],
        [makeEdge()],
      );
      await rerender({
        graph,
        layout: 'force' as const,
        visibleTypes: new Set(['hypothesis']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      await waitFor(() => {
        expect(hypNode._styles['display']).toBe('element');
      });

      expect(expNode._styles['display']).toBe('none');
    });

    it('hides edges when their source or target node is hidden', async () => {
      const hypNode = createMockNode('hyp-001', 'hypothesis', 'PROPOSED');
      const expNode = createMockNode('exp-001', 'experiment', 'PLANNED');
      const edge = createMockEdge('e1', 'tested_by', hypNode, expNode);

      const { rerender } = renderGraph();
      await waitFor(() => expect(mockCyInstance.batch).toHaveBeenCalled());

      (mockCyInstance.nodes as Mock).mockImplementation((selector?: string) => {
        if (selector === '[?isCluster]') return { forEach: vi.fn(), some: vi.fn(() => false) };
        return { forEach: vi.fn((cb: Function) => [hypNode, expNode].forEach(cb)), some: vi.fn(() => false) };
      });
      (mockCyInstance.edges as Mock).mockReturnValue({
        forEach: vi.fn((cb: Function) => [edge].forEach(cb)),
      });
      (mockCyInstance.batch as Mock).mockClear();

      const graph = makeGraph(
        [makeNode({ id: 'hyp-001' }), makeNode({ id: 'exp-001', type: 'experiment', status: 'PLANNED' })],
        [makeEdge()],
      );
      await rerender({
        graph,
        layout: 'force' as const,
        visibleTypes: new Set(['hypothesis']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      await waitFor(() => {
        // expNode hidden → edge's target style is 'none'
        expect(edge._styles['display']).toBe('none');
      });
    });
  });

  // ── Neighbor highlighting effect ──────────────────────────────────
  describe('neighbor highlighting effect', () => {
    function createHighlightNode(id: string, type = 'hypothesis', status = 'PROPOSED') {
      const classes = new Set<string>();
      const styles: Record<string, string> = {};
      const ele: Record<string, unknown> = {
        id: () => id,
        data: vi.fn((key?: string) => {
          if (key === 'type') return type;
          if (key === 'status') return status;
          return undefined;
        }),
        style: vi.fn((key?: string, val?: string) => {
          if (key && val !== undefined) { styles[key] = val; return ele; }
          return styles[key] ?? '';
        }),
        addClass: vi.fn((cls: string) => { classes.add(cls); return ele; }),
        removeClass: vi.fn((cls: string) => { classes.delete(cls); return ele; }),
        _classes: classes,
      };
      return ele;
    }

    function createHighlightEdge(id: string, srcId: string, tgtId: string, relation = 'tested_by') {
      const classes = new Set<string>();
      const styles: Record<string, string> = {};
      // Source/target need style() for filter visibility edge cascade
      const srcRef = {
        id: () => srcId,
        style: (key?: string) => key === 'display' ? 'element' : '',
      };
      const tgtRef = {
        id: () => tgtId,
        style: (key?: string) => key === 'display' ? 'element' : '',
      };
      const ele: Record<string, unknown> = {
        id: () => id,
        data: vi.fn((key?: string) => {
          if (key === 'relation') return relation;
          return undefined;
        }),
        style: vi.fn((key?: string, val?: string) => {
          if (key && val !== undefined) { styles[key] = val; return ele; }
          return styles[key] ?? '';
        }),
        source: vi.fn(() => srcRef),
        target: vi.fn(() => tgtRef),
        addClass: vi.fn((cls: string) => { classes.add(cls); return ele; }),
        removeClass: vi.fn((cls: string) => { classes.delete(cls); return ele; }),
        _classes: classes,
      };
      return ele;
    }

    it('highlights selected node and neighbors, dims others', async () => {
      const n1 = createHighlightNode('hyp-001');
      const n2 = createHighlightNode('exp-001');
      const n3 = createHighlightNode('fnd-001');
      const e1 = createHighlightEdge('e1', 'hyp-001', 'exp-001');

      const graph = makeGraph(
        [
          makeNode({ id: 'hyp-001' }),
          makeNode({ id: 'exp-001', type: 'experiment' }),
          makeNode({ id: 'fnd-001', type: 'finding' }),
        ],
        [makeEdge({ source: 'hyp-001', target: 'exp-001' })],
      );

      const { rerender } = renderGraph({
        graph,
        visibleTypes: new Set(['hypothesis', 'experiment', 'finding']),
      });
      await waitFor(() => expect(mockCyInstance.batch).toHaveBeenCalled());

      (mockCyInstance.nodes as Mock).mockImplementation((selector?: string) => {
        if (selector === '[?isCluster]') return { forEach: vi.fn(), some: vi.fn(() => false) };
        return { forEach: vi.fn((cb: Function) => [n1, n2, n3].forEach(cb)), some: vi.fn(() => false) };
      });
      (mockCyInstance.edges as Mock).mockReturnValue({
        forEach: vi.fn((cb: Function) => [e1].forEach(cb)),
      });
      (mockCyInstance.batch as Mock).mockClear();

      await rerender({
        graph,
        layout: 'force' as const,
        visibleTypes: new Set(['hypothesis', 'experiment', 'finding']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: 'hyp-001',
        neighborIds: ['exp-001'],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      await waitFor(() => {
        expect(n1._classes.has('highlighted')).toBe(true);
      });

      expect(n1._classes.has('dimmed')).toBe(false);
      expect(n2._classes.has('highlighted')).toBe(true);
      expect(n3._classes.has('dimmed')).toBe(true);
      expect(n3._classes.has('highlighted')).toBe(false);
      expect(e1._classes.has('highlighted')).toBe(true);
    });

    it('removes all highlight classes when no node is selected', async () => {
      const elemColl = { removeClass: vi.fn().mockReturnThis() };

      const { rerender } = renderGraph({
        selectedNodeId: 'hyp-001',
        neighborIds: ['exp-001'],
      });
      await waitFor(() => expect(mockCyInstance.batch).toHaveBeenCalled());

      (mockCyInstance.elements as Mock).mockReturnValue(elemColl);
      (mockCyInstance.batch as Mock).mockClear();

      await rerender({
        graph: makeGraph([makeNode()], []),
        layout: 'force' as const,
        visibleTypes: new Set(['hypothesis']),
        visibleStatuses: new Set(['PROPOSED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      await waitFor(() => {
        expect(elemColl.removeClass).toHaveBeenCalledWith('dimmed');
      });

      expect(elemColl.removeClass).toHaveBeenCalledWith('highlighted');
    });
  });

  // ── Theme change effect ───────────────────────────────────────────
  describe('theme change effect', () => {
    it('does NOT call cy.style().fromJson().update() on initial mount', async () => {
      // The theme effect guards against initial mount via prevTheme === null check.
      renderGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      // style() is called once during init (stylesheet setup via cytoscape({style: ...})),
      // but the fromJson().update() chain should not fire yet.
      const styleMock = mockCyInstance.style as Mock;
      // style() may be called during init, but fromJson only fires on theme change.
      const fromJsonCalls = styleMock.mock.results
        .filter((r) => r.type === 'return')
        .flatMap((r) => {
          const chain = r.value as { fromJson?: Mock };
          return chain.fromJson ? (chain.fromJson as Mock).mock.calls : [];
        });
      expect(fromJsonCalls.length).toBe(0);
    });

    it('refreshes Cytoscape styles when theme prop changes', async () => {
      const { rerender } = renderGraph({ theme: 'light' });
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      // Clear any init-time style interactions
      const styleMock = mockCyInstance.style as Mock;
      styleMock.mockClear();

      // Re-render with a new theme → effect should fire
      await rerender({
        graph: makeGraph(
          [
            makeNode({ id: 'hyp-001', title: 'Hypothesis 1', type: 'hypothesis', status: 'PROPOSED' }),
            makeNode({ id: 'exp-001', title: 'Experiment 1', type: 'experiment', status: 'PLANNED' }),
          ],
          [makeEdge({ source: 'hyp-001', target: 'exp-001', relation: 'tested_by' })],
        ),
        layout: 'force' as const,
        theme: 'dark',
        visibleTypes: new Set(['hypothesis', 'experiment']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      // Expect the full style refresh chain: style().fromJson(...).update()
      await waitFor(() => {
        const fromJsonCalls = styleMock.mock.results
          .filter((r) => r.type === 'return')
          .flatMap((r) => {
            const chain = r.value as { fromJson?: Mock };
            return chain.fromJson ? (chain.fromJson as Mock).mock.calls : [];
          });
        expect(fromJsonCalls.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Layout re-run gating by topologyChanged ────────────────────────
  describe('layout re-run gating', () => {
    it('runs layout on initial mount (topology change)', async () => {
      renderGraph();
      await waitFor(() => {
        expect(mockCyInstance.layout).toHaveBeenCalled();
      });
    });

    it('does NOT re-run layout when only visual data changes (no topology change)', async () => {
      const nodes = [
        makeNode({ id: 'hyp-001', title: 'Original', type: 'hypothesis', status: 'PROPOSED' }),
      ];
      const edges: ReturnType<typeof makeEdge>[] = [];

      const { rerender } = renderGraph({ graph: makeGraph(nodes, edges) });
      await waitFor(() => expect(mockCyInstance.layout).toHaveBeenCalled());

      // Clear layout call tracking
      (mockCyInstance.layout as Mock).mockClear();

      // Rerender with SAME topology but changed title (visual-only update)
      const updatedNodes = [
        makeNode({ id: 'hyp-001', title: 'Updated Title', type: 'hypothesis', status: 'PROPOSED' }),
      ];
      await rerender({
        graph: makeGraph(updatedNodes, edges),
        layout: 'force' as const,
        theme: 'light',
        visibleTypes: new Set(['hypothesis']),
        visibleStatuses: new Set(['PROPOSED']),
        visibleEdgeTypes: new Set<string>(),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      // Allow effects to flush
      await new Promise((r) => setTimeout(r, 0));

      // layout should NOT have been called again — topologyChanged=false
      expect(mockCyInstance.layout).not.toHaveBeenCalled();
    });

    it('DOES re-run layout when topology changes (new node added)', async () => {
      const nodes = [
        makeNode({ id: 'hyp-001', title: 'Hyp 1', type: 'hypothesis', status: 'PROPOSED' }),
      ];

      const { rerender } = renderGraph({ graph: makeGraph(nodes, []) });
      await waitFor(() => expect(mockCyInstance.layout).toHaveBeenCalled());

      (mockCyInstance.layout as Mock).mockClear();

      // Add a new node → topology changed
      const nextNodes = [
        ...nodes,
        makeNode({ id: 'exp-001', title: 'Exp 1', type: 'experiment', status: 'PLANNED' }),
      ];
      await rerender({
        graph: makeGraph(nextNodes, []),
        layout: 'force' as const,
        theme: 'light',
        visibleTypes: new Set(['hypothesis', 'experiment']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set<string>(),
        selectedNodeId: null,
        neighborIds: [],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      });

      await waitFor(() => {
        expect(mockCyInstance.layout).toHaveBeenCalled();
      });
    });
  });

  // ── Public API: panToNode / pulseNode (exported methods) ────────────
  // Svelte 5 exposes exported functions via mount() return value.
  describe('exported methods', () => {
    function mountGraph(overrides: Record<string, unknown> = {}) {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const graph = makeGraph(
        [
          makeNode({ id: 'hyp-001', title: 'Hypothesis 1', type: 'hypothesis' }),
          makeNode({ id: 'exp-001', title: 'Experiment 1', type: 'experiment', status: 'PLANNED' }),
        ],
        [makeEdge({ source: 'hyp-001', target: 'exp-001' })],
      );
      const defaults = {
        graph,
        layout: 'force' as const,
        visibleTypes: new Set(['hypothesis', 'experiment']),
        visibleStatuses: new Set(['PROPOSED', 'PLANNED']),
        visibleEdgeTypes: new Set(['tested_by']),
        selectedNodeId: null,
        neighborIds: [] as string[],
        onNodeClick: vi.fn(),
        onBackgroundClick: vi.fn(),
      };
      const instance = mount(CytoscapeGraph, {
        target,
        props: { ...defaults, ...overrides },
      });
      return { instance, target };
    }

    // Helper — make getElementById return a node that tracks animate calls
    function setupMockNodeLookup(cy: any, idsToExist: string[]) {
      const animateMock = vi.fn();
      const styleMock = vi.fn((key?: string) => {
        if (key === 'border-width') return '2px';
        if (key === 'border-color') return '#000';
        return '';
      });
      (cy.getElementById as Mock).mockImplementation((id: string) => ({
        id: () => id,
        length: idsToExist.includes(id) ? 1 : 0,
        animate: animateMock,
        style: styleMock,
      }));
      return { animateMock };
    }

    it('panToNode calls cy.animate for an existing node', async () => {
      const { instance, target } = mountGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      setupMockNodeLookup(mockCyInstance, ['hyp-001']);
      (mockCyInstance.animate as Mock).mockClear();

      instance.panToNode('hyp-001');

      expect(mockCyInstance.animate).toHaveBeenCalled();
      const args = (mockCyInstance.animate as Mock).mock.calls[0];
      expect(args[0]).toMatchObject({ zoom: 1.5 });

      unmount(instance);
      target.remove();
    });

    it('panToNode is a no-op when the node does not exist', async () => {
      const { instance, target } = mountGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      setupMockNodeLookup(mockCyInstance, []); // no ids exist
      (mockCyInstance.animate as Mock).mockClear();

      instance.panToNode('unknown-id');

      expect(mockCyInstance.animate).not.toHaveBeenCalled();

      unmount(instance);
      target.remove();
    });

    it('pulseNode triggers a node.animate call for an existing node', async () => {
      const { instance, target } = mountGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      const { animateMock } = setupMockNodeLookup(mockCyInstance, ['hyp-001']);

      instance.pulseNode('hyp-001');

      expect(animateMock).toHaveBeenCalled();
      const firstCallStyle = animateMock.mock.calls[0][0].style;
      expect(firstCallStyle['border-color']).toBe('#FF6B6B');
      expect(firstCallStyle['border-width']).toBe(6);

      unmount(instance);
      target.remove();
    });

    it('pulseNode is a no-op when the node does not exist', async () => {
      const { instance, target } = mountGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      const { animateMock } = setupMockNodeLookup(mockCyInstance, []);

      instance.pulseNode('unknown-id');

      expect(animateMock).not.toHaveBeenCalled();

      unmount(instance);
      target.remove();
    });
  });

  // ── Viewport culling setup for large graphs (500+ nodes) ────────────
  describe('viewport culling', () => {
    function makeLargeGraph(nodeCount: number) {
      const nodes = Array.from({ length: nodeCount }, (_, i) =>
        makeNode({ id: `n-${i}`, title: `Node ${i}`, type: 'hypothesis' }),
      );
      return makeGraph(nodes, []);
    }

    it('registers viewport listener and shows perf hint for graphs >= 500 nodes', async () => {
      const { container } = renderGraph({ graph: makeLargeGraph(500) });

      await waitFor(() => {
        expect(mockCyInstance.on).toHaveBeenCalledWith('viewport', expect.any(Function));
      });
      expect(mockCyInstance.on).toHaveBeenCalledWith('layoutstop', expect.any(Function));
      expect(container.querySelector('.perf-hint')).not.toBeNull();
    });

    it('does NOT set up viewport culling for graphs < 500 nodes', async () => {
      const { container } = renderGraph({ graph: makeLargeGraph(10) });
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      // No viewport listener should be registered
      const viewportCalls = (mockCyInstance.on as Mock).mock.calls.filter(
        (c: any[]) => c[0] === 'viewport',
      );
      expect(viewportCalls.length).toBe(0);
      expect(container.querySelector('.perf-hint')).toBeNull();
    });
  });

  // ── Cluster application logic ───────────────────────────────────────
  describe('cluster application', () => {
    it('adds compound nodes and moves child nodes into them', async () => {
      mockFetchClusters.mockResolvedValueOnce({
        clusters: [
          { id: 'cluster-1', label: 'Cluster 1', nodeIds: ['hyp-001'], isManual: false },
        ],
      });

      renderGraph();
      await waitFor(() => expect(mockFetchClusters).toHaveBeenCalled());

      // Wait for async applyClustersToGraph to complete
      await waitFor(() => {
        const addCalls = (mockCyInstance.add as Mock).mock.calls;
        const clusterAdd = addCalls.find(
          (c: any[]) => c[0]?.data?.isCluster === true,
        );
        expect(clusterAdd).toBeDefined();
      });

      // Verify cluster data is correctly populated
      const addCalls = (mockCyInstance.add as Mock).mock.calls;
      const clusterAdd = addCalls.find((c: any[]) => c[0]?.data?.isCluster === true);
      expect(clusterAdd?.[0].data).toMatchObject({
        id: 'cluster-1',
        label: 'Cluster 1',
        isCluster: true,
        isManual: false,
      });
      expect(clusterAdd?.[0].data.bgColor).toBeDefined();
      expect(clusterAdd?.[0].data.borderColor).toBeDefined();
    });

    it('gracefully handles fetchClusters rejection (silent degradation)', async () => {
      mockFetchClusters.mockRejectedValueOnce(new Error('cluster API down'));

      const { container } = renderGraph();
      await waitFor(() => expect(mockFetchClusters).toHaveBeenCalled());

      // Graph canvas still rendered — no error thrown
      expect(container.querySelector('.cy-container')).not.toBeNull();
    });

    it('skips cluster application when response is empty', async () => {
      mockFetchClusters.mockResolvedValueOnce({ clusters: [] });
      (mockCyInstance.add as Mock).mockClear();

      renderGraph();
      await waitFor(() => expect(mockFetchClusters).toHaveBeenCalled());

      // No cluster was added (only the original nodes)
      const addCalls = (mockCyInstance.add as Mock).mock.calls;
      const clusterAdd = addCalls.find((c: any[]) => c[0]?.data?.isCluster === true);
      expect(clusterAdd).toBeUndefined();
    });
  });

  describe('cluster parent tap-to-zoom', () => {
    it('registers a tap handler on cluster parent nodes', async () => {
      renderGraph();
      await waitFor(() => {
        expect(mockCyInstance.on).toHaveBeenCalledWith(
          'tap',
          'node[?isCluster]',
          expect.any(Function),
        );
      });
    });

    it('animates fit-to-children when cluster parent is tapped', async () => {
      renderGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      // Find the cluster tap handler
      const tapCalls = (mockCyInstance.on as Mock).mock.calls.filter(
        (c: any[]) => c[0] === 'tap' && c[1] === 'node[?isCluster]',
      );
      expect(tapCalls.length).toBeGreaterThan(0);
      const handler = tapCalls[0][2] as Function;

      // Simulate a cluster tap event with children
      const mockChildren = [{ id: () => 'child1' }, { id: () => 'child2' }];
      const mockCluster = { children: vi.fn(() => mockChildren) };
      handler({ target: mockCluster });

      expect(mockCyInstance.animate).toHaveBeenCalledWith(
        expect.objectContaining({ fit: expect.objectContaining({ eles: mockChildren, padding: 40 }) }),
        expect.objectContaining({ duration: 300 }),
      );
    });

    it('does not animate when cluster has no children', async () => {
      renderGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      const tapCalls = (mockCyInstance.on as Mock).mock.calls.filter(
        (c: any[]) => c[0] === 'tap' && c[1] === 'node[?isCluster]',
      );
      const handler = tapCalls[0][2] as Function;

      const mockCluster = { children: vi.fn(() => ({ length: 0 })) };
      handler({ target: mockCluster });

      expect(mockCyInstance.animate).not.toHaveBeenCalled();
    });
  });

  describe('drag tracking', () => {
    it('registers a drag handler on non-cluster nodes', async () => {
      renderGraph();
      await waitFor(() => {
        expect(mockCyInstance.on).toHaveBeenCalledWith(
          'drag',
          'node[!isCluster]',
          expect.any(Function),
        );
      });
    });

    it('marks dragged node as manually positioned via scratch', async () => {
      renderGraph();
      await waitFor(() => expect(mockCytoscape).toHaveBeenCalled());

      const dragCalls = (mockCyInstance.on as Mock).mock.calls.filter(
        (c: any[]) => c[0] === 'drag' && c[1] === 'node[!isCluster]',
      );
      expect(dragCalls.length).toBeGreaterThan(0);
      const handler = dragCalls[0][2] as Function;

      const mockScratch = vi.fn();
      handler({ target: { scratch: mockScratch } });

      expect(mockScratch).toHaveBeenCalledWith('_manuallyPositioned', true);
    });
  });
});
