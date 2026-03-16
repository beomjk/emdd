import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import matter from 'gray-matter';

export interface BacklogItem {
  text: string;
  episodeId: string;
}

export interface BacklogResult {
  items: BacklogItem[];
}

export async function backlogCommand(graphDir: string, _statusFilter?: string): Promise<BacklogResult> {
  const episodeDir = join(graphDir, 'episodes');
  const pattern = join(episodeDir, '*.md');
  const files = await glob(pattern, { nodir: true });
  const items: BacklogItem[] = [];

  for (const file of files.sort()) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(content);
    } catch {
      continue;
    }

    const episodeId = parsed.data?.id ?? '';
    const body = parsed.content;

    for (const line of body.split('\n')) {
      const unchecked = line.match(/^- \[ \]\s+(.+)/);
      if (unchecked) {
        items.push({ text: unchecked[1].trim(), episodeId });
      }
    }
  }

  return { items };
}
