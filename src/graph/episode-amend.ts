// episode-amend.ts — record a justified append-only violation on an episode.
//
// See specs/010-ceremony-rhythm/data-model.md §E-7, contracts/cli-commands.md §C-3.

import fs from 'node:fs';
import matter from 'gray-matter';
import { loadGraph } from './loader.js';
import { normalizeDateFields } from './date-utils.js';
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

  normalizeDateFields(data);
  const out = matter.stringify(parsed.content, data);
  fs.writeFileSync(filePath, out, 'utf-8');

  return {
    episodeId,
    violationIndex: violations.length - 1,
    severity: 'justified',
  };
}
