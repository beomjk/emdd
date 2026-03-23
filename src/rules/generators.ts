import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NODE_TYPES,
  NODE_TYPE_DIRS,
  ID_PREFIXES,
  EDGE_TYPES,
  CEREMONY_TRIGGERS,
} from '../graph/types.js';

export type ToolType = 'claude' | 'cursor' | 'windsurf' | 'cline' | 'copilot' | 'all';
export type RulesVariant = 'full' | 'compact';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tool -> output path mapping (relative to project root)
const TOOL_PATHS: Record<Exclude<ToolType, 'all'>, string> = {
  claude: '.claude/CLAUDE.md',
  cursor: '.cursor/rules/emdd.mdc',
  windsurf: '.windsurf/rules/emdd.md',
  cline: '.clinerules/emdd.md',
  copilot: '.github/copilot-instructions.md',
};

const ALL_TOOLS: Exclude<ToolType, 'all'>[] = ['claude', 'cursor', 'windsurf', 'cline', 'copilot'];

// Short descriptions for each node type used in rules output
const NODE_DESCRIPTIONS: Record<string, string> = {
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

function makeCompactRules(): string {
  const nodeLines = NODE_TYPES.map((t) => {
    const desc = NODE_DESCRIPTIONS[t] ?? t;
    return `- **${titleCase(t)}** (\`graph/${NODE_TYPE_DIRS[t]}/\`) — ${desc}`;
  }).join('\n');

  const idExamples = NODE_TYPES.map((t) => `\`${ID_PREFIXES[t]}-001\``).join(', ');

  const triggers = CEREMONY_TRIGGERS.consolidation;

  return `# EMDD — Evolving Mindmap-Driven Development (Compact)

You are working in an EMDD project. The knowledge graph lives in \`graph/\` as Markdown + YAML frontmatter files.

## Node Types

${nodeLines}

## ID Convention

${idExamples}

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
  const nodeTableRows = NODE_TYPES.map((t) => {
    const desc = NODE_DESCRIPTIONS[t] ?? t;
    return `| ${titleCase(t)} | \`graph/${NODE_TYPE_DIRS[t]}/\` | ${titleCase(desc)} |`;
  }).join('\n');

  // ID convention examples
  const idExamples = NODE_TYPES.map((t) => `\`${ID_PREFIXES[t]}-001\``).join(', ');

  // Edge list
  const edgeList = [...EDGE_TYPES].sort().join(', ');

  // Ceremony triggers
  const triggers = CEREMONY_TRIGGERS.consolidation;

  return `# EMDD — Evolving Mindmap-Driven Development

You are working in a project that uses the EMDD methodology. EMDD organizes research and exploration as a knowledge graph stored in \`graph/\` with Markdown + YAML frontmatter files, tracked by Git.

## Graph Structure

The graph contains ${NODE_TYPES.length} node types, each in its own subdirectory:

| Node Type | Directory | Purpose |
|-----------|-----------|---------|
${nodeTableRows}

Nodes are connected by typed edges (${edgeList}) declared in YAML frontmatter \`links:\` arrays.

## Node File Format

Every node is a Markdown file with YAML frontmatter:

\`\`\`yaml
---
id: ${ID_PREFIXES[NODE_TYPES[0]]}-001
type: ${NODE_TYPES[0]}
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

function wrapForCursor(content: string): string {
  return `---
description: EMDD methodology rules for AI-assisted research graph management
globs: graph/**/*.md
---
${content}`;
}

/**
 * Get rules content for a specific tool and variant.
 * For 'all', returns claude content (use generateRulesFile for writing all files).
 */
export function getRulesContent(tool: ToolType, variant: RulesVariant): string {
  const resolvedTool = tool === 'all' ? 'claude' : tool;

  let content: string;
  if (variant === 'compact') {
    content = makeCompactRules();
  } else {
    const rules = makeFullRules();
    const agent = loadAgentMarkdown();
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
