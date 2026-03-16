import fs from 'node:fs';
import { loadGraph } from '../graph/loader.js';

/**
 * Mark a checklist item as done in an episode node.
 *
 * Finds `- [ ] {item}` in the body and replaces with `- [x] {item}`.
 * Throws if the item is not found.
 */
export async function doneCommand(
  graphDir: string,
  episodeId: string,
  item: string,
): Promise<void> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);

  if (!node) {
    throw new Error(`Node not found: ${episodeId}`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Find lines matching the unchecked item
  const lines = raw.split('\n');
  const matches: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('- [ ]') && lines[i].includes(item)) {
      matches.push(i);
    }
  }

  if (matches.length === 0) {
    throw new Error(`Item not found in ${episodeId}: ${item}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple matches for '${item}' in ${episodeId}`);
  }

  // Replace the matched line
  lines[matches[0]] = lines[matches[0]].replace('- [ ]', '- [x]');

  fs.writeFileSync(filePath, lines.join('\n'));
}
