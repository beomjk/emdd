import type { Graph, HealthReport } from '../graph/types.js';
import { loadGraph } from '../graph/loader.js';
import { getHealth } from '../graph/operations.js';
import type { SerializedGraph, SerializedNode, SerializedEdge } from './types.js';

export interface GraphCache {
  load(): Promise<SerializedGraph>;
  invalidate(): void;
  getGraph(): Promise<SerializedGraph>;
  getHealth(): Promise<HealthReport>;
  getRawGraph(): Promise<Graph>;
}

function serializeGraph(graph: Graph): SerializedGraph {
  const nodes: SerializedNode[] = [];
  const edges: SerializedEdge[] = [];

  for (const [, node] of graph.nodes) {
    nodes.push({
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status ?? '',
      confidence: node.confidence,
      tags: node.tags,
      links: node.links.map((l) => ({ target: l.target, relation: l.relation })),
      created: node.meta.created ? String(node.meta.created) : undefined,
      updated: node.meta.updated ? String(node.meta.updated) : undefined,
      ...(node.meta._invalid ? { invalid: true, parseError: String(node.meta._parseError ?? '') } : {}),
    });

    for (const link of node.links) {
      edges.push({ source: node.id, target: link.target, relation: link.relation });
    }
  }

  return { nodes, edges, loadedAt: new Date().toISOString() };
}

export function createGraphCache(graphDir: string): GraphCache {
  let cachedGraph: SerializedGraph | null = null;
  let cachedRawGraph: Graph | null = null;
  let cachedHealth: HealthReport | null = null;

  return {
    async load(): Promise<SerializedGraph> {
      const graph = await loadGraph(graphDir, { permissive: true });
      cachedRawGraph = graph;
      cachedGraph = serializeGraph(graph);
      cachedHealth = null; // invalidate health when graph reloads
      return cachedGraph;
    },

    invalidate(): void {
      cachedGraph = null;
      cachedRawGraph = null;
      cachedHealth = null;
    },

    async getGraph(): Promise<SerializedGraph> {
      if (!cachedGraph) {
        return this.load();
      }
      return cachedGraph;
    },

    async getHealth(): Promise<HealthReport> {
      if (!cachedHealth) {
        cachedHealth = await getHealth(graphDir);
      }
      return cachedHealth;
    },

    async getRawGraph(): Promise<Graph> {
      if (!cachedRawGraph) {
        await this.load();
      }
      return cachedRawGraph!;
    },
  };
}
