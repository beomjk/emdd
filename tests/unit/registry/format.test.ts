import { describe, it, expect } from 'vitest';
import type { HealthReport, GapDetail, PromoteCandidate, Node, NodeDetail, CreateNodeResult, CheckResult } from '../../../src/graph/types.js';
import type { ConfidenceResult } from '../../../src/graph/confidence.js';
import type { TransitionRecommendation } from '../../../src/graph/transitions.js';
import type { KillCriterionAlert } from '../../../src/graph/kill-criterion.js';
import type { BranchGroup } from '../../../src/graph/branch-groups.js';
import { healthDef } from '../../../src/registry/commands/health.js';
import { lintDef } from '../../../src/registry/commands/lint.js';
import { gapsDef } from '../../../src/registry/commands/gaps.js';
import { listNodesDef } from '../../../src/registry/commands/list-nodes.js';
import { neighborsDef } from '../../../src/registry/commands/neighbors.js';
import { createEdgeDef } from '../../../src/registry/commands/create-edge.js';
import { deleteEdgeDef } from '../../../src/registry/commands/delete-edge.js';
import { updateNodeDef } from '../../../src/registry/commands/update-node.js';
import { markDoneDef } from '../../../src/registry/commands/mark-done.js';
import { promoteDef } from '../../../src/registry/commands/promote.js';
import { analyzeRefutationDef } from '../../../src/registry/commands/analyze-refutation.js';
import { backlogDef } from '../../../src/registry/commands/backlog.js';
import { indexGraphDef } from '../../../src/registry/commands/index-graph.js';
import { readNodeDef } from '../../../src/registry/commands/read-node.js';
import { createNodeDef } from '../../../src/registry/commands/create-node.js';
import { checkDef } from '../../../src/registry/commands/check.js';
import { confidencePropagateDef } from '../../../src/registry/commands/confidence-propagate.js';
import { transitionsDef } from '../../../src/registry/commands/transitions.js';
import { killCheckDef } from '../../../src/registry/commands/kill-check.js';
import { branchGroupsDef } from '../../../src/registry/commands/branch-groups.js';
import { markConsolidatedDef } from '../../../src/registry/commands/mark-consolidated.js';

describe('format() functions', () => {
  describe('health', () => {
    const baseReport: HealthReport = {
      totalNodes: 10,
      totalEdges: 5,
      byType: { hypothesis: 3, finding: 4, experiment: 3 },
      statusDistribution: { hypothesis: { PROPOSED: 2, TESTING: 1 } },
      avgConfidence: 0.75,
      openQuestions: 2,
      linkDensity: 1.5,
      gaps: [],
      gapDetails: [],
      deferredItems: [],
      affinityViolations: [],
    };

    it('formats basic health report', () => {
      const out = healthDef.format(baseReport);
      expect(out).toContain('EMDD Health Dashboard');
      expect(out).toContain('Total Nodes: 10');
      expect(out).toContain('hypothesis: 3');
      expect(out).toContain('0.75');
    });

    it('shows gap details when present', () => {
      const detail: GapDetail = { type: 'orphan_finding', nodeIds: ['fnd-001'], message: 'Orphan finding' };
      const report = { ...baseReport, gapDetails: [detail] };
      const out = healthDef.format(report);
      expect(out).toContain('Gap Details');
      expect(out).toContain('fnd-001');
    });

    it('shows affinity violations when present', () => {
      const report = { ...baseReport, affinityViolations: ['violation1'] };
      const out = healthDef.format(report);
      expect(out).toContain('Affinity Violations');
      expect(out).toContain('violation1');
    });

    it('hides gap/affinity/deferred sections when empty', () => {
      const out = healthDef.format(baseReport);
      expect(out).not.toContain('Gap Details');
      expect(out).not.toContain('Affinity Violations');
      expect(out).not.toContain('Deferred Items');
    });

    it('handles null avgConfidence', () => {
      const report = { ...baseReport, avgConfidence: null };
      const out = healthDef.format(report);
      expect(out).toContain('N/A');
    });
  });

  describe('lint', () => {
    it('returns clean message for no errors', () => {
      const out = lintDef.format({ errors: [], errorCount: 0, warningCount: 0 });
      expect(out).toMatch(/no errors/i);
    });

    it('formats errors with summary', () => {
      const errors = [
        { nodeId: 'hyp-001', field: 'status', message: 'Invalid status', severity: 'error' },
        { nodeId: 'fnd-001', field: 'links', message: 'Broken link', severity: 'warning' },
      ];
      const out = lintDef.format({ errors, errorCount: 1, warningCount: 1 });
      expect(out).toContain('[ERROR] hyp-001.status');
      expect(out).toContain('[WARNING] fnd-001.links');
      expect(out).toContain('1 error(s), 1 warning(s)');
    });
  });

  describe('gaps', () => {
    it('returns empty message when no gaps', () => {
      const out = gapsDef.format({ gaps: [], gapDetails: [] });
      expect(out).toMatch(/no gaps/i);
    });

    it('formats gap details', () => {
      const detail: GapDetail = { type: 'stale_knowledge', nodeIds: ['kno-001'], message: 'Stale' };
      const out = gapsDef.format({ gaps: ['gap1'], gapDetails: [detail] });
      expect(out).toContain('gap1');
      expect(out).toContain('stale_knowledge');
    });
  });

  describe('list-nodes', () => {
    it('returns empty message when no nodes', () => {
      const out = listNodesDef.format([]);
      expect(out).toMatch(/no nodes/i);
    });

    it('formats node list with confidence', () => {
      const nodes: Node[] = [{
        id: 'hyp-001', type: 'hypothesis', title: 'Test',
        path: '/fake', status: 'PROPOSED', confidence: 0.8,
        tags: [], links: [], meta: {},
      }];
      const out = listNodesDef.format(nodes);
      expect(out).toContain('[hyp-001] Test');
      expect(out).toContain('hypothesis');
      expect(out).toContain('0.80');
    });
  });

  describe('neighbors', () => {
    it('returns empty message when no neighbors', () => {
      const out = neighborsDef.format([]);
      expect(out).toMatch(/no neighbors/i);
    });

    it('formats with direction arrows', () => {
      const neighbors = [{
        id: 'fnd-001', type: 'finding' as const, title: 'Found',
        relation: 'supports', direction: 'outgoing' as const, depth: 1,
      }];
      const out = neighborsDef.format(neighbors);
      expect(out).toContain('→');
      expect(out).toContain('fnd-001');
    });
  });

  describe('create-edge', () => {
    it('formats link result', () => {
      const out = createEdgeDef.format({ source: 'hyp-001', target: 'fnd-001', relation: 'supports' });
      expect(out).toContain('hyp-001');
      expect(out).toContain('fnd-001');
      expect(out).toContain('supports');
    });
  });

  describe('delete-edge', () => {
    it('formats deletion result', () => {
      const out = deleteEdgeDef.format({ source: 'a', target: 'b', deletedCount: 2, deletedRelations: ['supports'] });
      expect(out).toContain('2');
      expect(out).toContain('a');
    });
  });

  describe('update-node', () => {
    it('formats update result', () => {
      const out = updateNodeDef.format({ nodeId: 'hyp-001', updatedFields: ['status', 'confidence'], updatedDate: '2025-01-01' });
      expect(out).toContain('hyp-001');
      expect(out).toContain('status, confidence');
    });
  });

  describe('mark-done', () => {
    it('formats done result', () => {
      const out = markDoneDef.format({ episodeId: 'epi-001', item: 'Do thing', marker: 'done' });
      expect(out).toContain('Do thing');
      expect(out).toContain('done');
      expect(out).toContain('epi-001');
    });
  });

  describe('promote', () => {
    it('returns empty message when no candidates', () => {
      const out = promoteDef.format([]);
      expect(out).toMatch(/no promotion/i);
    });

    it('formats candidates', () => {
      const candidates: PromoteCandidate[] = [
        { id: 'hyp-001', confidence: 0.9, supports: 3, reason: 'confidence' },
      ];
      const out = promoteDef.format(candidates);
      expect(out).toContain('hyp-001');
      expect(out).toContain('0.9');
    });
  });

  describe('analyze-refutation', () => {
    it('returns empty message when no affected', () => {
      const out = analyzeRefutationDef.format({
        affectedHypotheses: [], pivotCeremonyTriggered: false, retractedKnowledgeIds: [],
      });
      expect(out).toMatch(/no affected/i);
    });

    it('formats affected hypotheses and pivot', () => {
      const out = analyzeRefutationDef.format({
        affectedHypotheses: [{
          hypothesisId: 'hyp-001', knowledgeId: 'kno-001',
          severity: 'FATAL', oldConfidence: 0.8, newConfidence: 0.2,
        }],
        pivotCeremonyTriggered: true,
        retractedKnowledgeIds: ['kno-001'],
      });
      expect(out).toContain('hyp-001');
      expect(out).toContain('→');
      expect(out).toContain('Pivot ceremony triggered');
    });
  });

  describe('backlog', () => {
    it('returns empty message when no items', () => {
      const out = backlogDef.format({ items: [] });
      expect(out).toMatch(/no backlog/i);
    });

    it('formats items', () => {
      const out = backlogDef.format({
        items: [{ text: 'Task 1', episodeId: 'epi-001', marker: 'pending' }],
      });
      expect(out).toContain('[pending] Task 1');
    });
  });

  describe('index-graph', () => {
    it('formats node count', () => {
      const out = indexGraphDef.format({ nodeCount: 14 });
      expect(out).toContain('14');
      expect(out).toMatch(/index/i);
    });
  });

  describe('read-node', () => {
    const baseDetail: NodeDetail = {
      id: 'hyp-001', type: 'hypothesis', title: 'Test',
      path: '/fake', status: 'PROPOSED', confidence: 0.75,
      tags: ['tag1'], links: [{ target: 'fnd-001', relation: 'supports' }],
      meta: {}, body: 'Body text',
    };

    it('formats node detail with all fields', () => {
      const out = readNodeDef.format(baseDetail);
      expect(out).toContain('hyp-001');
      expect(out).toContain('hypothesis');
      expect(out).toContain('0.75');
      expect(out).toContain('tag1');
      expect(out).toContain('fnd-001');
      expect(out).toContain('supports');
      expect(out).toContain('Body text');
    });

    it('omits body section when body is empty', () => {
      const detail = { ...baseDetail, body: '' };
      const out = readNodeDef.format(detail);
      expect(out).toContain('hyp-001');
      expect(out).not.toContain('Body text');
    });
  });

  describe('create-node', () => {
    it('formats creation result', () => {
      const result: CreateNodeResult = { id: 'hyp-002', type: 'hypothesis', path: '/fake' };
      const out = createNodeDef.format(result);
      expect(out).toContain('hyp-002');
      expect(out).toContain('hypothesis');
    });
  });

  describe('check', () => {
    it('returns no triggers message when empty', () => {
      const result: CheckResult = {
        triggers: [], promotionCandidates: [], orphanFindings: [], deferredItems: [],
      };
      const out = checkDef.format(result);
      expect(out).toMatch(/no consolidation triggers/i);
    });

    it('formats triggers and promotion candidates', () => {
      const result: CheckResult = {
        triggers: [{ type: 'stale', message: 'Stale hyp' }],
        promotionCandidates: [{ id: 'hyp-001', confidence: 0.9, supports: 3, reason: 'confidence' }],
        orphanFindings: [],
        deferredItems: [],
      };
      const out = checkDef.format(result);
      expect(out).toContain('stale');
      expect(out).toContain('Stale hyp');
      expect(out).toContain('hyp-001');
      expect(out).toContain('0.9');
    });
  });

  describe('confidence-propagate', () => {
    it('returns empty message when no changes', () => {
      const out = confidencePropagateDef.format([]);
      expect(out).toMatch(/no confidence/i);
    });

    it('formats confidence changes', () => {
      const results: ConfidenceResult[] = [
        { nodeId: 'hyp-001', oldConfidence: 0.5, newConfidence: 0.8 },
      ];
      const out = confidencePropagateDef.format(results);
      expect(out).toContain('hyp-001');
      expect(out).toContain('0.50');
      expect(out).toContain('0.80');
    });
  });

  describe('transitions', () => {
    it('returns empty message when no transitions', () => {
      const out = transitionsDef.format([]);
      expect(out).toMatch(/no available transitions/i);
    });

    it('formats transition recommendations', () => {
      const results: TransitionRecommendation[] = [{
        nodeId: 'hyp-001', currentStatus: 'PROPOSED',
        recommendedStatus: 'TESTING', reason: 'Has experiments',
        evidenceIds: ['exp-001'],
      }];
      const out = transitionsDef.format(results);
      expect(out).toContain('hyp-001');
      expect(out).toContain('PROPOSED');
      expect(out).toContain('TESTING');
    });
  });

  describe('kill-check', () => {
    it('returns empty message when no alerts', () => {
      const out = killCheckDef.format([]);
      expect(out).toMatch(/no kill/i);
    });

    it('formats kill criterion alerts', () => {
      const results: KillCriterionAlert[] = [{
        hypothesisId: 'hyp-001', killCriterion: 'confidence < 0.2',
        trigger: 'low_confidence', message: 'Too low',
      }];
      const out = killCheckDef.format(results);
      expect(out).toContain('hyp-001');
      expect(out).toContain('Too low');
    });
  });

  describe('branch-groups', () => {
    it('returns empty message when no groups', () => {
      const out = branchGroupsDef.format([]);
      expect(out).toMatch(/no branch/i);
    });

    it('formats branch groups with candidates', () => {
      const results: BranchGroup[] = [{
        groupId: 'group-1',
        candidates: [{ id: 'hyp-001', confidence: 0.8, status: 'TESTING', role: 'primary' }],
        convergenceReady: true,
        convergenceReason: 'All tested',
        warnings: [],
        oldestCreated: '2025-01-01',
      }];
      const out = branchGroupsDef.format(results);
      expect(out).toContain('group-1');
      expect(out).toContain('hyp-001');
    });
  });

  describe('mark-consolidated', () => {
    it('formats consolidation date', () => {
      const out = markConsolidatedDef.format({ date: '2026-03-22' });
      expect(out).toContain('2026-03-22');
    });
  });
});
