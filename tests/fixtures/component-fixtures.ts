import type {
  LayoutMode,
  SerializedEdge,
  SerializedGraph,
  SerializedNode,
  VisualCluster,
} from '../../src/web/types.js';

export type GraphTheme = 'light' | 'dark';

export interface GraphUiPropsFixture {
  graph: SerializedGraph;
  layout: LayoutMode;
  theme: GraphTheme;
  visibleTypes: Set<string>;
  visibleStatuses: Set<string>;
  visibleEdgeTypes: Set<string>;
  selectedNodeId: string | null;
  neighborIds: string[];
}

export interface GraphStateCueScenario {
  props: GraphUiPropsFixture;
  clusters: VisualCluster[];
}

export function makeNode(overrides: Partial<SerializedNode> = {}): SerializedNode {
  return {
    id: 'hyp-001',
    title: 'Test Hypothesis',
    type: 'hypothesis',
    status: 'PROPOSED',
    tags: [],
    links: [],
    ...overrides,
  };
}

export function makeEdge(overrides: Partial<SerializedEdge> = {}): SerializedEdge {
  return {
    source: 'hyp-001',
    target: 'exp-001',
    relation: 'tested_by',
    ...overrides,
  };
}

export function makeGraph(
  nodes: SerializedNode[] = [makeNode()],
  edges: SerializedEdge[] = [],
): SerializedGraph {
  return {
    nodes,
    edges,
    loadedAt: '2026-04-09T00:00:00Z',
  };
}

export function makeCluster(overrides: Partial<VisualCluster> = {}): VisualCluster {
  return {
    id: 'cluster-001',
    label: 'Research Cluster',
    nodeIds: ['hyp-001', 'exp-001'],
    isManual: false,
    ...overrides,
  };
}

export function makeGraphUiProps(
  overrides: Partial<GraphUiPropsFixture> = {},
): GraphUiPropsFixture {
  const graph = overrides.graph ?? makeGraph(
    [
      makeNode({ id: 'hyp-001', title: 'Hypothesis 1', type: 'hypothesis', status: 'PROPOSED' }),
      makeNode({ id: 'exp-001', title: 'Experiment 1', type: 'experiment', status: 'PLANNED' }),
    ],
    [makeEdge({ source: 'hyp-001', target: 'exp-001', relation: 'tested_by' })],
  );

  return {
    graph,
    layout: overrides.layout ?? 'force',
    theme: overrides.theme ?? 'light',
    visibleTypes: overrides.visibleTypes ?? new Set(graph.nodes.map((node) => node.type)),
    visibleStatuses: overrides.visibleStatuses ?? new Set(graph.nodes.map((node) => node.status)),
    visibleEdgeTypes: overrides.visibleEdgeTypes ?? new Set(graph.edges.map((edge) => edge.relation)),
    selectedNodeId: overrides.selectedNodeId ?? null,
    neighborIds: overrides.neighborIds ?? [],
  };
}

export function makeGraphThemeScenario(
  theme: GraphTheme,
  overrides: Partial<GraphUiPropsFixture> = {},
): GraphUiPropsFixture {
  return makeGraphUiProps({ ...overrides, theme });
}

export function makeGraphStateCueScenario(
  overrides: {
    theme?: GraphTheme;
    layout?: LayoutMode;
    selectedNodeId?: string | null;
    neighborIds?: string[];
    invalidNodeIds?: string[];
    includeCluster?: boolean;
    clusterOverrides?: Partial<VisualCluster>;
  } = {},
): GraphStateCueScenario {
  const invalidNodeIds = new Set(overrides.invalidNodeIds ?? ['fnd-001']);
  const nodes = [
    makeNode({
      id: 'hyp-001',
      title: 'Hypothesis 1',
      type: 'hypothesis',
      status: 'PROPOSED',
      invalid: invalidNodeIds.has('hyp-001'),
    }),
    makeNode({
      id: 'exp-001',
      title: 'Experiment 1',
      type: 'experiment',
      status: 'PLANNED',
      invalid: invalidNodeIds.has('exp-001'),
    }),
    makeNode({
      id: 'fnd-001',
      title: 'Finding 1',
      type: 'finding',
      status: 'ACTIVE',
      invalid: invalidNodeIds.has('fnd-001'),
    }),
  ];
  const edges = [
    makeEdge({ source: 'hyp-001', target: 'exp-001', relation: 'tested_by' }),
    makeEdge({ source: 'exp-001', target: 'fnd-001', relation: 'supports' }),
  ];
  const graph = makeGraph(nodes, edges);

  return {
    props: makeGraphUiProps({
      graph,
      layout: overrides.layout ?? 'force',
      theme: overrides.theme ?? 'light',
      selectedNodeId: overrides.selectedNodeId ?? 'hyp-001',
      neighborIds: overrides.neighborIds ?? ['exp-001'],
    }),
    clusters: overrides.includeCluster === false
      ? []
      : [makeCluster(overrides.clusterOverrides)],
  };
}

export function makeNodeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hyp-001',
    title: 'Test Hypothesis',
    type: 'hypothesis',
    status: 'PROPOSED',
    confidence: 0.75,
    tags: ['ml', 'vision'],
    links: [{ target: 'exp-001', relation: 'tested_by' }],
    body: '# Summary\nThis is the body.',
    ...overrides,
  };
}
