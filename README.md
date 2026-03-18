# EMDD: Evolving Mindmap-Driven Development

> **A methodology that gives structure to R&D exploration through an AI-maintained evolving knowledge graph -- without killing the exploration itself.**

## Demo

<img src="docs/assets/demo.svg" alt="EMDD Demo" width="720">

## What is EMDD?

Too much structure suffocates research. Too little structure evaporates it. Existing approaches each solve one piece -- Zettelkasten gives bottom-up emergence, HDD gives hypothesis testing, DDP gives risk prioritization -- but none of them track the *relationships* between what you know, what you don't know, and what to explore next. EMDD fills that gap: it is a lightweight, AI-maintained knowledge graph that structures your exploration as it happens, surfaces blind spots, and remembers every dead end so you never walk it twice.

## Who is it for?

- **Solo researchers or small teams doing exploratory R&D** where the destination is unknown -- visual inspection R&D, architecture spikes, open-ended investigations.
- **Developers working with AI coding assistants** (e.g., Claude Code) who want the AI to maintain the knowledge structure while they retain judgment.
- **Anyone who has lost track of what they tried last week**, why they abandoned an approach, or which assumptions remain untested.
- **Teams that need more rigor than a scratchpad** but less overhead than a project management system.
- **Researchers who want to know what to explore next**, not just what they have already done.

## The EMDD Equation

```
EMDD = Zettelkasten's bottom-up emergence
     + DDP's risk-first validation
     + InfraNodus's structural gap detection
     + Graphiti's temporal evolution
     ─────────────────────────────────
       Autonomous maintenance and suggestions by an AI agent
```

Delegate cognitive load to the graph and the AI, but never delegate judgment.

## How It Works

EMDD has three roles. The **Researcher** exercises taste and judgment -- deciding which directions are worth pursuing, creating hypotheses, and making intuitive leaps the graph cannot derive on its own. The **Graph** is the living knowledge structure: a map of what is known, what remains unknown, and what has been tried. The **Agent** (AI) is the graph's gardener -- maintaining connections, detecting patterns and gaps, and suggesting what to explore next. Suggestions are always suggestions, never decisions.

### The Knowledge Graph

| Node Type | Purpose |
|-----------|---------|
| **Knowledge** | Confirmed facts, literature, domain rules |
| **Hypothesis** | Testable claims with confidence scores and kill criteria |
| **Experiment** | Units of work that validate or refute hypotheses |
| **Finding** | Facts or patterns discovered from experiments (observations, insights, negatives) |
| **Question** | Open research questions that need answers |
| **Decision** | Recorded decisions with rationale and alternatives considered |
| **Episode** | Record of one exploration session -- what was tried, what is next |

### The Lifecycle

```
Question ──> Hypothesis ──> Experiment ──> Finding
                                             │
                              ┌───────────────┤
                              v               v
                          Knowledge      New Question
                        (promoted)      (the cycle continues)
```

Hypotheses move through `PROPOSED -> TESTING -> SUPPORTED / REFUTED / REVISED`. Findings accumulate evidence. When a Finding has sufficient independent support, it is promoted to Knowledge. Refuted hypotheses are preserved -- the knowledge of *why* something failed is itself knowledge.

## Installation

```bash
npm install -g @beomjk/emdd
```

Or use directly with npx:

```bash
npx @beomjk/emdd <command>
```

## Quick Start

```bash
# Initialize an EMDD project
emdd init my-research

# Create your first nodes
cd my-research
emdd new question "what-causes-defects"
emdd new hypothesis "surface-cracks-from-stress"

# Link them
emdd link hyp-001 qst-001 spawned_from

# Check graph health
emdd lint
emdd health
```

See the [Quick Start Guide](docs/QUICK_START.md) for a full walkthrough.

## CLI Commands

| Command | Description |
|---------|-------------|
| `emdd init [path]` | Initialize a new EMDD project (`--tool claude\|cursor\|windsurf\|cline\|copilot\|all`, `--lang en\|ko`) |
| `emdd list [path]` | List nodes (`--type`, `--status` filters) |
| `emdd new <type> <slug>` | Create a node (hypothesis, experiment, finding, ...) |
| `emdd link <source> <target> <relation>` | Add a link between nodes |
| `emdd update <node-id> --set key=value` | Update node frontmatter |
| `emdd done <episode-id> "<item>"` | Mark an episode item with a status marker (`--marker <done\|deferred\|superseded>`) |
| `emdd lint [path]` | Validate schema and link integrity |
| `emdd health [path]` | Show graph health dashboard (`--all`) |
| `emdd check [path]` | Check consolidation triggers |
| `emdd promote [path]` | Identify promotion candidates |
| `emdd backlog [path]` | List incomplete items across all episodes (`--status <pending\|done\|deferred\|superseded\|all>`) |
| `emdd index [path]` | Generate `_index.md` |
| `emdd graph [path]` | Generate `_graph.mmd` (Mermaid) |
| `emdd confidence [path]` | Propagate confidence across the graph |
| `emdd transitions [path]` | Detect recommended status transitions |
| `emdd kill-check [path]` | Check kill criteria status for hypotheses |
| `emdd branches [path]` | List and analyze branch groups |
| `emdd mcp` | Start MCP server (stdio transport) |

The `init` command supports `--lang en|ko` for bilingual project setup.

## Phased Adoption

You do not need to adopt everything at once. Start lite and add structure as you need it.

| Phase | Duration | Node Types | Daily Overhead | You're doing it right when... |
|-------|----------|------------|----------------|-------------------------------|
| **Lite** | Week 1-2 | 4 (Hypothesis, Experiment, Finding, Episode) | ~15 min | You can open last week's Episode and immediately know what to do next |
| **Standard** | Week 3-4 | 6 (+Knowledge, Question) | ~25 min | Findings regularly get promoted to Knowledge |
| **Full** | Week 5+ | 7 (+Decision, all edge types, all ceremonies) | ~45 min | The graph tells you what to explore next |

See [section 11 of the specification](docs/spec/SPEC_EN.md#11-phased-adoption-guide) for details on each phase.

## Documentation

- [EMDD in 5 Minutes](docs/TUTORIAL.md) -- copy-paste tutorial
- [Quick Start Guide](docs/QUICK_START.md) -- get started in 15 minutes
- [Example Graph](examples/ml-backbone-selection/) -- a complete 14-node research narrative
- [Full Specification](docs/spec/SPEC_EN.md) -- the complete methodology
- [Philosophy](docs/PHILOSOPHY.md) -- why EMDD exists
- [Operations](docs/OPERATIONS.md) -- research loops, ceremonies, adoption
- [Tool Comparison](docs/COMPARISON.md) -- EMDD vs. Obsidian, Zettelkasten, DDP, HDD, nbdev, and more
- [Glossary](docs/GLOSSARY.md) -- definitions of all EMDD terms
- [한국어 스펙](docs/spec/SPEC_KO.md) -- Korean specification

## What EMDD is NOT

- **Not a project management tool.** No deadlines, no progress percentages -- it tracks what you know and what you don't.
- **Not a knowledge base.** The value is in the tensions, contradictions, and gaps between information, not in tidy organization.
- **Not SDD with a graph bolted on.** Direction emerges from exploration; the specification does not come first.
- **Not a personal knowledge management system.** It is project-scoped working memory, not a second brain for a lifetime.
- **Not outsourcing research to AI.** The AI prunes branches and points to empty ground. The researcher decides where to walk.

## Contributing

Contributions are welcome -- whether that is trying EMDD on your own project and reporting what worked, proposing changes to the spec, or building tooling. See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines and the RFC process.

## License

[MIT](LICENSE)
