# EMDD Agent Behavior Guidelines

## Session Workflow

1. **Session Start**: Read the latest Episode's "What's Next" section. Load prerequisite nodes.
2. **During Work**: Execute experiments, write code, take notes. Mark surprises with [!].
3. **Session End**: Write a new Episode. Record what was tried, create Findings, list next steps.

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

**Read operations:**
- `list-nodes` — List nodes with optional type/status filters
- `read-node` — Read a single node (frontmatter + body)
- `graph-neighbors` — Get a node's neighbors and connections

**Write operations:**
- `create-node` — Create a new node
- `create-edge` — Add a link between nodes
- `update-node` — Update node frontmatter fields
- `delete-edge` — Remove a link between nodes
- `mark-done` — Mark an episode checklist item
- `index-graph` — Generate _index.md

**Analysis operations:**
- `health` — Compute graph health report
- `check` — Check consolidation triggers
- `promote` — Identify promotion candidates
- `confidence-propagate` — Propagate confidence across the graph
- `status-transitions` — Detect recommended status transitions
- `kill-check` — Check kill criteria for hypotheses
- `graph-gaps` — Detect structural gaps (orphans, stale, disconnected)
- `analyze-refutation` — Analyze refutation impact on hypotheses
- `lint` — Lint the graph for schema errors
- `backlog` — Show project backlog (open items, deferred, checklists)
- `branch-groups` — List and analyze branch groups
- `mark-consolidated` — Record consolidation date

**Prompts:**
- `context-loading` — Load graph context for a session
- `episode-creation` — Guide episode creation
- `consolidation` — Guide consolidation workflow
- `health-review` — Guide health review workflow
