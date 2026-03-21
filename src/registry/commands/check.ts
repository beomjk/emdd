import { z } from 'zod';
import { checkConsolidation } from '../../graph/operations.js';
import type { CheckResult } from '../../graph/types.js';
import { t } from '../../i18n/index.js';
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
      lines.push(t('check.no_triggers'));
    } else {
      lines.push(`${t('check.title')}:`);
      for (const trigger of result.triggers) lines.push(`  [${trigger.type}] ${trigger.message}`);
    }
    if (result.promotionCandidates.length > 0) {
      lines.push('');
      lines.push(`${t('promote.title')}:`);
      for (const c of result.promotionCandidates) lines.push(`  ${c.id} (confidence: ${c.confidence})`);
    }
    return lines.join('\n');
  },
};
