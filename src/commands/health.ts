import { resolveGraphDir } from '../graph/loader.js';
import { getHealth } from '../graph/operations.js';
import { NODE_TYPES } from '../graph/types.js';
import { t } from '../i18n/index.js';

export interface HealthOptions {
  all?: boolean;
}

export async function healthCommand(targetPath: string | undefined, options?: HealthOptions): Promise<void> {
  const graphDir = resolveGraphDir(targetPath);
  const report = await getHealth(graphDir);

  const avgConf = report.avgConfidence !== null ? report.avgConfidence.toFixed(2) : 'N/A';
  const linkDensity = report.linkDensity.toFixed(2);

  // Output
  console.log('');
  console.log(`=== ${t('health.title')} ===`);
  console.log('');
  console.log(`${t('health.total_nodes')}: ${report.totalNodes}`);
  console.log('');
  console.log(`${t('health.by_type')}:`);
  for (const nodeType of NODE_TYPES) {
    const count = report.byType[nodeType] ?? 0;
    if (count > 0) {
      console.log(`  ${nodeType}: ${count}`);
    }
  }

  const hypStatus = report.statusDistribution['hypothesis'];
  if (hypStatus && Object.keys(hypStatus).length > 0) {
    console.log('');
    console.log(`${t('health.hypothesis_status')}:`);
    for (const [status, count] of Object.entries(hypStatus).sort()) {
      console.log(`  ${status}: ${count}`);
    }
  }

  console.log('');
  console.log(`${t('health.avg_confidence')}: ${avgConf}`);
  console.log(`${t('health.open_questions')}: ${report.openQuestions}`);
  console.log(`${t('health.link_density')}: ${linkDensity}`);
  console.log('');

  // --all: show gap details
  if (options?.all && report.gapDetails.length > 0) {
    console.log('=== Gap Details ===');
    console.log('');
    for (const gap of report.gapDetails) {
      const trigger = gap.triggerType ? ` [${gap.triggerType}]` : '';
      console.log(`  [${gap.type}]${trigger} ${gap.message}`);
      console.log(`    Nodes: ${gap.nodeIds.join(', ')}`);
    }
    console.log('');
  }
}
