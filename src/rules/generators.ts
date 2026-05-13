import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NODE_TYPES,
  NODE_DISPLAY_ORDER,
  NODE_TYPE_DIRS,
  ID_PREFIXES,
  EDGE_TYPES,
  CEREMONY_TRIGGERS,
  VALID_STATUSES,
  type NodeType,
} from '../graph/types.js';

export type ToolType = 'claude' | 'codex' | 'cursor' | 'windsurf' | 'cline' | 'copilot' | 'all';
export type SkillToolType = 'claude' | 'codex';
export type SkillName = 'emdd-open' | 'emdd-close';
export type RulesVariant = 'full' | 'compact';

// Single source of truth for which tools support repository-local skills.
export const SKILL_TOOLS = ['claude', 'codex'] as const satisfies readonly SkillToolType[];

// Compile-time exhaustiveness guard: if SkillToolType gains a member that is
// not listed in SKILL_TOOLS, this type resolves to a non-empty union and the
// assignment fails. Keeps SKILL_TOOLS and SkillToolType in lockstep.
type _MissingSkillTools = Exclude<SkillToolType, typeof SKILL_TOOLS[number]>;
const _skillToolsExhaustive: _MissingSkillTools extends never ? true : never = true;
void _skillToolsExhaustive;

export function toolSupportsSkills(tool: ToolType): tool is SkillToolType {
  return (SKILL_TOOLS as readonly ToolType[]).includes(tool);
}

// Marker written at line 1 of every generated EMDD rules file. Shared between
// the generator (which writes it) and doctor (which probes for it) so a rename
// can't silently break detection.
export const EMDD_RULES_MARKER = '# EMDD';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tool -> output path mapping (relative to project root)
export const TOOL_PATHS: Record<Exclude<ToolType, 'all'>, string> = {
  claude: '.claude/CLAUDE.md',
  codex: 'AGENTS.md',
  cursor: '.cursor/rules/emdd.mdc',
  windsurf: '.windsurf/rules/emdd.md',
  cline: '.clinerules/emdd.md',
  copilot: '.github/copilot-instructions.md',
};

// Compile-time guard: every SkillToolType must also be a key of TOOL_PATHS so
// generateSkillFiles can resolve a writable destination for it. Without this,
// adding a tool to SkillToolType but forgetting it in TOOL_PATHS would only
// surface at the use-site `skillRoot[tool]`, not at the type declaration.
type _SkillToolsHavePaths = Exclude<SkillToolType, keyof typeof TOOL_PATHS>;
const _skillToolsHavePaths: _SkillToolsHavePaths extends never ? true : never = true;
void _skillToolsHavePaths;

const ALL_TOOLS = Object.keys(TOOL_PATHS) as Array<Exclude<ToolType, 'all'>>;

// Single-source list of every accepted `--tool` value (concrete tools + 'all').
// Used by the CLI to validate input before any filesystem work, and by
// getToolEnumerationString to build the help/docs enumeration.
const ALL_TOOL_CHOICES: readonly ToolType[] = [...ALL_TOOLS, 'all'];

export function isValidTool(value: string): value is ToolType {
  return (ALL_TOOL_CHOICES as readonly string[]).includes(value);
}

/**
 * Build the "claude|codex|cursor|...|all" enumeration string for CLI help text
 * and generated docs. Single source — derived from TOOL_PATHS so adding a new
 * tool requires no manual edits to help strings or doc tables.
 */
export function getToolEnumerationString(separator = '|'): string {
  return ALL_TOOL_CHOICES.join(separator);
}

// Short descriptions for each node type used in rules output
const NODE_DESCRIPTIONS: Record<NodeType, string> = {
  hypothesis: 'testable claims with confidence 0.0-1.0',
  experiment: 'work units testing hypotheses',
  finding: 'observations from experiments',
  knowledge: 'established facts promoted from findings',
  question: 'open questions driving exploration',
  decision: 'recorded choices with rationale',
  episode: 'session logs (mandatory: "What I Tried" + "What\'s Next")',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Single source of truth for the session-shortcut sentence rendered into rules.
// The Title-Case form is what `emdd-agent.md` (full variant) uses verbatim — see
// adaptAgentMarkdownForTool — so changing `Session Start` / `Session End` here
// requires updating `emdd-agent.md` in lockstep (the drift guard will fire if not).
const SHORTCUT_LINE = {
  claude: {
    compact: 'Claude Code shortcuts: `/emdd-open` (start) and `/emdd-close` (end + maintenance + review).',
    full: '**Claude Code shortcuts:** `/emdd-open` (Session Start) and `/emdd-close` (Session End + Maintenance + Review).',
  },
  codex: {
    compact: 'Codex skills: `emdd-open` (start) and `emdd-close` (end + maintenance + review).',
    full: '**Codex skills:** `emdd-open` (Session Start) and `emdd-close` (Session End + Maintenance + Review).',
  },
} as const;

function shortcutGuidance(tool: Exclude<ToolType, 'all'>): string {
  return tool === 'codex' ? SHORTCUT_LINE.codex.compact : SHORTCUT_LINE.claude.compact;
}

function makeCompactRules(tool: Exclude<ToolType, 'all'> = 'claude'): string {
  const nodeLines = NODE_DISPLAY_ORDER.map((t) => {
    const desc = NODE_DESCRIPTIONS[t] ?? t;
    const statuses = VALID_STATUSES[t].join(', ');
    return `- **${titleCase(t)}** (\`graph/${NODE_TYPE_DIRS[t]}/\`) [${statuses}] — ${desc}`;
  }).join('\n');

  const idExamples = NODE_DISPLAY_ORDER.map((t) => `\`${ID_PREFIXES[t]}-001\``).join(', ');

  const triggers = CEREMONY_TRIGGERS.consolidation;

  // Codex cannot invoke MCP prompts (openai/codex#5059), so direct it to the
  // skills that wrap the equivalent MCP tools instead.
  const cycleLine = tool === 'codex'
    ? 'Run the `emdd-open` skill at session start; run the `emdd-close` skill at session end (it writes the Episode, runs Consolidation every close with triggers as depth hints, and reviews health).'
    : 'Use MCP prompts in order: `context-loading` (start) → work → `episode-creation` (end) → `consolidation` (every close; triggers are depth hints) → `health-review` (periodic).';

  return `${EMDD_RULES_MARKER} — Evolving Mindmap-Driven Development (Compact)

You are working in an EMDD project. The knowledge graph lives in \`graph/\` as Markdown + YAML frontmatter files.

## Node Types

${nodeLines}

## ID Convention

${idExamples}

## Session Cycle

${cycleLine}

${shortcutGuidance(tool)}

## Key Rules

1. Write an Episode at end of each session with "What I Tried" and "What's Next" (with prerequisite node IDs)
2. Run Consolidation when: ${triggers.unpromoted_findings_threshold}+ Findings, ${triggers.episodes_threshold}+ Episodes, 0 open Questions, or ${triggers.experiment_overload_threshold}+ Findings on one Experiment
3. Consolidation steps: Promote findings, split experiments, generate questions, update confidence, fix orphans
4. Never delete nodes — change status to REFUTED/RETRACTED/SUPERSEDED
5. Graph is source of truth; you are a gardener, not an architect — suggest, don't decide
`;
}

function makeFullRules(): string {
  // Node type table
  const nodeTableRows = NODE_DISPLAY_ORDER.map((t) => {
    const desc = NODE_DESCRIPTIONS[t] ?? t;
    const statuses = VALID_STATUSES[t].join(', ');
    return `| ${titleCase(t)} | \`graph/${NODE_TYPE_DIRS[t]}/\` | ${statuses} | ${titleCase(desc)} |`;
  }).join('\n');

  // ID convention examples
  const idExamples = NODE_DISPLAY_ORDER.map((t) => `\`${ID_PREFIXES[t]}-001\``).join(', ');

  // Edge list
  const edgeList = [...EDGE_TYPES].sort().join(', ');

  // Ceremony triggers
  const triggers = CEREMONY_TRIGGERS.consolidation;

  return `${EMDD_RULES_MARKER} — Evolving Mindmap-Driven Development

You are working in a project that uses the EMDD methodology. EMDD organizes research and exploration as a knowledge graph stored in \`graph/\` with Markdown + YAML frontmatter files, tracked by Git.

## Graph Structure

The graph contains ${NODE_TYPES.length} node types, each in its own subdirectory:

| Node Type | Directory | Valid Statuses | Purpose |
|-----------|-----------|----------------|---------|
${nodeTableRows}

Nodes are connected by typed edges (${edgeList}) declared in YAML frontmatter \`links:\` arrays.

## Node File Format

Every node is a Markdown file with YAML frontmatter:

\`\`\`yaml
---
id: ${ID_PREFIXES[NODE_DISPLAY_ORDER[0]]}-001
type: ${NODE_DISPLAY_ORDER[0]}
status: PROPOSED
confidence: 0.4
created: 2026-03-15
updated: 2026-03-15
created_by: human:yourname
tags: [topic]
links:
  - target: knw-001
    relation: depends_on
---
# Title here
Body content...
\`\`\`

Required fields vary by type. All nodes need: \`id\`, \`type\`, \`title\`, \`status\`, \`created\`, \`updated\`. Hypotheses, findings, and knowledge also need \`confidence\` (0.0-1.0).

## Node ID Convention

IDs use type prefix + sequential number: ${idExamples}.

## Episode Writing Protocol

Episodes are the primary mechanism for maintaining research continuity. Write an Episode at the end of each work session.

**Mandatory sections:**
- **What I Tried** — what was done this session
- **What's Next** — planned next steps with prerequisite reading nodes

**Optional sections:**
- What Got Stuck — blockers or wrong turns
- What Was Deliberately Not Done — deferred items with reasons
- Questions That Arose — new questions for the graph

Each "What's Next" item should list prerequisite reading: the node IDs to load before starting that task. This curates context for the next session.

## Consolidation Protocol

Consolidation is a mandatory maintenance ceremony. Check triggers after creating Episodes or Findings.

**Triggers (run if ANY apply):**
- ${triggers.unpromoted_findings_threshold} or more Finding nodes added since last Consolidation
- ${triggers.episodes_threshold} or more Episode nodes added since last Consolidation
- 0 open Questions (the illusion that research is "done")
- An Experiment has ${triggers.experiment_overload_threshold}+ Findings attached

**Consolidation steps:**
1. **Promotion** — promote established Findings to Knowledge nodes
2. **Splitting** — split bloated Experiments into meaningful units
3. **Question generation** — convert Episode questions into Question nodes
4. **Hypothesis update** — update confidence based on evidence
5. **Orphan cleanup** — add connections to unlinked Findings

Consolidation is an obligation, not optional. Do not record Consolidation as an Episode. Do not start new exploration during Consolidation.

## Key Principles

1. **Graph is source of truth** — the graph, not code, is the project's knowledge structure
2. **Minimum viable structure** — add structure only when needed; if it feels like bureaucracy, reduce it
3. **Gap-driven exploration** — the most valuable information is in the empty spaces between nodes
4. **Temporal evolution** — never delete wrong paths; deprecate them. The history of why something failed is itself knowledge
5. **Riskiest-first** — validate the most uncertain hypotheses first
6. **Archive, don't delete** — change status to REFUTED/RETRACTED/SUPERSEDED instead of removing nodes

## AI Agent Role

You are a **gardener** of the graph:
- Maintain connections, detect duplicates, identify orphans
- Detect patterns and potential connections the researcher missed
- Suggest exploration directions based on structural gaps
- Automate routine tasks (literature search, result summarization)
- Never make judgment calls — suggest, don't decide
`;
}

function loadAgentMarkdown(): string {
  return fs.readFileSync(path.join(__dirname, 'emdd-agent.md'), 'utf-8');
}

// Exported for direct unit testing of the drift-guard behavior.
//
// We deliberately avoid `String.prototype.replace`: it interprets `$&`, `$1`,
// `$$`, "$`" and `$'` in the replacement string, which would silently corrupt
// any future replacement containing those tokens. Splice via indexOf instead.
export function replaceOrThrow(content: string, search: string, replacement: string): string {
  if (search.length === 0) {
    throw new Error('replaceOrThrow: search string must be non-empty');
  }
  const i = content.indexOf(search);
  if (i === -1) {
    // Use a head+tail preview so tail-only drift (e.g., a trailing word change)
    // is visible in the error message instead of being hidden by truncation.
    const preview =
      search.length > 100 ? `${search.slice(0, 48)}…${search.slice(-48)}` : search;
    throw new Error(
      `adaptAgentMarkdownForTool: expected target not found in emdd-agent.md: "${preview}"`,
    );
  }
  return content.slice(0, i) + replacement + content.slice(i + search.length);
}

function adaptAgentMarkdownForTool(content: string, tool: Exclude<ToolType, 'all'>): string {
  if (tool !== 'codex') {
    return content;
  }

  let out = content;
  out = replaceOrThrow(out, SHORTCUT_LINE.claude.full, SHORTCUT_LINE.codex.full);
  // Step 1 of the Session Cycle directs the agent to "Run the `context-loading`
  // prompt (or `/emdd-open`)". Codex cannot run MCP prompts (openai/codex#5059),
  // so the prompt is unreachable for Codex — only the skill is. Rewrite the
  // primary directive to the skill, dropping the now-redundant fallback clause.
  // Keeps Step 1 consistent with the Steps 3-5 rewrite below; otherwise the
  // rules file contradicts itself.
  out = replaceOrThrow(
    out,
    'Run the `context-loading` prompt (or `/emdd-open`).',
    'Run the `emdd-open` skill.',
  );
  out = replaceOrThrow(out, 'via `/emdd-close`', 'via the `emdd-close` skill');

  // Steps 3-5 of the Session Cycle direct the agent to invoke MCP prompts
  // (`episode-creation`, `consolidation`, `health-review`) — but Codex cannot
  // run MCP prompts (openai/codex#5059). Redirect each step to the matching
  // step inside the `emdd-close` skill, which walks the equivalent MCP tools.
  // Without this rewrite the rules file (loaded as agent context every session)
  // contradicts the SKILL.md disclaimer and tells Codex to do something it can't.
  out = replaceOrThrow(
    out,
    'Run the `episode-creation` prompt.',
    'Run the `emdd-close` skill (Episode step).',
  );
  out = replaceOrThrow(
    out,
    'Run the `consolidation` prompt every close.',
    'Run the `emdd-close` skill (Consolidation step) every close.',
  );
  out = replaceOrThrow(
    out,
    'Run the `health-review` prompt periodically',
    'Run the `emdd-close` skill (Health Review step) periodically',
  );

  return out;
}

function wrapForCursor(content: string): string {
  return `---
description: EMDD methodology rules for AI-assisted research graph management
globs: graph/**/*.md
---
${content}`;
}

/**
 * Get rules content for a specific tool and variant.
 * Throws on 'all' — callers that want to write every tool's file should use
 * generateRulesFile, which iterates and calls getRulesContent per concrete tool.
 */
export function getRulesContent(tool: ToolType, variant: RulesVariant): string {
  if (tool === 'all') {
    throw new Error(
      "getRulesContent: 'all' is not a concrete tool. Use generateRulesFile('all', ...) to write all tool files.",
    );
  }
  const resolvedTool = tool;

  let content: string;
  if (variant === 'compact') {
    content = makeCompactRules(resolvedTool);
  } else {
    const rules = makeFullRules();
    const agent = adaptAgentMarkdownForTool(loadAgentMarkdown(), resolvedTool);
    content = `${rules}\n${agent}`;
  }

  // Apply tool-specific formatting
  if (resolvedTool === 'cursor') {
    return wrapForCursor(content);
  }

  return content;
}

/**
 * Generate rules file(s) for the given tool at the project path.
 * Returns an object with created file paths and any warnings.
 */
export function generateRulesFile(
  tool: ToolType,
  projectPath: string,
  options: { variant?: RulesVariant; force?: boolean } = {},
): { created: string[]; skipped: string[] } {
  const variant = options.variant ?? 'full';
  const force = options.force ?? false;
  const tools = tool === 'all' ? ALL_TOOLS : [tool as Exclude<ToolType, 'all'>];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const t of tools) {
    const relativePath = TOOL_PATHS[t];
    const fullPath = path.join(projectPath, relativePath);
    const dir = path.dirname(fullPath);

    // Check if file already exists
    if (!force && fs.existsSync(fullPath)) {
      skipped.push(relativePath);
      continue;
    }

    // Create directory if needed
    fs.mkdirSync(dir, { recursive: true });

    // Write the content
    const content = getRulesContent(t, variant);
    fs.writeFileSync(fullPath, content, 'utf-8');
    created.push(relativePath);
  }

  return { created, skipped };
}

// ── Skill Generation ───────────────────────────────────────────────

// Per-tool skill bodies. Claude invokes MCP prompts directly; Codex (which does
// not yet expose MCP prompts — tracked in openai/codex#5059) walks the equivalent
// MCP tools manually so the same SKILL.md works in both runtimes.
const SKILL_CONTENT: Record<SkillName, {
  description: string;
  body: Record<SkillToolType, string>;
}> = {
  'emdd-open': {
    description: 'EMDD 세션을 시작합니다. 그래프 컨텍스트를 로드하고 세션 우선순위를 안내합니다.',
    body: {
      claude: `# EMDD Session Open

Use the \`context-loading\` MCP prompt from the \`emdd\` server to load graph context.

## Instructions

1. Call the MCP prompt \`context-loading\` (no arguments needed — graphDir is auto-resolved).
2. Read the returned context — it contains graph state, episode arc, backlog, transition-ready nodes, and open questions.
3. Follow the Session Priorities and Episode Directive sections in the output.
`,
      codex: `# EMDD Session Open

Codex does not yet expose MCP prompts (tracked in openai/codex#5059), so load session
context manually by calling the equivalent MCP tools from the \`emdd\` server in order.

## Instructions

1. Call the \`health\` tool — get totals, structural gaps, and average confidence.
2. Call the \`list-nodes\` tool with \`type=episode\` — find recent episodes (sort by date desc, take top 5).
3. Call the \`read-node\` tool on the most recent episode for prior session context.
4. Call the \`check\` tool — compute consolidation depth hints for the next close.
5. Call the \`backlog\` tool with \`status=pending\` — list pending follow-ups.
6. Call the \`status-transitions\` tool — list nodes ready for status changes.
7. Call the \`list-nodes\` tool with \`type=question\` and \`status=OPEN\` — find blocking/high-urgency questions.
8. Synthesize the results into session priorities (BLOCKING questions, consolidation depth, transition-ready nodes, blocked streak) and pick one to start.
`,
    },
  },
  'emdd-close': {
    description: 'EMDD 세션을 마무리합니다. 에피소드 작성, 컨솔리데이션 체크, 헬스 리뷰를 순서대로 진행합니다.',
    body: {
      claude: `# EMDD Session Close

End the EMDD session by running the closing prompts in sequence.

## Instructions

1. Call the MCP prompt \`episode-creation\` — write an Episode node recording this session's work.
2. Call the MCP prompt \`consolidation\` — run the maintenance pass every close; triggers are depth hints, not gates.
3. Call the MCP prompt \`health-review\` — review graph health and note recommendations for next session.

Each prompt requires no arguments (graphDir is auto-resolved).
If the consolidation prompt reports no active triggers, run the lightweight pass and record that no deep consolidation was needed before step 3.
`,
      codex: `# EMDD Session Close

Codex does not yet expose MCP prompts (tracked in openai/codex#5059), so close the
session manually by calling the equivalent MCP tools from the \`emdd\` server in order.

## Instructions

1. **Episode** — Call the \`create-node\` tool with \`type=episode\` to record this session.
   - Frontmatter: \`trigger\` (what initiated this session), \`outcome\` (\`success\` | \`partial\` | \`blocked\`), and \`links\` with \`relation: produces\` for each node created or updated this session.
   - Body must include "What I Tried" and "What's Next" (with prerequisite reading node IDs).
2. **Consolidation** — Run the consolidation maintenance pass every close. Call the \`check\` tool for depth hints, then review promotion/splitting/question/confidence/orphan-edge work at the appropriate depth. Call \`mark-consolidated\` when the pass is complete.
3. **Health review** — Call the \`health\` tool to surface structural gaps and confidence trends. Capture recommendations for the next session.
`,
    },
  },
};

/**
 * Get SKILL.md content for a given skill name and tool.
 *
 * Claude and Codex receive different bodies because Codex does not yet expose MCP
 * prompts (openai/codex#5059); the Codex variant invokes equivalent MCP tools instead.
 */
export function getSkillContent(skillName: SkillName, tool: SkillToolType = 'claude'): string {
  const skill = SKILL_CONTENT[skillName];
  if (!skill) {
    throw new Error(`Unknown skill: ${skillName}`);
  }
  return `---\nname: ${skillName}\ndescription: >-\n  ${skill.description}\n---\n\n${skill.body[tool]}`;
}

/**
 * Generate skill files for AI tools that support repository-local skills.
 */
export function generateSkillFiles(
  projectPath: string,
  options: { force?: boolean; tool?: SkillToolType } = {},
): { created: string[]; skipped: string[] } {
  const force = options.force ?? false;
  const tool = options.tool ?? 'claude';
  const skillNames: SkillName[] = ['emdd-open', 'emdd-close'];
  const skillRoot: Record<SkillToolType, string> = {
    claude: path.join('.claude', 'skills'),
    codex: path.join('.agents', 'skills'),
  };

  const created: string[] = [];
  const skipped: string[] = [];

  for (const name of skillNames) {
    const relativePath = path.join(skillRoot[tool], name, 'SKILL.md');
    const fullPath = path.join(projectPath, relativePath);

    if (!force && fs.existsSync(fullPath)) {
      skipped.push(relativePath);
      continue;
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, getSkillContent(name, tool), 'utf-8');
    created.push(relativePath);
  }

  return { created, skipped };
}
