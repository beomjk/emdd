import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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

describe('emdd init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates graph/ directory with 7 subdirectories', () => {
    run(`init ${tmpDir}`);
    expect(existsSync(join(tmpDir, 'graph'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'hypotheses'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'experiments'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'findings'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'knowledge'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'questions'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'decisions'))).toBe(true);
    expect(existsSync(join(tmpDir, 'graph', 'episodes'))).toBe(true);
  });

  it('creates .emdd.yml config file', () => {
    run(`init ${tmpDir}`);
    expect(existsSync(join(tmpDir, '.emdd.yml'))).toBe(true);
  });

  it('applies --lang ko option to config', () => {
    run(`init ${tmpDir} --lang ko`);
    const config = readFileSync(join(tmpDir, '.emdd.yml'), 'utf-8');
    expect(config).toContain('lang: ko');
  });

  it('warns when project is already initialized', () => {
    run(`init ${tmpDir}`);
    const result = run(`init ${tmpDir}`);
    expect(result.toLowerCase()).toMatch(/already|exist/);
  });
});

describe('emdd new', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a hypothesis node file', () => {
    run(`new --type hypothesis --slug test-hyp`, tmpDir);
    const files = readdirSync(join(tmpDir, 'graph', 'hypotheses'));
    expect(files.some(f => f.includes('hyp-001'))).toBe(true);
  });

  it('returns error for invalid type', () => {
    const { exitCode } = runMayFail(`new --type invalid-type --slug test`, tmpDir);
    expect(exitCode).not.toBe(0);
  });

  it('increments ID on consecutive creation', () => {
    run(`new --type hypothesis --slug first`, tmpDir);
    run(`new --type hypothesis --slug second`, tmpDir);
    const files = readdirSync(join(tmpDir, 'graph', 'hypotheses'));
    expect(files.some(f => f.includes('hyp-002'))).toBe(true);
  });

  it('prints creation message', () => {
    const result = run(`new --type hypothesis --slug test-hyp`, tmpDir);
    expect(result).toMatch(/hyp-001/);
  });
});

describe('emdd lint', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns exit code 0 for valid graph', () => {
    run(`new --type hypothesis --slug test`, tmpDir);
    const { exitCode } = runMayFail(`lint`, tmpDir);
    expect(exitCode).toBe(0);
  });

  it('prints no-error message for valid graph', () => {
    run(`new --type hypothesis --slug test`, tmpDir);
    const result = run(`lint`, tmpDir);
    expect(result.toLowerCase()).toMatch(/valid|clean|no.*error/);
  });
});

describe('emdd health', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-test-'));
    run(`init ${tmpDir}`);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prints health dashboard', () => {
    run(`new --type hypothesis --slug test`, tmpDir);
    const result = run(`health`, tmpDir);
    expect(result.toLowerCase()).toContain('health');
  });

  it('displays node count', () => {
    run(`new --type hypothesis --slug test1`, tmpDir);
    run(`new --type experiment --slug test2`, tmpDir);
    const result = run(`health`, tmpDir);
    // Should show node counts
    expect(result).toMatch(/[12]/);
  });
});
