import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';

export interface BacklogItem {
  text: string;
  episodeId: string;
  checked: boolean;
}

export interface BacklogResult {
  items: BacklogItem[];
}

export async function backlogCommand(graphDir: string, statusFilter?: string): Promise<BacklogResult> {
  const episodeDir = join(graphDir, 'episodes');
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

    // Skip non-DEFERRED episodes when filtering by deferred
    if (statusFilter === 'deferred' && episodeStatus !== 'DEFERRED') {
      continue;
    }

    for (const line of body.split('\n')) {
      const unchecked = line.match(/^- \[ \]\s+(.+)/);
      const checked = line.match(/^- \[x\]\s+(.+)/i);

      if (unchecked) {
        items.push({ text: unchecked[1].trim(), episodeId, checked: false });
      } else if (checked) {
        items.push({ text: checked[1].trim(), episodeId, checked: true });
      }
    }
  }

  // Apply status filter
  if (!statusFilter || statusFilter === 'pending') {
    return { items: items.filter(i => !i.checked) };
  } else if (statusFilter === 'all') {
    return { items };
  } else if (statusFilter === 'deferred') {
    return { items: items.filter(i => !i.checked) };
  }

  // Default: unchecked only
  return { items: items.filter(i => !i.checked) };
}
