import { describe, it, expect } from 'vitest';
import type { Node } from '../../../src/graph/types.js';
import {
  getHypothesisMeta,
  getFindingMeta,
  getQuestionMeta,
  getEpisodeMeta,
  getExperimentMeta,
  getDecisionMeta,
  getKnowledgeMeta,
} from '../../../src/graph/accessors.js';

function makeNode(overrides: Partial<Node> & { type: Node['type'] }): Node {
  return {
    id: 'test-001',
    title: 'Test',
    path: '/fake/path.md',
    status: 'PROPOSED',
    tags: [],
    links: [],
    meta: {},
    ...overrides,
  };
}

describe('getHypothesisMeta', () => {
  it('returns risk_level, kill_criterion, priority, branch_group, branch_role from meta', () => {
    const node = makeNode({
      type: 'hypothesis',
      meta: {
        risk_level: 'high',
        kill_criterion: 'mAP < 0.6 after 100 epochs',
        priority: 1,
        branch_group: 'bg-001',
        branch_role: 'candidate',
      },
    });
    const m = getHypothesisMeta(node);
    expect(m).not.toBeNull();
    expect(m!.risk_level).toBe('high');
    expect(m!.kill_criterion).toBe('mAP < 0.6 after 100 epochs');
    expect(m!.priority).toBe(1);
    expect(m!.branch_group).toBe('bg-001');
    expect(m!.branch_role).toBe('candidate');
  });

  it('returns undefined for missing optional fields', () => {
    const node = makeNode({ type: 'hypothesis', meta: {} });
    const m = getHypothesisMeta(node);
    expect(m).not.toBeNull();
    expect(m!.risk_level).toBeUndefined();
    expect(m!.kill_criterion).toBeUndefined();
    expect(m!.priority).toBeUndefined();
  });

  it('returns null for non-hypothesis node', () => {
    const node = makeNode({ type: 'finding', meta: {} });
    expect(getHypothesisMeta(node)).toBeNull();
  });
});

describe('getFindingMeta', () => {
  it('returns finding_type from meta', () => {
    const node = makeNode({ type: 'finding', meta: { finding_type: 'observation' } });
    const m = getFindingMeta(node);
    expect(m!.finding_type).toBe('observation');
  });

  it('defaults: finding_type absent returns undefined (not error)', () => {
    const node = makeNode({ type: 'finding', meta: {} });
    const m = getFindingMeta(node);
    expect(m).not.toBeNull();
    expect(m!.finding_type).toBeUndefined();
  });
});

describe('getQuestionMeta', () => {
  it('returns question_type, urgency, answer_summary', () => {
    const node = makeNode({
      type: 'question',
      meta: { question_type: 'strategic', urgency: 'BLOCKING', answer_summary: 'Resolved via exp-003' },
    });
    const m = getQuestionMeta(node);
    expect(m!.question_type).toBe('strategic');
    expect(m!.urgency).toBe('BLOCKING');
    expect(m!.answer_summary).toBe('Resolved via exp-003');
  });
});

describe('getEpisodeMeta', () => {
  it('returns trigger, duration, outcome', () => {
    const node = makeNode({
      type: 'episode',
      meta: { trigger: 'scheduled review', duration: '2h', outcome: 'success' },
    });
    const m = getEpisodeMeta(node);
    expect(m!.trigger).toBe('scheduled review');
    expect(m!.duration).toBe('2h');
    expect(m!.outcome).toBe('success');
  });
});

describe('getExperimentMeta', () => {
  it('returns config, results, artifacts', () => {
    const node = makeNode({
      type: 'experiment',
      meta: { config: { lr: 0.001 }, results: { accuracy: 0.95 }, artifacts: ['model.pt'] },
    });
    const m = getExperimentMeta(node);
    expect(m!.config).toEqual({ lr: 0.001 });
    expect(m!.results).toEqual({ accuracy: 0.95 });
    expect(m!.artifacts).toEqual(['model.pt']);
  });
});

describe('getDecisionMeta', () => {
  it('returns alternatives_considered, reversibility', () => {
    const node = makeNode({
      type: 'decision',
      meta: { alternatives_considered: ['A', 'B'], reversibility: 'medium' },
    });
    const m = getDecisionMeta(node);
    expect(m!.alternatives_considered).toEqual(['A', 'B']);
    expect(m!.reversibility).toBe('medium');
  });
});

describe('getKnowledgeMeta', () => {
  it('returns knowledge_type, source', () => {
    const node = makeNode({
      type: 'knowledge',
      meta: { knowledge_type: 'empirical', source: 'experiment results' },
    });
    const m = getKnowledgeMeta(node);
    expect(m!.knowledge_type).toBe('empirical');
    expect(m!.source).toBe('experiment results');
  });
});
