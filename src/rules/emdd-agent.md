# EMDD Agent Behavior Guidelines

## Session Cycle (MCP Prompts)

Every session follows this prompt cycle:

```
  ┌→ context-loading ──→ [Work] ──→ episode-creation ──┐
  │    Session Start                  Session End       │
  └── health-review ◄── consolidation ◄────────────────┘
       Review             Maintenance (if triggered)
```

1. **Session Start** → Run the `context-loading` prompt. Review graph state, check gaps, read latest Episode's "What's Next".
2. **During Work** — Execute experiments, write code, take notes. Mark surprises with [!].
3. **Session End** → Run the `episode-creation` prompt. Record what was tried, create Findings, list next steps with prerequisite node IDs.
4. **Maintenance** → Run the `consolidation` prompt when triggers fire. Promote findings, split experiments, update confidence.
5. **Review** → Run the `health-review` prompt periodically for a full health dashboard with recommendations.

> Steps 4-5 are not mandatory every session — run when consolidation triggers fire or on a weekly cadence.

## Intervention Rules

- During deep work: do not interrupt unless a kill criterion is hit or a crash occurs
- Suggestions are a menu, not an order — the researcher selects what to pursue
- After a suggestion is rejected: 24-hour cooldown before re-suggesting
- Never negate an idea still forming in early exploration stages

## Authority Scope

**No approval needed:**
- Recording experiment metrics as Finding/Result nodes → `create-node`, `create-edge`
- Updating Experiment status (PLANNED -> RUNNING -> COMPLETED) → `update-node`
- Time-based attribute updates (updated field) → `update-node`

**Approval required:**
- Changing Hypothesis confidence → `update-node`
- Creating new Hypothesis or Question nodes → `create-node`
- Adding or deleting edges → `create-edge`, `delete-edge`
- Changing Knowledge status (DISPUTED/RETRACTED) → `update-node`
- Creating Decision nodes → `create-node`

**Forbidden:**
- Deleting any node (archive/deprecate instead)
- Modifying kill criteria

## Graph Maintenance Tasks

- After experiments: update related node statuses and confidence scores (with approval) → `update-node`, `confidence-propagate`
- Check Consolidation triggers after creating Episodes or Findings → `check`
- Identify orphan nodes (nodes with no outgoing links) → `graph-gaps`
- Detect stale nodes (untested hypotheses older than 3 days) → `graph-gaps`
- Flag structural gaps between clusters → `graph-gaps`

## Available MCP Tools

<!-- AUTO:agent-tools -->
<!-- Generated from command registry — DO NOT EDIT -->

**Read operations:**
- `list-nodes` — List nodes, optionally filtered by type, status, and/or date
- `read-node` — Read a node detail
- `read-nodes` — Read multiple nodes in a single operation (batch)
- `graph-neighbors` — List neighbor nodes within BFS depth

**Write operations:**
- `create-node` — Create a new node
- `create-edge` — Create an edge between two nodes
- `delete-edge` — Remove a link between nodes
- `update-node` — Update frontmatter fields on a node
- `mark-done` — Mark a checklist item as done in an episode
- `index-graph` — Generate the _index.md file

**Analysis operations:**
- `graph-gaps` — Show structural gaps in the graph
- `health` — Show health dashboard
- `check` — Check consolidation readiness
- `promote` — Show promotion candidates
- `confidence-propagate` — Propagate confidence scores through the graph
- `status-transitions` — Detect available status transitions
- `kill-check` — Check kill criteria alerts
- `branch-groups` — List hypothesis branch groups
- `lint` — Lint the graph for schema errors
- `backlog` — Show project backlog (open items, deferred, checklists)
- `analyze-refutation` — Analyze refutation patterns in the graph
- `mark-consolidated` — Record a consolidation date to reset episode counting

**Prompts:**
- `context-loading` — [Cycle 1/4 · Session Start] Load EMDD graph context — provides a summary of nodes, edges, health, and structural gaps
- `episode-creation` — [Cycle 2/4 · Session End] Step-by-step guide for writing an EMDD Episode node — includes frontmatter template, mandatory sections, and linking instructions
- `consolidation` — [Cycle 3/4 · Maintenance] Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses
- `health-review` — [Cycle 4/4 · Review] Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density
<!-- /AUTO:agent-tools -->
