import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { toGraphologyGraph } from './graphology-bridge.js';
import { nodeDate } from './date-utils.js';
import type { Node, NodeFilter, NodeDetail, NeighborNode } from './types.js';
import { t } from '../i18n/index.js';

// ── listNodes ───────────────────────────────────────────────────────

/**
 * List all nodes in the graph, optionally filtered by type and/or status.
 */
export async function listNodes(graphDir: string, filter?: NodeFilter): Promise<Node[]> {
  const graph = await loadGraph(graphDir);
  let nodes = [...graph.nodes.values()];

  if (filter?.type) {
    nodes = nodes.filter(n => n.type === filter.type);
  }
  if (filter?.status) {
    nodes = nodes.filter(n => n.status === filter.status);
  }
  if (filter?.since) {
    const sinceDate = new Date(filter.since);
    if (isNaN(sinceDate.getTime())) {
      throw new Error(t('error.invalid_date', { value: filter.since }));
    }
    nodes = nodes.filter(n => {
      const d = nodeDate(n);
      return d !== null && d >= sinceDate;
    });
  }

  return nodes;
}

// ── readNode ────────────────────────────────────────────────────────

/**
 * Read a single node by ID, returning full detail including body text.
 * Returns null if the node is not found.
 */
export async function readNode(graphDir: string, nodeId: string): Promise<NodeDetail | null> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(nodeId);
  if (!node) return null;

  // Read file to extract body
  const raw = fs.readFileSync(node.path, 'utf-8');
  const parsed = matter(raw);

  return {
    ...node,
    body: parsed.content,
  };
}

// ── readNodes (batch) ────────────────────────────────────────────────

/**
 * Read multiple nodes by ID in a single operation.
 * Loads graph once for efficiency. Missing IDs are silently skipped.
 */
export async function readNodes(graphDir: string, nodeIds: string[]): Promise<NodeDetail[]> {
  const graph = await loadGraph(graphDir);
  const results: NodeDetail[] = [];

  for (const nodeId of nodeIds) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    const raw = fs.readFileSync(node.path, 'utf-8');
    const parsed = matter(raw);
    results.push({ ...node, body: parsed.content });
  }

  return results;
}

// ── getNeighbors ───────────────────────────────────────────────────

// NeighborNode is defined in types.ts for consistency with other interfaces
export type { NeighborNode } from './types.js';

/**
 * Get neighbors of a node up to a given depth using BFS.
 */
export async function getNeighbors(
  graphDir: string,
  nodeId: string,
  depth: number = 1,
): Promise<NeighborNode[]> {
  const graph = await loadGraph(graphDir);
  const startNode = graph.nodes.get(nodeId);
  if (!startNode) {
    throw new Error(t('error.node_not_found', { id: nodeId }));
  }

  const g = toGraphologyGraph(graph);
  const visited = new Set<string>([nodeId]);
  const result: NeighborNode[] = [];
  let frontier: string[] = [nodeId];

  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];

    for (const id of frontier) {
      // Outgoing edges
      for (const edge of g.outEdges(id)) {
        const target = g.target(edge);
        if (visited.has(target)) continue;
        visited.add(target);
        const node = graph.nodes.get(target)!;
        result.push({
          id: node.id,
          type: node.type,
          title: node.title,
          status: node.status,
          relation: g.getEdgeAttribute(edge, 'relation'),
          direction: 'outgoing',
          depth: d + 1,
        });
        nextFrontier.push(target);
      }

      // Incoming edges
      for (const edge of g.inEdges(id)) {
        const source = g.source(edge);
        if (visited.has(source)) continue;
        visited.add(source);
        const node = graph.nodes.get(source)!;
        result.push({
          id: node.id,
          type: node.type,
          title: node.title,
          status: node.status,
          relation: g.getEdgeAttribute(edge, 'relation'),
          direction: 'incoming',
          depth: d + 1,
        });
        nextFrontier.push(source);
      }
    }

    frontier = nextFrontier;
  }

  return result;
}
