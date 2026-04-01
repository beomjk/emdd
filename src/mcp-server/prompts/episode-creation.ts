import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listNodes } from '../../graph/operations.js';
import { nextId } from '../../graph/templates.js';
import { nodeDate } from '../../graph/date-utils.js';
import { getLocale, setLocale } from '../../i18n/index.js';
import { PROMPT_LIMITS } from './prompt-limits.js';
import { PROMPT_META } from './meta.js';
import type { Node } from '../../graph/types.js';

// NOTE: Prompt text is intentionally NOT localized via t().
// MCP prompts are consumed by AI agents, not displayed to human users.
// setLocale() is called so downstream operations respect the user's locale.
const meta = PROMPT_META.find(p => p.name === 'episode-creation')!;

// ── Dynamic context builder ──────────────────────────────────────────

function buildDynamicEpisodeGuide(
  nextEpisodeId: string,
  lastEpisode: Node | null,
  recentNodes: Node[],
): string {
  const today = new Date().toISOString().slice(0, 10);

  // Classify nodes: new vs updated
  const classified = recentNodes.map(n => {
    const created = String(n.meta.created ?? '');
    const updated = String(n.meta.updated ?? '');
    const tag = created === updated ? '[new]' : '[updated]';
    return { node: n, tag };
  });

  // Build produces links (new nodes) and relates_to links (updated nodes)
  const producesLinks = classified
    .filter(c => c.tag === '[new]')
    .map(c => `  - target: ${c.node.id}\n    relation: produces`);
  const relatesToLinks = classified
    .filter(c => c.tag === '[updated]')
    .map(c => `  - target: ${c.node.id}\n    relation: relates_to`);
  const allLinks = [...producesLinks, ...relatesToLinks];
  const linksYaml = allLinks.length > 0
    ? `links:\n${allLinks.join('\n')}`
    : 'links: []';

  // Recent nodes list
  const recentSection = recentNodes.length > 0
    ? classified
        .map(c => `  - ${c.tag} [${c.node.id}] ${c.node.title} (${c.node.type}, ${c.node.status ?? 'no status'})`)
        .join('\n')
    : '  (no nodes changed since last episode)';

  const sinceLabel = lastEpisode
    ? `Since last episode **${lastEpisode.id}** (${String(lastEpisode.meta.updated ?? lastEpisode.meta.created ?? 'unknown date')})`
    : 'First episode — all existing nodes listed';

  return `# EMDD Episode Creation — Dynamic Context

## Next Episode ID: \`${nextEpisodeId}\`

## Recently Changed Nodes
${sinceLabel}

${recentSection}

## Pre-filled Frontmatter

\`\`\`yaml
---
id: ${nextEpisodeId}
type: episode
status: COMPLETED
trigger: "Description of what prompted this session"
created: ${today}
updated: ${today}
duration: ~Xm
outcome: success | partial | blocked
created_by: human:yourname
tags: []
${linksYaml}
---
\`\`\``;
}

// ── Static guide (reference) ─────────────────────────────────────────

function buildStaticGuide(): string {
  return `
---

# Episode Creation Reference Guide

An Episode is a session log that records what you tried, what you learned, and where to go next. It is the backbone of the EMDD temporal chain — each Episode curates the context for the next session.

## Step-by-Step Checklist

1. **Determine the Episode ID**: Use the next sequential ID shown above.
2. **Write the frontmatter** (use the pre-filled template above as a starting point).
3. **Fill in mandatory sections**:
   - "What I Tried" — summarize the work done this session.
   - "What's Next" — list planned next steps with prerequisite reading nodes.
4. **Fill in optional sections** (include when relevant):
   - "What Got Stuck" — blockers, wrong turns, or dead ends.
   - "What Was Deliberately Not Done" — choices to defer or skip, with reasons.
   - "Questions That Arose" — new questions to convert to Question nodes at consolidation.
5. **Add links** to all nodes created, updated, or referenced during the session.
6. **Verify prerequisite reading** under each "What's Next" item — this is critical for future context loading.

## Linking Instructions

- Use \`produces\` for nodes created during this session.
- Use \`relates_to\` for nodes referenced or updated.
- Use \`context_for\` for nodes that provided background context.
- Every Episode should link to at least one other node.

## Body Template

\`\`\`markdown
# ${'{EPISODE_ID}'}: Session Title

## What I Tried
- [Summary of work done]

## What Got Stuck
- [Blockers or wrong turns — omit if nothing got stuck]

## What's Next
- [ ] Next step description
  - Prerequisite reading: node-id-1, node-id-2
- [ ] Another next step
  - Prerequisite reading: node-id-3
\`\`\`

## Principles
- Keep Episodes short — "What I Tried" and "What's Next" are the only mandatory sections.
- A five-line Episode is better than no Episode.
- Do not record Consolidation as an Episode — Consolidation is a meta-activity.
- "What's Next" is for **research and exploration tasks only**. Do NOT include meta-activities (consolidation, health-review, graph maintenance) — these are handled automatically by the session cycle prompts.
- Write the Episode at the end of each session, not days later.`;
}

// ── Prompt registration ──────────────────────────────────────────────

export function registerEpisodeCreation(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    {
      graphDir: z.string().describe('Path to the EMDD graph directory'),
      lang: z.string().optional().describe('Language locale (en or ko)'),
    },
    async ({ graphDir, lang }) => {
      const locale = getLocale(lang);
      setLocale(locale);

      try {
        // Get all nodes and find episodes
        const allNodes = await listNodes(graphDir);
        const episodes = allNodes
          .filter(n => n.type === 'episode')
          .sort((a, b) => {
            const da = nodeDate(a);
            const db = nodeDate(b);
            if (!da && !db) return 0;
            if (!da) return -1;
            if (!db) return 1;
            return da.getTime() - db.getTime();
          });

        const lastEpisode = episodes.length > 0 ? episodes[episodes.length - 1] : null;
        const nextEpisodeIdStr = nextId(graphDir, 'episode');

        // Filter recently changed non-episode nodes since last episode
        let recentNodes: Node[];
        if (lastEpisode) {
          const lastDate = nodeDate(lastEpisode);
          recentNodes = allNodes
            .filter(n => n.type !== 'episode')
            .filter(n => {
              if (!lastDate) return true;
              const d = nodeDate(n);
              return d !== null && d >= lastDate;
            });
        } else {
          // First episode: list all non-episode nodes
          recentNodes = allNodes.filter(n => n.type !== 'episode');
        }

        // Cap to limit
        recentNodes = recentNodes.slice(0, PROMPT_LIMITS.recentNodes);

        const dynamicSection = buildDynamicEpisodeGuide(nextEpisodeIdStr, lastEpisode, recentNodes);
        const staticSection = buildStaticGuide();
        const text = dynamicSection + staticSection;

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
