// episode-close.ts — IN_PROGRESS → COMPLETED transition for episodes.
//
// See contracts/cli-commands.md §C-2.

import fs from 'node:fs';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { loadGraph } from './loader.js';
import { t } from '../i18n/index.js';

export interface EpisodeCloseResult {
  episodeId: string;
  fromStatus: string;
  toStatus: 'COMPLETED';
}

export async function closeEpisode(
  graphDir: string,
  episodeId: string,
): Promise<EpisodeCloseResult> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);
  if (!node) {
    throw new Error(t('error.node_not_found', { id: episodeId }));
  }
  if (node.type !== 'episode') {
    throw new Error(`node ${episodeId} is not an episode (type: ${node.type})`);
  }
  if (node.status === 'COMPLETED') {
    throw new Error(`episode ${episodeId} is already COMPLETED`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data: Record<string, unknown> = structuredClone(parsed.data);

  const fromStatus = String(data.status ?? 'unknown');
  data.status = 'COMPLETED';
  data.updated = new Date().toISOString().slice(0, 10);

  const yamlDump = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  const out = `---\n${yamlDump}---\n${parsed.content}`;
  fs.writeFileSync(filePath, out, 'utf-8');

  return { episodeId, fromStatus, toStatus: 'COMPLETED' };
}
