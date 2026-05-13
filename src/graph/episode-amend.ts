// episode-amend.ts — record a justified append-only violation on an episode.
//
// See specs/010-ceremony-rhythm/data-model.md §E-7, contracts/cli-commands.md §C-3.

import fs from 'node:fs';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { loadGraph } from './loader.js';
import { t } from '../i18n/index.js';
import type { AppendOnlyViolation } from './episode-checkpoint.js';

export interface AmendResult {
  episodeId: string;
  violationIndex: number;
  severity: 'justified';
}

export async function amendEpisode(
  graphDir: string,
  episodeId: string,
  reason: string,
): Promise<AmendResult> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);
  if (!node) {
    throw new Error(t('error.node_not_found', { id: episodeId }));
  }
  if (node.type !== 'episode') {
    throw new Error(`node ${episodeId} is not an episode (type: ${node.type})`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data: Record<string, unknown> = structuredClone(parsed.data);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const violations: AppendOnlyViolation[] = Array.isArray(data.append_only_violations)
    ? (data.append_only_violations as AppendOnlyViolation[])
    : [];
  violations.push({
    timestamp: now,
    severity: 'justified',
    reason,
    detected_by: 'manual_amend',
  });

  data.append_only_violations = violations;
  data.updated = today;

  const yamlDump = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  const out = `---\n${yamlDump}---\n${parsed.content}`;
  fs.writeFileSync(filePath, out, 'utf-8');

  return {
    episodeId,
    violationIndex: violations.length - 1,
    severity: 'justified',
  };
}
