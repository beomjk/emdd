import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock generators to avoid side effects.
// Keep the mocked `isValidTool` predicate aligned with the real ToolType union;
// initCommand validates input through it before any FS work, so the mock must
// accept every concrete tool plus 'all' or unrelated unit tests would throw.
const VALID_TOOL_VALUES = new Set(['claude', 'codex', 'cursor', 'windsurf', 'cline', 'copilot', 'all']);
vi.mock('../../../src/rules/generators.js', () => ({
  generateRulesFile: vi.fn(() => ({ created: [], skipped: [] })),
  generateSkillFiles: vi.fn(() => ({ created: ['skills/emdd-open/SKILL.md', 'skills/emdd-close/SKILL.md'], skipped: [] })),
  SKILL_TOOLS: ['claude', 'codex'] as const,
  toolSupportsSkills: (tool: string) => tool === 'claude' || tool === 'codex',
  isValidTool: (value: string) => VALID_TOOL_VALUES.has(value),
  getToolEnumerationString: (sep = '|') => ['claude', 'codex', 'cursor', 'windsurf', 'cline', 'copilot', 'all'].join(sep),
}));

import { initCommand } from '../../../src/cli/init.js';
import { generateSkillFiles } from '../../../src/rules/generators.js';
import { setLocale } from '../../../src/i18n/index.js';

// Pin the mock against the real module surface. If SkillToolType / SKILL_TOOLS
// drifts (e.g. a 3rd skill-capable tool is added), the assertions below fail
// here so the mock factory above is updated in lockstep — without this, the
// init mock could silently keep stale literals while every other test passes.
describe('init.test.ts mock vs real generators surface', () => {
  it('mocked SKILL_TOOLS matches the real module export', async () => {
    const real = await vi.importActual<typeof import('../../../src/rules/generators.js')>(
      '../../../src/rules/generators.js',
    );
    const mocked = await import('../../../src/rules/generators.js');
    expect([...mocked.SKILL_TOOLS]).toEqual([...real.SKILL_TOOLS]);
  });

  it('mocked toolSupportsSkills agrees with the real predicate for every ToolType value', async () => {
    const real = await vi.importActual<typeof import('../../../src/rules/generators.js')>(
      '../../../src/rules/generators.js',
    );
    const mocked = await import('../../../src/rules/generators.js');
    // Iterate the real registry rather than a hardcoded list — if a 7th tool is
    // added to TOOL_PATHS, it flows through automatically and a missing mock
    // entry fails here instead of being silently skipped.
    for (const t of Object.keys(real.TOOL_PATHS) as Array<keyof typeof real.TOOL_PATHS>) {
      expect(mocked.toolSupportsSkills(t)).toBe(real.toolSupportsSkills(t));
    }
  });

  it('mocked isValidTool agrees with the real predicate for every concrete tool, "all", and a sample bogus value', async () => {
    const real = await vi.importActual<typeof import('../../../src/rules/generators.js')>(
      '../../../src/rules/generators.js',
    );
    const mocked = await import('../../../src/rules/generators.js');
    const tools: string[] = [...Object.keys(real.TOOL_PATHS), 'all', 'bogus'];
    for (const t of tools) {
      expect(mocked.isValidTool(t)).toBe(real.isValidTool(t));
    }
  });
});

// initCommand validates --tool BEFORE any FS work and throws on bogus input.
// Without a unit-level test, this contract is only verified through a real-CLI
// integration test, which is slow and only checks exit code / absence of a
// generic 'undefined' substring. A direct test here pins the throw, the error
// message format, and (crucially) that no side-effects run.
describe('initCommand validates --tool up front', () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-init-invalid-tool-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLocale('en');
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws a descriptive error when --tool is not in the accepted enumeration', () => {
    const target = path.join(tmpDir, 'proj-bogus');
    expect(() => initCommand(target, { tool: 'nope' })).toThrow(/Invalid --tool value: "nope"/);
    // Error message must include the accepted enumeration so the user sees the
    // valid options inline (mirrors the CLI help text).
    expect(() => initCommand(target, { tool: 'nope' })).toThrow(/Valid values: claude, codex/);
  });

  it('does not create graph/ when --tool is invalid (no partial init)', () => {
    const target = path.join(tmpDir, 'proj-no-graph');
    expect(() => initCommand(target, { tool: 'nope' })).toThrow();
    expect(fs.existsSync(path.join(target, 'graph'))).toBe(false);
  });

  it('does not call generateRulesFile when --tool is invalid', async () => {
    const { generateRulesFile } = await import('../../../src/rules/generators.js');
    (generateRulesFile as ReturnType<typeof vi.fn>).mockClear();
    const target = path.join(tmpDir, 'proj-no-rules');
    expect(() => initCommand(target, { tool: 'nope' })).toThrow();
    expect(generateRulesFile).not.toHaveBeenCalled();
  });
});

describe('initCommand next steps output', () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-init-test-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLocale('en');
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prints "recommended" and claude MCP command for default tool', () => {
    const target = path.join(tmpDir, 'proj');
    initCommand(target, {});
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('recommended');
    expect(output).toContain('claude mcp add emdd');
  });

  it('prints tool-specific MCP hint for cursor', () => {
    const target = path.join(tmpDir, 'proj2');
    initCommand(target, { tool: 'cursor' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('.cursor/mcp.json');
  });

  it('prints MCP docs link for --tool all', () => {
    const target = path.join(tmpDir, 'proj3');
    initCommand(target, { tool: 'all' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('MCP_SETUP.md');
  });

  it('does not print MCP docs link for specific tool', () => {
    const target = path.join(tmpDir, 'proj4');
    initCommand(target, { tool: 'claude' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).not.toContain('MCP_SETUP.md');
  });

  it('prints copilot MCP hint for copilot tool', () => {
    const target = path.join(tmpDir, 'proj5');
    initCommand(target, { tool: 'copilot' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('.vscode/mcp.json');
  });

  it('prints codex MCP add command for codex tool', () => {
    const target = path.join(tmpDir, 'proj-codex');
    initCommand(target, { tool: 'codex' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('codex mcp add emdd -- npx @beomjk/emdd mcp');
  });

  it('calls generateSkillFiles for --tool claude', () => {
    const target = path.join(tmpDir, 'proj-skills');
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
    initCommand(target, { tool: 'claude' });
    expect(generateSkillFiles).toHaveBeenCalledWith(target, { force: undefined, tool: 'claude' });
  });

  it('calls generateSkillFiles for --tool codex', () => {
    const target = path.join(tmpDir, 'proj-skills-codex');
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
    initCommand(target, { tool: 'codex' });
    expect(generateSkillFiles).toHaveBeenCalledWith(target, { force: undefined, tool: 'codex' });
  });

  it('calls generateSkillFiles for claude and codex with --tool all', () => {
    const target = path.join(tmpDir, 'proj-skills-all');
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
    initCommand(target, { tool: 'all' });
    expect(generateSkillFiles).toHaveBeenCalledWith(target, { force: undefined, tool: 'claude' });
    expect(generateSkillFiles).toHaveBeenCalledWith(target, { force: undefined, tool: 'codex' });
  });

  it('calls generateSkillFiles for default tool (no --tool flag)', () => {
    const target = path.join(tmpDir, 'proj-skills-default');
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
    initCommand(target, {});
    expect(generateSkillFiles).toHaveBeenCalledWith(target, { force: undefined, tool: 'claude' });
  });

  it('does not call generateSkillFiles for tools without skill support', () => {
    // Skill-capable tools are claude + codex (see SKILL_TOOLS); every other
    // entry in TOOL_PATHS must NOT trigger generateSkillFiles.
    for (const nonSkillTool of ['cursor', 'windsurf', 'cline', 'copilot'] as const) {
      const target = path.join(tmpDir, `proj-skills-${nonSkillTool}`);
      (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
      initCommand(target, { tool: nonSkillTool });
      expect(generateSkillFiles).not.toHaveBeenCalled();
    }
  });

  it('prints both claude and codex MCP hints for --tool all', () => {
    // --tool all writes both .claude/CLAUDE.md and AGENTS.md and both
    // assistants have a first-class one-liner; the next-steps banner must
    // surface both, not silently fall back to only one.
    const target = path.join(tmpDir, 'proj-all-hints');
    initCommand(target, { tool: 'all' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('claude mcp add emdd');
    expect(output).toContain('codex mcp add emdd');
  });

  it('prints windsurf MCP-add hint for --tool windsurf', () => {
    // The MCP_SETUP_HINTS table holds a multi-line entry for every tool; if a
    // future regression replaced an entry with an empty string (TS would still
    // type-check), the banner would print blank lines silently. Pin the
    // distinctive prose for the non-skill tools that don't have a one-liner.
    const target = path.join(tmpDir, 'proj-windsurf');
    initCommand(target, { tool: 'windsurf' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Windsurf MCP settings');
  });

  it('prints cline MCP-add hint for --tool cline', () => {
    const target = path.join(tmpDir, 'proj-cline');
    initCommand(target, { tool: 'cline' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('.continue/config.yaml');
  });

  it('prints next-steps banner when a new tool is added to an existing project', () => {
    // Re-running `emdd init` with a different --tool on an existing project
    // must surface the new tool's MCP-add hint. Pre-fix, printNextSteps was
    // gated on `!fs.existsSync(graphDir)` so the banner was silently dropped on
    // re-init, leaving the second tool installed but unconfigured.
    const target = path.join(tmpDir, 'proj-incremental');
    initCommand(target, { tool: 'claude' }); // creates graph/ and .claude/
    logSpy.mockClear();
    initCommand(target, { tool: 'codex' }); // graph/ already exists; AGENTS.md is new
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('codex mcp add emdd');
  });

  it('does not print next-steps banner on a no-op re-run (everything already in place)', () => {
    // Pure no-op re-runs (same tool, all files exist) should NOT spam the
    // banner. Only when at least one rules/skill file was actually written.
    // Simulate the no-op via the mocks: both generators report nothing created
    // (the real code achieves the same via fs.existsSync skipping writes).
    const target = path.join(tmpDir, 'proj-noop');
    initCommand(target, { tool: 'claude' });
    logSpy.mockClear();
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      created: [],
      skipped: ['.claude/skills/emdd-open/SKILL.md', '.claude/skills/emdd-close/SKILL.md'],
    });
    initCommand(target, { tool: 'claude' });
    const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).not.toContain('claude mcp add emdd');
  });
});
