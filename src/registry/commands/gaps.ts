import { z } from 'zod';
import { getHealth } from '../../graph/operations.js';
import type { GapDetail } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

interface GapsResult {
  gaps: string[];
  gapDetails: GapDetail[];
}

export const gapsDef: CommandDef<typeof schema, GapsResult> = {
  name: 'gaps',
  description: 'Show structural gaps in the graph',
  category: 'analysis',
  schema,
  mcp: { toolName: 'graph_gaps' },

  async execute(input) {
    const report = await getHealth(input.graphDir);
    return { gaps: report.gaps, gapDetails: report.gapDetails };
  },

  format(result) {
    if (result.gapDetails.length === 0 && result.gaps.length === 0) return t('format.no_gaps');
    const lines: string[] = [];
    for (const gap of result.gaps) lines.push(`- ${gap}`);
    for (const detail of result.gapDetails) {
      lines.push(`[${detail.type}] ${detail.message}`);
      lines.push(`  ${t('health.nodes')}: ${detail.nodeIds.join(', ')}`);
    }
    return lines.join('\n');
  },
};
