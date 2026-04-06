import { describe, it, expect } from 'vitest';

describe('Public API exports (src/index.ts)', () => {
  it('exports core graph operations', async () => {
    const api = await import('../../src/index.js');
    expect(typeof api.loadGraph).toBe('function');
    expect(typeof api.resolveGraphDir).toBe('function');
    expect(typeof api.listNodes).toBe('function');
    expect(typeof api.readNode).toBe('function');
    expect(typeof api.readNodes).toBe('function');
    expect(typeof api.createNode).toBe('function');
    expect(typeof api.createEdge).toBe('function');
    expect(typeof api.updateNode).toBe('function');
    expect(typeof api.deleteEdge).toBe('function');
    expect(typeof api.getHealth).toBe('function');
    expect(typeof api.checkConsolidation).toBe('function');
    expect(typeof api.getPromotionCandidates).toBe('function');
    expect(typeof api.getNeighbors).toBe('function');
    expect(typeof api.detectTransitions).toBe('function');
    expect(typeof api.propagateConfidence).toBe('function');
    expect(typeof api.traceImpact).toBe('function');
    expect(typeof api.lintGraph).toBe('function');
  });

  it('exports remaining graph functions', async () => {
    const api = await import('../../src/index.js');
    expect(typeof api.markDone).toBe('function');
    expect(typeof api.markConsolidated).toBe('function');
    expect(typeof api.lintNode).toBe('function');
    expect(typeof api.detectClusters).toBe('function');
    expect(typeof api.getBacklog).toBe('function');
    expect(typeof api.checkKillCriteria).toBe('function');
    expect(typeof api.listBranchGroups).toBe('function');
    expect(typeof api.analyzeRefutation).toBe('function');
  });

  it('exports plan/execute functions', async () => {
    const api = await import('../../src/index.js');
    expect(typeof api.planCreateNode).toBe('function');
    expect(typeof api.planCreateEdge).toBe('function');
    expect(typeof api.executeOps).toBe('function');
  });

  it('exports i18n utilities', async () => {
    const api = await import('../../src/index.js');
    expect(typeof api.t).toBe('function');
    expect(typeof api.setLocale).toBe('function');
    expect(typeof api.getLocale).toBe('function');
  });
});
