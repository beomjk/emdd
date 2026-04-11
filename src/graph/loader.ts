import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { glob } from 'glob';
import type { Node, Graph, Link, NodeType } from './types.js';
import { REVERSE_LABELS, NODE_TYPE_DIRS, PREFIX_TO_TYPE, EDGE_ATTRIBUTE_NAMES, EDGE_ATTRIBUTE_TYPES, EDGE } from './types.js';
import { t } from '../i18n/index.js';

export interface LoadGraphOptions {
  permissive?: boolean;
}

const DIR_TO_TYPE: Record<string, NodeType> = Object.fromEntries(
  Object.entries(NODE_TYPE_DIRS).map(([type, dir]) => [dir, type as NodeType]),
);

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
    throw new Error(t('error.graph_not_found'));
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
  throw new Error(t('error.graph_not_found'));
}

function normalizeRelation(relation: string): string {
  return REVERSE_LABELS[relation] ?? relation;
}

function parseLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const link: Link = {
        target: String(item.target ?? ''),
        relation: normalizeRelation(String(item.relation ?? EDGE.relates_to)),
      };
      for (const attr of EDGE_ATTRIBUTE_NAMES) {
        const v = item[attr];
        if (v === undefined) continue;
        if (EDGE_ATTRIBUTE_TYPES[attr] === 'number') {
          // Numeric attrs (strength, completeness) — must be number
          if (typeof v === 'number') (link as unknown as Record<string, unknown>)[attr] = v;
        } else {
          // Enum attrs (severity, dependencyType, impact) — must be string
          if (typeof v === 'string') (link as unknown as Record<string, unknown>)[attr] = v;
        }
      }
      return link;
    });
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

  // Deprecated: artifacts → outputs (will be removed in 0.2.0)
  if (type === 'experiment' && meta.artifacts !== undefined) {
    if (meta.outputs === undefined) {
      meta.outputs = meta.artifacts;
    }
    delete meta.artifacts;
  }

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
 * Build a minimal Node for an invalid/unparseable file (FR-026).
 * Returns null if id or type cannot be derived from the file path.
 */
function buildInvalidNode(filePath: string, graphDir: string): Node | null {
  const basename = path.basename(filePath, '.md');
  const idMatch = basename.match(/^(\w+-\d+)/);
  if (!idMatch) return null;

  const id = idMatch[1];
  const prefix = id.split('-')[0];
  const type = PREFIX_TO_TYPE[prefix];
  if (!type) return null;

  // Verify parent directory matches expected type dir
  const relative = path.relative(graphDir, filePath);
  const parentDir = relative.split(/[\\/]/)[0];
  const dirType = DIR_TO_TYPE[parentDir];
  // Use dir-based type if available, otherwise fall back to prefix-based
  const resolvedType = dirType ?? type;

  let parseError = 'Failed to parse node frontmatter';
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      parseError = 'No frontmatter found';
    } else if (!parsed.data.type) {
      parseError = 'Missing required field: type';
    }
  } catch (e) {
    // Scrub the user's absolute workspace path from YAML error messages so it
    // never reaches the web UI (or an exported HTML bundle). js-yaml embeds
    // the file path in its error text verbatim, which would leak local
    // filesystem layout to anyone who sees the parse error.
    const raw = e instanceof Error ? e.message : String(e);
    const scrubbed = raw.split(graphDir).join('graph');
    parseError = `Parse error: ${scrubbed}`;
  }

  return {
    id,
    type: resolvedType,
    title: basename,
    path: filePath,
    status: undefined,
    tags: [],
    links: [],
    meta: { _invalid: true, _parseError: parseError },
  };
}

/**
 * Load all .md nodes from a graph directory (including subdirectories).
 * Excludes files/dirs starting with _.
 *
 * When `options.permissive` is true, invalid/unparseable files are included
 * as minimal nodes with `meta._invalid = true` instead of being silently skipped.
 */
export async function loadGraph(graphDir: string, options?: LoadGraphOptions): Promise<Graph> {
  const graph: Graph = {
    nodes: new Map(),
    errors: [],
    warnings: [],
  };

  const permissive = options?.permissive ?? false;

  // Find all .md files in the graph directory and subdirectories
  // Use forward slashes for glob patterns (backslashes are escape chars in glob v10+)
  const pattern = path.join(graphDir, '**/*.md').split(path.sep).join('/');
  const files = await glob(pattern, { nodir: true });

  for (const file of files.sort()) {
    // Skip files or directories starting with _
    const relative = path.relative(graphDir, file);
    const parts = relative.split(/[\\/]/);
    if (parts.some((p) => p.startsWith('_'))) continue;

    const node = await loadNode(file);
    if (node) {
      graph.nodes.set(node.id, node);
    } else if (permissive) {
      const invalidNode = buildInvalidNode(file, graphDir);
      if (invalidNode) {
        graph.nodes.set(invalidNode.id, invalidNode);
        graph.errors.push(`Invalid node file: ${relative}`);
      } else {
        graph.errors.push(`Unidentifiable file (skipped): ${relative}`);
      }
    }
  }

  return graph;
}
