/**
 * impact.ts — Impact analysis orchestration.
 *
 * Provides traceImpact() which combines BFS scoring with optional
 * Orchestrator what-if simulation. Current-status mode uses EMDD
 * BFS scoring only; what-if mode also runs orchestrator.simulate().
 */
import { loadGraph } from './loader.js';
import { computeImpactScores } from './impact-scoring.js';
import { createEmddOrchestrator } from './orchestrator-setup.js';
import type { ImpactReport, ImpactedNode, ImpactScoringState, Graph, Node, Link } from './types.js';
import { EDGE_CLASSIFICATION, IMPACT_THRESHOLD, VALID_STATUSES } from './derive-constants.js';
import { t } from '../i18n/index.js';
import type { CascadeTrace } from '@beomjk/state-engine/orchestrator';

const UNKNOWN_STATUS = 'UNKNOWN';

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
    throw new Error(t('error.node_not_found', { id: nodeId }));
  }

  if (options?.whatIf) {
    // Validate what-if status
    const validStatuses = VALID_STATUSES[seedNode.type];
    if (validStatuses && !validStatuses.includes(options.whatIf)) {
      throw new Error(t('impact.error.invalid_status', { status: options.whatIf, type: seedNode.type }));
    }
    return traceImpactWhatIf(graph, seedNode, options.whatIf);
  }

  // Current-status mode: BFS scoring only
  return buildCurrentStatusReport(graph, seedNode);
}

function buildCurrentStatusReport(graph: Graph, seedNode: Node): ImpactReport {
  const scoringStates = computeImpactScores(graph, seedNode.id, {
    edgeClassification: EDGE_CLASSIFICATION,
    threshold: IMPACT_THRESHOLD,
  });

  const impactedNodes = buildImpactedNodes(graph, scoringStates);

  return {
    seed: {
      nodeId: seedNode.id,
      nodeType: seedNode.type,
      currentStatus: seedNode.status ?? UNKNOWN_STATUS,
    },
    impactedNodes,
    summary: buildSummary(impactedNodes),
  };
}

async function traceImpactWhatIf(
  graph: Graph,
  seedNode: Node,
  whatIfStatus: string,
): Promise<ImpactReport> {
  const orchestrator = createEmddOrchestrator();
  const relations = buildRelationInstances(graph);

  // Build entities map for orchestrator (Entity = {id, type, status, meta})
  const entities = new Map<string, { id: string; type: string; status: string; meta: Record<string, unknown> }>();
  for (const [id, node] of graph.nodes) {
    if (!node.status) continue;
    entities.set(id, {
      id: node.id,
      type: node.type,
      status: node.status,
      meta: node.meta,
    });
  }

  // Run simulate
  const result = orchestrator.simulate(entities, relations, graph, {
    entityId: seedNode.id,
    targetStatus: whatIfStatus,
  });

  let cascadeTrace: ImpactReport['cascadeTrace'];

  if (result.ok) {
    const trace = result.trace;
    cascadeTrace = convertCascadeTrace(trace);
  } else if (result.error === 'cascade_error') {
    const trace = result.partialTrace;
    cascadeTrace = convertCascadeTrace(trace);
  } else {
    throw new Error(t('impact.error.orchestrator', { error: result.error }));
  }

  // BFS scoring on the graph (same as current-status)
  const scoringStates = computeImpactScores(graph, seedNode.id, {
    edgeClassification: EDGE_CLASSIFICATION,
    threshold: IMPACT_THRESHOLD,
  });

  // Build impacted nodes with auto-transition info from cascade
  const autoTransitions = new Map<string, { from: string; to: string; matchedIds: string[] }>();
  if (cascadeTrace) {
    for (const step of cascadeTrace.steps) {
      if (!autoTransitions.has(step.entityId)) {
        autoTransitions.set(step.entityId, {
          from: step.from,
          to: step.to,
          matchedIds: step.triggeredBy,
        });
      }
    }
  }

  const impactedNodes = buildImpactedNodes(graph, scoringStates, autoTransitions);

  // Include orchestrator-affected nodes not in BFS results
  for (const entityId of cascadeTrace?.affected ?? []) {
    if (entityId === seedNode.id) continue;
    if (scoringStates.has(entityId)) continue;
    const node = graph.nodes.get(entityId);
    if (!node) continue;
    const impacted: ImpactedNode = {
      nodeId: entityId,
      nodeType: node.type,
      currentStatus: node.status ?? UNKNOWN_STATUS,
      aggregateScore: 0,
      bestPathScore: 0,
      depth: 0,
      bestPath: [],
      bestPathEdges: [],
      pathCount: 0,
    };
    const auto = autoTransitions.get(entityId);
    if (auto) impacted.autoTransition = auto;
    impactedNodes.push(impacted);
  }

  impactedNodes.sort((a, b) => b.aggregateScore - a.aggregateScore);

  return {
    seed: {
      nodeId: seedNode.id,
      nodeType: seedNode.type,
      currentStatus: seedNode.status ?? UNKNOWN_STATUS,
      whatIfStatus,
    },
    impactedNodes,
    cascadeTrace,
    summary: buildSummary(impactedNodes),
  };
}

function convertCascadeTrace(trace: CascadeTrace): ImpactReport['cascadeTrace'] {
  return {
    trigger: trace.trigger,
    steps: trace.steps.map(s => ({
      entityId: s.entityId,
      entityType: s.entityType,
      from: s.from,
      to: s.to,
      round: s.round,
      triggeredBy: s.triggeredBy,
    })),
    unresolved: trace.unresolved.map(u => ({
      entityId: u.entityId,
      entityType: u.entityType,
      candidates: u.conflictingTargets.map(ct => ({ to: ct })),
    })),
    availableManualTransitions: trace.availableManualTransitions.map(m => ({
      entityId: m.entityId,
      entityType: m.entityType,
      to: m.to,
    })),
    affected: trace.affected,
    finalStates: Object.fromEntries(trace.finalStates),
    converged: trace.converged,
    rounds: trace.rounds,
  };
}

function buildImpactedNodes(
  graph: Graph,
  scoringStates: Map<string, ImpactScoringState>,
  autoTransitions?: Map<string, { from: string; to: string; matchedIds: string[] }>,
): ImpactedNode[] {
  const nodes: ImpactedNode[] = [];
  for (const [id, state] of scoringStates) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    const impacted: ImpactedNode = {
      nodeId: id,
      nodeType: node.type,
      currentStatus: node.status ?? UNKNOWN_STATUS,
      aggregateScore: 1 - state.complementProduct,
      bestPathScore: state.bestPathScore,
      depth: state.depth,
      bestPath: state.bestPath,
      bestPathEdges: state.bestPathEdges,
      pathCount: state.pathCount,
    };
    const auto = autoTransitions?.get(id);
    if (auto) impacted.autoTransition = auto;
    nodes.push(impacted);
  }
  nodes.sort((a, b) => b.aggregateScore - a.aggregateScore);
  return nodes;
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
