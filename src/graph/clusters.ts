import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import GraphologyDefault from 'graphology';
import louvainDefault from 'graphology-communities-louvain';
import { STATUS, EDGE, type Graph as EmddGraph, type Node, type EdgeType } from './types.js';

// ESM interop — graphology/louvain export shapes vary by bundler
const GraphologyGraph = (GraphologyDefault as any).default ?? GraphologyDefault;
const louvain = (louvainDefault as any).default ?? louvainDefault;
import type { VisualCluster } from '../web/types.js';

// ── Edge weight configuration for Louvain clustering ────────────────

const EDGE_WEIGHTS: Partial<Record<EdgeType, number>> = {
  [EDGE.supports]: 1.0,
  [EDGE.contradicts]: 1.0,
  [EDGE.tests]: 0.8,
  [EDGE.produces]: 0.8,
  [EDGE.answers]: 0.8,
  [EDGE.informs]: 0.6,
  [EDGE.depends_on]: 0.6,
  [EDGE.relates_to]: 0.3,
};

const DEFAULT_EDGE_WEIGHT = 0.3;
const TAG_OVERLAP_BONUS = 0.3;

// ── Topic context (preserved — unrelated to dashboard clustering) ───

export interface TopicContext {
  entryPoints: Array<{ id: string; title: string; type: string }>;
  openQuestions: Array<{ id: string; title: string }>;
  relatedNodes: Array<{ id: string; title: string; type: string }>;
}

// ── Manual clusters from _index.md YAML frontmatter ─────────────────

export async function identifyClusters(graphDir: string): Promise<VisualCluster[]> {
  const indexPath = path.join(graphDir, '_index.md');

  let indexContent: string;
  try {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } catch {
    return [];
  }

  const parsed = matter(indexContent);
  const clusters = parsed.data.clusters;
  if (!Array.isArray(clusters)) return [];

  return clusters.map((c: { label?: string; members?: string[] }, i: number) => ({
    id: `manual-${i}`,
    label: c.label ?? `Manual Cluster ${i}`,
    nodeIds: Array.isArray(c.members) ? c.members.map(String) : [],
    isManual: true,
  }));
}

// ── Louvain auto-detection ──────────────────────────────────────────

export interface DetectClustersOptions {
  resolution?: number;
  minClusterSize?: number;
}

export async function detectClusters(
  graph: EmddGraph,
  graphDir: string,
  options?: DetectClustersOptions,
): Promise<VisualCluster[]> {
  const resolution = options?.resolution ?? 1.0;
  const minClusterSize = options?.minClusterSize ?? 2;

  // 1. Load manual clusters first — their members are excluded from Louvain
  const manualClusters = await identifyClusters(graphDir);
  const manualNodeIds = new Set(manualClusters.flatMap((c) => c.nodeIds));

  // 2. Build graphology instance from EMDD graph (excluding manual cluster members)
  const g = new GraphologyGraph({ type: 'undirected' });
  const nodeTagsMap = new Map<string, string[]>();

  for (const [id, node] of graph.nodes) {
    if (manualNodeIds.has(id)) continue;
    g.addNode(id);
    nodeTagsMap.set(id, node.tags ?? []);
  }

  // Add edges with weights
  const edgesSeen = new Set<string>();
  for (const [, node] of graph.nodes) {
    if (manualNodeIds.has(node.id)) continue;
    for (const link of node.links) {
      if (manualNodeIds.has(link.target)) continue;
      if (!g.hasNode(link.target)) continue;

      const edgeKey = [node.id, link.target].sort().join('::');
      if (edgesSeen.has(edgeKey)) {
        // Accumulate weight on existing edge
        const existing = g.getEdgeAttribute(g.edge(node.id, link.target)!, 'weight') ?? 0;
        const addWeight = EDGE_WEIGHTS[link.relation as EdgeType] ?? DEFAULT_EDGE_WEIGHT;
        g.setEdgeAttribute(g.edge(node.id, link.target)!, 'weight', existing + addWeight);
        continue;
      }

      const baseWeight = EDGE_WEIGHTS[link.relation as EdgeType] ?? DEFAULT_EDGE_WEIGHT;

      // Tag overlap bonus
      const sourceTags = nodeTagsMap.get(node.id) ?? [];
      const targetTags = nodeTagsMap.get(link.target) ?? [];
      const sharedTags = sourceTags.filter((t) => targetTags.includes(t)).length;
      const totalWeight = baseWeight + sharedTags * TAG_OVERLAP_BONUS;

      g.addEdge(node.id, link.target, { weight: totalWeight });
      edgesSeen.add(edgeKey);
    }
  }

  // 3. Run Louvain — needs at least 1 edge
  if (g.size === 0 || g.order < 2) {
    return [...manualClusters];
  }

  const communities = louvain(g, { resolution });

  // 4. Group nodes by community
  const communityMap = new Map<number, string[]>();
  for (const [nodeId, community] of Object.entries(communities)) {
    const comm = community as number;
    if (!communityMap.has(comm)) communityMap.set(comm, []);
    communityMap.get(comm)!.push(nodeId);
  }

  // 5. Build auto clusters (filter by minClusterSize)
  const autoClusters: VisualCluster[] = [];
  let autoIndex = 0;

  for (const [, members] of communityMap) {
    if (members.length < minClusterSize) continue;

    const label = generateClusterLabel(members, graph, autoIndex);
    autoClusters.push({
      id: `auto-${autoIndex}`,
      label,
      nodeIds: members,
      isManual: false,
    });
    autoIndex++;
  }

  return [...manualClusters, ...autoClusters];
}

// ── Label generation ────────────────────────────────────────────────

function generateClusterLabel(
  memberIds: string[],
  graph: EmddGraph,
  index: number,
): string {
  // Strategy 1: Top 2 most frequent tags
  const tagCounts = new Map<string, number>();
  for (const id of memberIds) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    for (const tag of node.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  if (tagCounts.size > 0) {
    const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topTags = sorted.slice(0, 2).map(([tag]) => tag);
    return topTags.join('/');
  }

  // Strategy 2: Highest-confidence knowledge node title
  let bestKnowledge: { title: string; confidence: number } | null = null;
  for (const id of memberIds) {
    const node = graph.nodes.get(id);
    if (!node || node.type !== 'knowledge') continue;
    const conf = node.confidence ?? 0;
    if (!bestKnowledge || conf > bestKnowledge.confidence) {
      bestKnowledge = { title: node.title, confidence: conf };
    }
  }

  if (bestKnowledge) return bestKnowledge.title;

  // Strategy 3: Fallback
  return `Cluster ${index}`;
}

// ── loadContextForTopic (preserved — unrelated to dashboard) ────────

export async function loadContextForTopic(graphDir: string, topic: string): Promise<TopicContext> {
  // Lazy import to avoid circular dependency
  const { loadGraph } = await import('./loader.js');
  const graph = await loadGraph(graphDir);
  const entryPoints: TopicContext['entryPoints'] = [];
  const openQuestions: TopicContext['openQuestions'] = [];
  const relatedNodes: TopicContext['relatedNodes'] = [];

  for (const [, node] of graph.nodes) {
    const tags = node.tags.map((t) => t.toLowerCase());
    const titleLower = node.title.toLowerCase();
    const topicLower = topic.toLowerCase();

    if (!tags.includes(topicLower) && !titleLower.includes(topicLower)) continue;

    if (
      (node.type === 'knowledge' && node.status === STATUS.ACTIVE) ||
      (node.type === 'finding' && node.status === STATUS.VALIDATED)
    ) {
      entryPoints.push({ id: node.id, title: node.title, type: node.type });
    }

    if (node.type === 'question' && node.status === STATUS.OPEN) {
      openQuestions.push({ id: node.id, title: node.title });
    }

    relatedNodes.push({ id: node.id, title: node.title, type: node.type });
  }

  return { entryPoints, openQuestions, relatedNodes };
}
