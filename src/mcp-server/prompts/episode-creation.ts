import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PROMPT_META } from './meta.js';

const meta = PROMPT_META.find(p => p.name === 'episode-creation')!;

export function registerEpisodeCreation(server: McpServer): void {
  server.prompt(
    meta.name,
    meta.description,
    async () => {
      const text = `# EMDD Episode Creation Guide

An Episode is a session log that records what you tried, what you learned, and where to go next. It is the backbone of the EMDD temporal chain — each Episode curates the context for the next session.

## Step-by-Step Checklist

1. **Determine the Episode ID**: Use the next sequential ID (e.g., epi-004 if epi-003 exists).
2. **Write the frontmatter** (see template below).
3. **Fill in mandatory sections**:
   - "What I Tried" — summarize the work done this session.
   - "What's Next" — list planned next steps with prerequisite reading nodes.
4. **Fill in optional sections** (include when relevant):
   - "What Got Stuck" — blockers, wrong turns, or dead ends.
   - "What Was Deliberately Not Done" — choices to defer or skip, with reasons.
   - "Questions That Arose" — new questions to convert to Question nodes at consolidation.
5. **Add links** to all nodes created, updated, or referenced during the session.
6. **Verify prerequisite reading** under each "What's Next" item — this is critical for future context loading.

## Frontmatter Template

\`\`\`yaml
---
id: epi-XXX
type: episode
status: COMPLETED
trigger: "Description of what prompted this session"
created: YYYY-MM-DD
updated: YYYY-MM-DD
duration: ~Xm
outcome: success | partial | blocked
created_by: human:yourname
tags: [relevant, tags]
links:
  - target: node-id
    relation: produces
---
\`\`\`

## Linking Instructions

- Use \`produces\` for nodes created during this session.
- Use \`relates_to\` for nodes referenced or updated.
- Use \`context_for\` for nodes that provided background context.
- Every Episode should link to at least one other node.

## Body Template

\`\`\`markdown
# EPI-XXX: Session Title

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
- Write the Episode at the end of each session, not days later.`;

      return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
      };
    },
  );
}
