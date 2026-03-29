/**
 * impact.ts — Impact analysis orchestration.
 *
 * Provides traceImpact() which combines BFS scoring with optional
 * Orchestrator what-if simulation. Current-status mode uses EMDD
 * BFS scoring only; what-if mode also runs orchestrator.simulate().
 */
import { loadGraph } from './loader.js';
import { computeImpactScores } from './impact-scoring.js';
import type { ImpactReport, ImpactedNode, Graph, Node, Link } from './types.js';
import { EDGE_CLASSIFICATION, IMPACT_THRESHOLD } from './derive-constants.js';

export interface TraceImpactOptions {
  whatIf?: string;
}

/**
 * Analyze cascade impact from a seed node.
 * - Current-status mode: BFS scoring only, no cascadeTrace
 * - What-if mode: orchestrator.simulate() + BFS scoring, includes cascadeTrace
 */
export async function traceImpact(
  graphDir: string,
  nodeId: string,
  options?: TraceImpactOptions,
): Promise<ImpactReport> {
  const graph = await loadGraph(graphDir);
  const seedNode = graph.nodes.get(nodeId);
  if (!seedNode) {
    throw new Error(`Node '${nodeId}' not found`);
  }

  const report: ImpactReport = {
    seed: {
      nodeId,
      nodeType: seedNode.type,
      currentStatus: seedNode.status ?? 'UNKNOWN',
    },
    impactedNodes: [],
    summary: {
      totalAffected: 0,
      maxScore: 0,
      avgScore: 0,
      affectedByType: {},
    },
  };

  if (options?.whatIf) {
    report.seed.whatIfStatus = options.whatIf;
    // What-if mode: delegate to orchestrator + BFS (Phase 4)
    const whatIfReport = await traceImpactWhatIf(graph, seedNode, options.whatIf);
    return whatIfReport;
  }

  // Current-status mode: BFS scoring only
  const scoringStates = computeImpactScores(graph, nodeId, {
    edgeClassification: EDGE_CLASSIFICATION,
    threshold: IMPACT_THRESHOLD,
  });

  const impactedNodes: ImpactedNode[] = [];
  for (const [id, state] of scoringStates) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    const aggregateScore = 1 - state.complementProduct;
    impactedNodes.push({
      nodeId: id,
      nodeType: node.type,
      currentStatus: node.status ?? 'UNKNOWN',
      aggregateScore,
      bestPathScore: state.bestPathScore,
      depth: state.depth,
      bestPath: state.bestPath,
      bestPathEdges: state.bestPathEdges,
      pathCount: state.pathCount,
    });
  }

  // Sort by aggregate score descending
  impactedNodes.sort((a, b) => b.aggregateScore - a.aggregateScore);

  report.impactedNodes = impactedNodes;
  report.summary = buildSummary(impactedNodes);

  return report;
}

function buildSummary(nodes: ImpactedNode[]) {
  const totalAffected = nodes.length;
  const maxScore = nodes.length > 0 ? Math.max(...nodes.map(n => n.aggregateScore)) : 0;
  const avgScore = nodes.length > 0 ? nodes.reduce((s, n) => s + n.aggregateScore, 0) / nodes.length : 0;
  const affectedByType: Record<string, number> = {};
  for (const n of nodes) {
    affectedByType[n.nodeType] = (affectedByType[n.nodeType] ?? 0) + 1;
  }
  return { totalAffected, maxScore, avgScore, affectedByType };
}

// Placeholder for what-if mode (Phase 4)
async function traceImpactWhatIf(
  _graph: Graph,
  _seedNode: Node,
  _whatIfStatus: string,
): Promise<ImpactReport> {
  throw new Error('What-if mode not yet implemented');
}

/**
 * Build RelationInstance[] from Graph for orchestrator.simulate().
 * Converts Node.links[] to flat relation instances with reverse edge normalization.
 */
export function buildRelationInstances(graph: Graph): Array<{
  name: string;
  sourceId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}> {
  const relations: Array<{
    name: string;
    sourceId: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }> = [];

  for (const node of graph.nodes.values()) {
    for (const link of node.links) {
      relations.push({
        name: link.relation,
        sourceId: node.id,
        targetId: link.target,
        metadata: buildLinkMetadata(link),
      });
    }
  }

  return relations;
}

function buildLinkMetadata(link: Link): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (link.strength !== undefined) meta.strength = link.strength;
  if (link.severity !== undefined) meta.severity = link.severity;
  if (link.impact !== undefined) meta.impact = link.impact;
  if (link.dependencyType !== undefined) meta.dependencyType = link.dependencyType;
  if (link.completeness !== undefined) meta.completeness = link.completeness;
  return Object.keys(meta).length > 0 ? meta : undefined;
}
