import type { Graph, Node } from './types.js';

const TITLE_MAX_LEN = 40;

function truncateTitle(title: string): string {
  if (title.length <= TITLE_MAX_LEN) return title;
  return title.slice(0, TITLE_MAX_LEN) + '...';
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'fill:#90EE90',
  REFUTED: 'fill:#FFB6C1',
  DEPRECATED: 'fill:#D3D3D3',
};

export function generateMermaid(graph: Graph): string {
  const lines: string[] = ['graph TD'];

  // Node definitions
  for (const [id, node] of graph.nodes) {
    const label = `${id}: ${truncateTitle(node.title)}`;
    lines.push(`  ${id}["${label}"]`);
  }

  // Edges
  for (const [id, node] of graph.nodes) {
    for (const link of node.links) {
      if (!graph.nodes.has(link.target)) continue;
      lines.push(`  ${id} -->|${link.relation}| ${link.target}`);
    }
  }

  // Styles for special statuses
  for (const [id, node] of graph.nodes) {
    const style = node.status ? STATUS_STYLES[node.status] : undefined;
    if (style) {
      lines.push(`  style ${id} ${style}`);
    }
  }

  return lines.join('\n');
}
