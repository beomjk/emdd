import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function loadRulesMarkdown(): string {
  return fs.readFileSync(path.join(__dirname, 'emdd-rules.md'), 'utf-8');
}

function loadAgentMarkdown(): string {
  return fs.readFileSync(path.join(__dirname, 'emdd-agent.md'), 'utf-8');
}

function makeCompactRules(): string {
  // Compact version: essential rules only, targeting ~1500 tokens (~6000 chars)
  return `# EMDD — Evolving Mindmap-Driven Development (Compact)

You are working in an EMDD project. The knowledge graph lives in \`graph/\` as Markdown + YAML frontmatter files.

## Node Types

- **Hypothesis** (\`graph/hypotheses/\`) — testable claims with confidence 0.0-1.0
- **Experiment** (\`graph/experiments/\`) — work units testing hypotheses
- **Finding** (\`graph/findings/\`) — observations from experiments
- **Knowledge** (\`graph/knowledge/\`) — established facts promoted from findings
- **Question** (\`graph/questions/\`) — open questions driving exploration
- **Decision** (\`graph/decisions/\`) — recorded choices with rationale
- **Episode** (\`graph/episodes/\`) — session logs (mandatory: "What I Tried" + "What's Next")

## ID Convention

\`hyp-001\`, \`exp-003\`, \`fnd-012\`, \`knw-005\`, \`qst-002\`, \`dec-001\`, \`epi-007\`

## Key Rules

1. Write an Episode at end of each session with "What I Tried" and "What's Next" (with prerequisite node IDs)
2. Run Consolidation when: 5+ Findings, 3+ Episodes, 0 open Questions, or 5+ Findings on one Experiment
3. Consolidation steps: Promote findings, split experiments, generate questions, update confidence, fix orphans
4. Never delete nodes — change status to REFUTED/RETRACTED/SUPERSEDED
5. Graph is source of truth; you are a gardener, not an architect — suggest, don't decide
`;
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
    const rules = loadRulesMarkdown();
    const agent = loadAgentMarkdown();
    content = `${rules}\n\n${agent}`;
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
