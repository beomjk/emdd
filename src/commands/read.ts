import chalk from 'chalk';
import { readNode } from '../graph/operations.js';

export async function readCommand(
  graphDir: string,
  nodeId: string,
): Promise<void> {
  const detail = await readNode(graphDir, nodeId);

  if (!detail) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  console.log(chalk.bold(`[${detail.id}] ${detail.title}`));
  console.log(`  type: ${detail.type}`);
  if (detail.status) console.log(`  status: ${detail.status}`);
  if (detail.confidence != null) console.log(`  confidence: ${detail.confidence}`);
  if (detail.tags.length > 0) console.log(`  tags: ${detail.tags.join(', ')}`);

  if (detail.links.length > 0) {
    console.log('  links:');
    for (const link of detail.links) {
      console.log(`    → ${link.target} (${link.relation})`);
    }
  }

  for (const [key, val] of Object.entries(detail.meta)) {
    console.log(`  ${key}: ${String(val)}`);
  }

  if (detail.body.trim()) {
    console.log('');
    console.log(detail.body.trim());
  }
}
