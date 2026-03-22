import { z } from 'zod';
import { getHealth } from '../../graph/operations.js';
import { NODE_TYPES } from '../../graph/types.js';
import type { HealthReport } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const healthDef: CommandDef<typeof schema, HealthReport> = {
  name: 'health',
  description: 'Show health dashboard',
  category: 'analysis',
  schema,
  async execute(input) {
    return getHealth(input.graphDir);
  },

  format(report) {
    const lines: string[] = [];
    const avgConf = report.avgConfidence !== null ? report.avgConfidence.toFixed(2) : 'N/A';

    lines.push('');
    lines.push(`=== ${t('health.title')} ===`);
    lines.push('');
    lines.push(`${t('health.total_nodes')}: ${report.totalNodes}`);
    lines.push('');
    lines.push(`${t('health.by_type')}:`);
    for (const nodeType of NODE_TYPES) {
      const count = report.byType[nodeType] ?? 0;
      if (count > 0) lines.push(`  ${nodeType}: ${count}`);
    }

    const hypStatus = report.statusDistribution['hypothesis'];
    if (hypStatus && Object.keys(hypStatus).length > 0) {
      lines.push('');
      lines.push(`${t('health.hypothesis_status')}:`);
      for (const [status, count] of Object.entries(hypStatus).sort()) {
        lines.push(`  ${status}: ${count}`);
      }
    }

    lines.push('');
    lines.push(`${t('health.avg_confidence')}: ${avgConf}`);
    lines.push(`${t('health.open_questions')}: ${report.openQuestions}`);
    lines.push(`${t('health.link_density')}: ${report.linkDensity.toFixed(2)}`);
    lines.push('');

    if (report.gapDetails.length > 0) {
      lines.push(`=== ${t('health.gap_details')} ===`);
      lines.push('');
      for (const gap of report.gapDetails) {
        const trigger = gap.triggerType ? ` [${gap.triggerType}]` : '';
        lines.push(`  [${gap.type}]${trigger} ${gap.message}`);
        lines.push(`    ${t('health.nodes')}: ${gap.nodeIds.join(', ')}`);
      }
      lines.push('');
    }

    if (report.affinityViolations.length > 0) {
      lines.push(`${t('health.affinity_violations')}:`);
      for (const v of report.affinityViolations) lines.push(`  ${v}`);
      lines.push('');
    }

    if (report.deferredItems.length > 0) {
      lines.push(`${t('health.deferred_items')}:`);
      for (const d of report.deferredItems) lines.push(`  ${d}`);
      lines.push('');
    }

    return lines.join('\n');
  },
};
