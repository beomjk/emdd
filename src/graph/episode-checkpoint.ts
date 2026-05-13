// episode-checkpoint.ts — append-only progress note management for IN_PROGRESS episodes.
//
// See specs/010-ceremony-rhythm/data-model.md §E-6, contracts/cli-commands.md §C-1.

import fs from 'node:fs';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { loadGraph } from './loader.js';
import { t } from '../i18n/index.js';

export interface CheckpointEntry {
  timestamp: string;
  note: string;
}

export interface AppendOnlyViolation {
  timestamp: string;
  severity: 'soft' | 'justified';
  reason?: string;
  detected_by: 'checkpoint_diff' | 'manual_amend';
}

export interface CheckpointResult {
  episodeId: string;
  checkpointTimestamp: string;
  status: 'IN_PROGRESS';
  warnings: string[];
}

const CHECKPOINTS_HEADING = '## Checkpoints';

function extractCheckpointSection(body: string): { before: string; lines: string[]; after: string } | null {
  const headingIdx = body.indexOf(CHECKPOINTS_HEADING);
  if (headingIdx < 0) return null;
  const lineStart = body.indexOf('\n', headingIdx);
  if (lineStart < 0) {
    return { before: body.slice(0, headingIdx), lines: [], after: '' };
  }
  const rest = body.slice(lineStart + 1);
  const nextHeadingMatch = rest.match(/^## /m);
  const sectionEnd = nextHeadingMatch && typeof nextHeadingMatch.index === 'number'
    ? lineStart + 1 + nextHeadingMatch.index
    : body.length;
  const sectionBody = body.slice(lineStart + 1, sectionEnd);
  const lines = sectionBody.split('\n').filter(l => l.trim().length > 0);
  return {
    before: body.slice(0, headingIdx),
    lines,
    after: body.slice(sectionEnd),
  };
}

export async function checkpointEpisode(
  graphDir: string,
  episodeId: string,
  note: string,
): Promise<CheckpointResult> {
  const graph = await loadGraph(graphDir);
  const node = graph.nodes.get(episodeId);
  if (!node) {
    throw new Error(t('error.node_not_found', { id: episodeId }));
  }
  if (node.type !== 'episode') {
    throw new Error(`node ${episodeId} is not an episode (type: ${node.type})`);
  }
  if (node.status !== 'IN_PROGRESS') {
    throw new Error(`episode ${episodeId} is not IN_PROGRESS (current: ${node.status ?? 'unknown'}) — set status to IN_PROGRESS first`);
  }

  const filePath = node.path;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data: Record<string, unknown> = structuredClone(parsed.data);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // ── Append-only diff check: compare current body's Checkpoints section
  // against the frontmatter `checkpoints[]` (the previous source of truth).
  const warnings: string[] = [];
  const priorCheckpoints = Array.isArray(data.checkpoints)
    ? (data.checkpoints as CheckpointEntry[])
    : [];
  const section = extractCheckpointSection(parsed.content);
  const violations: AppendOnlyViolation[] = Array.isArray(data.append_only_violations)
    ? (data.append_only_violations as AppendOnlyViolation[])
    : [];
  if (section && priorCheckpoints.length > 0) {
    // Expect first N body lines to start with the prior checkpoint timestamps in order.
    let driftDetected = false;
    for (let i = 0; i < priorCheckpoints.length; i++) {
      const expectedTs = priorCheckpoints[i].timestamp;
      const bodyLine = section.lines[i];
      if (!bodyLine || !bodyLine.includes(expectedTs)) {
        driftDetected = true;
        break;
      }
    }
    if (driftDetected) {
      violations.push({
        timestamp: now,
        severity: 'soft',
        detected_by: 'checkpoint_diff',
      });
      warnings.push(`append-only drift detected for ${episodeId}; recorded as soft violation`);
    }
  }

  // ── Append checkpoint to body (## Checkpoints section)
  const newLine = `- ${now} — ${note}`;
  let newBody: string;
  if (section) {
    const newLines = [...section.lines, newLine].join('\n');
    newBody = `${section.before}${CHECKPOINTS_HEADING}\n${newLines}${section.after.length > 0 ? `\n${section.after.replace(/^\n+/, '')}` : '\n'}`;
  } else {
    const prefix = parsed.content.endsWith('\n') ? parsed.content : parsed.content + '\n';
    newBody = `${prefix}\n${CHECKPOINTS_HEADING}\n${newLine}\n`;
  }

  // ── Update frontmatter
  const newCheckpoints: CheckpointEntry[] = [...priorCheckpoints, { timestamp: now, note }];
  data.checkpoints = newCheckpoints;
  data.updated = today;
  if (violations.length > 0) {
    data.append_only_violations = violations;
  }

  const yamlDump = yaml.dump(data, { lineWidth: -1, sortKeys: false });
  const out = `---\n${yamlDump}---\n${newBody}`;
  fs.writeFileSync(filePath, out, 'utf-8');

  return {
    episodeId,
    checkpointTimestamp: now,
    status: 'IN_PROGRESS',
    warnings,
  };
}
