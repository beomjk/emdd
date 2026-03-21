import { z } from 'zod';
import { analyzeRefutation } from '../../graph/operations.js';
import type { RefutationAnalysis } from '../../graph/refutation.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const analyzeRefutationDef: CommandDef<typeof schema, RefutationAnalysis> = {
  name: 'analyze-refutation',
  description: { en: 'Analyze refutation patterns in the graph', ko: '그래프의 반증 패턴 분석' },
  category: 'analysis',
  schema,

  async execute(input) {
    return analyzeRefutation(input.graphDir);
  },

  format(result, _locale) {
    const lines: string[] = [];

    if (result.affectedHypotheses.length === 0) {
      lines.push('No affected hypotheses.');
    } else {
      lines.push(`Affected hypotheses (${result.affectedHypotheses.length}):`);
      for (const h of result.affectedHypotheses) {
        lines.push(`  ${h.hypothesisId} [${h.severity}] via ${h.knowledgeId}: ${h.oldConfidence.toFixed(2)} -> ${h.newConfidence.toFixed(2)}`);
      }
    }

    if (result.pivotCeremonyTriggered) {
      lines.push(`Pivot ceremony triggered (${result.retractedKnowledgeIds.length} retracted: ${result.retractedKnowledgeIds.join(', ')})`);
    }

    return lines.join('\n');
  },
};
