import { z } from 'zod';
import { getHealth } from '../../graph/operations.js';
import type { GapDetail } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

interface GapsResult {
  gaps: string[];
  gapDetails: GapDetail[];
}

export const gapsDef: CommandDef<typeof schema, GapsResult> = {
  name: 'gaps',
  description: { en: 'Show structural gaps in the graph', ko: '그래프 구조적 갭 표시' },
  category: 'analysis',
  schema,
  mcp: { toolName: 'graph_gaps' },

  async execute(input) {
    const report = await getHealth(input.graphDir);
    return { gaps: report.gaps, gapDetails: report.gapDetails };
  },

  format(result, _locale) {
    if (result.gapDetails.length === 0 && result.gaps.length === 0) return 'No gaps found.';
    const lines: string[] = [];
    for (const gap of result.gaps) lines.push(`- ${gap}`);
    for (const detail of result.gapDetails) {
      lines.push(`[${detail.type}] ${detail.message}`);
      lines.push(`  Nodes: ${detail.nodeIds.join(', ')}`);
    }
    return lines.join('\n');
  },
};
