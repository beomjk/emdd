import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth, checkConsolidation, listNodes, getBacklog, detectTransitions } from '../../graph/operations.js';
import { resolveGraphDir } from '../../graph/loader.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { nodeDate } from '../../graph/date-utils.js';
import { VALID_URGENCIES } from '../../graph/types.js';
import { PROMPT_LIMITS } from './prompt-limits.js';
import { PROMPT_META } from './meta.js';
import type { HealthReport, CheckResult, Node } from '../../graph/types.js';
import type { BacklogItem } from '../../graph/backlog.js';
import type { TransitionRecommendation } from '../../graph/transitions.js';

// NOTE: Prompt text is intentionally NOT localized via t().
// MCP prompts are consumed by AI agents, not displayed to human users.
// setLocale() is called so downstream operations respect the user's locale.
const meta = PROMPT_META.find(p => p.name === 'context-loading')!;

/** Urgency sort order derived from schema (BLOCKING=0, HIGH=1, MEDIUM=2, LOW=3) */
const URGENCY_ORDER: Record<string, number> = Object.fromEntries(
  VALID_URGENCIES.map((u, i) => [u, i])
);

interface SessionData {
  health: HealthReport;
  nodes: Node[];
  consolidation: CheckResult;
  episodes: Node[];
  backlogItems: BacklogItem[];
  transitions: TransitionRecommendation[];
  openQuestions: Node[];
}

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

// ── Section Builders ────────────────────────────────────────────────

function buildGraphOverview(health: HealthReport): string {
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

  return `## Graph Overview
- Total nodes: ${health.totalNodes}
- Total edges: ${health.totalEdges}
- Link density: ${health.linkDensity.toFixed(2)} edges/node
- ${confidenceInfo}
- Open questions: ${health.openQuestions}

## Node Counts by Type
${typeBreakdown}

## Structural Gaps
${gapsSection}`;
}

function buildEpisodeArc(episodes: Node[]): string {
  const recent = episodes.slice(0, PROMPT_LIMITS.episodeArc);
  if (recent.length === 0) return '';

  const rows = recent.map(ep => {
    const rawDate = String(ep.meta?.updated ?? ep.meta?.created ?? '—');
    const shortDate = rawDate.length >= 10 ? rawDate.slice(5, 10) : rawDate;
    const trigger = String(ep.meta?.trigger ?? '—');
    const outcome = String(ep.meta?.outcome ?? '—');
    const produced = (ep.links ?? [])
      .filter((l: { relation: string }) => l.relation === 'produces')
      .map((l: { target: string }) => l.target);
    const producedStr = produced.length > 0 ? produced.join(', ') : '—';
    return `| ${ep.id} | ${shortDate} | ${trigger} | ${outcome} | ${producedStr} |`;
  });

  return `## Episode Arc (last ${recent.length})
| Episode | Date | Trigger | Outcome | Produced |
|---------|------|---------|---------|----------|
${rows.join('\n')}`;
}

function buildOutcomeStreak(episodes: Node[]): string {
  const recent = episodes.slice(0, PROMPT_LIMITS.episodeArc);
  if (recent.length === 0) return '';

  const outcomes = recent.map(ep => String(ep.meta?.outcome ?? '—'));
  const outcomeStr = outcomes.join(' → ');

  let blockedStreak = 0;
  for (const o of outcomes) {
    if (o === 'blocked') blockedStreak++;
    else break;
  }

  let annotation = '';
  if (blockedStreak >= PROMPT_LIMITS.blockedStreakThreshold) {
    annotation = ` ⚠️ ${blockedStreak} consecutive blocked sessions — consider changing approach`;
  }

  return `## Research Momentum
Last ${outcomes.length} outcomes: ${outcomeStr}${annotation}`;
}

function buildBacklogDigest(items: BacklogItem[]): string {
  if (items.length === 0) return '';

  const shown = items.slice(0, PROMPT_LIMITS.backlogDigest);
  const lines = shown.map(item => `- [ ] ${item.text} (from ${item.episodeId})`);
  const summary = items.length > PROMPT_LIMITS.backlogDigest
    ? `\n(showing ${PROMPT_LIMITS.backlogDigest} of ${items.length} pending items)`
    : '';

  return `## Backlog (${items.length} pending items)
${lines.join('\n')}${summary}`;
}

function buildActiveFrontier(transitions: TransitionRecommendation[]): string {
  if (transitions.length === 0) return '';

  const shown = transitions.slice(0, PROMPT_LIMITS.activeFrontier);
  const lines = shown.map(t => {
    const evidence = t.evidenceIds.length > 0 ? ` [${t.evidenceIds.join(', ')}]` : '';
    return `- ${t.nodeId}: ${t.currentStatus} → ${t.recommendedStatus} (${t.reason})${evidence}`;
  });

  return `## Active Frontier (${transitions.length} transition-ready)
${lines.join('\n')}`;
}

function buildOpenQuestions(questions: Node[]): string {
  if (questions.length === 0) return '';

  const shown = questions.slice(0, PROMPT_LIMITS.openQuestions);
  const lines = shown.map(q => {
    const urgency = String(q.meta?.urgency ?? 'MEDIUM');
    if (urgency === 'BLOCKING') {
      return `- **[BLOCKING]** ${q.id}: "${q.title}"`;
    }
    return `- ${q.id}: "${q.title}" (${urgency})`;
  });

  return `## Open Questions (${questions.length})
${lines.join('\n')}`;
}

function buildEpisodeDirective(episodes: Node[]): string {
  if (episodes.length === 0) return '';

  const lines: string[] = [];
  lines.push(`Read the latest episode for context: \`read-node ${episodes[0].id}\``);

  const extras = episodes.slice(1, PROMPT_LIMITS.episodeDirective);
  if (extras.length > 0) {
    const ids = extras.map(ep => `\`read-node ${ep.id}\``).join(', ');
    lines.push(`For deeper history, also check: ${ids}`);
  }

  return `## Episode Directive
${lines.join('\n')}`;
}

function buildAdaptiveInstructions(data: SessionData): string {
  const instructions: string[] = [];

  // Always: read latest episode
  if (data.episodes.length > 0) {
    instructions.push(`Read latest episode \`${data.episodes[0].id}\` for session context.`);
  }

  // Consolidation overdue
  if (data.consolidation.triggers.length > 0) {
    instructions.push('**Consolidation is overdue.** Run the `consolidation` prompt before starting new exploration.');
  }

  // Blocking questions
  const blocking = data.openQuestions.filter(q => String(q.meta?.urgency) === 'BLOCKING');
  if (blocking.length > 0) {
    instructions.push(`**${blocking.length} BLOCKING question(s)** need resolution: ${blocking.map(q => q.id).join(', ')}.`);
  }

  // Transitions available
  if (data.transitions.length > 0) {
    instructions.push(`${data.transitions.length} node(s) are ready for status transitions. Review the Active Frontier above.`);
  }

  // Pending backlog
  if (data.backlogItems.length > 0) {
    instructions.push(`${data.backlogItems.length} pending backlog item(s). Consider picking up unfinished work.`);
  }

  // Outcome streak warning
  const recentBlocked = data.episodes.slice(0, 3).filter(e => String(e.meta?.outcome) === 'blocked').length;
  if (recentBlocked >= PROMPT_LIMITS.blockedStreakThreshold) {
    instructions.push('Recent sessions have been blocked. Consider changing approach or breaking the problem down.');
  }

  // Default
  if (instructions.length === 0) {
    instructions.push('Graph is in good shape. Explore open questions or start new experiments.');
  }

  return `## Session Priorities
${instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

Use the \`list-nodes\` and \`read-node\` tools to explore specific nodes in detail.`;
}

// ── Main Builder ────────────────────────────────────────────────────

function buildSessionContext(data: SessionData): string {
  const sections: string[] = [
    '# EMDD Graph Context — Session Start',
    '',
    buildGraphOverview(data.health),
  ];

  // Episode Arc
  const episodeArc = buildEpisodeArc(data.episodes);
  if (episodeArc) sections.push('', episodeArc);

  // Outcome Streak
  const outcomeStreak = buildOutcomeStreak(data.episodes);
  if (outcomeStreak) sections.push('', outcomeStreak);

  // Backlog Digest
  const backlog = buildBacklogDigest(data.backlogItems);
  if (backlog) sections.push('', backlog);

  // Active Frontier
  const frontier = buildActiveFrontier(data.transitions);
  if (frontier) sections.push('', frontier);

  // Open Questions
  const questions = buildOpenQuestions(data.openQuestions);
  if (questions) sections.push('', questions);

  // Consolidation Status
  const consolidationText = data.consolidation.triggers.length > 0
    ? '**[Consolidation recommended]** Triggers met:\n' + data.consolidation.triggers.map(t => `  - ${t.message}`).join('\n')
    : 'No consolidation triggers active.';
  sections.push('', `## Consolidation Status\n${consolidationText}`);

  // Episode Directive
  const directive = buildEpisodeDirective(data.episodes);
  if (directive) sections.push('', directive);

  // Adaptive Instructions (replaces static 6-step)
  sections.push('', buildAdaptiveInstructions(data));

  return sections.join('\n');
}

export function registerContextLoading(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    { graphDir: z.string().optional().describe('Path to the EMDD graph directory'), lang: z.string().optional().describe('Language locale (en or ko)') },
    async ({ graphDir: rawGraphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);
      try {
        const graphDir = rawGraphDir || resolveGraphDir();
        const health = await getHealth(graphDir);

        let text: string;
        if (health.totalNodes === 0) {
          text = buildFirstSessionGuide();
        } else {
          const [nodes, consolidation, backlogResult, transitions] = await Promise.all([
            listNodes(graphDir),
            checkConsolidation(graphDir),
            getBacklog(graphDir, 'pending'),
            detectTransitions(graphDir),
          ]);

          const episodes = nodes
            .filter(n => n.type === 'episode')
            .sort((a, b) => (nodeDate(b)?.getTime() ?? 0) - (nodeDate(a)?.getTime() ?? 0));

          const openQuestions = nodes
            .filter(n => n.type === 'question' && n.status === 'OPEN')
            .sort((a, b) => (URGENCY_ORDER[String(a.meta?.urgency)] ?? 99) - (URGENCY_ORDER[String(b.meta?.urgency)] ?? 99));

          text = buildSessionContext({
            health,
            nodes,
            consolidation,
            episodes,
            backlogItems: backlogResult.items,
            transitions,
            openQuestions,
          });
        }

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
