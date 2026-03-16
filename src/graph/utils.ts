import type { Graph } from './types.js';

export interface IncomingEdge {
  sourceId: string;
  sourceConfidence: number;
  relation: string;
  strength?: number;
  severity?: string;
  completeness?: number;
  dependencyType?: string;
  impact?: string;
}

export function buildReverseEdgeIndex(graph: Graph): Map<string, IncomingEdge[]> {
  const index = new Map<string, IncomingEdge[]>();

  for (const [sourceId, node] of graph.nodes) {
    for (const link of node.links) {
      const edge: IncomingEdge = {
        sourceId,
        sourceConfidence: node.confidence ?? 0,
        relation: link.relation,
        strength: link.strength,
        severity: link.severity,
        completeness: link.completeness,
        dependencyType: link.dependencyType,
        impact: link.impact,
      };

      const existing = index.get(link.target);
      if (existing) {
        existing.push(edge);
      } else {
        index.set(link.target, [edge]);
      }
    }
  }

  return index;
}
