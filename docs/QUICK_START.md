# EMDD Quick Start

> **Using an AI assistant?** You don't need to create files manually. After Step 1 (init), connect via MCP and ask your AI to load the `context-loading` prompt -- it will guide you through creating your first nodes. See [MCP Setup](MCP_SETUP.md).

> From zero to a working knowledge graph in 15 minutes.

## Prerequisites

- A project directory (new or existing)
- An AI coding assistant (Claude Code, Cursor, Windsurf, or any tool that can read/write Markdown files)
- That's it. No installation required.

## Step 1: Create the Graph Directory (1 minute)

```bash
mkdir -p graph/{hypotheses,experiments,findings,knowledge,questions,episodes}
mkdir -p scratchpad
```

You do not need `decisions/` or `_analysis/` yet. Those come later when you adopt Full EMDD.

## Step 2: Define Your Problem (3 minutes)

Create your first Knowledge node to anchor the graph. This is the established fact that everything else builds on.

Create `graph/knowledge/knw-001.md`:

```markdown
---
id: knw-001
type: knowledge
status: active
confidence: 1.0
created: 2026-03-15
created_by: human:yourname
tags: [problem-definition]
links: []
---

# [Your project's core problem statement]

## Context
- [What you already know for certain]
- [Key constraints or requirements]
- [Relevant prior work or literature]
```

This is a Knowledge node -- it records confirmed facts, not guesses. If you are not sure about something, that belongs in a Hypothesis (next step).

## Step 3: Form Your First Hypothesis (3 minutes)

What is your best guess at a solution or direction? A good hypothesis is a **testable claim** -- something an experiment could prove wrong.

Create `graph/hypotheses/hyp-001.md`:

```markdown
---
id: hyp-001
type: hypothesis
status: proposed
confidence: 0.4
risk_level: high
priority: 1
created: 2026-03-15
created_by: human:yourname
tags: [your-topic]
links:
  - target: knw-001
    relation: depends_on
kill_criterion: "[What specific result would prove this wrong?]"
---

# [Your hypothesis -- a testable claim]

## Rationale
- [Why you think this might be true]
- [What evidence or intuition supports it]

## How to Test
- [What experiment would validate or invalidate this?]
```

Two things to get right here:

- **`confidence: 0.4`** -- start low. You have not tested it yet. This number will move as evidence comes in.
- **`kill_criterion`** -- write this before you start testing. It forces you to define what failure looks like while you are still objective about it.

## Step 4: Design an Experiment (3 minutes)

An Experiment is a unit of work that tests a Hypothesis. It does not have to be a formal lab experiment -- running a benchmark, writing a prototype, or reading a paper all count.

Create `graph/experiments/exp-001.md`:

```markdown
---
id: exp-001
type: experiment
status: planned
created: 2026-03-15
created_by: human:yourname
tags: [your-topic]
links:
  - target: hyp-001
    relation: tests
---

# [Experiment title -- what you will actually do]

## Setup
- [Tools, data, or environment needed]
- [Steps you will follow]

## Expected Outcome
- If hypothesis is correct: [expected result]
- If hypothesis is wrong: [expected result]

## Actual Results
(Fill in after running the experiment)
```

Writing the expected outcomes before running the experiment prevents you from rationalizing whatever result you get. This is the core of hypothesis-driven work.

## Step 5: Write Your First Episode (5 minutes)

After you have done some work -- ran an experiment, read some papers, wrote some code -- record what happened. An Episode is a session log: what you tried, what you learned, and where to go next.

Create `graph/episodes/ep-001.md`:

```markdown
---
id: ep-001
type: episode
trigger: "Project kickoff"
created: 2026-03-15
duration: ~30m
outcome: success
created_by: human:yourname
tags: [setup, kickoff]
links:
  - target: knw-001
    relation: produces
  - target: hyp-001
    relation: produces
---

# EP-001: Project Kickoff

## What I Tried
- Defined the core problem in knw-001
- Formed initial hypothesis in hyp-001
- Designed first experiment in exp-001

## What Got Stuck
- [Any blockers or wrong turns -- leave this out if nothing got stuck]

## What's Next
- [ ] Run exp-001
  - Prerequisite reading: knw-001, hyp-001
- [ ] [Another next step you are considering]
  - Prerequisite reading: [relevant node IDs]
```

The two mandatory sections are **What I Tried** and **What's Next**. The other sections (What Got Stuck, What Was Deliberately Not Done, Questions That Arose) are optional -- include them when they apply, skip them when they do not.

The **Prerequisite reading** line under each next step is important: it tells future-you (or your AI assistant) exactly which nodes to load before starting that task. The previous Episode curates the context for the next one.

## What You Have Now

```
graph/
  knowledge/knw-001.md     -- Your problem definition
  hypotheses/hyp-001.md    -- Your first testable guess
  experiments/exp-001.md   -- How you will test it
  episodes/ep-001.md       -- Record of your first session
```

This is a minimal but complete EMDD graph. Four files. The Episode's "What's Next" section tells you exactly where to start tomorrow, and which nodes to re-read before you begin.

## The Daily Loop

Once the graph exists, your daily workflow is simple:

1. **Start a session**: Read the latest Episode's "What's Next" section. Load the prerequisite nodes.
2. **Do the work**: Run experiments, write code, read papers.
3. **End the session**: Write a new Episode. Record what you tried, create Findings for what you learned, and list what comes next.

That is it. The graph grows naturally from this loop.

## Next Steps

### This Week (Lite EMDD)

- Run experiments, create Findings when you learn something (`graph/findings/find-001.md`)
- Use four edge types: `supports`, `contradicts`, `produces`, `spawns`
- Write an Episode at the end of each work session
- Do not worry about Consolidation or Knowledge promotion yet

**You are doing it right when:** You can open last week's Episode and immediately know what to do next.

### Next Week (Standard EMDD)

- When you have 5+ Findings, run your first Consolidation -- review Findings and promote the confirmed ones to Knowledge
- Create Question nodes (`graph/questions/q-001.md`) for things you do not know yet
- Add three more edge types: `promotes`, `answers`, `extends`

**You are doing it right when:** Findings regularly get promoted to Knowledge, and new Questions emerge from Episodes.

### Month 2+ (Full EMDD)

- Add Decision nodes, risk prioritization, and gap detection
- Adopt the full ceremony schedule (Weekly Review, Milestone, Pivot)
- See the [Phased Adoption Guide](spec/SPEC_EN.md#11-phased-adoption-guide) for details

**You are doing it right when:** The graph tells you what to explore next, not just what you have already done.

## Tips

- **Start messy.** Throw nodes in first, organize later. The moment the graph feels like bureaucracy, you are over-structuring.
- **Record failures.** Dead ends are knowledge too. A confirmed "this does not work" is as valuable as a success -- it prevents you and others from walking the same dead end again.
- **Let the AI help.** Ask your AI assistant to maintain the graph, detect gaps, and suggest next steps. The AI is a gardener, not an architect -- it tends the graph, but you decide where it grows.
- **Keep Episodes short.** "What I tried" and "What's next" are the only mandatory sections. A five-line Episode is better than no Episode.
- **Do not delete -- deprecate.** When a hypothesis is wrong, change its status to `refuted`. When knowledge is overturned, mark it `retracted`. The graph should be able to answer "why didn't we try that?" six months from now.

---

*Prefer a faster, copy-paste-only walkthrough? Try [EMDD in 5 Minutes](TUTORIAL.md). For a complete example graph, see [`examples/ml-backbone-selection/`](../examples/ml-backbone-selection/). For the complete methodology, read the [full specification](spec/SPEC_EN.md). For the philosophical foundation, see [Philosophy](PHILOSOPHY.md). For term definitions, see the [Glossary](GLOSSARY.md).*
