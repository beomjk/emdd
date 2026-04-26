# EMDD vs. Existing Tools and Methodologies

This document compares EMDD (Evolving Mindmap-Driven Development) with existing knowledge management tools and research methodologies. The goal is to help you decide whether EMDD fits your needs -- not to claim it is universally superior.

## When to Use EMDD

- **You are doing exploratory R&D** where the destination is unknown -- investigating novel architectures, analyzing complex visual inspection pipelines, or running open-ended experiments without a fixed spec.
- **You need to track how your understanding evolved**, not just what you currently know. The history of failed hypotheses and dead ends is as valuable as the successes.
- **You work with AI assistants** (e.g., Claude Code, Codex) and want the AI to maintain the knowledge structure, detect gaps, and suggest next steps -- while you retain judgment.
- **Your project has a defined scope and lifetime.** EMDD is designed for a single research project's working memory, not for accumulating lifetime knowledge.
- **You want structure without bureaucracy.** You need more rigor than a scratchpad but less overhead than a full project management system.

## When NOT to Use EMDD

- **You already know what to build.** If you have clear requirements and acceptance criteria, use Agile/Scrum/SDD. EMDD is for exploration, not execution.
- **You want a lifetime knowledge base.** For accumulating personal knowledge across years and topics, use Obsidian, Logseq, or a Zettelkasten. EMDD is project-scoped by design.
- **Your team needs real-time collaborative editing.** EMDD's current implementation (Markdown + Git) supports async collaboration but not live co-editing. Notion or Google Docs may be better for that.
- **You need a legal record of research.** Traditional lab notebooks with witnessed, signed, and dated entries have legal standing for IP protection. EMDD does not replace this function (though Git history provides some auditability).
- **You want a turnkey tool.** EMDD is a methodology with a lightweight reference implementation. If you want a polished GUI out of the box, Obsidian or Notion will serve you better today.

## Comparison Matrix

| Feature | EMDD | Obsidian | Roam | Logseq | Notion | Zettelkasten | DDP | HDD | nbdev | Lab Notebook |
|---|---|---|---|---|---|---|---|---|---|---|
| **Knowledge model** | Typed knowledge graph (7 node types, 14 edge types) | Free-form graph (links between notes) | Block-level graph (bidirectional links) | Block-level outliner + graph | Relational database + docs | Atomic notes + links | Assumption register (list) | Hypothesis cards (flat) | Notebooks (linear + code) | Sequential pages |
| **AI integration** | Native (AI as "gardener" of the graph) | Plugin (community plugins, InfraNodus) | None built-in | None built-in | Native (Notion AI agents, multi-model) | None (method predates AI) | None (method) | None (method) | None | None |
| **Temporal tracking** | First-class (all nodes track created/updated/deprecated, evolution history preserved) | Manual (version via Git or Obsidian Sync history) | Limited (page history) | Limited (Git-based) | Page history (snapshots) | None inherent (cards are static) | Milestone checkpoints | Per-experiment results | Notebook versions | Strong (date-based sequential entries) |
| **Gap detection** | Automated (5 types: disconnected clusters, untested hypotheses, blocking questions, stale knowledge, orphan findings) | Manual (visual graph inspection) | Manual (graph exploration) | Manual (graph + queries) | None | Manual (review note connections) | Manual (assumption checklist review) | None | None | None |
| **Hypothesis lifecycle** | Full (PROPOSED -> TESTING -> SUPPORTED/REFUTED/REVISED, confidence scores, kill criteria, risk propagation) | None (DIY with templates) | None (DIY) | None (DIY) | None (DIY with databases) | None (notes are equal) | Partial (assumptions ranked by risk, tested at milestones) | Core (hypothesis -> experiment -> learn, but no inter-hypothesis tracking) | None | Informal (written observations) |
| **Friction budget** | Explicit target: 45 min/day (~10% of research time), with "3-minute rule" and skip permissions | Low (write notes naturally) | Low-Medium (block references add overhead) | Low (outliner is fast) | Medium (database setup, properties) | Medium (discipline required for atomic notes) | Low (planning sessions only) | Low (per-experiment only) | Medium (notebook conventions) | Low (just write) |
| **Scope** | Project-scoped (one research project's working memory) | Lifetime (personal knowledge base) | Lifetime (personal knowledge base) | Lifetime (personal knowledge base) | Flexible (team/project/personal) | Lifetime (decades of accumulated notes) | Project-scoped (one venture/initiative) | Per-feature or per-sprint | Per-library/project | Per-project or per-researcher |
| **Collaboration** | Async via Git (dual-agency: human + AI both modify graph) | Async (shared vaults, Obsidian Sync) | Real-time (multiplayer) | Real-time (DB version with RTC, beta) | Strong real-time (team workspaces, permissions) | Individual (by design) | Team (planning sessions) | Team (experiment reviews) | Individual or small team | Individual (witnessed by others) |
| **Open source / local-first** | Yes / Yes (Markdown + Git, no vendor lock-in) | Partially (app is closed-source, data is local Markdown) | No / No (cloud-based, proprietary) | Yes / Yes (open-source, local-first) | No / No (cloud-based, proprietary) | N/A (method, not software) | N/A (method) | N/A (method) | Yes / Yes (open-source, Jupyter-based) | N/A (physical or ELN software varies) |

## Detailed Comparisons

### EMDD vs. Obsidian / Roam / Logseq (PKM Tools)

The fundamental difference is **scope and purpose**. Obsidian, Roam, and Logseq are Personal Knowledge Management (PKM) tools designed to be your "second brain" -- a lifetime repository of notes, ideas, and references across all topics. EMDD is explicitly *not* a PKM system. It is a **project-scoped working memory** for a single research endeavor.

This difference has concrete consequences:

- **Node typing.** PKM tools treat all notes as equal. EMDD distinguishes between Hypotheses, Experiments, Findings, Knowledge, Questions, Decisions, and Episodes. These types carry different metadata (confidence scores, kill criteria, status transitions) that drive the methodology.
- **Directionality.** PKM tools help you *find* connections. EMDD tells you *what to explore next* through automated gap detection -- identifying untested hypotheses, disconnected clusters, and orphan findings.
- **AI role.** In PKM tools, AI is an optional plugin for search or summarization. In EMDD, the AI agent is a core participant that maintains the graph, detects patterns, and proposes research directions. The graph is co-authored by human and AI.
- **Temporal semantics.** PKM notes are typically current-state. EMDD preserves the full evolution: why a hypothesis was abandoned, what path led to a dead end, how confidence changed over time.

**Where PKM tools win:** If you want to accumulate knowledge over years, capture fleeting ideas, or build a personal reference library, PKM tools are the right choice. EMDD is too structured for casual note-taking and too project-specific for lifetime knowledge.

**Compatibility note:** EMDD's Markdown + YAML frontmatter format is deliberately compatible with Obsidian. You can open an EMDD graph directory in Obsidian and get a working graph view with `[[wikilink]]` navigation for free.

### EMDD vs. DDP (Discovery-Driven Planning)

EMDD explicitly incorporates DDP's core insight: **treat assumptions as hypotheses to be tested, and prioritize the riskiest ones first** (EMDD Principle 5: Riskiest-First Ordering). The EMDD project kickoff includes a "DDP-style assumption register" where all hypotheses are ranked by risk_level x uncertainty.

Where EMDD goes beyond DDP:

- **Graph structure.** DDP's assumption register is a prioritized list. EMDD organizes assumptions into a graph where dependencies, supports, and contradictions between hypotheses are explicitly tracked. When one assumption falls, EMDD can propagate the impact to dependent hypotheses (confidence cascading).
- **AI maintenance.** DDP requires manual review of the assumption register at milestones. EMDD's AI agent continuously monitors the graph for stale assumptions, risk propagation paths, and unvalidated high-priority hypotheses.
- **Continuous vs. milestone-based.** DDP operates at discrete checkpoints. EMDD evolves continuously -- every experiment result updates the graph in near-real-time.

**Where DDP wins:** DDP is simpler, well-established, and requires no tooling. It works well for business planning and new venture assessment where the structure of assumptions is relatively flat. If your project has a clear financial model with quantifiable assumptions, DDP's reverse income statement approach is more directly applicable than EMDD's knowledge graph.

### EMDD vs. HDD (Hypothesis-Driven Development)

HDD and EMDD share the same scientific loop: **hypothesis -> experiment -> learn -> iterate**. EMDD's Hypothesis and Experiment node types, status transitions, and kill criteria are essentially an HDD loop made explicit in graph form.

The key difference is that HDD treats each hypothesis-experiment cycle as **independent**, while EMDD tracks the **relationships between hypotheses**:

- A finding from one experiment might support hypothesis A while contradicting hypothesis B. EMDD captures this with SUPPORTS and CONTRADICTS edges.
- EMDD's DEPENDS_ON edges reveal that validating hypothesis C is pointless until hypothesis A is confirmed.
- EMDD's confidence propagation algorithm updates all connected hypotheses when new evidence arrives, not just the one being directly tested.

**Where HDD wins:** HDD is lightweight and immediately actionable. It needs no graph, no tooling, and no AI. For product teams running A/B tests or feature experiments, HDD's simplicity is a feature, not a bug. EMDD's graph machinery is overkill when hypotheses are independent and experiments are quick.

### EMDD vs. Zettelkasten

EMDD owes a direct intellectual debt to Zettelkasten. The EMDD equation explicitly includes "Zettelkasten's bottom-up emergence" as a component. Both systems believe that knowledge should grow organically from atomic units connected by meaningful links, with higher-order structure emerging rather than being imposed.

The critical difference is **direction**:

- Zettelkasten answers: "What do I know, and how is it connected?"
- EMDD answers: "What do I know, what do I *not* know, and what should I investigate next?"

EMDD adds three capabilities that Zettelkasten lacks:

1. **Gap detection.** EMDD actively identifies structural holes -- disconnected clusters, untested hypotheses, orphan findings -- and surfaces them as research directions. Zettelkasten relies on the researcher to notice gaps through serendipitous browsing.
2. **Hypothesis lifecycle.** Zettelkasten treats all notes equally. EMDD distinguishes between uncertain claims (hypotheses with confidence scores) and established facts (knowledge), with explicit transitions between them.
3. **AI agency.** Luhmann called his Zettelkasten a "conversation partner." EMDD makes this literal: the AI agent reads the graph, identifies patterns, and proposes connections and questions. The conversation is bidirectional.

**Where Zettelkasten wins:** Zettelkasten is a proven system with decades of track record for deep intellectual work. It is tool-agnostic, infinitely flexible, and imposes minimal structure. For lifetime scholarship -- writing books, developing theories over years, building a personal intellectual legacy -- Zettelkasten's simplicity and openness are strengths. EMDD's typed nodes and structured workflows would feel constraining in that context.

### EMDD vs. Lab Notebooks

A traditional lab notebook is a sequential, date-based record of experiments: what you did, what you observed, when you did it. EMDD's Episode nodes serve a similar function -- they record "what happened" in a research session, including successes, failures, and dead ends.

The difference: **EMDD is a lab notebook that talks back.**

- A lab notebook is **write-only** in practice. You record entries and rarely revisit old pages systematically. EMDD's graph structure makes every past finding, decision, and dead end searchable and interconnected.
- A lab notebook is **flat**. Entries follow each other in time. EMDD's graph reveals thematic connections across time -- a finding from week 1 might suddenly become relevant to week 8's hypothesis.
- A lab notebook is **silent**. It stores information but does not analyze it. EMDD's AI agent detects patterns across entries, identifies contradictions, and suggests what to investigate next.

**Where lab notebooks win:** Lab notebooks have irreplaceable qualities for certain contexts. They have legal standing as records of invention (critical for patents). They are simple, reliable, and require no technology. The discipline of writing by hand forces careful thought. In regulated industries (pharma, medical devices), lab notebooks with witnessed entries are often legally required. EMDD does not and should not replace this function.

### EMDD vs. nbdev

nbdev integrates code, tests, and documentation in Jupyter notebooks -- a literate programming approach where the narrative and the implementation live together. EMDD and nbdev occupy different layers of the research process.

- **nbdev** answers: "How do I keep my code, docs, and tests in sync?"
- **EMDD** answers: "How do I track what I know, what I don't know, and what to explore next?"

nbdev does not track the *evolution* of understanding. It captures the current state of code and its documentation, not why you chose this approach over alternatives, what hypotheses you tested and abandoned, or what gaps remain. EMDD fills that layer.

**Where nbdev wins:** For library development and reproducible research artifacts, nbdev is excellent. If your primary output is a Python package with documentation, nbdev's notebook-to-package pipeline is far more practical than EMDD's knowledge graph. The two tools address different problems.

## Complementary Use

EMDD is a methodology, not a walled garden. It is designed to work alongside other tools:

- **Obsidian as a viewer.** EMDD's Markdown files can be opened directly in Obsidian, giving you graph visualization, full-text search, and `[[wikilink]]` navigation with zero additional setup. Use EMDD's methodology and AI agent for graph maintenance; use Obsidian's UI for browsing and exploration.
- **DDP thinking at kickoff.** Use DDP's reverse income statement and assumption register approach during EMDD's project kickoff ceremony (Day 0) to identify and prioritize initial hypotheses.
- **HDD for individual experiments.** Each EMDD Experiment node can follow HDD's hypothesis-experiment-learn loop internally. EMDD adds the cross-experiment relationship layer on top.
- **Lab notebook for daily notes.** EMDD's scratchpad protocol (quick notes during deep work with `[!]` markers for surprises) is essentially a lightweight lab notebook practice. For regulated contexts, maintain a formal lab notebook alongside the EMDD graph.
- **nbdev for code artifacts.** When an EMDD experiment produces code worth packaging, nbdev can manage the code-to-library pipeline. The EMDD Experiment node references the nbdev project as an artifact.
- **Zettelkasten for lifetime knowledge.** After an EMDD project concludes, promote key Knowledge nodes into your personal Zettelkasten for long-term retention. EMDD is the working memory; Zettelkasten is the long-term memory.
