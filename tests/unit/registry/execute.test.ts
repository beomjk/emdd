import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

import { listNodesDef } from '../../../src/registry/commands/list-nodes.js';
import { readNodeDef } from '../../../src/registry/commands/read-node.js';
import { healthDef } from '../../../src/registry/commands/health.js';
import { checkDef } from '../../../src/registry/commands/check.js';
import { lintDef } from '../../../src/registry/commands/lint.js';

describe('command execute() wiring', () => {
  it('list-nodes returns all nodes from sample graph', async () => {
    const result = await listNodesDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(14);
    expect(result.some((n: { id: string }) => n.id === 'hyp-001')).toBe(true);
  });

  it('list-nodes filters by type', async () => {
    const result = await listNodesDef.execute({ graphDir: SAMPLE_GRAPH, type: 'finding' });
    expect(result.every((n: { type: string }) => n.type === 'finding')).toBe(true);
    expect(result.length).toBe(5);
  });

  it('read-node returns detail for existing node', async () => {
    const result = await readNodeDef.execute({ graphDir: SAMPLE_GRAPH, nodeId: 'hyp-001' });
    expect(result.id).toBe('hyp-001');
    expect(result.type).toBe('hypothesis');
    expect(result.title).toBeTruthy();
  });

  it('read-node throws for missing node', async () => {
    await expect(readNodeDef.execute({ graphDir: SAMPLE_GRAPH, nodeId: 'hyp-999' }))
      .rejects.toThrow();
  });

  it('health returns valid report', async () => {
    const result = await healthDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result.totalNodes).toBe(14);
    expect(typeof result.linkDensity).toBe('number');
    expect(result.byType).toBeDefined();
  });

  it('check returns valid consolidation result', async () => {
    const result = await checkDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(Array.isArray(result.triggers)).toBe(true);
    expect(Array.isArray(result.promotionCandidates)).toBe(true);
    expect(Array.isArray(result.orphanFindings)).toBe(true);
  });

  it('lint returns clean result for sample graph', async () => {
    const result = await lintDef.execute({ graphDir: SAMPLE_GRAPH });
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
