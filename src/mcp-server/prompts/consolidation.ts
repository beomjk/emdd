import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkConsolidation, getHealth } from '../../graph/operations.js';
import { CEREMONY_TRIGGERS, THRESHOLDS } from '../../graph/types.js';

export function registerConsolidation(server: McpServer): void {
  server.prompt(
    'consolidation',
    'Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses',
    { path: z.string().describe('Path to the EMDD graph directory') },
    async ({ path: graphDir }) => {
      const checkResult = await checkConsolidation(graphDir);
      const health = await getHealth(graphDir);
      const ct = CEREMONY_TRIGGERS.consolidation;

      const triggersSection = checkResult.triggers.length > 0
        ? checkResult.triggers.map(t => `  - [TRIGGERED] ${t.message}`).join('\n')
        : '  No triggers active — consolidation is optional but you may still run it proactively.';

      const text = `# EMDD Consolidation Guide

## Current Trigger Status
${triggersSection}

## Graph State
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Open questions: ${health.openQuestions}
- Average confidence: ${health.avgConfidence !== null ? health.avgConfidence.toFixed(2) : 'N/A'}

## Consolidation Triggers (run if any apply)
- ${ct.unpromoted_findings_threshold} or more Finding nodes added since last Consolidation
- ${ct.episodes_threshold} or more Episode nodes added since last Consolidation
- 0 open Questions (the illusion that research is "done")
- An Experiment has become a catch-all with ${ct.experiment_overload_threshold}+ Findings attached

## Step-by-Step Consolidation Procedure

### Step 1: Promotion
Review all Finding nodes. For each Finding with high confidence (>= ${THRESHOLDS.promotion_confidence}) and strong evidence (${THRESHOLDS.min_independent_supports}+ supporting links):
- Promote it to a Knowledge node using the \`create-node\` tool (type: knowledge).
- Add a \`promotes\` edge from the new Knowledge node to the original Finding.
- Use the \`promote\` tool to identify candidates automatically.

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

### Step 6: Record Consolidation
Mark this consolidation as complete so future checks only count new episodes:
- Use the \`mark-consolidated\` tool (defaults to today's date).

## Consolidation Principles
- Consolidation is an obligation, not optional — check triggers after creating Episodes or Findings.
- Do not record Consolidation itself as an Episode — it is a meta-activity.
- Do not start new exploration during Consolidation — this is garden tending, not planting.`;

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
      };
    },
  );
}
