import type { SerializedGraph, SerializedNode, SerializedEdge } from '../../types.js';

export interface NodeElementData {
  id: string;
  [key: string]: unknown;
}

export interface EdgeElementData {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface GraphDelta {
  addedNodes: NodeElementData[];
  removedNodeIds: string[];
  updatedNodes: { id: string; data: Record<string, unknown> }[];
  addedEdges: EdgeElementData[];
  removedEdgeIds: string[];
  topologyChanged: boolean;
}

function edgeId(e: SerializedEdge): string {
  return `${e.source}-${e.relation}-${e.target}`;
}

/**
 * Compute the delta between two serialized graphs.
 * `buildNodeData` and `buildEdgeData` transform domain objects into
 * Cytoscape element data, keeping the diff logic pure and testable.
 */
export function diffGraph(
  oldGraph: SerializedGraph | null,
  newGraph: SerializedGraph,
  buildNodeData: (node: SerializedNode) => NodeElementData,
  buildEdgeData: (edge: SerializedEdge, validNodeIds: Set<string>) => EdgeElementData | null,
): GraphDelta {
  const newNodeIds = new Set(newGraph.nodes.map((n) => n.id));

  if (!oldGraph) {
    return {
      addedNodes: newGraph.nodes.map(buildNodeData),
      removedNodeIds: [],
      updatedNodes: [],
      addedEdges: newGraph.edges
        .map((e) => buildEdgeData(e, newNodeIds))
        .filter((e): e is EdgeElementData => e !== null),
      removedEdgeIds: [],
      topologyChanged: true,
    };
  }

  const oldNodeMap = new Map(oldGraph.nodes.map((n) => [n.id, n]));
  const oldEdgeMap = new Map(oldGraph.edges.map((e) => [edgeId(e), e]));

  const addedNodes: NodeElementData[] = [];
  const updatedNodes: { id: string; data: Record<string, unknown> }[] = [];

  for (const node of newGraph.nodes) {
    const old = oldNodeMap.get(node.id);
    if (!old) {
      addedNodes.push(buildNodeData(node));
    } else if (nodeChanged(old, node)) {
      const data = buildNodeData(node);
      updatedNodes.push({ id: node.id, data });
    }
  }

  const removedNodeIds = oldGraph.nodes
    .filter((n) => !newNodeIds.has(n.id))
    .map((n) => n.id);

  const addedEdges: EdgeElementData[] = [];
  for (const edge of newGraph.edges) {
    const eid = edgeId(edge);
    if (!oldEdgeMap.has(eid)) {
      const data = buildEdgeData(edge, newNodeIds);
      if (data) addedEdges.push(data);
    }
  }

  const newEdgeIds = new Set(newGraph.edges.map(edgeId));
  const removedEdgeIds = oldGraph.edges
    .filter((e) => !newEdgeIds.has(edgeId(e)))
    .map(edgeId);

  const topologyChanged =
    addedNodes.length > 0 ||
    removedNodeIds.length > 0 ||
    addedEdges.length > 0 ||
    removedEdgeIds.length > 0;

  return {
    addedNodes,
    removedNodeIds,
    updatedNodes,
    addedEdges,
    removedEdgeIds,
    topologyChanged,
  };
}

function nodeChanged(a: SerializedNode, b: SerializedNode): boolean {
  return (
    a.title !== b.title ||
    a.status !== b.status ||
    a.type !== b.type ||
    a.confidence !== b.confidence ||
    a.invalid !== b.invalid ||
    a.bodyPreview !== b.bodyPreview ||
    JSON.stringify(a.tags) !== JSON.stringify(b.tags)
  );
}
