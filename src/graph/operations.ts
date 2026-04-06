import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { nextId, renderTemplate, nodePath, sanitizeSlug } from './templates.js';
import { NODE_TYPES, NODE_TYPE_DIRS, ALL_VALID_RELATIONS, REVERSE_LABELS, THRESHOLDS, VALID_STATUSES, ENUM_FIELD_VALIDATORS, EDGE_ATTRIBUTE_NAMES, EDGE_ATTRIBUTE_RANGES, EDGE_ATTRIBUTE_ENUM_VALUES, TRANSITION_POLICY_DEFAULT, TRANSITION_TABLE, MANUAL_TRANSITIONS, CEREMONY_TRIGGERS, URGENCY, VALUE_PRODUCING_EDGES, EDGE, STATUS } from './types.js';
import { checkEdgeAffinity, getPresentAttrKeys } from './edge-attrs.js';
import { engine } from './engine-setup.js';
import { collectDeferredIds, buildNodeToComponent, getConnectedComponents } from './utils.js';
import { toGraphologyGraph } from './graphology-bridge.js';
import { normalizeDateFields, nodeDate } from './date-utils.js';
import { suggest } from '../utils/suggest.js';
import type {
  Node,
  NodeType,
  NodeFilter,
  NodeDetail,
  NodeWithStatus,
  Graph,
  CreateNodeResult,
  CreateEdgeResult,
  CreateNodePlan,
  CreateEdgePlan,
  EdgeAttributes,
  FileOp,
  HealthReport,
  GapDetail,
  CheckResult,
  CheckTrigger,
  PromoteCandidate,
  UpdateNodeResult,
  DeleteEdgeResult,
  DoneMarker,
  MarkDoneResult,
} from './types.js';
import { loadConfig, saveConfig } from './config.js';
import type { EmddConfig } from './config.js';
export { detectClusters, identifyClusters } from './clusters.js';
export { lintNode, lintGraph } from './validator.js';
import { lintGraph as _lintGraph } from './validator.js';

/**
 * Convenience facade: load graph from directory and lint in one call.
 */
export async function lintGraphFromDir(graphDir: string) {
  const graph = await loadGraph(graphDir);
  return _lintGraph(graph);
}
export { analyzeRefutation } from './refutation.js';
export { detectTransitions } from './transitions.js';
export { propagateConfidence } from './confidence.js';
export { checkKillCriteria } from './kill-criterion.js';
export { listBranchGroups } from './branch-groups.js';
export { traceImpact } from './impact.js';
export { generateIndex } from './index-generator.js';
export { getBacklog } from './backlog.js';
import { generateIndex as _generateIndex } from './index-generator.js';
import { t } from '../i18n/index.js';
import type { Locale } from '../i18n/index.js';

// ── query functions (moved to query.ts) ─────────────────────────────
export { listNodes, readNode, readNodes, getNeighbors } from './query.js';
export type { NeighborNode } from './query.js';

// ── executeOps ──────────────────────────────────────────────────────
// (moved to file-ops.ts)

import { executeOps } from './file-ops.js';
export { executeOps } from './file-ops.js';

// ── node CRUD (moved to node-crud.ts) ──────────────────────────────
export { planCreateNode, createNode, updateNode, markDone, writeIndex, markConsolidated } from './node-crud.js';

// ── edge CRUD (moved to edge-crud.ts) ──────────────────────────────
export { planCreateEdge, createEdge, deleteEdge } from './edge-crud.js';

// ── Shared helpers (moved to consolidation-helpers.ts) ─────────────
import { countEpisodesSince, resolveConsolidationAnchor } from './consolidation-helpers.js';

// ── getHealth ───────────────────────────────────────────────────────

/**
 * Compute a health report for the graph.
 */
export async function getHealth(graphDir: string): Promise<HealthReport> {
  const graph = await loadGraph(graphDir);

  // Count nodes by type
  const byType = {} as Record<NodeType, number>;
  for (const nodeType of NODE_TYPES) {
    byType[nodeType] = 0;
  }
  for (const node of graph.nodes.values()) {
    byType[node.type] = (byType[node.type] ?? 0) + 1;
  }

  const totalNodes = graph.nodes.size;

  // Status distribution per type
  const statusDistribution = {} as Record<NodeType, Record<string, number>>;
  for (const node of graph.nodes.values()) {
    const dist = (statusDistribution[node.type] ??= {});
    const s = node.status ?? 'unknown';
    dist[s] = (dist[s] ?? 0) + 1;
  }

  // Average confidence
  let confSum = 0;
  let confCount = 0;
  for (const node of graph.nodes.values()) {
    if (node.confidence !== undefined) {
      confSum += node.confidence;
      confCount++;
    }
  }
  const avgConfidence = confCount > 0 ? confSum / confCount : null;

  // Open questions
  const openQuestions = [...graph.nodes.values()].filter(
    n => n.type === 'question' && n.status === STATUS.OPEN
  ).length;

  // Total edges and link density
  let totalEdges = 0;
  for (const node of graph.nodes.values()) {
    totalEdges += node.links.length;
  }
  const linkDensity = totalNodes > 0 ? totalEdges / totalNodes : 0;

  // Structural gaps (basic)
  const gaps: string[] = [];
  if (byType['hypothesis'] > 0 && byType['experiment'] === 0) {
    gaps.push(t('gap.no_experiments'));
  }
  if (byType['finding'] > 0 && byType['knowledge'] === 0) {
    gaps.push(t('gap.no_knowledge'));
  }
  if (byType['experiment'] > 0 && byType['finding'] === 0) {
    gaps.push(t('gap.no_findings'));
  }
  if (totalNodes > 0 && totalEdges === 0) {
    gaps.push(t('gap.no_edges'));
  }

  // Advanced gap detection (§6.8)
  const config = loadConfig(graphDir);
  const gapDetails: GapDetail[] = [];
  const now = new Date();

  function formatTriggerInfo(
    triggerType: 'days' | 'episodes' | 'both',
    daysVal: number,
    episodesVal: number,
  ): string {
    if (triggerType === 'days') return t('gap.trigger_days', { days: String(daysVal) });
    if (triggerType === 'episodes') return t('gap.trigger_episodes', { episodes: String(episodesVal) });
    return t('gap.trigger_both', { days: String(daysVal), episodes: String(episodesVal) });
  }

  // 1. Untested hypotheses: PROPOSED + (N days elapsed OR M episodes since updated)
  const untestedIds: string[] = [];
  let untestedAnyDays = false;
  let untestedAnyEpisodes = false;
  for (const node of graph.nodes.values()) {
    if (node.type === 'hypothesis' && node.status === STATUS.PROPOSED) {
      const updated = nodeDate(node);
      if (updated) {
        const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        const daysMet = daysElapsed >= config.gaps.untested_days;
        const episodesMet = countEpisodesSince(graph, updated) >= config.gaps.untested_episodes;
        if (daysMet || episodesMet) {
          untestedIds.push(node.id);
          if (daysMet) untestedAnyDays = true;
          if (episodesMet) untestedAnyEpisodes = true;
        }
      }
    }
  }
  if (untestedIds.length > 0) {
    const triggerType: 'days' | 'episodes' | 'both' =
      untestedAnyDays && untestedAnyEpisodes ? 'both'
        : untestedAnyDays ? 'days' : 'episodes';
    const triggerInfo = formatTriggerInfo(triggerType, config.gaps.untested_days, config.gaps.untested_episodes);
    gapDetails.push({
      type: 'untested_hypothesis',
      nodeIds: untestedIds,
      message: t('gap.untested_hypothesis', { count: String(untestedIds.length), triggerInfo }),
      triggerType,
    });
  }

  // 2. Blocking questions: OPEN + urgency=BLOCKING + (N days OR M episodes)
  const blockingIds: string[] = [];
  let blockingAnyDays = false;
  let blockingAnyEpisodes = false;
  for (const node of graph.nodes.values()) {
    if (node.type === 'question' && node.status === STATUS.OPEN && node.meta.urgency === URGENCY.BLOCKING) {
      const updated = nodeDate(node);
      if (updated) {
        const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        const daysMet = daysElapsed >= config.gaps.blocking_days;
        const episodesMet = countEpisodesSince(graph, updated) >= config.gaps.blocking_episodes;
        if (daysMet || episodesMet) {
          blockingIds.push(node.id);
          if (daysMet) blockingAnyDays = true;
          if (episodesMet) blockingAnyEpisodes = true;
        }
      }
    }
  }
  if (blockingIds.length > 0) {
    const triggerType: 'days' | 'episodes' | 'both' =
      blockingAnyDays && blockingAnyEpisodes ? 'both'
        : blockingAnyDays ? 'days' : 'episodes';
    const triggerInfo = formatTriggerInfo(triggerType, config.gaps.blocking_days, config.gaps.blocking_episodes);
    gapDetails.push({
      type: 'blocking_question',
      nodeIds: blockingIds,
      message: t('gap.blocking_question', { count: String(blockingIds.length), triggerInfo }),
      triggerType,
    });
  }

  // 3. Orphan findings: no outgoing value-producing edges (edgeCategories.value_producing)
  const orphanIds: string[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === 'finding') {
      const forwardEdges = node.links.filter(l => VALUE_PRODUCING_EDGES.has(l.relation));
      if (forwardEdges.length <= config.gaps.orphan_min_outgoing) {
        orphanIds.push(node.id);
      }
    }
  }
  if (orphanIds.length > 0) {
    gapDetails.push({
      type: 'orphan_finding',
      nodeIds: orphanIds,
      message: t('gap.orphan_finding', { count: String(orphanIds.length) }),
    });
  }

  // 4. Stale knowledge: source date > N days + newer knowledge exists in same cluster (spec §6.8)
  const knowledgeNodes = [...graph.nodes.values()].filter(n => n.type === 'knowledge');
  const nodeToComponent = buildNodeToComponent(graph);
  const staleIds: string[] = [];
  for (const node of knowledgeNodes) {
    if (node.status !== STATUS.ACTIVE) continue;
    const updated = nodeDate(node);
    if (updated) {
      const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed >= config.gaps.stale_days) {
        // Check if newer knowledge exists in same cluster
        const myComp = nodeToComponent.get(node.id);
        const hasNewer = knowledgeNodes.some(other => {
          if (other.id === node.id) return false;
          if (nodeToComponent.get(other.id) !== myComp) return false;
          const otherUpdated = nodeDate(other);
          return otherUpdated && otherUpdated > updated;
        });
        if (hasNewer) {
          staleIds.push(node.id);
        }
      }
    }
  }
  if (staleIds.length > 0) {
    gapDetails.push({
      type: 'stale_knowledge',
      nodeIds: staleIds,
      message: t('gap.stale_knowledge', { count: String(staleIds.length), days: String(config.gaps.stale_days) }),
    });
  }

  // 5. Disconnected clusters: connected components
  if (totalNodes > 1) {
    const components = getConnectedComponents(graph);

    if (components.length > 1) {
      // Count inter-cluster edges
      const nodeToCluster = new Map<string, number>();
      components.forEach((comp, idx) => comp.forEach(id => nodeToCluster.set(id, idx)));

      let interClusterEdges = 0;
      for (const node of graph.nodes.values()) {
        const myCluster = nodeToCluster.get(node.id)!;
        for (const link of node.links) {
          const targetCluster = nodeToCluster.get(link.target);
          if (targetCluster !== undefined && targetCluster !== myCluster) {
            interClusterEdges++;
          }
        }
      }

      if (interClusterEdges < config.gaps.min_cluster_edges) {
        const clusterNodeIds = components
          .filter(c => c.length > 0)
          .map(c => c[0]);
        gapDetails.push({
          type: 'disconnected_cluster',
          nodeIds: clusterNodeIds,
          message: t('gap.disconnected_cluster', { count: String(components.length), edges: String(interClusterEdges) }),
        });
      }
    }
  }

  // Deferred items (OPERATIONS.md §7.4: display not-pursued items in health report)
  const deferredItems = collectDeferredIds(graph);

  // Edge attribute affinity violations
  const affinityViolations: string[] = [];
  for (const node of graph.nodes.values()) {
    for (const link of node.links) {
      const violation = checkEdgeAffinity(link.relation, getPresentAttrKeys(link as unknown as Record<string, unknown>));
      if (!violation) continue;
      if (violation.allowedAttrs === null) {
        affinityViolations.push(`${node.id} → ${link.target} [${link.relation}]: no attributes allowed, but has [${violation.invalidAttrs.join(', ')}]`);
      } else {
        affinityViolations.push(`${node.id} → ${link.target} [${link.relation}]: allows [${violation.allowedAttrs.join(', ')}], but has disallowed [${violation.invalidAttrs.join(', ')}]`);
      }
    }
  }

  return {
    totalNodes,
    totalEdges,
    byType,
    statusDistribution,
    avgConfidence,
    openQuestions,
    linkDensity,
    gaps,
    gapDetails,
    deferredItems,
    affinityViolations,
  };
}

// ── getNeighbors (moved to query.ts, re-exported above) ────────────

// ── checkConsolidation ──────────────────────────────────────────────

/**
 * Check consolidation triggers in the graph.
 * Replicates logic from commands/check.ts as a pure function.
 */
export async function checkConsolidation(graphDir: string): Promise<CheckResult> {
  const graph = await loadGraph(graphDir);
  const triggers: CheckTrigger[] = [];

  const findings: string[] = [];
  const episodes: string[] = [];
  const experiments: string[] = [];
  const openQuestions: string[] = [];
  const questionCount = { total: 0 };
  const promotedIds = new Set<string>();

  for (const [id, node] of graph.nodes) {
    switch (node.type) {
      case 'finding':
        findings.push(id);
        break;
      case 'episode':
        episodes.push(id);
        break;
      case 'experiment':
        experiments.push(id);
        break;
      case 'question':
        questionCount.total++;
        if (node.status === STATUS.OPEN) {
          openQuestions.push(id);
        }
        break;
      case 'knowledge':
        for (const link of node.links) {
          if (link.relation === EDGE.promotes) {
            promotedIds.add(link.target);
          }
        }
        break;
    }
  }

  // Ceremony thresholds from schema
  const ct = CEREMONY_TRIGGERS.consolidation;
  const findingsThreshold = ct.unpromoted_findings_threshold;
  const episodesThreshold = ct.episodes_threshold;
  const allQuestionsResolved = ct.all_questions_resolved;
  const overloadThreshold = ct.experiment_overload_threshold;

  // Load config early — needed for episode anchor and orphan thresholds
  const config = loadConfig(graphDir);

  // Resolve consolidation anchor for time-scoped counting
  const anchorDate = resolveConsolidationAnchor(config, graph);

  // 1. Unpromoted findings threshold (since last consolidation, per spec §7.4)
  const unpromoted = findings.filter(id => {
    if (promotedIds.has(id)) return false;
    if (!anchorDate) return true;
    const node = graph.nodes.get(id);
    const created = node?.meta.created ? new Date(String(node.meta.created)) : null;
    return !created || created > anchorDate;
  });
  if (unpromoted.length >= findingsThreshold) {
    triggers.push({
      type: 'findings',
      message: t('check.findings_threshold', { count: String(unpromoted.length), threshold: String(findingsThreshold) }),
      count: unpromoted.length,
    });
  }

  // 2. Episode accumulation threshold (since last consolidation)
  const episodeCount = anchorDate
    ? countEpisodesSince(graph, anchorDate)
    : episodes.length;
  if (episodeCount >= episodesThreshold) {
    triggers.push({
      type: 'episodes',
      message: t('check.episodes_threshold', { count: String(episodeCount), threshold: String(episodesThreshold) }),
      count: episodeCount,
    });
  }

  // 3. All questions resolved (boolean trigger: total > 0 && open === 0)
  if (allQuestionsResolved && questionCount.total > 0 && openQuestions.length === 0) {
    triggers.push({
      type: 'questions',
      message: t('check.all_questions_resolved'),
      count: 0,
    });
  }

  // 4. Experiment overload (produces edge count)
  for (const expId of experiments) {
    const expNode = graph.nodes.get(expId);
    if (!expNode) continue;
    const producesCount = expNode.links.filter(l => l.relation === EDGE.produces).length;
    if (producesCount >= overloadThreshold) {
      triggers.push({
        type: 'experiment_overload',
        message: t('check.experiment_overload', { id: expId, count: String(producesCount), threshold: String(overloadThreshold) }),
        count: producesCount,
      });
    }
  }

  // Promotion evaluation
  const promotionCandidates = await getPromotionCandidates(graphDir, graph);

  // Orphan findings: findings with forward edges <= configurable threshold
  const orphanFindings: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    const forwardEdges = node.links.filter(l => VALUE_PRODUCING_EDGES.has(l.relation));
    if (forwardEdges.length <= config.gaps.orphan_min_outgoing) orphanFindings.push(id);
  }

  // Deferred items
  const deferredItems = collectDeferredIds(graph);

  return { triggers, promotionCandidates, orphanFindings, deferredItems };
}

// ── getPromotionCandidates ──────────────────────────────────────────

/**
 * Identify findings eligible for promotion to knowledge.
 * Spec §6.2 criteria (OR logic — at least one must be met):
 * 1. confidence >= 0.9 + independent support 2+
 * 2. de facto in use (referenced as premise via DEPENDS_ON/EXTENDS)
 * Exclusion: CONTRADICTS edge exists → not eligible
 */
export async function getPromotionCandidates(graphDir: string, preloadedGraph?: Graph): Promise<PromoteCandidate[]> {
  const graph = preloadedGraph ?? await loadGraph(graphDir);
  const candidates: PromoteCandidate[] = [];

  // Track already-promoted findings
  const promotedIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    if (node.type === 'knowledge') {
      for (const link of node.links) {
        if (link.relation === EDGE.promotes) {
          promotedIds.add(link.target);
        }
      }
    }
  }

  // Build set of findings that are contradicted
  const contradictedIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    for (const link of node.links) {
      if (link.relation === EDGE.contradicts) {
        contradictedIds.add(link.target);
      }
    }
  }

  // Build set of findings referenced as premise (de facto in use)
  const deFactoIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    for (const link of node.links) {
      if (link.relation === EDGE.depends_on || link.relation === EDGE.extends) {
        deFactoIds.add(link.target);
      }
    }
  }

  // Count incoming supports (how many other nodes support each finding)
  const incomingSupportCounts = new Map<string, number>();
  for (const [, n] of graph.nodes) {
    for (const link of n.links) {
      if (link.relation === EDGE.supports) {
        incomingSupportCounts.set(link.target, (incomingSupportCounts.get(link.target) ?? 0) + 1);
      }
    }
  }

  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    if (node.status === STATUS.PROMOTED) continue;
    if (promotedIds.has(id)) continue;
    if (contradictedIds.has(id)) continue;

    const confidence = node.confidence ?? 0;
    const supportsCount = incomingSupportCounts.get(id) ?? 0;
    const isDeFacto = deFactoIds.has(id);
    const meetsConfidence = confidence >= THRESHOLDS.promotion_confidence && supportsCount >= THRESHOLDS.min_independent_supports;

    if (!meetsConfidence && !isDeFacto) continue;

    const reason = meetsConfidence && isDeFacto ? 'both'
      : meetsConfidence ? 'confidence'
      : 'de_facto';

    candidates.push({ id, confidence, supports: supportsCount, reason });
  }

  return candidates;
}

// ── updateNode (moved to node-crud.ts, re-exported above) ─────────

// ── deleteEdge (moved to edge-crud.ts, re-exported above) ─────────
