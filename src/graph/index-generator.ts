import type { Graph, Node, NodeType } from './types.js';
import { NODE_DISPLAY_ORDER, NODE_TYPE_DIRS } from './types.js';

// Derive section order from NODE_TYPES (schema-defined order)
const SECTION_ORDER: NodeType[] = NODE_DISPLAY_ORDER;

// Derive section titles from NODE_TYPE_DIRS (title-cased directory names)
function titleCaseDir(dir: string): string {
  return dir.charAt(0).toUpperCase() + dir.slice(1);
}

const SECTION_TITLES: Record<NodeType, string> = Object.fromEntries(
  NODE_DISPLAY_ORDER.map((t) => [t, titleCaseDir(NODE_TYPE_DIRS[t])]),
) as Record<NodeType, string>;

export function generateIndex(graph: Graph): string {
  const lines: string[] = [];
  const totalNodes = graph.nodes.size;
  const today = new Date().toISOString().slice(0, 10);

  // Frontmatter
  lines.push('---');
  lines.push(`generated: ${today}`);
  lines.push(`node_count: ${totalNodes}`);
  lines.push('---');
  lines.push('');
  lines.push('# EMDD Graph Index');
  lines.push('');
  lines.push(`Total nodes: ${totalNodes}`);
  lines.push('');

  // Group nodes by type
  const byType = new Map<NodeType, Node[]>();
  for (const node of graph.nodes.values()) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }

  // Sections
  for (const ntype of SECTION_ORDER) {
    const nodes = byType.get(ntype);
    if (!nodes || nodes.length === 0) continue;

    lines.push(`## ${SECTION_TITLES[ntype]}`);
    lines.push('');
    lines.push('| ID | Title | Status | Updated |');
    lines.push('|----|-------|--------|---------|');

    for (const n of nodes.sort((a, b) => a.id.localeCompare(b.id))) {
      const status = n.status ?? '?';
      const updated = (n.meta?.updated as string) ?? '?';
      lines.push(`| ${n.id} | ${n.title} | ${status} | ${updated} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
