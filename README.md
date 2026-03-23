# EMDD: Evolving Mindmap-Driven Development

[![npm version](https://img.shields.io/npm/v/@beomjk/emdd.svg)](https://www.npmjs.com/package/@beomjk/emdd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> [!WARNING]
> This project is in an **experimental stage**. APIs and file formats may change without notice.

> **A methodology that gives structure to R&D exploration through an AI-maintained evolving knowledge graph -- without killing the exploration itself.**

## Table of Contents

- [Demo](#demo)
- [What is EMDD?](#what-is-emdd)
- [Who is it for?](#who-is-it-for)
- [The EMDD Equation](#the-emdd-equation)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Phased Adoption](#phased-adoption)
- [Documentation](#documentation)
- [What EMDD is NOT](#what-emdd-is-not)
- [Contributing](#contributing)

## Demo

<img src="docs/assets/demo.svg" alt="EMDD Demo" width="720">

### Web Dashboard

<img src="docs/assets/dashboard.png" alt="EMDD Web Dashboard" width="720">

## What is EMDD?

Too much structure suffocates research. Too little structure evaporates it. Existing approaches each solve one piece -- Zettelkasten gives bottom-up emergence, HDD gives hypothesis testing, DDP gives risk prioritization -- but none of them track the *relationships* between what you know, what you don't know, and what to explore next. EMDD fills that gap: it is a lightweight, AI-maintained knowledge graph that structures your exploration as it happens, surfaces blind spots, and remembers every dead end so you never walk it twice.

## Who is it for?

- **Solo researchers or small teams doing exploratory R&D** where the destination is unknown -- visual inspection R&D, architecture spikes, open-ended investigations.
- **Developers working with AI coding assistants** (e.g., Claude Code) who want the AI to maintain the knowledge structure while they retain judgment.
- **Anyone who has lost track of what they tried last week**, why they abandoned an approach, or which assumptions remain untested.
- **Teams that need more rigor than a scratchpad** but less overhead than a project management system.
- **Researchers who want to know what to explore next**, not just what they have already done.

## The EMDD Equation

> [!TIP]
> ```
> EMDD = Zettelkasten's bottom-up emergence
>      + DDP's risk-first validation
>      + InfraNodus's structural gap detection
>      + Graphiti's temporal evolution
>      ─────────────────────────────────
>        Autonomous maintenance and suggestions by an AI agent
> ```
>
> Delegate cognitive load to the graph and the AI, but never delegate judgment.

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

```mermaid
graph LR
    Q[Question] --> H[Hypothesis]
    H --> E[Experiment]
    E --> F[Finding]
    F --> K[Knowledge<br/><i>promoted</i>]
    F --> Q2[New Question<br/><i>the cycle continues</i>]

    style Q fill:#6c5ce7,color:#fff,stroke:none
    style H fill:#e17055,color:#fff,stroke:none
    style E fill:#00b894,color:#fff,stroke:none
    style F fill:#0984e3,color:#fff,stroke:none
    style K fill:#fdcb6e,color:#2d3436,stroke:none
    style Q2 fill:#6c5ce7,color:#fff,stroke:none
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

All registry-based commands accept `--graphDir <path>` (graph directory), `--lang <en|ko>` (locale), and `--json` (JSON output).

| Command | Description |
|---------|-------------|
| `emdd init [path]` | Initialize a new EMDD project (`--tool claude\|cursor\|windsurf\|cline\|copilot\|all`, `--lang en\|ko`) |
| `emdd list` | List nodes (`--type`, `--status` filters) |
| `emdd new <type> <slug>` | Create a node (hypothesis, experiment, finding, ...) |
| `emdd link <source> <target> <relation>` | Add a link between nodes (`--strength`, `--severity`, `--completeness`, `--dependencyType`, `--impact`) |
| `emdd unlink <source> <target>` | Remove a link between nodes (`--relation` optional) |
| `emdd read <nodeId>` | Read a node by ID, showing frontmatter and body |
| `emdd update <nodeId> --set key=value` | Update node frontmatter (supports JSON arrays/objects, `--transitionPolicy strict\|warn\|off`) |
| `emdd done <episodeId> <item>` | Mark an episode item with a status marker (`--marker <done\|deferred\|superseded>`) |
| `emdd neighbors <nodeId>` | Get a node's neighbors and connections (`--depth`, default 1) |
| `emdd gaps` | Detect structural gaps (orphans, stale, disconnected) |
| `emdd lint` | Validate schema and link integrity |
| `emdd health` | Show graph health dashboard |
| `emdd check` | Check consolidation triggers |
| `emdd promote` | Identify promotion candidates |
| `emdd backlog` | List incomplete items across all episodes (`--status <pending\|done\|deferred\|superseded\|all>`) |
| `emdd index` | Generate `_index.md` |
| `emdd graph [path]` | Generate `_graph.mmd` (Mermaid) |
| `emdd confidence` | Propagate confidence across the graph |
| `emdd transitions` | Detect recommended status transitions |
| `emdd kill-check` | Check kill criteria status for hypotheses |
| `emdd branches` | List and analyze branch groups |
| `emdd analyze-refutation` | Analyze refutation impact on hypotheses |
| `emdd mark-consolidated` | Record consolidation date (`--date`, default today) |
| `emdd serve [path]` | Start web dashboard server (`-p, --port`, `--no-open`) |
| `emdd export-html [output]` | Export graph as standalone HTML file (`--layout force\|hierarchical`, `--types`, `--statuses`) |
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

<details>
<summary><h2>What EMDD is NOT</h2></summary>

- **Not a project management tool.** No deadlines, no progress percentages -- it tracks what you know and what you don't.
- **Not a knowledge base.** The value is in the tensions, contradictions, and gaps between information, not in tidy organization.
- **Not SDD with a graph bolted on.** Direction emerges from exploration; the specification does not come first.
- **Not a personal knowledge management system.** It is project-scoped working memory, not a second brain for a lifetime.
- **Not outsourcing research to AI.** The AI prunes branches and points to empty ground. The researcher decides where to walk.

</details>

## Contributing

Contributions are welcome -- whether that is trying EMDD on your own project and reporting what worked, proposing changes to the spec, or building tooling. See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines and the RFC process.

## License

[MIT](LICENSE)
