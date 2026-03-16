import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from '../graph/loader.js';
import { ALL_VALID_RELATIONS, REVERSE_LABELS } from '../graph/types.js';

/**
 * Add a link from source node to target node with the given relation.
 *
 * Validates relation against ALL_VALID_RELATIONS.
 * Normalizes reverse labels to canonical form.
 */
export async function linkCommand(
  graphDir: string,
  source: string,
  target: string,
  relation: string,
): Promise<void> {
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
    throw new Error(`Node not found: ${source}`);
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
}
