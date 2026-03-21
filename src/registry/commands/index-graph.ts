import { z } from 'zod';
import { generateIndex } from '../../graph/operations.js';
import { loadGraph } from '../../graph/loader.js';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { t } from '../../i18n/index.js';
import type { CommandDef } from '../types.js';

const schema = z.object({});

interface IndexResult {
  nodeCount: number;
}

export const indexGraphDef: CommandDef<typeof schema, IndexResult> = {
  name: 'index-graph',
  description: { en: 'Generate the _index.md file', ko: '_index.md 파일 생성' },
  category: 'write',
  schema,
  cli: { commandName: 'index' },

  async execute(input) {
    const graph = await loadGraph(input.graphDir);
    const indexContent = generateIndex(graph);
    writeFileSync(path.join(input.graphDir, '_index.md'), indexContent);
    return { nodeCount: graph.nodes.size };
  },

  format(result, _locale) {
    return t('format.index_generated', { count: String(result.nodeCount) });
  },
};
