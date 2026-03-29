import { z } from 'zod';
import { traceImpact } from '../../graph/operations.js';
import type { ImpactReport } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({
  nodeId: z.string().describe('Seed node ID for impact analysis'),
  whatIf: z.string().optional().describe('Hypothetical status for what-if simulation'),
});

export const impactDef: CommandDef<typeof schema, ImpactReport> = {
  name: 'impact',
  description: 'Analyze cascade impact from a node state change',
  category: 'analysis',
  schema,
  cli: { positional: ['nodeId'] },
  mcp: { toolName: 'impact-analysis' },

  async execute(input) {
    return traceImpact(input.graphDir, input.nodeId, {
      whatIf: input.whatIf,
    });
  },

  format(report) {
    const lines: string[] = [];

    // Title
    if (report.seed.whatIfStatus) {
      lines.push(t('impact.title_whatif', {
        nodeId: report.seed.nodeId,
        currentStatus: report.seed.currentStatus,
        whatIfStatus: report.seed.whatIfStatus,
      }));
    } else {
      lines.push(t('impact.title', {
        nodeId: report.seed.nodeId,
        currentStatus: report.seed.currentStatus,
      }));
    }
    lines.push('');

    if (report.impactedNodes.length === 0) {
      lines.push(t('impact.no_affected'));
      return lines.join('\n');
    }

    // Table header
    lines.push(` ${'Node'.padEnd(10)} ${'Type'.padEnd(12)} ${'Status'.padEnd(12)} ${'Score'.padEnd(7)} ${'Best'.padEnd(7)} ${'Hops'.padEnd(5)} Auto-Transition`);
    lines.push(` ${'─'.repeat(10)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(5)} ${'─'.repeat(15)}`);

    for (const node of report.impactedNodes) {
      const auto = node.autoTransition
        ? `${node.autoTransition.from} → ${node.autoTransition.to}`
        : '—';
      lines.push(` ${node.nodeId.padEnd(10)} ${node.nodeType.padEnd(12)} ${node.currentStatus.padEnd(12)} ${node.aggregateScore.toFixed(2).padEnd(7)} ${node.bestPathScore.toFixed(2).padEnd(7)} ${String(node.depth).padEnd(5)} ${auto}`);
    }

    lines.push('');
    lines.push(t('impact.summary', {
      total: String(report.summary.totalAffected),
      max: report.summary.maxScore.toFixed(2),
      avg: report.summary.avgScore.toFixed(2),
    }));

    // Cascade info for what-if mode
    if (report.cascadeTrace) {
      const autoCount = report.cascadeTrace.steps.length;
      const unresolvedCount = report.cascadeTrace.unresolved.length;
      lines.push(t('impact.cascade', {
        autoTransitions: String(autoCount),
        unresolved: String(unresolvedCount),
      }));
    }

    return lines.join('\n');
  },

  shouldFail(report) {
    return false;
  },
};
