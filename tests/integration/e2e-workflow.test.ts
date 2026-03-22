import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI = `${PROJECT_ROOT}/node_modules/.bin/tsx ${PROJECT_ROOT}/src/cli.ts`;

function run(args: string, cwd?: string): string {
  return execSync(`${CLI} ${args}`, {
    encoding: 'utf-8',
    cwd: cwd ?? PROJECT_ROOT,
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
    run(`new --type hypothesis --slug surface-defect-detection`, dir);
    run(`new --type hypothesis --slug edge-detection-approach`, dir);
    const files = readdirSync(join(dir, 'graph', 'hypotheses'));
    expect(files.length).toBe(2);
  });

  it('Step 3: create experiment', () => {
    run(`new --type experiment --slug cnn-baseline`, dir);
    const files = readdirSync(join(dir, 'graph', 'experiments'));
    expect(files.length).toBe(1);
  });

  it('Step 4: link experiment to hypothesis', () => {
    const result = run(`link --source exp-001 --target hyp-001 --relation supports`, dir);
    expect(result).toContain('Linked');
  });

  it('Step 5: create finding and set confidence', () => {
    run(`new --type finding --slug cnn-accuracy-92`, dir);
    run(`update --nodeId fnd-001 --transitionPolicy off --set confidence=0.85`, dir);
    // Verify confidence was set
    const findingDir = join(dir, 'graph', 'findings');
    const files = readdirSync(findingDir);
    const content = readFileSync(join(findingDir, files[0]), 'utf-8');
    expect(content).toContain('confidence: 0.85');
  });

  it('Step 6: lint passes', () => {
    const result = run(`lint`, dir);
    expect(result.toLowerCase()).not.toMatch(/\berror\b/);
  });

  it('Step 7: health dashboard', () => {
    const result = run(`health`, dir);
    expect(result.toLowerCase()).toContain('health');
  });

  it('Step 8: create episode and mark done', () => {
    run(`new --type episode --slug initial-exploration`, dir);
    const episodeDir = join(dir, 'graph', 'episodes');
    const files = readdirSync(episodeDir);
    expect(files.length).toBe(1);

    // The default template has an empty "- [ ] " item, add a real checklist item
    const episodePath = join(episodeDir, files[0]);
    let content = readFileSync(episodePath, 'utf-8');
    content = content.replace('- [ ] ', '- [ ] Review initial results');
    writeFileSync(episodePath, content);

    run(`done --episodeId epi-001 --item "Review initial results"`, dir);
    const updated = readFileSync(episodePath, 'utf-8');
    expect(updated).toContain('- [done] Review initial results');
  });

  it('Step 9: generate index', () => {
    const result = run(`index`, dir);
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
    const result = run(`check`, dir);
    expect(result).toBeDefined();
  });

  it('Step 12: promote candidates', () => {
    const result = run(`promote`, dir);
    expect(result).toBeDefined();
  });

  it('Step 13: backlog', () => {
    const result = run(`backlog`, dir);
    expect(result).toBeDefined();
  });
});
