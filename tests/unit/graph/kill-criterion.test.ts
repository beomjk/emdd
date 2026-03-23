import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { checkKillCriteria } from '../../../src/graph/kill-criterion.js';
import { THRESHOLDS } from '../../../src/graph/types.js';

describe('checkKillCriteria', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-kill-'));
    graphDir = join(tmpDir, 'graph');
    for (const sub of ['hypotheses', 'experiments', 'findings']) {
      mkdirSync(join(graphDir, sub), { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeNode(subdir: string, filename: string, fm: Record<string, unknown>) {
    writeFileSync(join(graphDir, subdir, filename), matter.stringify('', fm));
  }

  it('flags hypothesis when confidence < 0.3 and kill_criterion exists', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.2, kill_criterion: 'mAP < 0.60 after 100 epochs',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.hypothesisId === 'hyp-001' && a.trigger === 'low_confidence')).toBe(true);
  });

  it('flags stale kill criteria (TESTING 14+ days, no recent experiment)', async () => {
    const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.5, kill_criterion: 'mAP < 0.60',
      created: oldDate, updated: oldDate, tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.hypothesisId === 'hyp-001' && a.trigger === 'stale')).toBe(true);
  });

  it('does not flag hypotheses without kill_criterion', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.2, created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts).toEqual([]);
  });

  it('does not flag REFUTED/DEFERRED hypotheses', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'REFUTED',
      confidence: 0.1, kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'DEFERRED',
      confidence: 0.1, kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts).toEqual([]);
  });

  it('returns alert objects (hypothesisId, killCriterion, trigger, message)', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.2, kill_criterion: 'mAP < 0.60 after 100 epochs',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    const alert = alerts[0];
    expect(alert.hypothesisId).toBe('hyp-001');
    expect(alert.killCriterion).toBe('mAP < 0.60 after 100 epochs');
    expect(alert.trigger).toBe('low_confidence');
    expect(alert.message).toBeTruthy();
  });

  it('confidence=0.3 exactly → NOT triggered (boundary)', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.3, kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.trigger === 'low_confidence')).toBe(false);
  });

  it('13 days elapsed → stale NOT triggered (boundary)', async () => {
    const date13 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.9, kill_criterion: 'mAP < 0.60',
      created: date13, updated: date13, tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.trigger === 'stale')).toBe(false);
  });

  it('14 days exactly → stale triggered (boundary)', async () => {
    const date14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.9, kill_criterion: 'mAP < 0.60',
      created: date14, updated: date14, tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.trigger === 'stale')).toBe(true);
  });

  it('confidence undefined + kill_criterion → low_confidence triggered', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'PROPOSED',
      kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.some(a => a.hypothesisId === 'hyp-001' && a.trigger === 'low_confidence')).toBe(true);
  });

  it('TESTING without updated field → stale check skipped', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.9, kill_criterion: 'mAP < 0.60',
      tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts).toEqual([]);
  });

  it('SUPPORTED/REVISED statuses → skipped', async () => {
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'SUPPORTED',
      confidence: 0.1, kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'REVISED',
      confidence: 0.1, kill_criterion: 'mAP < 0.60',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts).toEqual([]);
  });

  it('threshold boundaries match THRESHOLDS constants', async () => {
    // Confidence exactly at threshold → NOT triggered
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: THRESHOLDS.kill_confidence, kill_criterion: 'test',
      created: '2026-01-01', updated: '2026-01-01', tags: [], links: [],
    });
    const alerts1 = await checkKillCriteria(graphDir);
    expect(alerts1.some(a => a.trigger === 'low_confidence')).toBe(false);

    // Days exactly at threshold → triggered
    const dateAtThreshold = new Date(Date.now() - THRESHOLDS.kill_stale_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-002-test.md', {
      id: 'hyp-002', type: 'hypothesis', title: 'H2', status: 'TESTING',
      confidence: 0.9, kill_criterion: 'test',
      created: dateAtThreshold, updated: dateAtThreshold, tags: [], links: [],
    });
    const alerts2 = await checkKillCriteria(graphDir);
    expect(alerts2.some(a => a.hypothesisId === 'hyp-002' && a.trigger === 'stale')).toBe(true);
  });

  it('both low_confidence AND stale simultaneously', async () => {
    const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    writeNode('hypotheses', 'hyp-001-test.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H1', status: 'TESTING',
      confidence: 0.1, kill_criterion: 'mAP < 0.60',
      created: oldDate, updated: oldDate, tags: [], links: [],
    });

    const alerts = await checkKillCriteria(graphDir);
    expect(alerts.length).toBe(2);
    expect(alerts.some(a => a.trigger === 'low_confidence')).toBe(true);
    expect(alerts.some(a => a.trigger === 'stale')).toBe(true);
  });
});
