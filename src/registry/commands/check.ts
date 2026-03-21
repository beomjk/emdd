import { z } from 'zod';
import { checkConsolidation } from '../../graph/operations.js';
import type { CheckResult } from '../../graph/types.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

export const checkDef: CommandDef<typeof schema, CheckResult> = {
  name: 'check',
  description: { en: 'Check consolidation readiness', ko: '통합 준비 상태 확인' },
  category: 'analysis',
  schema,

  async execute(input) {
    return checkConsolidation(input.graphDir);
  },

  format(result, _locale) {
    const lines: string[] = [];
    if (result.triggers.length === 0) {
      lines.push('No consolidation triggers active.');
    } else {
      lines.push('Consolidation triggers:');
      for (const t of result.triggers) lines.push(`  [${t.type}] ${t.message}`);
    }
    if (result.promotionCandidates.length > 0) {
      lines.push('');
      lines.push('Promotion candidates:');
      for (const c of result.promotionCandidates) lines.push(`  ${c.id} (confidence: ${c.confidence})`);
    }
    return lines.join('\n');
  },
};
