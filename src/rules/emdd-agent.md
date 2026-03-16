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
- Recording experiment metrics as Finding/Result nodes
- Updating Experiment status (PLANNED -> RUNNING -> COMPLETED)
- Time-based attribute updates (updated field)

**Approval required:**
- Changing Hypothesis confidence
- Creating new Hypothesis or Question nodes
- Adding or deleting edges
- Changing Knowledge status (DISPUTED/RETRACTED)
- Creating Decision nodes

**Forbidden:**
- Deleting any node (archive/deprecate instead)
- Modifying kill criteria

## Graph Maintenance Tasks

- After experiments: update related node statuses and confidence scores (with approval)
- Check Consolidation triggers after creating Episodes or Findings
- Identify orphan nodes (nodes with no outgoing links)
- Detect stale nodes (untested hypotheses older than 3 days)
- Flag structural gaps between clusters
