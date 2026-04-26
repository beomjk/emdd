import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initCommand } from '../../../src/cli/init.js';

describe('emdd init --tool', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-init-tool-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .claude/CLAUDE.md with --tool claude', () => {
    initCommand(tmpDir, { lang: 'en', tool: 'claude' });
    const filePath = join(tmpDir, '.claude', 'CLAUDE.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('EMDD');
  });

  it('creates .cursor/rules/emdd.mdc with --tool cursor', () => {
    initCommand(tmpDir, { lang: 'en', tool: 'cursor' });
    const filePath = join(tmpDir, '.cursor', 'rules', 'emdd.mdc');
    expect(existsSync(filePath)).toBe(true);
  });

  it('creates AGENTS.md and Codex skills with --tool codex', () => {
    initCommand(tmpDir, { lang: 'en', tool: 'codex' });
    const filePath = join(tmpDir, 'AGENTS.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('EMDD');
    expect(content).toContain('Codex skills');
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
  });

  it('creates all tool files with --tool all', () => {
    initCommand(tmpDir, { lang: 'en', tool: 'all' });
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'emdd.mdc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.windsurf', 'rules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.clinerules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
    // Every skill-capable tool must get its skill dir in the --tool all flow,
    // not just the last one iterated. Guards against a regression that drops
    // Claude skill emission while keeping Codex (or vice versa).
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
  });

  it('defaults to claude when --tool is omitted (rules + skills both emitted)', () => {
    initCommand(tmpDir, { lang: 'en' });
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    // Default flow must also emit Claude skill files, not just the rules file —
    // a regression where only rules but no skills are emitted would silently
    // break the /emdd-open and /emdd-close shortcuts in Claude Code.
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
  });

  it('--force --tool all overwrites every existing rules and skill file', () => {
    // Pre-seed sentinel content in every file the --tool all flow writes. After
    // running with `force: true`, none of these sentinels may survive — both
    // skill roots (.claude/skills + .agents/skills) must be overwritten, not
    // just the rules files. Guards against `force` being dropped on the path
    // through the all-branch skill loop.
    const sentinel = 'SENTINEL-PRE-EXISTING-CONTENT';
    const seed = (rel: string) => {
      mkdirSync(join(tmpDir, ...rel.split('/').slice(0, -1)), { recursive: true });
      writeFileSync(join(tmpDir, rel), sentinel);
    };
    seed('.claude/CLAUDE.md');
    seed('AGENTS.md');
    seed('.cursor/rules/emdd.mdc');
    seed('.windsurf/rules/emdd.md');
    seed('.clinerules/emdd.md');
    seed('.github/copilot-instructions.md');
    seed('.claude/skills/emdd-open/SKILL.md');
    seed('.claude/skills/emdd-close/SKILL.md');
    seed('.agents/skills/emdd-open/SKILL.md');
    seed('.agents/skills/emdd-close/SKILL.md');

    initCommand(tmpDir, { lang: 'en', tool: 'all', force: true });

    const checks = [
      '.claude/CLAUDE.md',
      'AGENTS.md',
      '.cursor/rules/emdd.mdc',
      '.windsurf/rules/emdd.md',
      '.clinerules/emdd.md',
      '.github/copilot-instructions.md',
      '.claude/skills/emdd-open/SKILL.md',
      '.claude/skills/emdd-close/SKILL.md',
      '.agents/skills/emdd-open/SKILL.md',
      '.agents/skills/emdd-close/SKILL.md',
    ];
    for (const rel of checks) {
      const body = readFileSync(join(tmpDir, rel), 'utf-8');
      expect(body, `expected ${rel} to be overwritten by --force`).not.toContain(sentinel);
    }
  });

  it('warns when target file already exists', () => {
    // Create the file first
    mkdirSync(join(tmpDir, '.claude'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'existing content');

    const consoleSpy = vi.spyOn(console, 'log');
    initCommand(tmpDir, { lang: 'en', tool: 'claude' });

    const logged = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    // Tighten to the actual "Skipped (already exists): .claude/CLAUDE.md" message.
    // The previous regex /exist|skip|already/i also matched the unrelated
    // "already initialized" banner, so a regression that dropped the per-file
    // Skipped log would still pass — pin the file path here to close that gap.
    expect(logged).toMatch(/Skipped.*\.claude.CLAUDE\.md/);
    consoleSpy.mockRestore();
  });

  it('preserves existing AGENTS.md without --force for --tool codex', () => {
    // AGENTS.md lives at project root and may be a user's hand-authored file.
    // Running `--tool codex` must skip, not overwrite, unless --force is set.
    const existing = '# My Project Agents\nHand-authored content.\n';
    writeFileSync(join(tmpDir, 'AGENTS.md'), existing);

    const consoleSpy = vi.spyOn(console, 'log');
    initCommand(tmpDir, { lang: 'en', tool: 'codex' });

    expect(readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')).toBe(existing);
    const logged = consoleSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logged).toMatch(/Skipped.*AGENTS\.md/);
    consoleSpy.mockRestore();
  });

  it('generates valid MDC frontmatter for cursor', () => {
    initCommand(tmpDir, { lang: 'en', tool: 'cursor' });
    const filePath = join(tmpDir, '.cursor', 'rules', 'emdd.mdc');
    const content = readFileSync(filePath, 'utf-8');
    // MDC frontmatter must start with --- and contain description field
    expect(content).toMatch(/^---\n/);
    expect(content).toMatch(/description:/);
    // Must have closing ---
    const parts = content.split('---');
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });
});
