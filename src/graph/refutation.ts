import { loadGraph } from './loader.js';
import { buildReverseEdgeIndex, buildNodeToComponent } from './utils.js';

const SEVERITY_PENALTIES: Record<string, number> = {
  FATAL: 0.5,
  WEAKENING: 0.7,
  TENSION: 0.9,
};

export interface AffectedHypothesis {
  hypothesisId: string;
  knowledgeId: string;
  oldConfidence: number;
  newConfidence: number;
  severity: string;
}

export interface RefutationAnalysis {
  affectedHypotheses: AffectedHypothesis[];
  pivotCeremonyTriggered: boolean;
  retractedKnowledgeIds: string[];
}

export async function analyzeRefutation(graphDir: string): Promise<RefutationAnalysis> {
  const graph = await loadGraph(graphDir);
  const reverseIndex = buildReverseEdgeIndex(graph);
  const affectedHypotheses: AffectedHypothesis[] = [];

  // Find DISPUTED knowledge and determine severity from incoming contradicts edges
  for (const [knwId, knwNode] of graph.nodes) {
    if (knwNode.type !== 'knowledge' || knwNode.status !== 'DISPUTED') continue;

    // Find the contradiction severity
    const incoming = reverseIndex.get(knwId) ?? [];
    const contradicts = incoming.filter(e => e.relation === 'contradicts');
    if (contradicts.length === 0) continue;

    // Use the worst (lowest penalty = highest impact) severity
    let worstSeverity = 'TENSION';
    for (const edge of contradicts) {
      const sev = edge.severity ?? 'TENSION';
      if ((SEVERITY_PENALTIES[sev] ?? 0.9) < (SEVERITY_PENALTIES[worstSeverity] ?? 0.9)) {
        worstSeverity = sev;
      }
    }

    const penalty = SEVERITY_PENALTIES[worstSeverity] ?? 0.9;

    // Find hypotheses that depend on this knowledge (via supports or depends_on edges FROM hypothesis TO knowledge)
    for (const [hypId, hypNode] of graph.nodes) {
      if (hypNode.type !== 'hypothesis') continue;
      const linksToKnowledge = hypNode.links.some(
        l => l.target === knwId && (l.relation === 'supports' || l.relation === 'depends_on')
      );
      if (!linksToKnowledge) continue;

      const oldConf = hypNode.confidence ?? 0;
      affectedHypotheses.push({
        hypothesisId: hypId,
        knowledgeId: knwId,
        oldConfidence: oldConf,
        newConfidence: oldConf * penalty,
        severity: worstSeverity,
      });
    }
  }

  // Pivot ceremony: 2+ RETRACTED knowledge nodes in the same cluster (spec §6.6, §7.4)
  const retractedKnowledgeIds: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.type === 'knowledge' && node.status === 'RETRACTED') {
      retractedKnowledgeIds.push(id);
    }
  }

  let pivotCeremonyTriggered = false;
  if (retractedKnowledgeIds.length >= 2) {
    const nodeToComponent = buildNodeToComponent(graph);
    const byCluster = new Map<number, string[]>();
    for (const id of retractedKnowledgeIds) {
      const comp = nodeToComponent.get(id) ?? -1;
      const list = byCluster.get(comp) ?? [];
      list.push(id);
      byCluster.set(comp, list);
    }
    for (const ids of byCluster.values()) {
      if (ids.length >= 2) {
        pivotCeremonyTriggered = true;
        break;
      }
    }
  }

  return {
    affectedHypotheses,
    pivotCeremonyTriggered,
    retractedKnowledgeIds,
  };
}
