import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from '../graph/loader.js';

/**
 * Update frontmatter fields on a node.
 *
 * Automatically sets `updated` to today's date.
 * Parses numeric strings for `confidence`.
 */
export async function updateCommand(
  graphDir: string,
  nodeId: string,
  updates: Record<string, string>,
): Promise<void> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);

  // Apply updates
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'confidence') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 1) {
        throw new Error(`Invalid confidence value: "${value}" (must be 0-1)`);
      }
      parsed.data[key] = num;
    } else {
      parsed.data[key] = value;
    }
  }

  // Auto-update the `updated` field
  parsed.data.updated = new Date().toISOString().slice(0, 10);

  // Write back
  const output = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, output);
}
