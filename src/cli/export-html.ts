import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { resolveGraphDir } from '../graph/loader.js';
import { createGraphCache } from '../web/cache.js';
import { generateExportHtml } from '../web/export.js';
import type { LayoutMode } from '../web/types.js';

interface ExportHtmlOptions {
  layout: string;
  types?: string;
  statuses?: string;
}

export async function exportHtmlCommand(
  outputArg: string | undefined,
  options: ExportHtmlOptions,
): Promise<void> {
  const graphDir = resolveGraphDir(undefined);
  const cache = createGraphCache(graphDir);
  const graph = await cache.load();
  const clusters = await cache.getClusters();

  const layout = (options.layout === 'hierarchical' ? 'hierarchical' : 'force') as LayoutMode;
  const types = options.types ? options.types.split(',').filter(Boolean) : undefined;
  const statuses = options.statuses ? options.statuses.split(',').filter(Boolean) : undefined;

  const { html, nodeCount, edgeCount } = generateExportHtml(graph, {
    layout,
    types,
    statuses,
    theme: undefined,
    clusters,
  });

  const outputPath = path.resolve(outputArg ?? 'graph-dashboard.html');
  fs.writeFileSync(outputPath, html, 'utf-8');

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(0);
  console.log(chalk.green(`✅ Exported dashboard to ${outputPath} (${sizeKb}KB)`));
  console.log(chalk.gray(`   ${nodeCount} nodes, ${edgeCount} edges included`));
}
