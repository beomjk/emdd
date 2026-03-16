# EMDD: Philosophy and Principles

> This document explains the *why* behind EMDD. For practical usage, see the [Operations Guide](OPERATIONS.md). For the complete specification, see [SPEC_EN.md](spec/SPEC_EN.md).

---

## 1. Problem Statement

Software engineering has evolved on the assumption that "you know what to build." Spec-Driven Development, Waterfall, even Agile — all stand on the premise that a destination exists. Sprints end with deliverables; tickets have acceptance criteria. This works for development. It does not work for research. Research is, by nature, exploration without a specification.

On the opposite end lies vibe-coding: following intuition freely. This is creative but fatally flawed — it is irreproducible, yesterday's findings vanish from today's context, and you end up walking the same dead ends over and over. The tension James March identified between exploration and exploitation — the balance between discovering new possibilities and leveraging what you know — reproduces exactly at the level of an individual researcher's workflow.

**Too much structure suffocates exploration. Too little structure evaporates it.**

Existing methodologies capture only one facet of this problem. HDD provides a hypothesis-testing loop but does not track relationships between hypotheses. DDP prioritizes assumptions but cannot accommodate unexpected connections. nbdev unifies code and documentation but cannot express the evolution of knowledge. Zettelkasten produces bottom-up emergence but cannot tell you "what to explore next."

What we need is not the intersection of all these, but something that fills the single absence they all share: **a living structure built for exploration itself.**

---

## 2. The EMDD Equation

```
EMDD = Zettelkasten's bottom-up emergence
     + DDP's risk-first validation
     + InfraNodus's structural gap detection
     + Graphiti's temporal evolution
     ─────────────────────────────────
       Autonomous maintenance and suggestions by an AI agent
```

Delegate cognitive load to the graph and the AI, but never delegate judgment.

---

## 3. Core Principles (7)

### Principle 1: Graph as First-Class Citizen
The graph — not the code — is the project's source of truth. Nodes contain **knowledge and hypotheses**, not code modules. The graph simultaneously expresses "what we have learned so far" and "what we need to learn next." Code is an artifact derived from graph nodes.

### Principle 2: Minimum Viable Structure
Structure should exist only in the minimum necessary amount. When node formats are flexible, edge semantics are loose, and the overall graph shape is unpredictable — structure is working correctly. The moment it feels like bureaucracy, reduce it.

### Principle 3: Gap-Driven Exploration
The most valuable information in a graph is not in the nodes — it is in the empty spaces between them. Clusters that seem like they should be connected but are not; questions without answers; hypotheses without validation. The AI agent detects these gaps and suggests them. The researcher selects which are worth pursuing.

### Principle 4: Temporal Evolution
Nodes are created, modified, and deprecated. Hypotheses are validated or refuted. The full history of all these changes must be preserved within the graph. Tracking "how we got here" is as important in research as the results themselves. **Do not delete wrong paths — the knowledge of why they were wrong is itself knowledge.**

### Principle 5: Riskiest-First Ordering
Validate the most uncertain hypotheses first — the ones that could change the entire direction if they fail. Testing safe bets first is psychologically comfortable but strategically wrong. The AI agent identifies risk propagation paths ("if this falls, that falls too") and suggests validation priorities.

### Principle 6: Dual Trigger Evolution
The graph does not evolve in a single direction. When the human researcher inputs experimental results, the graph evolves. When the AI agent discovers patterns or detects conflicts with external knowledge, the graph evolves. This bidirectional triggering is the core dynamic of EMDD.

### Principle 7: Taste over Technique
AI is faster than humans at reading papers, matching patterns, generating code, and running experiments. But the judgment of "is this direction worth pursuing?" or "is this result interesting?" belongs to humans. In EMDD, AI suggestions are always suggestions, never decisions.

---

## 4. Three Roles

### The Researcher (Human): Taste, Judgment, Leaps

- **Exercises taste** — selects which AI-suggested exploration directions are worth pursuing
- **Makes judgments** — decides whether to revise or discard hypotheses
- **Makes leaps** — creates intuitive connections, analogies, and reframings that cannot be derived from the graph's logical structure alone
- Core action: **node creation and hypothesis verdicts**

### The Graph (Artifact): Living Knowledge Structure

Serves three roles simultaneously:
- **Knowledge representation**: a map of what is known and what remains unknown
- **Project roadmap**: gaps and untested hypotheses naturally compose the "what to do next" agenda
- **Research memory**: a record of attempted paths, failed hypotheses, and direction changes

### The Agent (AI): Gardener

The AI agent is a **gardener** of the graph, not an architect:
- **Maintenance**: cleaning up connections, detecting duplicates, identifying orphan nodes, maintaining consistency
- **Pattern detection**: identifying potential connections between nodes that the researcher missed
- **Gap suggestion**: structural gap analysis leading to exploration direction proposals
- **Automation**: literature search, experiment code generation, result summarization (the technique domain)

---

## 5. What EMDD Is Not

- **Not a project management tool**: no deadlines, no progress percentages. It tracks "what we know and what we don't."
- **Not a knowledge base**: the value lies not in organized information but in the tensions, contradictions, and gaps between information. A tidy graph is a dead graph.
- **Not SDD with a graph bolted on**: the specification does not come first. Direction emerges from the exploration process.
- **Not a personal knowledge management system**: it is **project-scoped**. Not a second brain for a lifetime of knowledge, but working memory for a single exploration.
- **Not outsourcing research to AI**: the AI only prunes branches, waters the garden, and says "there's empty ground over there."

---

*For the graph schema, workflows, and implementation details, continue to the [full specification](spec/SPEC_EN.md).*
