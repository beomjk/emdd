import { resolveGraphDir, loadGraph } from '../graph/loader.js';
import { lintGraph } from '../graph/validator.js';
import { t } from '../i18n/index.js';

export async function lintCommand(targetPath: string | undefined): Promise<void> {
  const graphDir = resolveGraphDir(targetPath);
  const graph = await loadGraph(graphDir);
  const errors = lintGraph(graph);

  const realErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  if (realErrors.length === 0 && warnings.length === 0) {
    console.log(t('lint.clean'));
    return;
  }

  for (const err of realErrors) {
    console.log(`ERROR  ${err.nodeId}  ${err.field}  ${err.message}`);
  }
  for (const warn of warnings) {
    console.log(`WARN   ${warn.nodeId}  ${warn.field}  ${warn.message}`);
  }

  if (realErrors.length > 0) {
    console.log(t('lint.errors_found', { count: String(realErrors.length) }));
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.log(t('lint.warnings_found', { count: String(warnings.length) }));
  }
}
