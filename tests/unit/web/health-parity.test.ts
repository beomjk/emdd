import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHealth } from '../../../src/graph/operations.js';
import { createDashboardServer } from '../../../src/web/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_GRAPH = path.resolve(__dirname, '../../fixtures/sample-graph');

describe('SC-010: Health parity between operations.getHealth() and GET /api/health', () => {
  it('field-by-field equivalence for sample-graph fixture', async () => {
    // Direct call via operations.ts
    const directHealth = await getHealth(SAMPLE_GRAPH);

    // Via server API
    const { app } = createDashboardServer(SAMPLE_GRAPH);
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const apiHealth = await res.json();

    // Core metrics
    expect(apiHealth.totalNodes).toBe(directHealth.totalNodes);
    expect(apiHealth.totalEdges).toBe(directHealth.totalEdges);
    expect(apiHealth.linkDensity).toBe(directHealth.linkDensity);
    expect(apiHealth.openQuestions).toBe(directHealth.openQuestions);

    // avgConfidence — both null or both same number
    if (directHealth.avgConfidence === null) {
      expect(apiHealth.avgConfidence).toBeNull();
    } else {
      expect(apiHealth.avgConfidence).toBeCloseTo(directHealth.avgConfidence, 10);
    }

    // byType — same keys and counts
    expect(apiHealth.byType).toEqual(directHealth.byType);

    // statusDistribution — nested structure
    expect(apiHealth.statusDistribution).toEqual(directHealth.statusDistribution);

    // gaps — same strings
    expect(apiHealth.gaps).toEqual(directHealth.gaps);

    // gapDetails — same length and types
    expect(apiHealth.gapDetails.length).toBe(directHealth.gapDetails.length);
    for (let i = 0; i < directHealth.gapDetails.length; i++) {
      expect(apiHealth.gapDetails[i].type).toBe(directHealth.gapDetails[i].type);
      expect(apiHealth.gapDetails[i].message).toBe(directHealth.gapDetails[i].message);
      expect(apiHealth.gapDetails[i].nodeIds).toEqual(directHealth.gapDetails[i].nodeIds);
    }

    // deferredItems
    expect(apiHealth.deferredItems).toEqual(directHealth.deferredItems);
  });
});
