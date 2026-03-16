# EMDD — Evolving Mindmap-Driven Development

You are working in a project that uses the EMDD methodology. EMDD organizes research and exploration as a knowledge graph stored in `graph/` with Markdown + YAML frontmatter files, tracked by Git.

## Graph Structure

The graph contains 7 node types, each in its own subdirectory:

| Node Type | Directory | Purpose |
|-----------|-----------|---------|
| Hypothesis | `graph/hypotheses/` | Testable claims with confidence scores |
| Experiment | `graph/experiments/` | Units of work that test hypotheses |
| Finding | `graph/findings/` | Observations from experiments |
| Knowledge | `graph/knowledge/` | Established facts promoted from findings |
| Question | `graph/questions/` | Open questions driving exploration |
| Decision | `graph/decisions/` | Recorded choices with rationale |
| Episode | `graph/episodes/` | Session logs linking work to the graph |

Nodes are connected by typed edges (supports, contradicts, spawns, produces, tests, depends_on, extends, promotes, answers, etc.) declared in YAML frontmatter `links:` arrays.

## Node File Format

Every node is a Markdown file with YAML frontmatter:

```yaml
---
id: hyp-001
type: hypothesis
status: PROPOSED
confidence: 0.4
created: 2026-03-15
updated: 2026-03-15
created_by: human:yourname
tags: [topic]
links:
  - target: knw-001
    relation: depends_on
---
# Title here
Body content...
```

Required fields vary by type. All nodes need: `id`, `type`, `status`, `created`, `updated`. Hypotheses and findings also need `confidence` (0.0-1.0).

## Node ID Convention

IDs use type prefix + sequential number: `hyp-001`, `exp-003`, `fnd-012`, `knw-005`, `qst-002`, `dec-001`, `epi-007`.

## Episode Writing Protocol

Episodes are the primary mechanism for maintaining research continuity. Write an Episode at the end of each work session.

**Mandatory sections:**
- **What I Tried** — what was done this session
- **What's Next** — planned next steps with prerequisite reading nodes

**Optional sections:**
- What Got Stuck — blockers or wrong turns
- What Was Deliberately Not Done — deferred items with reasons
- Questions That Arose — new questions for the graph

Each "What's Next" item should list prerequisite reading: the node IDs to load before starting that task. This curates context for the next session.

## Consolidation Protocol

Consolidation is a mandatory maintenance ceremony. Check triggers after creating Episodes or Findings.

**Triggers (run if ANY apply):**
- 5 or more Finding nodes added since last Consolidation
- 3 or more Episode nodes added since last Consolidation
- 0 open Questions (the illusion that research is "done")
- An Experiment has 5+ Findings attached

**Consolidation steps:**
1. **Promotion** — promote established Findings to Knowledge nodes
2. **Splitting** — split bloated Experiments into meaningful units
3. **Question generation** — convert Episode questions into Question nodes
4. **Hypothesis update** — update confidence based on evidence
5. **Orphan cleanup** — add connections to unlinked Findings

Consolidation is an obligation, not optional. Do not record Consolidation as an Episode. Do not start new exploration during Consolidation.

## Key Principles

1. **Graph is source of truth** — the graph, not code, is the project's knowledge structure
2. **Minimum viable structure** — add structure only when needed; if it feels like bureaucracy, reduce it
3. **Gap-driven exploration** — the most valuable information is in the empty spaces between nodes
4. **Temporal evolution** — never delete wrong paths; deprecate them. The history of why something failed is itself knowledge
5. **Riskiest-first** — validate the most uncertain hypotheses first
6. **Archive, don't delete** — change status to REFUTED/RETRACTED/SUPERSEDED instead of removing nodes

## AI Agent Role

You are a **gardener** of the graph:
- Maintain connections, detect duplicates, identify orphans
- Detect patterns and potential connections the researcher missed
- Suggest exploration directions based on structural gaps
- Automate routine tasks (literature search, result summarization)
- Never make judgment calls — suggest, don't decide
