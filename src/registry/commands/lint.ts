import { z } from 'zod';
import { loadGraph } from '../../graph/loader.js';
import { lintGraph } from '../../graph/operations.js';
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
    if (result.errors.length === 0) return 'No lint errors.';
    const lines = result.errors.map(e =>
      `[${e.severity.toUpperCase()}] ${e.nodeId}.${e.field}: ${e.message}`
    );
    lines.push('');
    lines.push(`${result.errorCount} error(s), ${result.warningCount} warning(s)`);
    return lines.join('\n');
  },
};
