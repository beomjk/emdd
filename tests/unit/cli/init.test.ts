import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock generators to avoid side effects
vi.mock('../../../src/rules/generators.js', () => ({
  generateRulesFile: vi.fn(() => ({ created: [], skipped: [] })),
  generateSkillFiles: vi.fn(() => ({ created: ['skills/emdd-open/SKILL.md', 'skills/emdd-close/SKILL.md'], skipped: [] })),
}));

import { initCommand } from '../../../src/cli/init.js';
import { generateSkillFiles } from '../../../src/rules/generators.js';
import { setLocale } from '../../../src/i18n/index.js';

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

  it('does not call generateSkillFiles for non-claude tools', () => {
    const target = path.join(tmpDir, 'proj-skills-cursor');
    (generateSkillFiles as ReturnType<typeof vi.fn>).mockClear();
    initCommand(target, { tool: 'cursor' });
    expect(generateSkillFiles).not.toHaveBeenCalled();
  });
});
