import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = './node_modules/.bin/tsx src/cli.ts';

function run(args: string): string {
  return execSync(`${CLI} ${args}`, {
    encoding: 'utf-8',
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

describe('EMDD E2E workflow', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'emdd-e2e-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('Step 1: init project', () => {
    const result = run(`init ${dir} --lang en`);
    expect(existsSync(join(dir, 'graph', 'hypotheses'))).toBe(true);
    expect(existsSync(join(dir, 'graph', 'experiments'))).toBe(true);
    expect(existsSync(join(dir, 'graph', 'findings'))).toBe(true);
    expect(existsSync(join(dir, 'graph', 'episodes'))).toBe(true);
  });

  it('Step 2: create hypotheses', () => {
    run(`new hypothesis surface-defect-detection --path ${dir}`);
    run(`new hypothesis edge-detection-approach --path ${dir}`);
    const files = readdirSync(join(dir, 'graph', 'hypotheses'));
    expect(files.length).toBe(2);
  });

  it('Step 3: create experiment', () => {
    run(`new experiment cnn-baseline --path ${dir}`);
    const files = readdirSync(join(dir, 'graph', 'experiments'));
    expect(files.length).toBe(1);
  });

  it('Step 4: link experiment to hypothesis', () => {
    const result = run(`link exp-001 hyp-001 supports --path ${dir}`);
    expect(result).toContain('Linked');
  });

  it('Step 5: create finding and set confidence', () => {
    run(`new finding cnn-accuracy-92 --path ${dir}`);
    run(`update fnd-001 --set confidence=0.85 --path ${dir}`);
    // Verify confidence was set
    const findingDir = join(dir, 'graph', 'findings');
    const files = readdirSync(findingDir);
    const content = readFileSync(join(findingDir, files[0]), 'utf-8');
    expect(content).toContain('confidence: 0.85');
  });

  it('Step 6: lint passes', () => {
    const result = run(`lint ${dir}`);
    expect(result.toLowerCase()).not.toMatch(/\berror\b/);
  });

  it('Step 7: health dashboard', () => {
    const result = run(`health ${dir}`);
    expect(result.toLowerCase()).toContain('health');
  });

  it('Step 8: create episode and mark done', () => {
    run(`new episode initial-exploration --path ${dir}`);
    const episodeDir = join(dir, 'graph', 'episodes');
    const files = readdirSync(episodeDir);
    expect(files.length).toBe(1);

    // The default template has an empty "- [ ] " item, add a real checklist item
    const episodePath = join(episodeDir, files[0]);
    let content = readFileSync(episodePath, 'utf-8');
    content = content.replace('- [ ] ', '- [ ] Review initial results');
    writeFileSync(episodePath, content);

    run(`done epi-001 "Review initial results" --path ${dir}`);
    const updated = readFileSync(episodePath, 'utf-8');
    expect(updated).toContain('- [done] Review initial results');
  });

  it('Step 9: generate index', () => {
    const result = run(`index ${dir}`);
    expect(result).toContain('nodes');
    expect(existsSync(join(dir, 'graph', '_index.md'))).toBe(true);
    const content = readFileSync(join(dir, 'graph', '_index.md'), 'utf-8');
    expect(content).toContain('hyp-001');
  });

  it('Step 10: generate graph', () => {
    const result = run(`graph ${dir}`);
    expect(result).toContain('nodes');
    expect(existsSync(join(dir, 'graph', '_graph.mmd'))).toBe(true);
    const content = readFileSync(join(dir, 'graph', '_graph.mmd'), 'utf-8');
    expect(content).toMatch(/graph TD/);
    expect(content).toContain('supports');
  });

  it('Step 11: check triggers', () => {
    const result = run(`check ${dir}`);
    expect(result).toBeDefined();
  });

  it('Step 12: promote candidates', () => {
    const result = run(`promote ${dir}`);
    expect(result).toBeDefined();
  });

  it('Step 13: backlog', () => {
    const result = run(`backlog ${dir}`);
    expect(result).toBeDefined();
  });
});
