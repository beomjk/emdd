import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth, checkConsolidation } from '../../graph/operations.js';
import { listNodes } from '../../graph/operations.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { PROMPT_META } from './meta.js';
import type { HealthReport, CheckResult, Node } from '../../graph/types.js';

const meta = PROMPT_META.find(p => p.name === 'context-loading')!;

function buildFirstSessionGuide(): string {
  return `# EMDD First Session Guide

Welcome! Your knowledge graph is empty — this is the starting point for every EMDD project.

## The EMDD Research Cycle

\`\`\`
Question → Hypothesis → Experiment → Finding → Knowledge
                                        ↓
                                    New Question
\`\`\`

Each node type plays a role: **Questions** drive inquiry, **Hypotheses** are testable claims,
**Experiments** validate or refute them, **Findings** capture results, and **Knowledge** records
confirmed facts.

## Getting Started

Choose one of these starting points:

### Option A: Start with what you know
Create a Knowledge node to anchor your graph with established facts:
\`\`\`
create-node: type=knowledge, slug="your-domain-facts"
\`\`\`

### Option B: Start with a hypothesis
If you already have a testable idea:
\`\`\`
create-node: type=hypothesis, slug="your-first-hypothesis"
\`\`\`

### Option C: Start with a question
If you have an open research question:
\`\`\`
create-node: type=question, slug="your-research-question"
\`\`\`

## What Happens Next

After creating your first nodes, link them together to form the graph structure.
At the end of this session, use the \`episode-creation\` prompt to record your work —
the Episode curates the context for your next session.

## Available Tools

- \`list-nodes\` — see all nodes in the graph
- \`read-node\` — read a specific node's content
- \`health\` — check graph health and structural gaps
- \`graph-gaps\` — identify missing connections in the research loop`;
}

function buildSessionContext(
  health: HealthReport,
  nodes: Node[],
  consolidation: CheckResult,
): string {
  const typeBreakdown = Object.entries(health.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `  - ${type}: ${count}`)
    .join('\n');

  const gapsSection = health.gaps.length > 0
    ? health.gaps.map(g => `  - ${g}`).join('\n')
    : '  None detected';

  const confidenceInfo = health.avgConfidence !== null
    ? `Average confidence: ${health.avgConfidence.toFixed(2)}`
    : 'Average confidence: N/A (no confidence values)';

  const recentNodes = nodes
    .slice(0, 10)
    .map(n => `  - [${n.id}] ${n.title} (${n.type}, ${n.status ?? 'no status'})`)
    .join('\n');

  return `# EMDD Graph Context — Session Start

## Graph Overview
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Link density: ${health.linkDensity.toFixed(2)} edges/node
- ${confidenceInfo}
- Open questions: ${health.openQuestions}

## Node Counts by Type
${typeBreakdown}

## Structural Gaps
${gapsSection}

## Recent Nodes (up to 10)
${recentNodes}

## Consolidation Status
${consolidation.triggers.length > 0
  ? '**[Consolidation recommended]** Triggers met:\n' + consolidation.triggers.map(t => `  - ${t.message}`).join('\n')
  : 'No consolidation triggers active.'}

## Session Start Instructions
1. Review the graph overview above to understand the current state.
2. Check structural gaps — these indicate missing connections in the research loop.
3. Read the latest Episode node's "What's Next" section for planned work.
4. Load prerequisite reading nodes listed in that Episode before starting.
5. Check consolidation status above — if triggered, run consolidation before new exploration.
6. Decide today's direction based on graph state and open questions.

Use the \`list-nodes\` and \`read-node\` tools to explore specific nodes in detail.`;
}

export function registerContextLoading(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    { graphDir: z.string().describe('Path to the EMDD graph directory'), lang: z.string().optional().describe('Language locale (en or ko)') },
    async ({ graphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);
      const health = await getHealth(graphDir);

      let text: string;
      if (health.totalNodes === 0) {
        text = buildFirstSessionGuide();
      } else {
        const nodes = await listNodes(graphDir);
        const consolidation = await checkConsolidation(graphDir);
        text = buildSessionContext(health, nodes, consolidation);
      }

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
      };
    },
  );
}
