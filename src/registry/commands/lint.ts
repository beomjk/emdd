import { z } from 'zod';
import { loadGraph } from '../../graph/loader.js';
import { lintGraph } from '../../graph/operations.js';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

interface LintResult {
  errors: Array<{ nodeId: string; field: string; message: string; severity: string }>;
  errorCount: number;
  warningCount: number;
}

export const lintDef: CommandDef<typeof schema, LintResult> = {
  name: 'lint',
  description: { en: 'Lint the graph for schema errors', ko: '그래프 스키마 오류 검사' },
  category: 'analysis',
  schema,

  shouldFail: (r) => r.errorCount > 0,

  async execute(input) {
    const graph = await loadGraph(input.graphDir);
    const errors = lintGraph(graph);
    return {
      errors,
      errorCount: errors.filter(e => e.severity === 'error').length,
      warningCount: errors.filter(e => e.severity === 'warning').length,
    };
  },

  format(result, _locale) {
    if (result.errors.length === 0) return t('lint.clean');
    const lines = result.errors.map(e =>
      `[${e.severity.toUpperCase()}] ${e.nodeId}.${e.field}: ${e.message}`
    );
    lines.push('');
    lines.push(t('format.lint_summary', { errors: String(result.errorCount), warnings: String(result.warningCount) }));
    return lines.join('\n');
  },
};
