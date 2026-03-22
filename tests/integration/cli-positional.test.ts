import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function runMayFail(args: string, cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = run(args, cwd);
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
  }
}

describe('CLI positional arguments (integration)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'emdd-positional-'));
    run(`init ${dir}`);
    // Create baseline nodes using --flag syntax (known-good)
    run('new --type hypothesis --slug baseline-hyp', dir);
    run('new --type experiment --slug baseline-exp', dir);
    run('new --type finding --slug baseline-fnd', dir);
    run('new --type episode --slug baseline-epi', dir);

    // Prepare episode checklist for done tests
    const episodeDir = join(dir, 'graph', 'episodes');
    const files = readdirSync(episodeDir);
    const episodePath = join(episodeDir, files[0]);
    let content = readFileSync(episodePath, 'utf-8');
    content = content.replace('- [ ] ', '- [ ] Review results\n- [ ] Other task');
    writeFileSync(episodePath, content);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('new: creates node with positional type and slug', () => {
    const result = run('new hypothesis pos-test-hyp', dir);
    expect(result).toContain('hyp-002');
    const files = readdirSync(join(dir, 'graph', 'hypotheses'));
    expect(files.some(f => f.includes('pos-test-hyp'))).toBe(true);
  });

  it('read: reads node with positional nodeId', () => {
    const result = run('read hyp-001', dir);
    expect(result).toContain('hyp-001');
  });

  it('link: creates edge with 3 positional args', () => {
    const result = run('link hyp-001 exp-001 supports', dir);
    expect(result).toContain('Linked');
  });

  it('link: positional + optional --strength flag', () => {
    const result = run('link hyp-001 fnd-001 supports --strength 0.8', dir);
    expect(result).toContain('Linked');
  });

  it('unlink: removes edge with positional args', () => {
    const result = run('unlink hyp-001 exp-001', dir);
    expect(result.toLowerCase()).not.toMatch(/\berror\b/);
  });

  it('unlink: positional + optional --relation flag', () => {
    const result = run('unlink hyp-001 fnd-001 --relation supports', dir);
    expect(result.toLowerCase()).not.toMatch(/\berror\b/);
  });

  it('update: positional nodeId + named --set flag', () => {
    run('update hyp-001 --transitionPolicy off --set confidence=0.9', dir);
    const hypDir = join(dir, 'graph', 'hypotheses');
    const files = readdirSync(hypDir);
    const content = readFileSync(join(hypDir, files[0]), 'utf-8');
    expect(content).toContain('confidence: 0.9');
  });

  it('neighbors: positional nodeId', () => {
    // Re-link for neighbors test
    run('link hyp-001 exp-001 supports', dir);
    const result = run('neighbors hyp-001', dir);
    expect(result).toContain('exp-001');
  });

  it('neighbors: positional + optional --depth flag', () => {
    const result = run('neighbors hyp-001 --depth 2', dir);
    expect(result).toContain('exp-001');
  });

  it('done: positional episodeId and item', () => {
    run('done epi-001 "Review results"', dir);
    const episodeDir = join(dir, 'graph', 'episodes');
    const files = readdirSync(episodeDir);
    const content = readFileSync(join(episodeDir, files[0]), 'utf-8');
    expect(content).toContain('[done] Review results');
  });

  it('done: positional + optional --marker flag', () => {
    run('done epi-001 "Other task" --marker deferred', dir);
    const episodeDir = join(dir, 'graph', 'episodes');
    const files = readdirSync(episodeDir);
    const content = readFileSync(join(episodeDir, files[0]), 'utf-8');
    expect(content).toContain('[deferred] Other task');
  });

  it('new: rejects invalid enum value via positional', () => {
    const { exitCode } = runMayFail('new invalid-type my-slug', dir);
    expect(exitCode).not.toBe(0);
  });

  it('read: backward compat with --flag syntax', () => {
    const flagResult = run('read --nodeId hyp-001', dir);
    const posResult = run('read hyp-001', dir);
    expect(flagResult).toBe(posResult);
  });
});
