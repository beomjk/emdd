import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import { checkConsolidation, getPromotionCandidates } from '../../../src/graph/consolidation.js';
import { CEREMONY_TRIGGERS, THRESHOLDS } from '../../../src/graph/types.js';

function setupTmpGraph(): { tmpDir: string; graphDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'emdd-cons-'));
  const graphDir = join(tmpDir, 'graph');
  for (const sub of ['hypotheses', 'experiments', 'findings', 'knowledge', 'questions', 'decisions', 'episodes']) {
    mkdirSync(join(graphDir, sub), { recursive: true });
  }
  return { tmpDir, graphDir };
}

function writeNode(graphDir: string, subdir: string, filename: string, fm: Record<string, unknown>, body = '') {
  writeFileSync(join(graphDir, subdir, filename), matter.stringify(body, fm));
}

function makeFinding(id: string, conf: number, extra: Record<string, unknown> = {}) {
  return {
    id, type: 'finding', title: id, status: 'DRAFT', confidence: conf,
    created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    ...extra,
  };
}

describe('checkConsolidation — trigger detection', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('fires findings trigger when unpromoted >= threshold', async () => {
    const threshold = CEREMONY_TRIGGERS.consolidation.unpromoted_findings_threshold;
    for (let i = 1; i <= threshold; i++) {
      writeNode(graphDir, 'findings', `find-00${i}-x.md`, makeFinding(`find-00${i}`, 0.7));
    }
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'findings')).toBe(true);
  });

  it('does not fire findings trigger when count below threshold', async () => {
    const threshold = CEREMONY_TRIGGERS.consolidation.unpromoted_findings_threshold;
    writeNode(graphDir, 'findings', 'find-001-x.md', makeFinding('find-001', 0.7));
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'findings' && t.count! >= threshold)).toBe(false);
  });

  it('fires episodes trigger when episode count >= threshold', async () => {
    const threshold = CEREMONY_TRIGGERS.consolidation.episodes_threshold;
    for (let i = 1; i <= threshold; i++) {
      writeNode(graphDir, 'episodes', `epi-00${i}-x.md`, {
        id: `epi-00${i}`, type: 'episode', title: `E${i}`, status: 'COMPLETED',
        created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
      });
    }
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'episodes')).toBe(true);
  });

  it('fires questions trigger only when total>0 and all resolved', async () => {
    writeNode(graphDir, 'questions', 'qst-001-x.md', {
      id: 'qst-001', type: 'question', title: 'Q', status: 'RESOLVED',
      created: '2026-04-01', updated: '2026-04-01', tags: [], links: [],
    });
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'questions')).toBe(true);
  });

  it('does not fire questions trigger when no questions exist', async () => {
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'questions')).toBe(false);
  });

  it('fires experiment overload when produces edges exceed threshold', async () => {
    const overload = CEREMONY_TRIGGERS.consolidation.experiment_overload_threshold;
    const links: Record<string, string>[] = [];
    for (let i = 1; i <= overload; i++) {
      writeNode(graphDir, 'findings', `find-00${i}-x.md`, makeFinding(`find-00${i}`, 0.5));
      links.push({ target: `find-00${i}`, relation: 'produces' });
    }
    writeNode(graphDir, 'experiments', 'exp-001-x.md', {
      id: 'exp-001', type: 'experiment', title: 'E', status: 'COMPLETED',
      created: '2026-04-01', updated: '2026-04-01', tags: [], links,
    });
    const res = await checkConsolidation(graphDir);
    expect(res.triggers.some(t => t.type === 'experiment_overload')).toBe(true);
  });

  it('returns empty triggers on empty graph', async () => {
    const res = await checkConsolidation(graphDir);
    expect(res.triggers).toEqual([]);
  });
});

describe('getPromotionCandidates', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => ({ tmpDir, graphDir } = setupTmpGraph()));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('includes findings meeting confidence + independent supports threshold', async () => {
    const minConf = THRESHOLDS.promotion_confidence;
    const minSupports = THRESHOLDS.min_independent_supports;
    writeNode(graphDir, 'findings', 'find-001-x.md', makeFinding('find-001', minConf));
    // Seed minSupports supports from distinct nodes
    for (let i = 1; i <= minSupports; i++) {
      writeNode(graphDir, 'findings', `find-10${i}-s.md`, makeFinding(`find-10${i}`, 0.5, {
        links: [{ target: 'find-001', relation: 'supports', strength: 0.8 }],
      }));
    }
    const res = await getPromotionCandidates(graphDir);
    const target = res.find(c => c.id === 'find-001');
    expect(target).toBeDefined();
    expect(['confidence', 'both']).toContain(target!.reason);
  });

  it('excludes contradicted findings', async () => {
    writeNode(graphDir, 'findings', 'find-001-x.md', makeFinding('find-001', 0.95));
    // A contradicts edge targeting find-001 disqualifies it
    writeNode(graphDir, 'findings', 'find-002-c.md', makeFinding('find-002', 0.6, {
      links: [{ target: 'find-001', relation: 'contradicts', severity: 'FATAL' }],
    }));
    const res = await getPromotionCandidates(graphDir);
    expect(res.find(c => c.id === 'find-001')).toBeUndefined();
  });

  it('excludes already-promoted findings', async () => {
    writeNode(graphDir, 'findings', 'find-001-x.md', { ...makeFinding('find-001', 0.95), status: 'PROMOTED' });
    writeNode(graphDir, 'knowledge', 'know-001-k.md', {
      id: 'know-001', type: 'knowledge', title: 'K', status: 'ACTIVE', confidence: 0.95,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'find-001', relation: 'promotes' }],
    });
    const res = await getPromotionCandidates(graphDir);
    expect(res.find(c => c.id === 'find-001')).toBeUndefined();
  });

  it('returns empty when no findings meet criteria', async () => {
    writeNode(graphDir, 'findings', 'find-001-x.md', makeFinding('find-001', 0.3));
    const res = await getPromotionCandidates(graphDir);
    expect(res).toEqual([]);
  });

  it('picks up de-facto-used findings via depends_on/extends', async () => {
    writeNode(graphDir, 'findings', 'find-001-x.md', makeFinding('find-001', 0.4));
    writeNode(graphDir, 'hypotheses', 'hyp-001-h.md', {
      id: 'hyp-001', type: 'hypothesis', title: 'H', status: 'PROPOSED', confidence: 0.6,
      created: '2026-04-01', updated: '2026-04-01', tags: [],
      links: [{ target: 'find-001', relation: 'depends_on', dependencyType: 'LOGICAL' }],
    });
    const res = await getPromotionCandidates(graphDir);
    const target = res.find(c => c.id === 'find-001');
    expect(target).toBeDefined();
    expect(target!.reason).toBe('de_facto');
  });
});
