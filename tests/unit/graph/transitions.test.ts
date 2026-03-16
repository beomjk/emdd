import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { detectTransitions } from '../../../src/graph/transitions.js';

describe('detectTransitions', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-trans-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  describe('hypothesis transitions', () => {
    it('PROPOSED→TESTING: connected experiment is RUNNING', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      writeNode('experiments', 'exp-001-test.md', {
        id: 'exp-001', type: 'experiment', title: 'E1', status: 'RUNNING',
        created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'hyp-001' && r.recommendedStatus === 'TESTING')).toBe(true);
    });

    it('TESTING→SUPPORTED: incoming SUPPORTS with strength≥0.7', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'hyp-001' && r.recommendedStatus === 'SUPPORTED')).toBe(true);
    });

    it('TESTING→REFUTED: incoming CONTRADICTS edge exists', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.3, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'hyp-001', relation: 'contradicts', severity: 'FATAL' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'hyp-001' && r.recommendedStatus === 'REFUTED')).toBe(true);
    });

    it('TESTING→REVISED: partial support + REVISES edge', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('hypotheses', 'hyp-002-test.md', {
        id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'PROPOSED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'hyp-001', relation: 'revises' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'hyp-001' && r.recommendedStatus === 'REVISED')).toBe(true);
    });

    it('no transition when conditions not met', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });

      const results = await detectTransitions(graphDir);
      expect(results.filter(r => r.nodeId === 'hyp-001')).toEqual([]);
    });
  });

  describe('knowledge transitions', () => {
    it('ACTIVE→DISPUTED: incoming CONTRADICTS from finding', async () => {
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
        confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'knw-001', relation: 'contradicts', severity: 'WEAKENING' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'knw-001' && r.recommendedStatus === 'DISPUTED')).toBe(true);
    });

    it('DISPUTED→ACTIVE: contradiction resolved (contradicting node RETRACTED)', async () => {
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'RETRACTED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'knw-001', relation: 'contradicts' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'knw-001' && r.recommendedStatus === 'ACTIVE')).toBe(true);
    });

    it('DISPUTED→SUPERSEDED: REVISES edge from newer knowledge', async () => {
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('knowledge', 'knw-002-test.md', {
        id: 'knw-002', type: 'knowledge', title: 'K2', status: 'ACTIVE',
        confidence: 0.9, created: '2026-01-15', updated: '2026-01-15', tags: [],
        links: [{ target: 'knw-001', relation: 'revises' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'knw-001' && r.recommendedStatus === 'SUPERSEDED')).toBe(true);
    });

    it('ACTIVE→SUPERSEDED: direct replacement via REVISES edge from newer knowledge', async () => {
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
        confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('knowledge', 'knw-002-test.md', {
        id: 'knw-002', type: 'knowledge', title: 'K2', status: 'ACTIVE',
        confidence: 0.9, created: '2026-01-15', updated: '2026-01-15', tags: [],
        links: [{ target: 'knw-001', relation: 'revises' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.some(r => r.nodeId === 'knw-001' && r.recommendedStatus === 'SUPERSEDED')).toBe(true);
    });

    it('no transition for DISPUTED without resolution', async () => {
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'DISPUTED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'knw-001', relation: 'contradicts', severity: 'FATAL' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.filter(r => r.nodeId === 'knw-001')).toEqual([]);
    });
  });

  describe('general', () => {
    it('returns recommendation objects (nodeId, current, recommended, reason)', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
        confidence: 0.7, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'hyp-001', relation: 'supports', strength: 0.8 }],
      });

      const results = await detectTransitions(graphDir);
      const r = results.find(r => r.nodeId === 'hyp-001');
      expect(r).toBeDefined();
      expect(r!.currentStatus).toBe('TESTING');
      expect(r!.recommendedStatus).toBe('SUPPORTED');
      expect(r!.reason).toBeTruthy();
      expect(r!.evidenceIds).toBeDefined();
    });

    it('handles multiple transitions in one graph', async () => {
      writeNode('hypotheses', 'hyp-001-test.md', {
        id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
        confidence: 0.5, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'exp-001', relation: 'tests' }],
      });
      writeNode('experiments', 'exp-001-test.md', {
        id: 'exp-001', type: 'experiment', title: 'E1', status: 'RUNNING',
        created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('knowledge', 'knw-001-test.md', {
        id: 'knw-001', type: 'knowledge', title: 'K1', status: 'ACTIVE',
        confidence: 0.9, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
      });
      writeNode('findings', 'fnd-001-test.md', {
        id: 'fnd-001', type: 'finding', title: 'F1', status: 'VALIDATED',
        confidence: 0.8, created: '2026-01-01', updated: '2026-01-01', tags: [],
        links: [{ target: 'knw-001', relation: 'contradicts', severity: 'FATAL' }],
      });

      const results = await detectTransitions(graphDir);
      expect(results.length).toBe(2);
    });
  });
});
