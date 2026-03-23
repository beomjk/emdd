import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { NODE_TYPE_DIRS } from './types.js';

export type ItemMarker = 'pending' | 'done' | 'deferred' | 'superseded';

export interface BacklogItem {
  text: string;
  episodeId: string;
  marker: ItemMarker;
}

export interface BacklogResult {
  items: BacklogItem[];
}

const CHECKLIST_RE = /^- \[([ xX]|done|deferred|superseded)\]\s+(.+)/;

function parseMarker(raw: string): ItemMarker {
  if (raw === ' ') return 'pending';
  if (raw === 'x' || raw === 'X' || raw === 'done') return 'done';
  if (raw === 'deferred') return 'deferred';
  if (raw === 'superseded') return 'superseded';
  return 'pending';
}

export async function getBacklog(graphDir: string, statusFilter?: string): Promise<BacklogResult> {
  const episodeDir = join(graphDir, NODE_TYPE_DIRS.episode);
  const pattern = join(episodeDir, '*.md');
  const files = await glob(pattern, { nodir: true });
  const items: BacklogItem[] = [];

  for (const file of files.sort()) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch (err) {
      console.warn(`Warning: Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(content);
    } catch (err) {
      console.warn(`Warning: Could not parse ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const episodeId = parsed.data?.id ?? '';
    const episodeStatus = parsed.data?.status ?? '';
    const body = parsed.content;

    for (const line of body.split('\n')) {
      const match = line.match(CHECKLIST_RE);
      if (match) {
        const marker = parseMarker(match[1]);
        items.push({ text: match[2].trim(), episodeId, marker });
      }
    }
  }

  // Apply status filter
  if (!statusFilter || statusFilter === 'pending') {
    return { items: items.filter(i => i.marker === 'pending') };
  } else if (statusFilter === 'all') {
    return { items };
  } else if (statusFilter === 'done') {
    return { items: items.filter(i => i.marker === 'done') };
  } else if (statusFilter === 'deferred') {
    return { items: items.filter(i => i.marker === 'deferred') };
  } else if (statusFilter === 'superseded') {
    return { items: items.filter(i => i.marker === 'superseded') };
  }

  // Default: unchecked only
  return { items: items.filter(i => i.marker === 'pending') };
}
