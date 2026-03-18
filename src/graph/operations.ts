import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { nextId, renderTemplate, nodePath, sanitizeSlug } from './templates.js';
import { NODE_TYPES, NODE_TYPE_DIRS, ALL_VALID_RELATIONS, REVERSE_LABELS, THRESHOLDS } from './types.js';
import type {
  Node,
  NodeType,
  NodeFilter,
  NodeDetail,
  CreateNodeResult,
  CreateEdgeResult,
  CreateNodePlan,
  CreateEdgePlan,
  FileOp,
  HealthReport,
  GapDetail,
  CheckResult,
  CheckTrigger,
  PromoteCandidate,
} from './types.js';
import { loadConfig } from './config.js';
import type { Locale } from '../i18n/index.js';

// ── listNodes ───────────────────────────────────────────────────────

/**
 * List all nodes in the graph, optionally filtered by type and/or status.
 */
export async function listNodes(graphDir: string, filter?: NodeFilter): Promise<Node[]> {
  const graph = await loadGraph(graphDir);
  let nodes = [...graph.nodes.values()];

  if (filter?.type) {
    nodes = nodes.filter(n => n.type === filter.type);
  }
  if (filter?.status) {
    nodes = nodes.filter(n => n.status === filter.status);
  }

  return nodes;
}

// ── readNode ────────────────────────────────────────────────────────

/**
 * Read a single node by ID, returning full detail including body text.
 * Returns null if the node is not found.
 */
export async function readNode(graphDir: string, nodeId: string): Promise<NodeDetail | null> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(nodeId);
  if (!node) return null;

  // Read file to extract body
  const raw = fs.readFileSync(node.path, 'utf-8');
  const parsed = matter(raw);

  return {
    ...node,
    body: parsed.content,
  };
}

// ── executeOps ──────────────────────────────────────────────────────

/**
 * Execute a list of file operations (mkdir / write).
 */
export async function executeOps(ops: FileOp[]): Promise<void> {
  for (const op of ops) {
    switch (op.kind) {
      case 'mkdir':
        if (!fs.existsSync(op.path)) {
          fs.mkdirSync(op.path, { recursive: true });
        }
        break;
      case 'write':
        fs.writeFileSync(op.path, op.content, 'utf-8');
        break;
    }
  }
}

// ── createNode ──────────────────────────────────────────────────────

/**
 * Plan the creation of a new node (pure computation, no I/O).
 */
export function planCreateNode(
  graphDir: string,
  type: string,
  slug: string,
  lang?: string,
): CreateNodePlan {
  if (!NODE_TYPES.includes(type as NodeType)) {
    throw new Error(`Invalid node type: ${type}. Valid types: ${NODE_TYPES.join(', ')}`);
  }

  const nodeType = type as NodeType;
  const id = nextId(graphDir, nodeType);
  const sanitized = sanitizeSlug(slug);
  const content = renderTemplate(nodeType, sanitized, {
    id,
    locale: (lang as Locale) ?? 'en',
  });
  const filePath = nodePath(graphDir, nodeType, id, sanitized);
  const dir = path.dirname(filePath);

  const ops: FileOp[] = [
    { kind: 'mkdir', path: dir },
    { kind: 'write', path: filePath, content },
  ];

  return { id, type: nodeType, path: filePath, ops };
}

/**
 * Create a new node of the given type with the given slug.
 * Returns the created node's ID, type, and file path.
 */
export async function createNode(
  graphDir: string,
  type: string,
  slug: string,
  lang?: string,
): Promise<CreateNodeResult> {
  const plan = planCreateNode(graphDir, type, slug, lang);
  await executeOps(plan.ops);
  return { id: plan.id, type: plan.type, path: plan.path };
}

// ── createEdge ──────────────────────────────────────────────────────

/**
 * Plan the creation of an edge (pure computation after graph load).
 */
export async function planCreateEdge(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
): Promise<CreateEdgePlan> {
  // Validate relation
  if (!ALL_VALID_RELATIONS.has(relation)) {
    const valid = [...ALL_VALID_RELATIONS].sort().join(', ');
    throw new Error(`Invalid relation: ${relation}. Valid: ${valid}`);
  }

  // Normalize reverse labels
  const canonical = REVERSE_LABELS[relation] ?? relation;

  const graph = await loadGraph(graphDir);
  const sourceNode = graph.nodes.get(source);
  if (!sourceNode) {
    throw new Error(`Source node not found: ${source}`);
  }

  const targetNode = graph.nodes.get(target);
  if (!targetNode) {
    throw new Error(`Target node not found: ${target}`);
  }

  const filePath = sourceNode.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  // Ensure links array exists
  if (!Array.isArray(parsed.data.links)) {
    parsed.data.links = [];
  }

  // Add link
  parsed.data.links.push({ target, relation: canonical });

  // Auto-update the `updated` field
  parsed.data.updated = new Date().toISOString().slice(0, 10);

  // Compute new file content
  const output = matter.stringify(parsed.content, parsed.data);
  const ops: FileOp[] = [{ kind: 'write', path: filePath, content: output }];

  return { source, target, relation: canonical, ops };
}

/**
 * Add an edge (link) from source to target with the given relation.
 * Validates relation, source existence, and target existence.
 */
export async function createEdge(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
): Promise<CreateEdgeResult> {
  const plan = await planCreateEdge(graphDir, source, target, relation);
  await executeOps(plan.ops);
  return { source: plan.source, target: plan.target, relation: plan.relation };
}

// ── getHealth ───────────────────────────────────────────────────────

/**
 * Compute a health report for the graph.
 */
export async function getHealth(graphDir: string): Promise<HealthReport> {
  const graph = await loadGraph(graphDir);

  // Count nodes by type
  const byType: Record<string, number> = {};
  for (const nodeType of NODE_TYPES) {
    byType[nodeType] = 0;
  }
  for (const node of graph.nodes.values()) {
    byType[node.type] = (byType[node.type] ?? 0) + 1;
  }

  const totalNodes = graph.nodes.size;

  // Status distribution per type
  const statusDistribution: Record<string, Record<string, number>> = {};
  for (const node of graph.nodes.values()) {
    if (!statusDistribution[node.type]) {
      statusDistribution[node.type] = {};
    }
    const s = node.status ?? 'unknown';
    statusDistribution[node.type][s] = (statusDistribution[node.type][s] ?? 0) + 1;
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
    n => n.type === 'question' && n.status === 'OPEN'
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
    gaps.push('No experiments — hypotheses lack testing');
  }
  if (byType['finding'] > 0 && byType['knowledge'] === 0) {
    gaps.push('No knowledge nodes — findings not consolidated');
  }
  if (byType['experiment'] > 0 && byType['finding'] === 0) {
    gaps.push('No findings — experiments lack documented results');
  }
  if (totalNodes > 0 && totalEdges === 0) {
    gaps.push('No edges — graph is disconnected');
  }

  // Advanced gap detection (§6.8)
  const config = loadConfig(graphDir);
  const gapDetails: GapDetail[] = [];
  const now = new Date();

  // 1. Untested hypotheses: PROPOSED + N days elapsed
  const untestedIds: string[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === 'hypothesis' && node.status === 'PROPOSED') {
      const created = node.meta.created ? new Date(String(node.meta.created)) : null;
      if (created) {
        const daysElapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed >= config.gaps.untested_days) {
          untestedIds.push(node.id);
        }
      }
    }
  }
  if (untestedIds.length > 0) {
    gapDetails.push({
      type: 'untested_hypothesis',
      nodeIds: untestedIds,
      message: `${untestedIds.length} hypothesis(es) in PROPOSED for ${config.gaps.untested_days}+ days`,
    });
  }

  // 2. Blocking questions: OPEN + urgency=BLOCKING + N days
  const blockingIds: string[] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === 'question' && node.status === 'OPEN' && node.meta.urgency === 'BLOCKING') {
      const created = node.meta.created ? new Date(String(node.meta.created)) : null;
      if (created) {
        const daysElapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed >= config.gaps.blocking_days) {
          blockingIds.push(node.id);
        }
      }
    }
  }
  if (blockingIds.length > 0) {
    gapDetails.push({
      type: 'blocking_question',
      nodeIds: blockingIds,
      message: `${blockingIds.length} blocking question(s) open for ${config.gaps.blocking_days}+ days`,
    });
  }

  // 3. Orphan findings: no outgoing SPAWNS, ANSWERS, or EXTENDS edges
  const orphanIds: string[] = [];
  const forwardRelations = new Set(['spawns', 'answers', 'extends']);
  for (const node of graph.nodes.values()) {
    if (node.type === 'finding') {
      const forwardEdges = node.links.filter(l => forwardRelations.has(l.relation));
      if (forwardEdges.length <= config.gaps.orphan_min_outgoing) {
        orphanIds.push(node.id);
      }
    }
  }
  if (orphanIds.length > 0) {
    gapDetails.push({
      type: 'orphan_finding',
      nodeIds: orphanIds,
      message: `${orphanIds.length} finding(s) with no outgoing spawns/answers/extends edges`,
    });
  }

  // 4. Stale knowledge: source date > N days + newer knowledge exists
  const knowledgeNodes = [...graph.nodes.values()].filter(n => n.type === 'knowledge');
  const staleIds: string[] = [];
  for (const node of knowledgeNodes) {
    if (node.status !== 'ACTIVE') continue;
    const updated = node.meta.updated ? new Date(String(node.meta.updated)) : null;
    if (updated) {
      const daysElapsed = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed >= config.gaps.stale_days) {
        // Check if newer knowledge exists
        const hasNewer = knowledgeNodes.some(other => {
          if (other.id === node.id) return false;
          const otherUpdated = other.meta.updated ? new Date(String(other.meta.updated)) : null;
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
      message: `${staleIds.length} knowledge node(s) stale for ${config.gaps.stale_days}+ days`,
    });
  }

  // 5. Disconnected clusters: BFS connected components
  if (totalNodes > 1) {
    // Build undirected adjacency
    const adj = new Map<string, Set<string>>();
    for (const node of graph.nodes.values()) {
      if (!adj.has(node.id)) adj.set(node.id, new Set());
      for (const link of node.links) {
        if (graph.nodes.has(link.target)) {
          adj.get(node.id)!.add(link.target);
          if (!adj.has(link.target)) adj.set(link.target, new Set());
          adj.get(link.target)!.add(node.id);
        }
      }
    }

    const visited = new Set<string>();
    const components: string[][] = [];
    for (const nodeId of graph.nodes.keys()) {
      if (visited.has(nodeId)) continue;
      const component: string[] = [];
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.push(current);
        const neighbors = adj.get(current) ?? new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      components.push(component);
    }

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
          .map(c => c[0]); // representative node from each cluster
        gapDetails.push({
          type: 'disconnected_cluster',
          nodeIds: clusterNodeIds,
          message: `${components.length} disconnected clusters with only ${interClusterEdges} inter-cluster edge(s)`,
        });
      }
    }
  }

  // Deferred items (OPERATIONS.md §7.4: display not-pursued items in health report)
  const deferredItems: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.status === 'DEFERRED') deferredItems.push(id);
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
  };
}

// ── getNeighbors ───────────────────────────────────────────────────

export interface NeighborNode {
  id: string;
  type: string;
  title: string;
  status?: string;
  relation: string;
  direction: 'outgoing' | 'incoming';
  depth: number;
}

/**
 * Get neighbors of a node up to a given depth using BFS.
 */
export async function getNeighbors(
  graphDir: string,
  nodeId: string,
  depth: number = 1,
): Promise<NeighborNode[]> {
  const graph = await loadGraph(graphDir);
  const startNode = graph.nodes.get(nodeId);
  if (!startNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Build reverse index for incoming edges
  const reverseAdj = new Map<string, Array<{ sourceId: string; relation: string }>>();
  for (const [id, node] of graph.nodes) {
    for (const link of node.links) {
      if (!reverseAdj.has(link.target)) reverseAdj.set(link.target, []);
      reverseAdj.get(link.target)!.push({ sourceId: id, relation: link.relation });
    }
  }

  const visited = new Set<string>([nodeId]);
  const result: NeighborNode[] = [];
  let frontier: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];

  while (frontier.length > 0) {
    const nextFrontier: Array<{ id: string; depth: number }> = [];

    for (const { id, depth: currentDepth } of frontier) {
      if (currentDepth >= depth) continue;
      const node = graph.nodes.get(id);
      if (!node) continue;

      // Outgoing edges
      for (const link of node.links) {
        if (!visited.has(link.target) && graph.nodes.has(link.target)) {
          visited.add(link.target);
          const target = graph.nodes.get(link.target)!;
          result.push({
            id: target.id,
            type: target.type,
            title: target.title,
            status: target.status,
            relation: link.relation,
            direction: 'outgoing',
            depth: currentDepth + 1,
          });
          nextFrontier.push({ id: target.id, depth: currentDepth + 1 });
        }
      }

      // Incoming edges
      const incoming = reverseAdj.get(id) ?? [];
      for (const edge of incoming) {
        if (!visited.has(edge.sourceId)) {
          visited.add(edge.sourceId);
          const source = graph.nodes.get(edge.sourceId)!;
          result.push({
            id: source.id,
            type: source.type,
            title: source.title,
            status: source.status,
            relation: edge.relation,
            direction: 'incoming',
            depth: currentDepth + 1,
          });
          nextFrontier.push({ id: source.id, depth: currentDepth + 1 });
        }
      }
    }

    frontier = nextFrontier;
  }

  return result;
}

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
        if (node.status === 'OPEN') {
          openQuestions.push(id);
        }
        break;
      case 'knowledge':
        for (const link of node.links) {
          if (link.relation === 'promotes') {
            promotedIds.add(link.target);
          }
        }
        break;
    }
  }

  // 1. Unpromoted findings threshold (5)
  const unpromoted = findings.filter(id => !promotedIds.has(id));
  if (unpromoted.length >= 5) {
    triggers.push({
      type: 'findings',
      message: `Findings pending consolidation: ${unpromoted.length} (threshold: 5)`,
      count: unpromoted.length,
    });
  }

  // 2. Episode accumulation threshold (3)
  if (episodes.length >= 3) {
    triggers.push({
      type: 'episodes',
      message: `Episodes since last consolidation: ${episodes.length} (threshold: 3)`,
      count: episodes.length,
    });
  }

  // 3. All questions resolved
  if (questionCount.total > 0 && openQuestions.length === 0) {
    triggers.push({
      type: 'questions',
      message: 'All questions resolved — consider generating new ones',
      count: 0,
    });
  }

  // 4. Experiment overload (5+ findings attached)
  for (const expId of experiments) {
    const expNode = graph.nodes.get(expId);
    if (!expNode) continue;
    const producesCount = expNode.links.filter(l => l.relation === 'produces').length;
    if (producesCount >= 5) {
      triggers.push({
        type: 'experiment_overload',
        message: `Experiment ${expId} has ${producesCount} findings attached (threshold: 5) — consider splitting`,
        count: producesCount,
      });
    }
  }

  // Promotion evaluation
  const promotionCandidates = await getPromotionCandidates(graphDir);

  // Orphan findings: findings with no forward edges
  const forwardRelations = new Set(['spawns', 'answers', 'extends']);
  const orphanFindings: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    const hasForward = node.links.some(l => forwardRelations.has(l.relation));
    if (!hasForward) orphanFindings.push(id);
  }

  // Deferred items
  const deferredItems: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.status === 'DEFERRED') deferredItems.push(id);
  }

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
export async function getPromotionCandidates(graphDir: string): Promise<PromoteCandidate[]> {
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

  // Build set of findings that are contradicted
  const contradictedIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    for (const link of node.links) {
      if (link.relation === 'contradicts') {
        contradictedIds.add(link.target);
      }
    }
  }

  // Build set of findings referenced as premise (de facto in use)
  const deFactoIds = new Set<string>();
  for (const [, node] of graph.nodes) {
    for (const link of node.links) {
      if (link.relation === 'depends_on' || link.relation === 'extends') {
        deFactoIds.add(link.target);
      }
    }
  }

  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    if (promotedIds.has(id)) continue;
    if (contradictedIds.has(id)) continue;

    const confidence = node.confidence ?? 0;
    const supportsCount = node.links.filter(l => l.relation === 'supports').length;
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
