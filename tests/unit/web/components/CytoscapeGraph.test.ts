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

  const nodesCollection = {
    forEach: vi.fn(),
    some: vi.fn(() => false),
  };
  const edgesCollection = { forEach: vi.fn() };
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

vi.mock('../../../../src/web/frontend/state/dashboard.svelte.js', () => {
  let theme = 'light';
  return {
    dashboardState: {
      get theme() { return theme; },
      set theme(v: string) { theme = v; },
    },
  };
});

import cytoscape from 'cytoscape';
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
});
