import { z } from 'zod';
import { traceImpact } from '../../graph/operations.js';
import type { ImpactReport } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

/** Compute visible width accounting for CJK double-width characters. */
function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    // CJK Unified Ideographs, Hangul Syllables, common fullwidth ranges
    w += (cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0x303E) ||
         (cp >= 0x3040 && cp <= 0x9FFF) || (cp >= 0xAC00 && cp <= 0xD7AF) ||
         (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE30 && cp <= 0xFE6F) ||
         (cp >= 0xFF01 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6) ||
         (cp >= 0x20000 && cp <= 0x2FFFF) ? 2 : 1;
  }
  return w;
}

/** padEnd that respects CJK double-width characters. */
function padCJK(str: string, width: number): string {
  const diff = width - displayWidth(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

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
    lines.push(` ${padCJK(t('impact.col.node'), 10)} ${padCJK(t('impact.col.type'), 12)} ${padCJK(t('impact.col.status'), 12)} ${padCJK(t('impact.col.score'), 7)} ${padCJK(t('impact.col.best'), 7)} ${padCJK(t('impact.col.hops'), 5)} ${t('impact.col.auto_transition')}`);
    lines.push(` ${'─'.repeat(10)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(5)} ${'─'.repeat(15)}`);

    for (const node of report.impactedNodes) {
      const auto = node.autoTransition
        ? `${node.autoTransition.from} → ${node.autoTransition.to}`
        : '—';
      const hops = node.depth === -1 ? 'N/A' : String(node.depth);
      lines.push(` ${padCJK(node.nodeId, 10)} ${padCJK(node.nodeType, 12)} ${padCJK(node.currentStatus, 12)} ${node.aggregateScore.toFixed(2).padEnd(7)} ${node.bestPathScore.toFixed(2).padEnd(7)} ${hops.padEnd(5)} ${auto}`);
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
};
