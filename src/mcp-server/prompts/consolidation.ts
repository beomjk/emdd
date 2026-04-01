import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkConsolidation, getHealth, listNodes } from '../../graph/operations.js';
import { CEREMONY_TRIGGERS, THRESHOLDS } from '../../graph/types.js';
import type { Node } from '../../graph/types.js';
import { loadConfig } from '../../graph/config.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { PROMPT_META } from './meta.js';

// NOTE: Prompt text is intentionally NOT localized via t().
// MCP prompts are consumed by AI agents, not displayed to human users.
// setLocale() is called so downstream operations respect the user's locale.
const meta = PROMPT_META.find(p => p.name === 'consolidation')!;

export function registerConsolidation(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    { graphDir: z.string().describe('Path to the EMDD graph directory'), lang: z.string().optional().describe('Language locale (en or ko)') },
    async ({ graphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);
      try {
        const checkResult = await checkConsolidation(graphDir);
        const health = await getHealth(graphDir);
        const ct = CEREMONY_TRIGGERS.consolidation;
        const config = loadConfig(graphDir);
        const sinceDate = config.last_consolidation_date ?? null;
        let deltaNodes: Node[] = [];
        if (sinceDate) {
          deltaNodes = await listNodes(graphDir, { since: sinceDate });
        }

        const triggersSection = checkResult.triggers.length > 0
          ? checkResult.triggers.map(t => `  - [TRIGGERED] ${t.message}`).join('\n')
          : '  No triggers active — consolidation is optional but you may still run it proactively.';

        // Promotion Candidates table
        const promotionSection = checkResult.promotionCandidates.length > 0
          ? `### Promotion Candidates\n| Finding | Confidence | Supports | Reason |\n|---------|-----------|----------|--------|\n${checkResult.promotionCandidates.map(c => `| ${c.id} | ${c.confidence.toFixed(2)} | ${c.supports} | ${c.reason} |`).join('\n')}`
          : '### Promotion Candidates\nNo findings currently meet promotion criteria.';

        // Orphan Findings list
        const orphanSection = checkResult.orphanFindings.length > 0
          ? `### Orphan Findings (no forward edges)\n${checkResult.orphanFindings.map(id => `- ${id}`).join('\n')}`
          : '';

        // Deferred Items list
        const deferredSection = checkResult.deferredItems.length > 0
          ? `### Deferred Items\n${checkResult.deferredItems.map(id => `- ${id}`).join('\n')}`
          : '';

        // Delta Since Last Consolidation
        let deltaSection: string;
        if (sinceDate) {
          const typeCounts = new Map<string, number>();
          for (const n of deltaNodes) {
            typeCounts.set(n.type, (typeCounts.get(n.type) ?? 0) + 1);
          }
          const typeList = [...typeCounts.entries()].map(([t, c]) => `${c} ${t}`).join(', ');
          deltaSection = `## Delta Since Last Consolidation (${sinceDate})\n- ${deltaNodes.length} nodes created/modified${typeList ? `\n- Types: ${typeList}` : ''}`;
        } else {
          deltaSection = '## Delta Since Last Consolidation\nNo consolidation anchor found — showing full graph state.';
        }

        const text = `# EMDD Consolidation Guide

## Current Trigger Status
${triggersSection}

## Graph State
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Open questions: ${health.openQuestions}
- Average confidence: ${health.avgConfidence !== null ? health.avgConfidence.toFixed(2) : 'N/A'}

${deltaSection}

## Consolidation Triggers (run if any apply)
- ${ct.unpromoted_findings_threshold} or more Finding nodes added since last Consolidation
- ${ct.episodes_threshold} or more Episode nodes added since last Consolidation
- 0 open Questions (the illusion that research is "done")
- An Experiment has become a catch-all with ${ct.experiment_overload_threshold}+ Findings attached

## Step-by-Step Consolidation Procedure

### Step 1: Promotion
Review all Finding nodes. Findings with an \`extends: know-NNN\` hint are reviewed first.
For each Finding with high confidence (>= ${THRESHOLDS.promotion_confidence}) and strong evidence (${THRESHOLDS.min_independent_supports}+ supporting links, or de facto in use as a premise by other work):
- Do NOT promote if an active CONTRADICTS edge exists on the Finding (this would create DISPUTED Knowledge).
- Promote it to a Knowledge node using the \`create-node\` tool (type: knowledge).
- Add a \`promotes\` edge from the new Knowledge node to the original Finding.
- Use the \`promote\` tool to identify candidates automatically.

${promotionSection}

### Step 2: Splitting
Review Experiments with many attached Findings (${ct.experiment_overload_threshold}+):
- Split bloated Experiments into focused sub-experiments.
- Reassign Findings to the appropriate sub-experiment.

### Step 3: Question Generation
Review Episode "Questions That Arose" sections:
- Convert unrecorded questions into Question nodes using \`create-node\` (type: question).
- Link new Questions to their source Episodes with \`spawns\`.

### Step 4: Hypothesis Update
Review all active Hypotheses:
- Update confidence values based on new Finding evidence.
- Create new Hypotheses if patterns suggest unexplored directions.
- Check kill criteria — mark REFUTED if a kill criterion is met.

### Step 5: Orphan Cleanup
Find Findings without outgoing links:
- Add \`supports\`, \`contradicts\`, or \`spawns\` edges as appropriate.
- Every Finding should connect to at least one Hypothesis or Question.
${orphanSection ? '\n' + orphanSection : ''}

### Step 6: Record Consolidation
Mark this consolidation as complete so future checks only count new episodes:
- Use the \`mark-consolidated\` tool (defaults to today's date).
${deferredSection ? '\n' + deferredSection : ''}

## Consolidation Principles
- Consolidation is an obligation, not optional — check triggers after creating Episodes or Findings.
- Do not record Consolidation itself as an Episode — it is a meta-activity.
- Do not start new exploration during Consolidation — this is garden tending, not planting.`;

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
