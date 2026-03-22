import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../../graph/operations.js';
import { CEREMONY_TRIGGERS } from '../../graph/types.js';

export function registerHealthReview(server: McpServer): void {
  server.prompt(
    'health-review',
    'Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density',
    { path: z.string().describe('Path to the EMDD graph directory') },
    async ({ path: graphDir }) => {
      const health = await getHealth(graphDir);

      const typeBreakdown = Object.entries(health.byType)
        .map(([type, count]) => `  - ${type}: ${count}`)
        .join('\n');

      const statusSection = Object.entries(health.statusDistribution)
        .map(([type, statuses]) => {
          const statusList = Object.entries(statuses)
            .map(([s, c]) => `${s}: ${c}`)
            .join(', ');
          return `  - ${type}: ${statusList}`;
        })
        .join('\n');

      const gapsSection = health.gaps.length > 0
        ? health.gaps.map(g => `  - ${g}`).join('\n')
        : '  None detected';

      // Generate recommendations based on health data
      const recommendations: string[] = [];

      if (health.gaps.length > 0) {
        for (const gap of health.gaps) {
          recommendations.push(`[ACTION] Address structural gap: ${gap}`);
        }
      }

      if (health.linkDensity < 1.0 && health.totalNodes > 0) {
        recommendations.push(
          `[ACTION] Low link density (${health.linkDensity.toFixed(2)}). Many nodes lack connections. Run orphan cleanup to add missing edges.`
        );
      }

      if (health.openQuestions === 0 && health.totalNodes > 0) {
        recommendations.push(
          '[ACTION] No open questions. This may indicate premature convergence. Consider generating new questions during consolidation.'
        );
      }

      if (health.avgConfidence !== null && health.avgConfidence < 0.5) {
        recommendations.push(
          `[ACTION] Low average confidence (${health.avgConfidence.toFixed(2)}). Prioritize experiments that test high-risk hypotheses.`
        );
      }

      if ((health.byType['finding'] ?? 0) >= CEREMONY_TRIGGERS.consolidation.unpromoted_findings_threshold && (health.byType['knowledge'] ?? 0) === 0) {
        recommendations.push(
          '[ACTION] Multiple findings but no knowledge nodes. Run a consolidation to promote validated findings.'
        );
      }

      if ((health.byType['episode'] ?? 0) === 0 && health.totalNodes > 0) {
        recommendations.push(
          '[ACTION] No episode nodes. Write an episode to record your session and maintain the temporal chain.'
        );
      }

      if (recommendations.length === 0) {
        recommendations.push('Graph health looks good. Continue with the current research loop.');
      }

      const recommendationsSection = recommendations.map(r => `  - ${r}`).join('\n');

      const text = `# EMDD Health Review

## Summary
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Link density: ${health.linkDensity.toFixed(2)} edges/node
- Average confidence: ${health.avgConfidence !== null ? health.avgConfidence.toFixed(2) : 'N/A'}
- Open questions: ${health.openQuestions}

## Node Distribution by Type
${typeBreakdown}

## Status Distribution
${statusSection}

## Structural Gaps
${gapsSection}

## Recommendations
${recommendationsSection}

## Next Steps
1. Address any [ACTION] items in the recommendations above.
2. If consolidation triggers are active, run the \`consolidation\` prompt for a guided procedure.
3. Use the \`check\` tool to verify consolidation trigger status.
4. Schedule a Weekly Graph Review if one has not been done in the past 7 days.`;

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
      };
    },
  );
}
