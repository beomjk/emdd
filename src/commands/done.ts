import fs from 'node:fs';
import { loadGraph } from '../graph/loader.js';

export type DoneMarker = 'done' | 'deferred' | 'superseded';

const VALID_MARKERS: DoneMarker[] = ['done', 'deferred', 'superseded'];
const COMPLETED_MARKERS = ['x', 'X', 'done', 'deferred', 'superseded'];

/**
 * Mark a checklist item in an episode node with a marker.
 *
 * Finds `- [ ] {item}` in the body and replaces with `- [{marker}] {item}`.
 * Throws if the item is not found or already marked.
 */
export async function doneCommand(
  graphDir: string,
  episodeId: string,
  item: string,
  marker: DoneMarker = 'done',
): Promise<void> {
  if (!VALID_MARKERS.includes(marker)) {
    throw new Error(`Invalid marker: ${marker}. Valid markers: ${VALID_MARKERS.join(', ')}`);
  }

  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);

  if (!node) {
    throw new Error(`Node not found: ${episodeId}`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');

  const lines = raw.split('\n');
  const uncheckedMatches: number[] = [];
  const alreadyMarked: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(item)) {
      if (lines[i].includes('- [ ]')) {
        uncheckedMatches.push(i);
      } else {
        // Check if already marked with any completed marker
        for (const m of COMPLETED_MARKERS) {
          if (lines[i].includes(`- [${m}]`)) {
            alreadyMarked.push(i);
            break;
          }
        }
      }
    }
  }

  if (uncheckedMatches.length === 0) {
    if (alreadyMarked.length > 0) {
      throw new Error(`Item already marked in ${episodeId}: ${item}`);
    }
    throw new Error(`Item not found in ${episodeId}: ${item}`);
  }

  if (uncheckedMatches.length > 1) {
    throw new Error(`Multiple matches for '${item}' in ${episodeId}`);
  }

  // Replace the matched line
  lines[uncheckedMatches[0]] = lines[uncheckedMatches[0]].replace('- [ ]', `- [${marker}]`);

  fs.writeFileSync(filePath, lines.join('\n'));
}
