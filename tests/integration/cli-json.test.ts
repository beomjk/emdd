import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI = `${PROJECT_ROOT}/node_modules/.bin/tsx ${PROJECT_ROOT}/src/cli.ts`;

function run(args: string, cwd: string): string {
  return execSync(`${CLI} ${args}`, {
    encoding: 'utf-8',
    cwd,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

function runMayFail(args: string, cwd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = run(args, cwd);
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
  }
}

describe('CLI --json output mode', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'emdd-json-'));
    run(`init ${dir}`, PROJECT_ROOT);
    run(`new --type hypothesis --slug test-hyp`, dir);
    run(`new --type experiment --slug test-exp`, dir);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('list --json returns valid JSON array', () => {
    const output = run('list --json', dir);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty('id');
    expect(parsed[0]).toHaveProperty('type');
  });

  it('health --json returns valid JSON object', () => {
    const output = run('health --json', dir);
    const parsed = JSON.parse(output);
    expect(typeof parsed).toBe('object');
    expect(parsed).toHaveProperty('totalNodes');
    expect(parsed).toHaveProperty('totalEdges');
  });

  it('read --json returns valid JSON object', () => {
    const output = run('read --nodeId hyp-001 --json', dir);
    const parsed = JSON.parse(output);
    expect(typeof parsed).toBe('object');
    expect(parsed).toHaveProperty('id', 'hyp-001');
    expect(parsed).toHaveProperty('type', 'hypothesis');
  });

  it('error with --json returns JSON error object and exit code 1', () => {
    const { stdout, exitCode } = runMayFail('read --nodeId nonexistent-999 --json', dir);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('error');
    expect(typeof parsed.error).toBe('string');
  });

  // T057: verify non-json format output for representative commands
  it('list without --json returns formatted text (not JSON)', () => {
    const output = run('list', dir);
    expect(() => JSON.parse(output)).toThrow();
    expect(output).toContain('hyp-001');
  });

  it('health without --json returns formatted text', () => {
    const output = run('health', dir);
    expect(() => JSON.parse(output)).toThrow();
    expect(output.toLowerCase()).toContain('health');
  });

  it('check without --json returns formatted text', () => {
    const output = run('check', dir);
    expect(() => JSON.parse(output)).toThrow();
  });
});
