import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '../../graph/operations.js';
import { CEREMONY_TRIGGERS } from '../../graph/types.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { PROMPT_META } from './meta.js';

// NOTE: Prompt text is intentionally NOT localized via t().
// MCP prompts are consumed by AI agents, not displayed to human users.
// setLocale() is called so downstream operations respect the user's locale.
const meta = PROMPT_META.find(p => p.name === 'health-review')!;

export function registerHealthReview(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    { graphDir: z.string().describe('Path to the EMDD graph directory'), lang: z.string().optional().describe('Language locale (en or ko)') },
    async ({ graphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);
      try {
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

        // Build dynamic next steps with cross-references to other session cycle prompts
        const nextSteps: string[] = [];

        if (health.gaps.length > 0 || recommendations.some(r => r.includes('[ACTION]'))) {
          nextSteps.push('Run `context-loading` to begin a focused session addressing the issues above.');
        }

        nextSteps.push('Run the `consolidation` prompt to check triggers and promote validated findings.');
        nextSteps.push('Use `episode-creation` to record this review session.');

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
${nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

        return {
          messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Error in ${meta.name}: ${msg}` } }],
        };
      } finally {
        setLocale(getLocale()); // restore to env default
      }
    },
  );
}
