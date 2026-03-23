import GraphologyDefault from 'graphology';
import type { Graph as EmddGraph } from './types.js';

// ESM interop — graphology export shape varies by bundler
const GraphologyGraph = (GraphologyDefault as any).default ?? GraphologyDefault;

export type GraphologyInstance = InstanceType<typeof GraphologyGraph>;

/**
 * Convert EMDD's Map<id, Node> graph into a directed graphology instance.
 * Nodes and edges are added with their core attributes for algorithm use.
 */
export function toGraphologyGraph(graph: EmddGraph): GraphologyInstance {
  const g = new GraphologyGraph({ type: 'directed' });

  for (const [id, node] of graph.nodes) {
    g.addNode(id, { type: node.type, title: node.title, status: node.status });
  }

  for (const [, node] of graph.nodes) {
    for (const link of node.links) {
      if (!g.hasNode(link.target)) continue;
      g.addDirectedEdge(node.id, link.target, { relation: link.relation });
    }
  }

  return g;
}
