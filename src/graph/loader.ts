import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { glob } from 'glob';
import type { Node, Graph, Link, NodeType } from './types.js';
import { REVERSE_LABELS } from './types.js';

/**
 * Walk up from startPath looking for a `graph/` directory.
 * Throws if not found.
 */
export function resolveGraphDir(startPath?: string): string {
  let current = path.resolve(startPath ?? process.cwd());

  // If startPath itself is not a directory, go to parent
  try {
    if (!fs.statSync(current).isDirectory()) {
      current = path.dirname(current);
    }
  } catch {
    throw new Error('No graph/ directory found');
  }

  const root = path.parse(current).root;
  while (current !== root) {
    const candidate = path.join(current, 'graph');
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // not found, keep walking
    }
    current = path.dirname(current);
  }
  throw new Error('No graph/ directory found');
}

function normalizeRelation(relation: string): string {
  return REVERSE_LABELS[relation] ?? relation;
}

function parseLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      target: String(item.target ?? ''),
      relation: normalizeRelation(String(item.relation ?? 'relates_to')),
    }));
}

/**
 * Parse a single .md file into a Node. Returns null on error or missing frontmatter.
 */
export async function loadNode(filePath: string): Promise<Node | null> {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch {
    return null;
  }

  const meta = parsed.data;
  if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) {
    return null;
  }

  const id = meta.id ?? path.basename(filePath, '.md').replace(/^(\w+-\d+).*$/, '$1');
  const type = meta.type as NodeType | undefined;
  if (!type) return null;

  return {
    id: String(id),
    type,
    title: String(meta.title ?? ''),
    path: filePath,
    status: meta.status ? String(meta.status) : undefined,
    confidence: typeof meta.confidence === 'number' ? meta.confidence : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    links: parseLinks(meta.links),
    meta,
  };
}

/**
 * Load all .md nodes from a graph directory (including subdirectories).
 * Excludes files/dirs starting with _.
 */
export async function loadGraph(graphDir: string): Promise<Graph> {
  const graph: Graph = {
    nodes: new Map(),
    errors: [],
    warnings: [],
  };

  // Find all .md files in the graph directory and subdirectories
  const pattern = path.join(graphDir, '**/*.md');
  const files = await glob(pattern, { nodir: true });

  for (const file of files.sort()) {
    // Skip files or directories starting with _
    const relative = path.relative(graphDir, file);
    const parts = relative.split(path.sep);
    if (parts.some((p) => p.startsWith('_'))) continue;

    const node = await loadNode(file);
    if (node) {
      graph.nodes.set(node.id, node);
    }
  }

  return graph;
}
