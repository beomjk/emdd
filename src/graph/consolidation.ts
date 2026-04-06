import { loadGraph } from './loader.js';
import { THRESHOLDS, CEREMONY_TRIGGERS, VALUE_PRODUCING_EDGES, EDGE, STATUS } from './types.js';
import type { Graph, CheckResult, CheckTrigger, PromoteCandidate } from './types.js';
import { collectDeferredIds } from './utils.js';
import { loadConfig } from './config.js';
import { countEpisodesSince, resolveConsolidationAnchor } from './consolidation-helpers.js';
import { t } from '../i18n/index.js';

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
