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
        // TESTING→CONTESTED: Decision with status CONTESTED references this hypothesis
        const contestedDecision = incoming.find(e => {
          const source = graph.nodes.get(e.sourceId);
          return source?.type === 'decision' && source.status === 'CONTESTED';
        });
        if (contestedDecision) {
          recommendations.push({
            nodeId,
            currentStatus: 'TESTING',
            recommendedStatus: 'CONTESTED',
            reason: `Contested by decision ${contestedDecision.sourceId}`,
            evidenceIds: [contestedDecision.sourceId],
          });
          continue;
        }

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

      if (node.status === 'CONTESTED') {
        // CONTESTED→REVISED: revises edge (same pattern as TESTING→REVISED)
        const revisesEdges = incoming.filter(e => e.relation === 'revises');
        if (revisesEdges.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'CONTESTED',
            recommendedStatus: 'REVISED',
            reason: `Revised by ${revisesEdges.map(e => e.sourceId).join(', ')}`,
            evidenceIds: revisesEdges.map(e => e.sourceId),
          });
          continue;
        }

        // Check for ACCEPTED decision referencing this hypothesis
        const hasAcceptedDecision = incoming.some(e => {
          const source = graph.nodes.get(e.sourceId);
          return source?.type === 'decision' && source.status === 'ACCEPTED';
        });

        if (hasAcceptedDecision) {
          // CONTESTED→SUPPORTED: SUPPORTS with strength≥0.7 AND ACCEPTED decision
          const strongSupports = incoming.filter(
            e => e.relation === 'supports' && (e.strength ?? 0) >= 0.7
          );
          if (strongSupports.length > 0) {
            recommendations.push({
              nodeId,
              currentStatus: 'CONTESTED',
              recommendedStatus: 'SUPPORTED',
              reason: `Resolved: strong support from ${strongSupports.map(e => e.sourceId).join(', ')} with accepted decision`,
              evidenceIds: strongSupports.map(e => e.sourceId),
            });
            continue;
          }

          // CONTESTED→REFUTED: CONTRADICTS edge AND ACCEPTED decision
          const contradictions = incoming.filter(e => e.relation === 'contradicts');
          if (contradictions.length > 0) {
            recommendations.push({
              nodeId,
              currentStatus: 'CONTESTED',
              recommendedStatus: 'REFUTED',
              reason: `Resolved: contradicted by ${contradictions.map(e => e.sourceId).join(', ')} with accepted decision`,
              evidenceIds: contradictions.map(e => e.sourceId),
            });
            continue;
          }
        }
      }
    }

    // Knowledge transitions
    if (node.type === 'knowledge') {
      const incoming = reverseIndex.get(nodeId) ?? [];

      if (node.status === 'ACTIVE') {
        // ACTIVE→DISPUTED: CONTRADICTS edge from new Finding
        const contradictions = incoming.filter(e => e.relation === 'contradicts');
        if (contradictions.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'ACTIVE',
            recommendedStatus: 'DISPUTED',
            reason: `Contradicted by ${contradictions.map(e => e.sourceId).join(', ')}`,
            evidenceIds: contradictions.map(e => e.sourceId),
          });
          continue;
        }

        // ACTIVE→SUPERSEDED: direct replacement (REVISES edge from newer knowledge)
        const revises = incoming.filter(
          e => e.relation === 'revises' && graph.nodes.get(e.sourceId)?.type === 'knowledge'
        );
        if (revises.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'ACTIVE',
            recommendedStatus: 'SUPERSEDED',
            reason: `Superseded by ${revises.map(e => e.sourceId).join(', ')}`,
            evidenceIds: revises.map(e => e.sourceId),
          });
        }
      }

      if (node.status === 'DISPUTED') {
        // DISPUTED→SUPERSEDED: REVISES edge from newer knowledge
        const revises = incoming.filter(
          e => e.relation === 'revises' && graph.nodes.get(e.sourceId)?.type === 'knowledge'
        );
        if (revises.length > 0) {
          recommendations.push({
            nodeId,
            currentStatus: 'DISPUTED',
            recommendedStatus: 'SUPERSEDED',
            reason: `Superseded by ${revises.map(e => e.sourceId).join(', ')}`,
            evidenceIds: revises.map(e => e.sourceId),
          });
          continue;
        }

        // DISPUTED→ACTIVE: contradiction resolved (all contradicting sources RETRACTED)
        const contradictions = incoming.filter(e => e.relation === 'contradicts');
        if (contradictions.length > 0) {
          const allRetracted = contradictions.every(e => {
            const src = graph.nodes.get(e.sourceId);
            return src?.status === 'RETRACTED';
          });
          if (allRetracted) {
            recommendations.push({
              nodeId,
              currentStatus: 'DISPUTED',
              recommendedStatus: 'ACTIVE',
              reason: `Contradiction resolved: ${contradictions.map(e => e.sourceId).join(', ')} retracted`,
              evidenceIds: contradictions.map(e => e.sourceId),
            });
          }
        }
      }
    }
  }

  return recommendations;
}
