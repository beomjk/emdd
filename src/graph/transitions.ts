import { loadGraph } from './loader.js';
import { buildReverseEdgeIndex } from './utils.js';

export interface TransitionRecommendation {
  nodeId: string;
  currentStatus: string;
  recommendedStatus: string;
  reason: string;
  evidenceIds: string[];
}

export async function detectTransitions(graphDir: string): Promise<TransitionRecommendation[]> {
  const graph = await loadGraph(graphDir);
  const reverseIndex = buildReverseEdgeIndex(graph);
  const recommendations: TransitionRecommendation[] = [];

  for (const [nodeId, node] of graph.nodes) {
    // Hypothesis transitions
    if (node.type === 'hypothesis') {
      const incoming = reverseIndex.get(nodeId) ?? [];

      if (node.status === 'PROPOSED') {
        // Check for PROPOSED→TESTING: connected experiment is RUNNING
        // Look at outgoing links (tests/tested_by) to find experiments
        for (const link of node.links) {
          const target = graph.nodes.get(link.target);
          if (target?.type === 'experiment' && target.status === 'RUNNING') {
            recommendations.push({
              nodeId,
              currentStatus: 'PROPOSED',
              recommendedStatus: 'TESTING',
              reason: `Connected experiment ${target.id} is RUNNING`,
              evidenceIds: [target.id],
            });
            break;
          }
        }
        // Also check reverse: experiments that link to this hypothesis
        for (const edge of incoming) {
          const source = graph.nodes.get(edge.sourceId);
          if (source?.type === 'experiment' && source.status === 'RUNNING') {
            if (!recommendations.some(r => r.nodeId === nodeId && r.recommendedStatus === 'TESTING')) {
              recommendations.push({
                nodeId,
                currentStatus: 'PROPOSED',
                recommendedStatus: 'TESTING',
                reason: `Connected experiment ${source.id} is RUNNING`,
                evidenceIds: [source.id],
              });
            }
            break;
          }
        }
      }

      if (node.status === 'TESTING') {
        // Check for REVISES edge first (REVISED takes priority over REFUTED)
        const revisesEdges = incoming.filter(e => e.relation === 'revises');
        if (revisesEdges.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'TESTING',
            recommendedStatus: 'REVISED',
            reason: `Revised by ${revisesEdges.map(e => e.sourceId).join(', ')}`,
            evidenceIds: revisesEdges.map(e => e.sourceId),
          });
          continue;
        }

        // TESTING→SUPPORTED: SUPPORTS with strength≥0.7
        const strongSupports = incoming.filter(
          e => e.relation === 'supports' && (e.strength ?? 0) >= 0.7
        );
        if (strongSupports.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'TESTING',
            recommendedStatus: 'SUPPORTED',
            reason: `Strong support from ${strongSupports.map(e => e.sourceId).join(', ')}`,
            evidenceIds: strongSupports.map(e => e.sourceId),
          });
          continue;
        }

        // TESTING→REFUTED: CONTRADICTS edge exists
        const contradictions = incoming.filter(e => e.relation === 'contradicts');
        if (contradictions.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'TESTING',
            recommendedStatus: 'REFUTED',
            reason: `Contradicted by ${contradictions.map(e => e.sourceId).join(', ')}`,
            evidenceIds: contradictions.map(e => e.sourceId),
          });
          continue;
        }
      }
    }

    // Knowledge transitions
    if (node.type === 'knowledge' && node.status === 'ACTIVE') {
      const incoming = reverseIndex.get(nodeId) ?? [];
      const contradictions = incoming.filter(e => e.relation === 'contradicts');
      if (contradictions.length > 0) {
        recommendations.push({
          nodeId,
          currentStatus: 'ACTIVE',
          recommendedStatus: 'DISPUTED',
          reason: `Contradicted by ${contradictions.map(e => e.sourceId).join(', ')}`,
          evidenceIds: contradictions.map(e => e.sourceId),
        });
      }
    }
  }

  return recommendations;
}
