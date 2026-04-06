import { loadGraph } from './loader.js';
import { NODE_TYPES, VALUE_PRODUCING_EDGES, URGENCY, STATUS } from './types.js';
import type { NodeType, HealthReport, GapDetail } from './types.js';
import { checkEdgeAffinity, getPresentAttrKeys } from './edge-attrs.js';
import { collectDeferredIds, buildNodeToComponent, getConnectedComponents } from './utils.js';
import { nodeDate } from './date-utils.js';
import { loadConfig } from './config.js';
import { countEpisodesSince } from './consolidation-helpers.js';
import { t } from '../i18n/index.js';

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
