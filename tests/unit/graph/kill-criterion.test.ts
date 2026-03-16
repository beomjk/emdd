import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { checkKillCriteria } from '../../../src/graph/kill-criterion.js';

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
});
