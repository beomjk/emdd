import { loadGraph } from './loader.js';
import { buildReverseEdgeIndex } from './utils.js';

const SEVERITY_WEIGHTS: Record<string, number> = {
  FATAL: 0.9,
  WEAKENING: 0.6,
  TENSION: 0.3,
};

const EVIDENTIAL_RELATIONS = new Set(['supports', 'contradicts', 'confirms']);

export interface EvidenceEdge {
  type: 'supports' | 'contradicts' | 'confirms';
  sourceConfidence: number;
  strength?: number;
  severity?: string;
}

export function computeConfidence(initial: number, edges: EvidenceEdge[]): number {
  let prior = initial;

  for (const edge of edges) {
    if (edge.type === 'supports' || edge.type === 'confirms') {
      const strength = edge.type === 'confirms' ? 1.0 : (edge.strength ?? 0.5);
      const impact = edge.sourceConfidence * strength;
      prior = prior + (1 - prior) * impact * 0.3;
    } else if (edge.type === 'contradicts') {
      const severityWeight = SEVERITY_WEIGHTS[edge.severity ?? 'TENSION'] ?? 0.3;
      const impact = edge.sourceConfidence * severityWeight;
      prior = prior * (1 - impact * 0.5);
    }
  }

  return Math.max(0.0, Math.min(1.0, prior));
}

export interface ConfidenceResult {
  nodeId: string;
  oldConfidence: number;
  newConfidence: number;
}

export async function propagateConfidence(graphDir: string): Promise<ConfidenceResult[]> {
  const graph = await loadGraph(graphDir);
  const reverseIndex = buildReverseEdgeIndex(graph);
  const results: ConfidenceResult[] = [];

  for (const [nodeId, node] of graph.nodes) {
    if (node.type !== 'hypothesis') continue;

    const incoming = reverseIndex.get(nodeId) ?? [];
    const evidentialEdges: EvidenceEdge[] = incoming
      .filter(e => EVIDENTIAL_RELATIONS.has(e.relation))
      .map(e => ({
        type: e.relation as EvidenceEdge['type'],
        sourceConfidence: e.sourceConfidence,
        strength: e.strength,
        severity: e.severity,
      }));

    if (evidentialEdges.length === 0) continue;

    const oldConfidence = node.confidence ?? 0.5;
    const newConfidence = computeConfidence(oldConfidence, evidentialEdges);

    results.push({ nodeId, oldConfidence, newConfidence });
  }

  return results;
}
