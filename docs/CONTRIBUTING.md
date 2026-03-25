# Contributing to EMDD

Thank you for your interest in EMDD. This project has two components that accept contributions differently:

1. **The EMDD Specification** -- the methodology itself (node types, edge types, ceremonies, workflows)
2. **The EMDD CLI Tool** -- the software that implements the specification

Both types of contributions are welcome, from typo fixes to new node types. This guide explains how each works.

---

## Contributing to the Specification

The EMDD specification lives in `docs/spec/`. The English version (`SPEC_EN.md`) is the canonical reference. Changes to the methodology go through a process proportional to their impact.

### Types of Spec Changes

| Change Type | Process | Examples |
|-------------|---------|----------|
| **Clarification** | Direct PR | Fixing ambiguous wording, adding examples, correcting typos |
| **Minor addition** | PR + 1 maintainer approval | New anti-pattern, additional edge type alias, new health metric |
| **Breaking change** | RFC process (30-day feedback) | New node type, removing an edge type, changing ceremony triggers, modifying confidence formula |

### RFC Process for Breaking Changes

1. **Open an Issue** with the `rfc` label describing the proposed change.
2. **Include:**
   - **Motivation:** What problem does this solve?
   - **Proposal:** Exact spec text changes.
   - **Impact:** What existing graphs would break? What tooling needs updating?
   - **Alternatives:** What other approaches were considered?
3. **30-day feedback period** -- community discussion on the issue.
4. **Maintainer decision** -- accept, modify, or reject with rationale.
5. **Implementation** -- PR with spec changes, CLI tool updates (if applicable), and a migration guide.

### Spec Versioning

The spec follows semantic versioning: `MAJOR.MINOR` (currently v0.4).

- **MINOR** versions add features without breaking existing graphs (e.g., v0.3 to v0.4).
- **MAJOR** versions may introduce breaking changes (e.g., v0.x to v1.0).
- Each version change is documented in the Changelog appendix of the spec.

### Translation

- The English specification (`docs/spec/SPEC_EN.md`) is the canonical reference.
- The Korean specification (`docs/spec/SPEC_KO.md`) is the original draft.
- Translations to other languages are welcome. Place them at `docs/spec/SPEC_<LANG>.md` (e.g., `SPEC_JA.md`, `SPEC_DE.md`).
- Translation PRs should note which English spec version they are based on.

---

## Contributing to the CLI Tool

### Prerequisites

- **Node.js** 22+ (LTS recommended)
- **npm** 10+

### Development Setup

```bash
# Clone the repository
git clone https://github.com/beomjk/emdd.git
cd emdd

# Install dependencies
npm install

# Build (TypeScript compile → copy rules → build web frontend)
npm run build

# Run in development mode (no build needed)
npm run dev -- health examples/ml-backbone-selection
```

### Key Commands

```bash
npm run build          # Full build pipeline
npm run dev            # Run CLI via tsx (skip build)
npm run lint           # Type-check only (tsc --noEmit)
npm run gen:spec-tables # Update SPEC_EN/KO.md auto-generated tables
npm run spec:coverage  # Check @spec tag coverage (--threshold 80)
```

### Running Tests

```bash
npx vitest run                                          # All tests
npx vitest run tests/unit/graph/operations.test.ts      # Single file
npx vitest run -t "returns all nodes"                   # By test name
npx vitest run --reporter=verbose                       # Verbose output
```

Tests are organized as:
- `tests/unit/` — unit tests (graph, schema, i18n, rules, web)
- `tests/integration/` — MCP server protocol tests
- `tests/fixtures/sample-graph/` — shared fixture with 14 nodes

### Architecture Overview

```
src/cli.ts              → CLI entry point (commander)
src/mcp-server/index.ts → MCP server entry point (stdio)
        ↓                        ↓
src/graph/operations.ts  ← shared core logic (no I/O formatting)
        ↓
src/graph/loader.ts      ← loadGraph() — parses graph/ dir
src/graph/types.ts       ← interfaces + re-exports from derive-constants.ts
src/graph/derive-constants.ts ← derived constants from schema config
        ↑
src/schema/schema.config.ts  ← SINGLE SOURCE OF TRUTH for all constants
```

**Important:** `schema.config.ts` is the single source of truth. Constants are derived at import time by `derive-constants.ts` — no code generation step needed.

### Adding a New Node Type, Status, or Edge

1. Edit `src/schema/schema.config.ts`
2. Run `npm run build`
3. Update tests as needed

### Code Contributions

1. **Fork** the repository.
2. **Create a branch** from `main`: `git checkout -b feature/your-feature`
3. **Write tests** for new functionality.
4. **Ensure all tests pass**: `npx vitest run`
5. **Ensure types check**: `npm run lint`
6. **Submit a PR** with a clear description of what changed and why.

### Code Style

- ESM throughout — use `.js` extensions in all imports (even for `.ts` source files).
- TypeScript with strict mode.
- Node statuses are UPPERCASE strings (e.g., `PROPOSED`, `TESTING`, `SUPPORTED`).
- All graph operations are async (return `Promise`).
- Follow existing patterns in the codebase — prefer clarity over cleverness.

### Release Process

Releases are automated via GitHub Actions:

1. Bump version: `npm version patch` (or `minor` / `major`)
2. Push with tag: `git push && git push --tags`
3. GitHub Actions automatically:
   - Runs CI (lint + test)
   - Publishes to npm (`@beomjk/emdd`)
   - Creates a GitHub Release

---

## Reporting Issues

Use [GitHub Issues](../../issues) for bugs, spec problems, and feature requests. Pick the right label:

- **`spec`** -- Something in the specification is ambiguous, contradictory, or missing. Quote the relevant section.
- **`bug`** -- The CLI tool does not behave as expected. Include steps to reproduce, expected behavior, and actual behavior.
- **`enhancement`** -- A feature request. Describe the use case, not just the desired feature.

---

## Trying EMDD and Sharing Feedback

One of the most valuable contributions right now is simply using EMDD on a real project and telling us what happened. If you try the methodology:

- What worked well?
- What was confusing or felt like unnecessary overhead?
- What did you end up skipping, and why?
- What would you add?

Open a [Discussion](../../discussions) or an Issue with your experience. Field reports directly shape how the spec evolves.

---

## Code of Conduct

We follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be respectful, constructive, and assume good intent.

---

## Questions?

- **Methodology questions:** Open a [Discussion](../../discussions).
- **Specific problems or proposals:** Open an [Issue](../../issues).
- **Quick clarifications:** Check the [Glossary](GLOSSARY.md) and [Quick Start Guide](QUICK_START.md) first -- your answer may already be there.
