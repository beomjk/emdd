import { resolveGraphDir, loadGraph } from '../graph/loader.js';
import { NODE_TYPES } from '../graph/types.js';
import type { NodeType, Node } from '../graph/types.js';
import { t } from '../i18n/index.js';

export async function healthCommand(targetPath: string | undefined): Promise<void> {
  const graphDir = resolveGraphDir(targetPath);
  const graph = await loadGraph(graphDir);

  // Count nodes by type
  const byType: Record<string, Node[]> = {};
  for (const nodeType of NODE_TYPES) {
    byType[nodeType] = [];
  }
  for (const node of graph.nodes.values()) {
    if (byType[node.type]) {
      byType[node.type].push(node);
    }
  }

  const total = graph.nodes.size;

  // Hypothesis status distribution
  const hypStatus: Record<string, number> = {};
  for (const h of byType['hypothesis']) {
    const s = h.status ?? 'unknown';
    hypStatus[s] = (hypStatus[s] ?? 0) + 1;
  }

  // Average confidence (across all nodes that have it)
  let confSum = 0;
  let confCount = 0;
  for (const node of graph.nodes.values()) {
    if (node.confidence !== undefined) {
      confSum += node.confidence;
      confCount++;
    }
  }
  const avgConf = confCount > 0 ? (confSum / confCount).toFixed(2) : 'N/A';

  // Open questions
  const openQuestions = byType['question'].filter(q => q.status === 'OPEN');

  // Link density
  let totalLinks = 0;
  for (const node of graph.nodes.values()) {
    totalLinks += node.links.length;
  }
  const linkDensity = total > 0 ? (totalLinks / total).toFixed(2) : '0';

  // Output
  console.log('');
  console.log(`=== ${t('health.title')} ===`);
  console.log('');
  console.log(`${t('health.total_nodes')}: ${total}`);
  console.log('');
  console.log(`${t('health.by_type')}:`);
  for (const nodeType of NODE_TYPES) {
    const count = byType[nodeType].length;
    if (count > 0) {
      console.log(`  ${nodeType}: ${count}`);
    }
  }

  if (Object.keys(hypStatus).length > 0) {
    console.log('');
    console.log(`${t('health.hypothesis_status')}:`);
    for (const [status, count] of Object.entries(hypStatus).sort()) {
      console.log(`  ${status}: ${count}`);
    }
  }

  console.log('');
  console.log(`${t('health.avg_confidence')}: ${avgConf}`);
  console.log(`${t('health.open_questions')}: ${openQuestions.length}`);
  console.log(`${t('health.link_density')}: ${linkDensity}`);
  console.log('');
}
