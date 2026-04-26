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

function runMayFail(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = run(args, cwd);
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: any) {
    // execSync throws an Error whose .stdout / .stderr buffers carry the child's
    // captured streams. Surface stderr too — the CLI writes its `Error: ...`
    // banner via console.error (stderr), so any test asserting on the error
    // message must read this stream, not stdout.
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
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

  it('--tool codex (real CLI) creates AGENTS.md and .agents/skills', async () => {
    // End-to-end: spawn the real CLI binary, not just initCommand(). Catches
    // commander wiring and option-parser regressions that unit tests miss.
    run(`init ${tmpDir} --tool codex`);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
    const agents = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8');
    expect(agents.startsWith('# EMDD')).toBe(true);
    // Pin the on-disk file to the canonical generator output. Without this,
    // any post-write transformation in generateRulesFile (a stray .replace,
    // accidental trim, BOM injection) that left "# EMDD" intact would slip
    // past the substring assertions above.
    const { getRulesContent } = await import('../../src/rules/generators.js');
    expect(agents).toBe(getRulesContent('codex', 'full'));
  });

  it('emdd doctor (real CLI) reports AGENTS.md after --tool codex init', () => {
    run(`init ${tmpDir} --tool codex`);
    const result = run(`doctor`, tmpDir);
    expect(result).toContain('AGENTS.md');
  });

  it('--tool all (real CLI) writes every tool file and prints both claude+codex MCP one-liners', () => {
    // End-to-end protection for --tool all: catches commander wiring regressions
    // (e.g., the option default getting dropped or an invalid `choices()` slipping
    // in) and proves printNextSteps walks SKILL_TOOLS to surface every first-class
    // one-liner — not just the first one. Unit tests mock printNextSteps, so this
    // is the only place the real stdout shape is verified.
    const result = run(`init ${tmpDir} --tool all`);
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'emdd.mdc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.windsurf', 'rules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.clinerules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(result).toContain('claude mcp add emdd');
    expect(result).toContain('codex mcp add emdd');
    expect(result).toContain('MCP_SETUP.md');
  });

  it('--tool <invalid> (real CLI) fails fast with a clear error and no partial init', () => {
    // Pre-fix, an invalid --tool would create graph/, print "undefined" as the
    // MCP hint, and then crash with `path argument must be string`. Validate that
    // input is rejected up-front and the project root stays clean.
    const { stdout, stderr, exitCode } = runMayFail(`init ${tmpDir} --tool nope`);
    expect(exitCode).not.toBe(0);
    // The CLI prints `Error: Invalid --tool value: "nope"...` via console.error
    // in withCliErrorHandling — that's stderr, not stdout. Assert on the
    // actual error stream, not the empty stdout that the pre-fix assertion
    // was tautologically not-containing 'undefined' on.
    expect(stderr).toContain('Invalid --tool value: "nope"');
    expect(stderr).toContain('Valid values:');
    expect(stdout).not.toContain('undefined');
    expect(existsSync(join(tmpDir, 'graph'))).toBe(false);
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
