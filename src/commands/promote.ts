import { loadGraph } from '../graph/loader.js';

export interface PromoteCandidate {
  id: string;
  confidence: number;
  supports: number;
}

export interface PromoteResult {
  candidates: PromoteCandidate[];
}

/**
 * Identify findings eligible for promotion to knowledge.
 *
 * Criteria: confidence >= 0.8 AND 2+ outgoing "supports" links.
 */
export async function promoteCommand(graphDir: string): Promise<PromoteResult> {
  const graph = await loadGraph(graphDir);
  const candidates: PromoteCandidate[] = [];

  // Track already-promoted findings
  const promotedIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    if (node.type === 'knowledge') {
      for (const link of node.links) {
        if (link.relation === 'promotes') {
          promotedIds.add(link.target);
        }
      }
    }
  }

  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    if (promotedIds.has(id)) continue;

    const confidence = node.confidence ?? 0;
    if (confidence < 0.8) continue;

    // Count outgoing "supports" links from this finding
    const supportsCount = node.links.filter(
      l => l.relation === 'supports'
    ).length;

    if (supportsCount < 2) continue;

    candidates.push({ id, confidence, supports: supportsCount });
  }

  return { candidates };
}
