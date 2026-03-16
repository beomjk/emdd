import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getRulesContent, generateRulesFile } from '../../../src/rules/generators.js';

// Rough token estimator: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

describe('getRulesContent', () => {
  // --- Claude ---
  it('generates Claude CLAUDE.md with EMDD header', () => {
    const content = getRulesContent('claude', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).toMatchSnapshot();
  });

  // --- Cursor ---
  it('generates Cursor .mdc with MDC frontmatter', () => {
    const content = getRulesContent('cursor', 'full');
    expect(content).toMatch(/^---\n.*description:/s);
    expect(content).toMatchSnapshot();
  });

  // --- Windsurf ---
  it('generates Windsurf .md with EMDD header', () => {
    const content = getRulesContent('windsurf', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).toMatchSnapshot();
  });

  // --- Cline ---
  it('generates Cline .md with EMDD header', () => {
    const content = getRulesContent('cline', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).toMatchSnapshot();
  });

  // --- Copilot ---
  it('generates Copilot instructions with EMDD header', () => {
    const content = getRulesContent('copilot', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).toMatchSnapshot();
  });

  // --- Compact variants ---
  it('generates compact Claude rules within 1500 token limit', () => {
    const content = getRulesContent('claude', 'compact');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThanOrEqual(1500);
    expect(content).toContain('EMDD');
    expect(content).toContain('Episode');
    expect(content).toMatchSnapshot();
  });

  it('generates compact Cursor rules within 1500 token limit', () => {
    const content = getRulesContent('cursor', 'compact');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThanOrEqual(1500);
    expect(content).toMatch(/^---\n.*description:/s);
    expect(content).toMatchSnapshot();
  });
});

describe('generateRulesFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-rules-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes claude rules to .claude/CLAUDE.md', () => {
    generateRulesFile('claude', tmpDir);
    const filePath = join(tmpDir, '.claude', 'CLAUDE.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('# EMDD');
  });

  it('writes cursor rules to .cursor/rules/emdd.mdc', () => {
    generateRulesFile('cursor', tmpDir);
    const filePath = join(tmpDir, '.cursor', 'rules', 'emdd.mdc');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/^---\n.*description:/s);
  });

  it('writes all tool files when tool=all', () => {
    generateRulesFile('all', tmpDir);
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'emdd.mdc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.windsurf', 'rules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.clinerules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
  });
});
