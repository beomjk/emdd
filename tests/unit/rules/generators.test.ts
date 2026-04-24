import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getRulesContent,
  generateRulesFile,
  getSkillContent,
  generateSkillFiles,
  replaceOrThrow,
  SKILL_TOOLS,
  toolSupportsSkills,
  TOOL_PATHS,
  EMDD_RULES_MARKER,
} from '../../../src/rules/generators.js';
import { NODE_TYPES, NODE_TYPE_DIRS, ID_PREFIXES, EDGE_TYPES, CEREMONY_TRIGGERS } from '../../../src/graph/types.js';

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
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Cursor ---
  it('generates Cursor .mdc with MDC frontmatter', () => {
    const content = getRulesContent('cursor', 'full');
    expect(content).toMatch(/^---\n.*description:/s);
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Windsurf ---
  it('generates Windsurf .md with EMDD header', () => {
    const content = getRulesContent('windsurf', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Cline ---
  it('generates Cline .md with EMDD header', () => {
    const content = getRulesContent('cline', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Copilot ---
  it('generates Copilot instructions with EMDD header', () => {
    const content = getRulesContent('copilot', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Codex ---
  it('generates Codex AGENTS.md with EMDD header and Codex skill guidance', () => {
    const content = getRulesContent('codex', 'full');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Episode');
    expect(content).toContain('Consolidation');
    expect(content).toContain('Codex skills: `emdd-open`');
    expect(content).not.toContain('Claude Code shortcuts');
    // All three Claude-specific phrasings must be adapted — not just the first.
    expect(content).not.toContain('(or `/emdd-open`)');
    expect(content).not.toContain('via `/emdd-close`');
    expect(content).toContain('(or the `emdd-open` skill)');
    expect(content).toContain('via the `emdd-close` skill');
    expect(content).toMatchSnapshot();
  });

  // --- Compact variants ---
  it('generates compact Claude rules within 1500 token limit', () => {
    const content = getRulesContent('claude', 'compact');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThanOrEqual(1500);
    expect(content).toContain('EMDD');
    expect(content).toContain('Episode');
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  it('generates compact Cursor rules within 1500 token limit', () => {
    const content = getRulesContent('cursor', 'compact');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThanOrEqual(1500);
    expect(content).toMatch(/^---\n.*description:/s);
    expect(content).not.toContain('Codex skills:');
    expect(content).toMatchSnapshot();
  });

  // --- Guard: 'all' is not a concrete tool ---
  it("throws when tool='all' is passed to getRulesContent", () => {
    expect(() => getRulesContent('all', 'full')).toThrow(/not a concrete tool/);
    expect(() => getRulesContent('all', 'compact')).toThrow(/not a concrete tool/);
  });

  it('generates compact Codex rules within 1500 token limit', () => {
    const content = getRulesContent('codex', 'compact');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThanOrEqual(1500);
    expect(content).toContain('EMDD');
    expect(content).toContain('Codex skills: `emdd-open`');
    expect(content).not.toContain('Claude Code shortcuts');
    expect(content).toMatchSnapshot();
  });

  // --- Schema-derived content assertions (T043a) ---

  describe('schema-derived content', () => {
    const fullContent = getRulesContent('claude', 'full');
    const compactContent = getRulesContent('claude', 'compact');

    it('full rules contain all NODE_TYPES entries', () => {
      const lower = fullContent.toLowerCase();
      for (const t of NODE_TYPES) {
        expect(lower).toContain(t);
      }
    });

    it('compact rules contain all NODE_TYPES entries', () => {
      const lower = compactContent.toLowerCase();
      for (const t of NODE_TYPES) {
        expect(lower).toContain(t);
      }
    });

    it('full rules contain all NODE_TYPE_DIRS values', () => {
      for (const dir of Object.values(NODE_TYPE_DIRS)) {
        expect(fullContent).toContain(dir);
      }
    });

    it('compact rules contain all NODE_TYPE_DIRS values', () => {
      for (const dir of Object.values(NODE_TYPE_DIRS)) {
        expect(compactContent).toContain(dir);
      }
    });

    it('full rules contain all ID_PREFIXES values', () => {
      for (const prefix of Object.values(ID_PREFIXES)) {
        expect(fullContent).toContain(prefix);
      }
    });

    it('compact rules contain all ID_PREFIXES values', () => {
      for (const prefix of Object.values(ID_PREFIXES)) {
        expect(compactContent).toContain(prefix);
      }
    });

    it('full rules content includes all forward edge types', () => {
      for (const edgeType of EDGE_TYPES) {
        expect(fullContent).toContain(edgeType);
      }
    });

    it('full rules content includes CEREMONY_TRIGGERS threshold values', () => {
      const triggers = CEREMONY_TRIGGERS.consolidation;
      expect(fullContent).toContain(String(triggers.unpromoted_findings_threshold));
      expect(fullContent).toContain(String(triggers.episodes_threshold));
      expect(fullContent).toContain(String(triggers.experiment_overload_threshold));
    });
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

  it('writes codex rules to AGENTS.md', () => {
    generateRulesFile('codex', tmpDir);
    const filePath = join(tmpDir, 'AGENTS.md');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('# EMDD');
    expect(content).toContain('Codex skills');
  });

  it('skips existing file when force is false', () => {
    generateRulesFile('claude', tmpDir);
    const result = generateRulesFile('claude', tmpDir);
    expect(result.skipped).toContain('.claude/CLAUDE.md');
    expect(result.created).toEqual([]);
  });

  it('overwrites existing file when force is true', () => {
    generateRulesFile('claude', tmpDir);
    const result = generateRulesFile('claude', tmpDir, { force: true });
    expect(result.created).toContain('.claude/CLAUDE.md');
    expect(result.skipped).toEqual([]);
  });

  it('writes all tool files when tool=all', () => {
    generateRulesFile('all', tmpDir);
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'emdd.mdc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.windsurf', 'rules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.clinerules', 'emdd.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true);
  });
});

describe('getSkillContent', () => {
  it('generates emdd-open skill with valid YAML frontmatter', () => {
    const content = getSkillContent('emdd-open');
    expect(content).toMatch(/^---\nname: emdd-open\n/);
    expect(content).toContain('description:');
    expect(content).toContain('---');
  });

  it('emdd-open skill references context-loading MCP prompt', () => {
    const content = getSkillContent('emdd-open');
    expect(content).toContain('context-loading');
  });

  it('generates emdd-close skill with valid YAML frontmatter', () => {
    const content = getSkillContent('emdd-close');
    expect(content).toMatch(/^---\nname: emdd-close\n/);
    expect(content).toContain('description:');
  });

  it('emdd-close skill references all closing prompts', () => {
    const content = getSkillContent('emdd-close');
    expect(content).toContain('episode-creation');
    expect(content).toContain('consolidation');
    expect(content).toContain('health-review');
  });

  it('throws for unknown skill name', () => {
    expect(() => getSkillContent('unknown' as any)).toThrow();
  });

  it('emdd-open skill content matches snapshot', () => {
    expect(getSkillContent('emdd-open')).toMatchSnapshot();
  });

  it('emdd-close skill content matches snapshot', () => {
    expect(getSkillContent('emdd-close')).toMatchSnapshot();
  });
});

describe('replaceOrThrow', () => {
  it('replaces when the search string is present', () => {
    expect(replaceOrThrow('hello world', 'world', 'there')).toBe('hello there');
  });

  it('throws when the search string is absent (drift guard)', () => {
    expect(() => replaceOrThrow('hello world', 'missing', 'x')).toThrow(/emdd-agent\.md/);
  });

  it('surfaces both head and tail of long search strings in the error (tail drift diagnostic)', () => {
    const head = 'BEGIN-SENTINEL-' + 'a'.repeat(80);
    const tail = 'b'.repeat(80) + '-END-SENTINEL';
    const longSearch = `${head}-MIDDLE-${tail}`;
    expect(() => replaceOrThrow('unrelated content', longSearch, 'x')).toThrow(/BEGIN-SENTINEL.*END-SENTINEL/s);
  });
});

// Pin the real module surface so test mocks (e.g. tests/unit/cli/init.test.ts's
// vi.mock factory) can't silently drift from the exported values. If SkillToolType
// gains a new member, these assertions fail and flag the mock for update.
describe('SKILL_TOOLS / toolSupportsSkills (real module surface)', () => {
  it('SKILL_TOOLS matches the expected set exactly', () => {
    expect([...SKILL_TOOLS]).toEqual(['claude', 'codex']);
  });

  it('toolSupportsSkills returns true for every entry in SKILL_TOOLS and false otherwise', () => {
    for (const t of SKILL_TOOLS) {
      expect(toolSupportsSkills(t)).toBe(true);
    }
    for (const t of ['cursor', 'windsurf', 'cline', 'copilot'] as const) {
      expect(toolSupportsSkills(t)).toBe(false);
    }
  });

  it('every SKILL_TOOLS entry is present in TOOL_PATHS', () => {
    for (const t of SKILL_TOOLS) {
      expect(TOOL_PATHS[t]).toBeDefined();
    }
  });
});

// Pin the EMDD_RULES_MARKER so doctor's content check and the generator output stay in sync.
describe('EMDD_RULES_MARKER', () => {
  it('appears at the start of every generated rules file (full variant)', () => {
    for (const t of ['claude', 'codex', 'windsurf', 'cline', 'copilot'] as const) {
      expect(getRulesContent(t, 'full').startsWith(EMDD_RULES_MARKER)).toBe(true);
    }
  });

  it('appears at the start of every generated rules file (compact variant)', () => {
    for (const t of ['claude', 'codex', 'windsurf', 'cline', 'copilot'] as const) {
      expect(getRulesContent(t, 'compact').startsWith(EMDD_RULES_MARKER)).toBe(true);
    }
  });
});

describe('generateSkillFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-skills-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates emdd-open and emdd-close skill directories', () => {
    const result = generateSkillFiles(tmpDir);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
    expect(result.created).toHaveLength(2);
  });

  it('creates Codex emdd-open and emdd-close skill directories', () => {
    const result = generateSkillFiles(tmpDir, { tool: 'codex' });
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.agents', 'skills', 'emdd-close', 'SKILL.md'))).toBe(true);
    expect(result.created).toEqual([
      join('.agents', 'skills', 'emdd-open', 'SKILL.md'),
      join('.agents', 'skills', 'emdd-close', 'SKILL.md'),
    ]);
  });

  it('skips existing Codex skill files when force is false', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const result = generateSkillFiles(tmpDir, { tool: 'codex' });
    expect(result.skipped).toHaveLength(2);
    expect(result.created).toHaveLength(0);
  });

  it('overwrites existing Codex skill files when force is true', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const result = generateSkillFiles(tmpDir, { tool: 'codex', force: true });
    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it('skill files start with valid YAML frontmatter', () => {
    generateSkillFiles(tmpDir);
    const open = readFileSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'), 'utf-8');
    const close = readFileSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'SKILL.md'), 'utf-8');
    expect(open).toMatch(/^---\nname: emdd-open\n/);
    expect(close).toMatch(/^---\nname: emdd-close\n/);
  });

  it('skips existing files when force is false', () => {
    generateSkillFiles(tmpDir);
    const result = generateSkillFiles(tmpDir);
    expect(result.skipped).toHaveLength(2);
    expect(result.created).toHaveLength(0);
  });

  it('overwrites existing files when force is true', () => {
    generateSkillFiles(tmpDir);
    const result = generateSkillFiles(tmpDir, { force: true });
    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });
});
