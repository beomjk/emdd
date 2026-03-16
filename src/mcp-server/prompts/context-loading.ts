import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../../graph/operations.js';
import { listNodes } from '../../graph/operations.js';

export function registerContextLoading(server: McpServer): void {
  server.prompt(
    'context-loading',
    'Load EMDD graph context for session start — provides a summary of nodes, edges, health, and structural gaps',
    { path: z.string().describe('Path to the EMDD graph directory') },
    async ({ path: graphDir }) => {
      const health = await getHealth(graphDir);
      const nodes = await listNodes(graphDir);

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

      const text = `# EMDD Graph Context — Session Start

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

## Session Start Instructions
1. Review the graph overview above to understand the current state.
2. Check structural gaps — these indicate missing connections in the research loop.
3. Read the latest Episode node's "What's Next" section for planned work.
4. Load prerequisite reading nodes listed in that Episode before starting.
5. Decide today's direction based on graph state and open questions.

Use the \`list-nodes\` and \`read-node\` tools to explore specific nodes in detail.`;

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
      };
    },
  );
}
