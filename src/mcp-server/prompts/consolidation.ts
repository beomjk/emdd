import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkConsolidation, getHealth, listNodes } from '../../graph/operations.js';
import { resolveGraphDir } from '../../graph/loader.js';
import { CEREMONY_TRIGGERS, THRESHOLDS } from '../../graph/types.js';
import type { Node } from '../../graph/types.js';
import { loadConfig } from '../../graph/config.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { PROMPT_META } from './meta.js';

// NOTE: Prompt text is intentionally NOT localized via t().
// MCP prompts are consumed by AI agents, not displayed to human users.
// setLocale() is called so downstream operations respect the user's locale.
const meta = PROMPT_META.find(p => p.name === 'consolidation')!;

function depthLabel(triggerCount: number): 'shallow' | 'normal' | 'deep' {
  if (triggerCount === 0) return 'shallow';
  if (triggerCount === 1) return 'normal';
  return 'deep';
}

export function registerConsolidation(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    { graphDir: z.string().optional().describe('Path to the EMDD graph directory'), lang: z.string().optional().describe('Language locale (en or ko)') },
    async ({ graphDir: rawGraphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);
      try {
        const graphDir = rawGraphDir || resolveGraphDir();
        const checkResult = await checkConsolidation(graphDir);
        const health = await getHealth(graphDir);
        const ct = CEREMONY_TRIGGERS.consolidation;
        const config = loadConfig(graphDir);
        const sinceDate = config.last_consolidation_date ?? null;
        let deltaNodes: Node[] = [];
        if (sinceDate) {
          deltaNodes = await listNodes(graphDir, { since: sinceDate });
        }

        // ── Depth Hint (replaces Current Trigger Status) ────────────
        const triggerCount = checkResult.triggers.length;
        const label = depthLabel(triggerCount);
        let depthLine: string;
        if (triggerCount === 0) {
          depthLine = `- depth: ${label} — no trigger thresholds reached.`;
        } else if (triggerCount === 1) {
          const t = checkResult.triggers[0];
          depthLine = `- depth: ${label} — ${t.type} reached${t.count !== undefined ? ` (${t.count})` : ''}`;
        } else {
          const names = checkResult.triggers.map(t => t.type).sort().join(', ');
          depthLine = `- depth: ${label} — ${triggerCount} triggers active (${names})`;
        }

        // ── Step content with fallback labels (FR-007) ─────────────
        const promotionSection = checkResult.promotionCandidates.length > 0
          ? `### Promotion Candidates\n| Finding | Confidence | Supports | Reason |\n|---------|-----------|----------|--------|\n${checkResult.promotionCandidates.map(c => `| ${c.id} | ${c.confidence.toFixed(2)} | ${c.supports} | ${c.reason} |`).join('\n')}`
          : '### Promotion Candidates\nNo findings currently meet promotion criteria.';

        const orphanSection = checkResult.orphanFindings.length > 0
          ? `### Orphan Findings (no forward edges)\n${checkResult.orphanFindings.map(id => `- ${id}`).join('\n')}`
          : '### Orphan Findings\nno orphans — all findings have outgoing edges.';

        const deferredSection = checkResult.deferredItems.length > 0
          ? `### Deferred Items\n${checkResult.deferredItems.map(id => `- ${id}`).join('\n')}`
          : '';

        // ── Delta Since Last Consolidation (informational only, FR-024) ──
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

> **Rhythm**: PER_SESSION — this ceremony runs at every \`/emdd-close\` regardless of trigger state.
> Triggers below are *depth hints*, not execution gates.

## Depth Hint
${depthLine}

## Graph State
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Open questions: ${health.openQuestions}
- Average confidence: ${health.avgConfidence !== null ? health.avgConfidence.toFixed(2) : 'N/A'}

${deltaSection}

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
- If no candidates apply: no candidates — proceed to Step 3.

### Step 3: Question Generation
Review Episode "Questions That Arose" sections:
- Convert unrecorded questions into Question nodes using \`create-node\` (type: question).
- Link new Questions to their source Episodes with \`spawns\`.
- If no candidates apply: no candidates — proceed to Step 4.

### Step 4: Hypothesis Update
Review all active Hypotheses:
- Update confidence values based on new Finding evidence.
- Create new Hypotheses if patterns suggest unexplored directions.
- Check kill criteria — mark REFUTED if a kill criterion is met.
- If no candidates apply: no candidates — proceed to Step 5.

### Step 5: Orphan Cleanup
Find Findings without outgoing links:
- Add \`supports\`, \`contradicts\`, or \`spawns\` edges as appropriate.
- Every Finding should connect to at least one Hypothesis or Question.

${orphanSection}

### Step 6: Record Consolidation
Mark this consolidation as complete so future checks only count new episodes:
- Use the \`mark-consolidated\` tool (defaults to today's date).
${deferredSection ? '\n' + deferredSection : ''}

## Consolidation Principles
- Consolidation is PER_SESSION — it runs every session-close regardless of trigger state.
- Do not record Consolidation itself as an Episode — it is a meta-activity.
- Do not start new exploration during Consolidation — this is garden tending, not planting.

## Recording Skipped Steps
If the user explicitly requests skipping any Consolidation step (e.g., "Skip Step 2", "step 3은 건너뛰자"),
the skip is permitted but MUST be recorded. You MUST append a \`## Skipped Consolidation Steps\` heading
to the current session's episode body (created by the \`episode-creation\` prompt) with one bullet per skip:

\`\`\`markdown
## Skipped Consolidation Steps
- Step <N>: <user-provided reason>
\`\`\`

Every skip MUST be recorded — silent omissions are forbidden. If the user does not state a reason, ask once before recording.`;

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
