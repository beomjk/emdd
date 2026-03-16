import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { nextId, renderTemplate, nodePath } from './templates.js';
import { NODE_TYPES, NODE_TYPE_DIRS, ALL_VALID_RELATIONS, REVERSE_LABELS } from './types.js';
import type {
  Node,
  NodeType,
  NodeFilter,
  NodeDetail,
  CreateNodeResult,
  CreateEdgeResult,
  HealthReport,
  CheckResult,
  CheckTrigger,
  PromoteCandidate,
} from './types.js';
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

// ── createNode ──────────────────────────────────────────────────────

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
  if (!NODE_TYPES.includes(type as NodeType)) {
    throw new Error(`Invalid node type: ${type}. Valid types: ${NODE_TYPES.join(', ')}`);
  }

  const nodeType = type as NodeType;
  const id = nextId(graphDir, nodeType);
  const content = renderTemplate(nodeType, slug, {
    id,
    locale: (lang as Locale) ?? 'en',
  });
  const filePath = nodePath(graphDir, nodeType, id, slug);

  // Ensure directory exists
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');

  return { id, type: nodeType, path: filePath };
}

// ── createEdge ──────────────────────────────────────────────────────

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

  // Validate target exists (new behavior not in original link.ts)
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

  // Write back
  const output = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, output);

  return { source, target, relation: canonical };
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

  // Structural gaps
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

  return {
    totalNodes,
    totalEdges,
    byType,
    statusDistribution,
    avgConfidence,
    openQuestions,
    linkDensity,
    gaps,
  };
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

  return { triggers };
}

// ── getPromotionCandidates ──────────────────────────────────────────

/**
 * Identify findings eligible for promotion to knowledge.
 * Criteria: confidence >= 0.8 AND 2+ outgoing "supports" links.
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

  for (const [id, node] of graph.nodes) {
    if (node.type !== 'finding') continue;
    if (promotedIds.has(id)) continue;

    const confidence = node.confidence ?? 0;
    if (confidence < 0.8) continue;

    const supportsCount = node.links.filter(
      l => l.relation === 'supports'
    ).length;

    if (supportsCount < 2) continue;

    candidates.push({ id, confidence, supports: supportsCount });
  }

  return candidates;
}
