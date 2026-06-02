import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  getRulesContent,
  generateRulesFile,
  getSkillContent,
  generateSkillFiles,
  getCodexSkillPolicy,
  replaceOrThrow,
  SKILL_TOOLS,
  toolSupportsSkills,
  TOOL_PATHS,
  EMDD_RULES_MARKER,
  getToolEnumerationString,
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
    // Lead-in is bolded for visual parity with the Claude variant.
    expect(content).toContain('**Codex skills:** `emdd-open`');
    expect(content).not.toContain('Claude Code shortcuts');
    // All Claude-specific phrasings must be adapted — not just the first.
    expect(content).not.toContain('(or `/emdd-open`)');
    expect(content).not.toContain('via `/emdd-close`');
    expect(content).toContain('via the `emdd-close` skill');
    // Step 1: Codex cannot invoke MCP prompts (openai/codex#5059), so the
    // primary "Run the `context-loading` prompt" directive must be rewritten to
    // the skill — not left with the prompt as primary and the skill as a
    // parenthetical fallback. Without this, the rules file (loaded as agent
    // context every session) contradicts the SKILL.md disclaimer.
    expect(content).not.toContain('Run the `context-loading` prompt');
    expect(content).toContain('Run the `emdd-open` skill');
    // Steps 3-5 must redirect to the `emdd-close` skill — same reason.
    expect(content).not.toContain('Run the `episode-creation` prompt');
    expect(content).not.toContain('Run the `consolidation` prompt');
    expect(content).not.toContain('Run the `health-review` prompt');
    expect(content).toContain('Run the `emdd-close` skill (Episode step)');
    expect(content).toContain('Run the `emdd-close` skill (Consolidation step)');
    expect(content).toContain('Run the `emdd-close` skill (Health Review step)');
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
    // Compact Session Cycle line must redirect to skills, not MCP prompts —
    // Codex cannot invoke MCP prompts (openai/codex#5059).
    expect(content).not.toContain('Use MCP prompts in order');
    expect(content).toContain('`emdd-open` skill at session start');
    expect(content).toContain('`emdd-close` skill at session end');
    expect(content).toMatchSnapshot();
  });

  it('Codex rules tell the agent not to auto-run emdd-close (user-driven close)', () => {
    // C half of the auto-run fix: the always-on rules context must agree with the
    // pinned allow_implicit_invocation:false policy — close is pull, not push.
    const full = getRulesContent('codex', 'full');
    expect(full).toContain('do not auto-run it just because work appears finished');
    expect(full).toContain('$emdd-close');

    const compact = getRulesContent('codex', 'compact');
    expect(compact).toContain('do not auto-run `emdd-close`');

    // Claude rules must NOT carry the Codex-specific guard or `$` invocation syntax.
    const claudeFull = getRulesContent('claude', 'full');
    expect(claudeFull).not.toContain('$emdd-close');
    expect(claudeFull).not.toContain('do not auto-run');
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

// Each Codex-targeted replaceOrThrow search string in adaptAgentMarkdownForTool
// must appear EXACTLY ONCE in emdd-agent.md. replaceOrThrow uses indexOf, which
// only rewrites the first occurrence — if a future edit duplicates one of these
// strings, the second copy stays in the original Claude phrasing and Codex
// AGENTS.md ships half-adapted with no error. This test pins uniqueness so the
// regression fails loudly rather than slipping past the drift guard.
describe('emdd-agent.md uniqueness invariant for Codex drift guard', () => {
  it('every Codex replacement search string appears exactly once in emdd-agent.md', () => {
    // src is one level above tests/unit/rules; resolve relative to this test file.
    const agentMdPath = join(__dirname, '..', '..', '..', 'src', 'rules', 'emdd-agent.md');
    const agentMd = readFileSync(agentMdPath, 'utf-8');
    // Mirrors the exact strings passed to replaceOrThrow inside
    // adaptAgentMarkdownForTool. Keep this list in sync if those calls change.
    const searchStrings = [
      '**Claude Code shortcuts:** `/emdd-open` (Session Start) and `/emdd-close` (Session End + Maintenance + Review).',
      'Run the `context-loading` prompt (or `/emdd-open`).',
      'via `/emdd-close`',
      'Run the `episode-creation` prompt.',
      'Run the `consolidation` prompt every close.',
      'Run the `health-review` prompt periodically',
    ];
    for (const s of searchStrings) {
      const occurrences = agentMd.split(s).length - 1;
      const preview = s.length > 60 ? `${s.slice(0, 30)}…${s.slice(-20)}` : s;
      expect(occurrences, `Expected exactly 1 occurrence of "${preview}" in emdd-agent.md`).toBe(1);
    }
  });
});

describe('replaceOrThrow', () => {
  it('replaces when the search string is present', () => {
    expect(replaceOrThrow('hello world', 'world', 'there')).toBe('hello there');
  });

  it('throws when the search string is absent (drift guard)', () => {
    expect(() => replaceOrThrow('hello world', 'missing', 'x')).toThrow(/emdd-agent\.md/);
  });

  it('throws on empty search string (degenerate input)', () => {
    // String.prototype.replace('') silently prepends; we want a hard failure instead.
    expect(() => replaceOrThrow('any content', '', 'x')).toThrow(/non-empty/);
  });

  it('treats $-bearing replacements literally (no regex-style $& / $1 expansion)', () => {
    // String.prototype.replace would interpret these tokens; replaceOrThrow must not.
    expect(replaceOrThrow('foo bar', 'bar', '$&')).toBe('foo $&');
    expect(replaceOrThrow('foo bar', 'bar', "$'")).toBe("foo $'");
    expect(replaceOrThrow('foo bar', 'bar', '$1')).toBe('foo $1');
    expect(replaceOrThrow('foo bar', 'bar', '$$')).toBe('foo $$');
  });

  it('replaces only the first occurrence (deterministic indexOf-based splicing)', () => {
    expect(replaceOrThrow('a b a b', 'a', 'X')).toBe('X b a b');
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

  it('cursor wraps in MDC frontmatter so it does NOT startsWith the marker (designed exemption)', () => {
    // Doctor's `contentCheck` is intentionally only applied to AGENTS.md — cursor
    // is excluded because wrapForCursor prepends a `---` frontmatter block. This
    // test pins that documented design choice; if wrapForCursor changes, this
    // test fires and forces a re-evaluation of doctor's TOOL_RULES entries.
    for (const variant of ['full', 'compact'] as const) {
      const cursor = getRulesContent('cursor', variant);
      expect(cursor.startsWith('---')).toBe(true);
      expect(cursor.startsWith(EMDD_RULES_MARKER)).toBe(false);
      // The marker still appears later in the body.
      expect(cursor).toContain(EMDD_RULES_MARKER);
    }
  });
});

// getToolEnumerationString is consumed by CLI help text (cli.ts) and the
// generated --tool flag row in doc-tables.ts. Both rely on it staying in sync
// with TOOL_PATHS; without direct coverage, a regression that returned only a
// subset of tools or changed the separator would slip past the substring
// assertions in the consumer tests.
describe('getToolEnumerationString', () => {
  it('includes every concrete tool plus "all" with the default | separator', () => {
    const result = getToolEnumerationString();
    expect(result).toBe('claude|codex|cursor|windsurf|cline|copilot|all');
  });

  it('uses the provided separator when given', () => {
    expect(getToolEnumerationString(',')).toBe('claude,codex,cursor,windsurf,cline,copilot,all');
  });

  it('preserves TOOL_PATHS key order with "all" appended last', () => {
    const parts = getToolEnumerationString().split('|');
    expect(parts.slice(0, -1)).toEqual(Object.keys(TOOL_PATHS));
    expect(parts[parts.length - 1]).toBe('all');
  });

  it('contains every SKILL_TOOLS entry', () => {
    const parts = getToolEnumerationString().split('|');
    for (const tool of SKILL_TOOLS) {
      expect(parts).toContain(tool);
    }
  });
});

// Pin the README prose enumeration ("Supported tools: `claude` (default),
// `codex`, ..., `all`.") to the SSOT — without this, adding a 7th tool to
// TOOL_PATHS quietly leaves README:132 stale even though the AUTO-marker CLI
// table at README:230+ updates automatically.
describe('README documents every supported tool', () => {
  it('the "Supported tools" sentence enumerates every entry from getToolEnumerationString', () => {
    const readme = readFileSync(join(__dirname, '..', '..', '..', 'README.md'), 'utf-8');
    const tools = getToolEnumerationString().split('|');
    for (const t of tools) {
      expect(readme, `README is missing \`${t}\` from the Supported tools enumeration`).toMatch(
        new RegExp(`Supported tools:[^\\n]*\`${t}\``),
      );
    }
  });
});

// Contract tests pinning generated content against the registries that own the
// canonical names. Both the Codex skill bodies (which name MCP tools inline as
// "`<name>` tool") and the agent rules / closing skill (which name MCP prompts
// inline as `\`<name>\``) hardcode strings that must stay in sync with their
// SSOT. Without these tests, renaming a tool in src/registry/commands/ or a
// prompt in src/mcp-server/prompts/meta.ts would silently leave the generated
// rules/skill files telling agents to call something that no longer exists.
describe('generated content references existing registry entries (drift guard)', () => {
  it('every MCP tool name in Codex skill bodies resolves to a real registered tool', async () => {
    const { createDefaultRegistry } = await import('../../../src/registry/all-commands.js');
    const registry = createDefaultRegistry();
    const mcpToolNames = new Set(
      registry
        .getAll()
        .filter((c) => c.mcp !== false)
        .map((c) => (c.mcp && typeof c.mcp === 'object' && c.mcp.toolName) || c.name),
    );
    const codexOpen = getSkillContent('emdd-open', 'codex');
    const codexClose = getSkillContent('emdd-close', 'codex');
    // Match `<name>` tool — pulls each backticked identifier the skill body
    // tells Codex to "Call". This is the actual coupling surface.
    const referenced = new Set<string>();
    for (const body of [codexOpen, codexClose]) {
      for (const m of body.matchAll(/`([a-z][a-z0-9-]*)`\s+tool/g)) {
        referenced.add(m[1]);
      }
    }
    expect(referenced.size).toBeGreaterThan(0); // sanity: regex must capture
    for (const name of referenced) {
      expect(mcpToolNames, `Codex skill body references \`${name}\` tool but no such MCP tool exists in the registry`).toContain(name);
    }
  });

  it('also covers `mark-consolidated` (referenced as a bare backtick, not "tool" suffixed)', async () => {
    const { createDefaultRegistry } = await import('../../../src/registry/all-commands.js');
    const mcpToolNames = new Set(
      createDefaultRegistry()
        .getAll()
        .filter((c) => c.mcp !== false)
        .map((c) => (c.mcp && typeof c.mcp === 'object' && c.mcp.toolName) || c.name),
    );
    // The Codex emdd-close body says "Then call `mark-consolidated`." (no
    // trailing "tool" word) — make sure that bare reference also tracks the
    // registry. Add new bare names here when the skill body grows.
    const bareReferences = ['mark-consolidated'];
    const codexClose = getSkillContent('emdd-close', 'codex');
    for (const name of bareReferences) {
      expect(codexClose).toContain(`\`${name}\``);
      expect(mcpToolNames, `Codex skill body references \`${name}\` but no such MCP tool exists`).toContain(name);
    }
  });

  it('every MCP prompt name referenced in Claude rules/skills exists in PROMPT_META', async () => {
    const { PROMPT_META } = await import('../../../src/mcp-server/prompts/meta.js');
    const promptNames = new Set(PROMPT_META.map((p) => p.name));
    // The Claude rules + skill bodies hardcode all four session-cycle prompt
    // names. If any literal here drifts from PROMPT_META, this test fires.
    const sources = [
      getRulesContent('claude', 'compact'),
      getRulesContent('claude', 'full'),
      getSkillContent('emdd-open', 'claude'),
      getSkillContent('emdd-close', 'claude'),
    ];
    const referenced = new Set<string>();
    for (const body of sources) {
      // Match any backticked identifier that is followed by ` prompt` (with
      // space) — pulls every "Run the `<name>` prompt" / "Use ... `<name>`
      // (start)" wording without false-matching unrelated backticks.
      for (const m of body.matchAll(/`([a-z][a-z-]*)`\s+(?:prompt|MCP prompt)/gi)) {
        referenced.add(m[1]);
      }
    }
    // Also pin the four prompt names appear at all (sanity).
    for (const name of ['context-loading', 'episode-creation', 'consolidation', 'health-review']) {
      expect(referenced, `prompt name "${name}" not referenced in any Claude rules/skill body`).toContain(name);
    }
    for (const name of referenced) {
      expect(promptNames, `Claude rules/skill body references \`${name}\` prompt but no such PROMPT_META entry exists`).toContain(name);
    }
  });
});

describe('getSkillContent (per-tool body)', () => {
  it('Claude emdd-open body invokes the context-loading MCP prompt', () => {
    const content = getSkillContent('emdd-open', 'claude');
    expect(content).toContain('context-loading');
    expect(content).toContain('MCP prompt');
  });

  it('Codex emdd-open body invokes MCP tools and references the upstream issue', () => {
    const content = getSkillContent('emdd-open', 'codex');
    // Codex cannot call MCP prompts (openai/codex#5059) — must walk MCP tools instead.
    expect(content).toContain('openai/codex#5059');
    // The disclaimer mentions "MCP prompts" generically, but the body must NOT
    // contain the prompt-invocation instruction "Call the MCP prompt …" — Codex
    // can't execute that, which is the entire reason for this branch.
    expect(content).not.toContain('Call the MCP prompt');
    expect(content).toContain('`health` tool');
    expect(content).toContain('`list-nodes` tool');
    expect(content).toContain('`read-node` tool');
    expect(content).toContain('`check` tool');
    expect(content).toContain('`backlog` tool');
    // The MCP tool is registered as `status-transitions` (see
    // src/registry/commands/transitions.ts). Codex skill bodies MUST use the
    // registered name — calling the bare `transitions` tool would fail at runtime.
    expect(content).toContain('`status-transitions` tool');
    expect(content).not.toContain('`transitions` tool');
  });

  it('Codex emdd-close body invokes MCP tools (create-node, check, mark-consolidated, health)', () => {
    const content = getSkillContent('emdd-close', 'codex');
    expect(content).toContain('openai/codex#5059');
    // The disclaimer mentions "MCP prompts" generically, but the body must NOT
    // contain the prompt-invocation instruction "Call the MCP prompt …" — Codex
    // can't execute that, which is the entire reason for this branch.
    expect(content).not.toContain('Call the MCP prompt');
    expect(content).toContain('`create-node` tool');
    expect(content).toContain('`check` tool');
    expect(content).toContain('`mark-consolidated`');
    expect(content).toContain('`health` tool');
  });

  it('default tool argument is "claude" (backwards-compatible signature)', () => {
    expect(getSkillContent('emdd-open')).toBe(getSkillContent('emdd-open', 'claude'));
    expect(getSkillContent('emdd-close')).toBe(getSkillContent('emdd-close', 'claude'));
  });

  it('skill descriptions scope invocation to explicit user requests (no auto-run)', () => {
    // Codex implicit invocation matches on the description, and Claude likewise
    // selects skills by description. Both bodies must tell the agent NOT to fire
    // on its own when work merely looks done — the B half of the auto-run fix.
    for (const tool of ['claude', 'codex'] as const) {
      const close = getSkillContent('emdd-close', tool);
      expect(close).toContain('명시적으로');
      expect(close).toContain('자동으로 실행하지 마세요');
      const open = getSkillContent('emdd-open', tool);
      expect(open).toContain('자동으로 실행하지 마세요');
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
      join('.agents', 'skills', 'emdd-open', 'agents', 'openai.yaml'),
      join('.agents', 'skills', 'emdd-close', 'SKILL.md'),
      join('.agents', 'skills', 'emdd-close', 'agents', 'openai.yaml'),
    ]);
  });

  it('Codex SKILL files on disk contain the tool-walking body, not the prompt-invoking body', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const open = readFileSync(join(tmpDir, '.agents', 'skills', 'emdd-open', 'SKILL.md'), 'utf-8');
    const close = readFileSync(join(tmpDir, '.agents', 'skills', 'emdd-close', 'SKILL.md'), 'utf-8');
    // Codex body — tools, not the prompt-invocation instruction.
    expect(open).toContain('`health` tool');
    expect(open).not.toContain('Call the MCP prompt');
    expect(close).toContain('`create-node` tool');
    expect(close).not.toContain('Call the MCP prompt');
  });

  it('Claude SKILL files on disk still contain the prompt-invoking body', () => {
    generateSkillFiles(tmpDir, { tool: 'claude' });
    const open = readFileSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'SKILL.md'), 'utf-8');
    const close = readFileSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'SKILL.md'), 'utf-8');
    expect(open).toContain('context-loading');
    expect(close).toContain('episode-creation');
  });

  it('Codex skills get agents/openai.yaml pinning allow_implicit_invocation: false', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    for (const name of ['emdd-open', 'emdd-close']) {
      const yamlPath = join(tmpDir, '.agents', 'skills', name, 'agents', 'openai.yaml');
      expect(existsSync(yamlPath), `${name} should have agents/openai.yaml`).toBe(true);
      const parsed = loadYaml(readFileSync(yamlPath, 'utf-8')) as {
        policy?: { allow_implicit_invocation?: boolean };
      };
      // The whole point: Codex must NOT auto-invoke a session ceremony just
      // because a task matches its description.
      expect(parsed.policy?.allow_implicit_invocation).toBe(false);
    }
  });

  it('the generated openai.yaml matches getCodexSkillPolicy() (drift guard)', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const body = readFileSync(
      join(tmpDir, '.agents', 'skills', 'emdd-close', 'agents', 'openai.yaml'),
      'utf-8',
    );
    expect(body).toBe(getCodexSkillPolicy());
  });

  it('Claude skills do NOT get an agents/openai.yaml (Codex-only policy key)', () => {
    generateSkillFiles(tmpDir, { tool: 'claude' });
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-open', 'agents', 'openai.yaml'))).toBe(false);
    expect(existsSync(join(tmpDir, '.claude', 'skills', 'emdd-close', 'agents', 'openai.yaml'))).toBe(false);
  });

  it('skips existing Codex skill files when force is false', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const result = generateSkillFiles(tmpDir, { tool: 'codex' });
    // 2 SKILL.md + 2 agents/openai.yaml — both tracked under the same skip rule.
    expect(result.skipped).toHaveLength(4);
    expect(result.created).toHaveLength(0);
  });

  it('overwrites existing Codex skill files when force is true', () => {
    generateSkillFiles(tmpDir, { tool: 'codex' });
    const result = generateSkillFiles(tmpDir, { tool: 'codex', force: true });
    // force rewrites both the SKILL.md and the agents/openai.yaml for each skill.
    expect(result.created).toHaveLength(4);
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
