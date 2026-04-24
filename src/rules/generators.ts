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

const ALL_TOOLS = Object.keys(TOOL_PATHS) as (keyof typeof TOOL_PATHS)[];

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

function shortcutGuidance(tool: Exclude<ToolType, 'all'>): string {
  if (tool === 'codex') {
    return 'Codex skills: `emdd-open` (start) and `emdd-close` (end + maintenance + review).';
  }
  return 'Claude Code shortcuts: `/emdd-open` (start) and `/emdd-close` (end + maintenance + review).';
}

function makeCompactRules(tool: Exclude<ToolType, 'all'> = 'claude'): string {
  const nodeLines = NODE_DISPLAY_ORDER.map((t) => {
    const desc = NODE_DESCRIPTIONS[t] ?? t;
    const statuses = VALID_STATUSES[t].join(', ');
    return `- **${titleCase(t)}** (\`graph/${NODE_TYPE_DIRS[t]}/\`) [${statuses}] — ${desc}`;
  }).join('\n');

  const idExamples = NODE_DISPLAY_ORDER.map((t) => `\`${ID_PREFIXES[t]}-001\``).join(', ');

  const triggers = CEREMONY_TRIGGERS.consolidation;

  return `# EMDD — Evolving Mindmap-Driven Development (Compact)

You are working in an EMDD project. The knowledge graph lives in \`graph/\` as Markdown + YAML frontmatter files.

## Node Types

${nodeLines}

## ID Convention

${idExamples}

## Session Cycle

Use MCP prompts in order: \`context-loading\` (start) → work → \`episode-creation\` (end) → \`consolidation\` (if triggered) → \`health-review\` (periodic).

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

  return `# EMDD — Evolving Mindmap-Driven Development

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
export function replaceOrThrow(content: string, search: string, replacement: string): string {
  if (!content.includes(search)) {
    // Use a head+tail preview so tail-only drift (e.g., a trailing word change)
    // is visible in the error message instead of being hidden by truncation.
    const preview =
      search.length > 100 ? `${search.slice(0, 48)}…${search.slice(-48)}` : search;
    throw new Error(
      `adaptAgentMarkdownForTool: expected target not found in emdd-agent.md: "${preview}"`,
    );
  }
  return content.replace(search, replacement);
}

function adaptAgentMarkdownForTool(content: string, tool: Exclude<ToolType, 'all'>): string {
  if (tool !== 'codex') {
    return content;
  }

  let out = content;
  out = replaceOrThrow(
    out,
    '**Claude Code shortcuts:** `/emdd-open` (Session Start) and `/emdd-close` (Session End + Maintenance + Review).',
    'Codex skills: `emdd-open` (Session Start) and `emdd-close` (Session End + Maintenance + Review).',
  );
  out = replaceOrThrow(out, '(or `/emdd-open`)', '(or the `emdd-open` skill)');
  out = replaceOrThrow(out, 'via `/emdd-close`', 'via the `emdd-close` skill');
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

const SKILL_CONTENT: Record<SkillName, { description: string; body: string }> = {
  'emdd-open': {
    description: 'EMDD 세션을 시작합니다. 그래프 컨텍스트를 로드하고 세션 우선순위를 안내합니다.',
    body: `# EMDD Session Open

Use the \`context-loading\` MCP prompt from the \`emdd\` server to load graph context.

## Instructions

1. Call the MCP prompt \`context-loading\` (no arguments needed — graphDir is auto-resolved).
2. Read the returned context — it contains graph state, episode arc, backlog, transition-ready nodes, and open questions.
3. Follow the Session Priorities and Episode Directive sections in the output.
`,
  },
  'emdd-close': {
    description: 'EMDD 세션을 마무리합니다. 에피소드 작성, 컨솔리데이션 체크, 헬스 리뷰를 순서대로 진행합니다.',
    body: `# EMDD Session Close

End the EMDD session by running the closing prompts in sequence.

## Instructions

1. Call the MCP prompt \`episode-creation\` — write an Episode node recording this session's work.
2. Call the MCP prompt \`consolidation\` — check if consolidation triggers are met and execute if needed.
3. Call the MCP prompt \`health-review\` — review graph health and note recommendations for next session.

Each prompt requires no arguments (graphDir is auto-resolved).
If the consolidation prompt reports that no triggers are met, note that consolidation is not needed and proceed to step 3.
`,
  },
};

/**
 * Get SKILL.md content for a given skill name.
 */
export function getSkillContent(skillName: SkillName): string {
  const skill = SKILL_CONTENT[skillName];
  if (!skill) {
    throw new Error(`Unknown skill: ${skillName}`);
  }
  return `---\nname: ${skillName}\ndescription: >-\n  ${skill.description}\n---\n\n${skill.body}`;
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
    fs.writeFileSync(fullPath, getSkillContent(name), 'utf-8');
    created.push(relativePath);
  }

  return { created, skipped };
}
