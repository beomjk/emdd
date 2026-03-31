# EMDD MCP Server Setup

> Connect your AI coding assistant to the EMDD knowledge graph via the Model Context Protocol.

## Overview

The EMDD MCP server exposes the knowledge graph to any MCP-compatible AI coding assistant. It provides:

<!-- AUTO:mcp-tool-count -->
<!-- Generated from command registry — DO NOT EDIT -->
- **23 tools** for reading, creating, updating, and analyzing graph nodes and edges
- **4 prompts** for guided workflows (context loading, episode creation, consolidation, health review)
<!-- /AUTO:mcp-tool-count -->

The server communicates over stdio transport and is started with `emdd mcp`.

## Quick Start

```bash
# Install emdd globally (or use npx)
npm install -g @beomjk/emdd

# Initialize an EMDD project (if you haven't already)
emdd init my-research

# Verify the MCP server starts
emdd mcp
# (the server will wait for stdio input — Ctrl+C to stop)
```

Then configure your AI tool using one of the sections below.

> **Windows users:** On Windows, wrap the command with `cmd /c` so that `npx` is resolved correctly. Each section below includes both macOS/Linux and Windows examples.

---

## Claude Code

**macOS / Linux:**

```bash
claude mcp add emdd -- npx @beomjk/emdd mcp
```

**Windows:**

```bash
claude mcp add emdd -- cmd /c npx @beomjk/emdd mcp
```

This registers the EMDD MCP server with Claude Code. Tools and prompts become available immediately in your next session.

---

## Cursor

Create `.cursor/mcp.json` in your project root:

**macOS / Linux:**

```json
{
  "mcpServers": {
    "emdd": {
      "command": "npx",
      "args": ["@beomjk/emdd", "mcp"]
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "emdd": {
      "command": "cmd",
      "args": ["/c", "npx", "@beomjk/emdd", "mcp"]
    }
  }
}
```

Restart Cursor to pick up the new configuration.

---

## Windsurf

Open Windsurf settings and navigate to the MCP configuration section. Add a new server:

- **Name:** `emdd`
- **Command:** `npx` (Windows: `cmd`)
- **Arguments:** `emdd mcp` (Windows: `/c npx @beomjk/emdd mcp`)
- **Transport:** stdio

Alternatively, if Windsurf supports a config file (e.g., `~/.codeium/windsurf/mcp_config.json`):

**macOS / Linux:**

```json
{
  "mcpServers": {
    "emdd": {
      "command": "npx",
      "args": ["@beomjk/emdd", "mcp"]
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "emdd": {
      "command": "cmd",
      "args": ["/c", "npx", "@beomjk/emdd", "mcp"]
    }
  }
}
```

---

## Continue IDE

Add to your `.continue/config.yaml`:

**macOS / Linux:**

```yaml
mcpServers:
  - name: emdd
    command: npx
    args:
      - emdd
      - mcp
```

**Windows:**

```yaml
mcpServers:
  - name: emdd
    command: cmd
    args:
      - /c
      - npx
      - emdd
      - mcp
```

Restart the Continue extension after saving.

---

## VS Code (Copilot)

Create `.vscode/mcp.json` in your project root:

**macOS / Linux:**

```json
{
  "servers": {
    "emdd": {
      "command": "npx",
      "args": ["@beomjk/emdd", "mcp"]
    }
  }
}
```

**Windows:**

```json
{
  "servers": {
    "emdd": {
      "command": "cmd",
      "args": ["/c", "npx", "@beomjk/emdd", "mcp"]
    }
  }
}
```

This makes the EMDD tools available to GitHub Copilot's agent mode.

---

## Tool Reference

All tools accept a `graphDir` parameter — the path to your EMDD `graph/` directory.

<!-- AUTO:mcp-tool-table -->
<!-- Generated from command registry — DO NOT EDIT -->
| Tool | Description | Parameters |
|------|-------------|------------|
| `list-nodes` | List nodes, optionally filtered by type, status, and/or date | `graphDir`, `type?`, `status?`, `since?` |
| `read-node` | Read a node detail | `graphDir`, `nodeId` |
| `read-nodes` | Read multiple nodes in a single operation (batch) | `graphDir`, `nodeIds` |
| `graph-neighbors` | List neighbor nodes within BFS depth | `graphDir`, `nodeId`, `depth?` |
| `graph-gaps` | Show structural gaps in the graph | `graphDir` |
| `create-node` | Create a new node | `graphDir`, `type`, `slug`, `title?`, `body?`, `lang?` |
| `create-edge` | Create an edge between two nodes | `graphDir`, `source`, `target`, `relation`, `strength?`, `severity?`, `completeness?`, `dependencyType?`, `impact?`, `force?` |
| `delete-edge` | Remove a link between nodes | `graphDir`, `source`, `target`, `relation?` |
| `update-node` | Update frontmatter fields on a node | `graphDir`, `nodeId`, `set`, `transitionPolicy?` |
| `mark-done` | Mark a checklist item as done in an episode | `graphDir`, `episodeId`, `item`, `marker?` |
| `index-graph` | Generate the _index.md file | `graphDir` |
| `health` | Show health dashboard | `graphDir`, `all?` |
| `check` | Check consolidation readiness | `graphDir` |
| `promote` | Show promotion candidates | `graphDir` |
| `confidence-propagate` | Propagate confidence scores through the graph | `graphDir` |
| `status-transitions` | Detect available status transitions | `graphDir` |
| `kill-check` | Check kill criteria alerts | `graphDir` |
| `branch-groups` | List hypothesis branch groups | `graphDir` |
| `lint` | Lint the graph for schema errors | `graphDir` |
| `backlog` | Show project backlog (open items, deferred, checklists) | `graphDir`, `status?` |
| `analyze-refutation` | Analyze refutation patterns in the graph | `graphDir` |
| `mark-consolidated` | Record a consolidation date to reset episode counting | `graphDir`, `date?` |
| `impact-analysis` | Analyze cascade impact from a node state change | `graphDir`, `nodeId`, `whatIf?` |
<!-- /AUTO:mcp-tool-table -->

### Parameter Details

- **`graphDir`** — Absolute or relative path to the `graph/` directory (e.g., `./graph` or `/home/user/project/graph`)
- **`type`** — Node type: `hypothesis`, `experiment`, `finding`, `knowledge`, `question`, `decision`, `episode`
- **`status`** — Any valid status string for the node type (e.g., `proposed`, `testing`, `supported`, `refuted`, `active`)
- **`since`** — Date filter in `YYYY-MM-DD` format — returns nodes updated (or created) on or after this date
- **`nodeId`** — Node ID in the format `prefix-NNN` (e.g., `hyp-001`, `fnd-003`)
- **`nodeIds`** — Array of node IDs for batch read (e.g., `["hyp-001", "fnd-003"]`)
- **`slug`** — URL-friendly slug for new nodes (e.g., `surface-crack-analysis`)
- **`relation`** — Edge relation type.
  - *Forward:* `answers`, `confirms`, `context_for`, `contradicts`, `depends_on`, `extends`, `informs`, `part_of`, `produces`, `promotes`, `relates_to`, `resolves`, `revises`, `spawns`, `supports`, `tests`
  - *Reverse:* `answered_by`, `confirmed_by`, `produced_by`, `resolved_by`, `spawned_from`, `supported_by`, `tested_by`
- **`lang`** — Language locale: `en` (default) or `ko`
- **`set`** — Key-value pairs to update (e.g., `{"status": "TESTING", "confidence": "0.8"}`)
- **`transitionPolicy`** — Status transition validation: `strict` (block invalid), `warn` (allow with warning), `off` (no check)
- **`marker`** — Checklist marker: `done`, `deferred`, or `superseded`
- **`strength`** — Link strength: `0.0`--`1.0` (for `supports`, `confirms` edges)
- **`severity`** — Contradiction severity: `FATAL`, `WEAKENING`, or `TENSION`
- **`completeness`** — Answer completeness: `0.0`--`1.0` (for `answers` edges)
- **`dependencyType`** — Dependency type: `LOGICAL`, `PRACTICAL`, or `TEMPORAL`
- **`impact`** — Impact level: `DECISIVE`, `SIGNIFICANT`, or `MINOR`
- **`date`** — Date in `YYYY-MM-DD` format (defaults to today)

> **Note:** All tools also accept an optional `lang` parameter (`en` or `ko`) for locale selection.

---

## Prompt Reference

<!-- AUTO:mcp-prompt-table -->
<!-- Generated from command registry — DO NOT EDIT -->
| Prompt | Parameters | Description |
|--------|-----------|-------------|
| `context-loading` | `graphDir` (required), `lang?` | [Cycle 1/4 · Session Start] Load EMDD graph context — provides a summary of nodes, edges, health, and structural gaps |
| `episode-creation` | (none) | [Cycle 2/4 · Session End] Step-by-step guide for writing an EMDD Episode node — includes frontmatter template, mandatory sections, and linking instructions |
| `consolidation` | `graphDir` (required), `lang?` | [Cycle 3/4 · Maintenance] Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses |
| `health-review` | `graphDir` (required), `lang?` | [Cycle 4/4 · Review] Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density |
<!-- /AUTO:mcp-prompt-table -->

### Session Cycle

The four prompts form a recurring session cycle:

1. **`context-loading`** — Run at session start to load graph state and identify next steps.
2. **`episode-creation`** — Run at session end to record what happened and plan next steps.
3. **`consolidation`** — Run when triggers are met to promote findings and maintain the graph.
4. **`health-review`** — Run periodically for a full health dashboard with recommendations.

Steps 1-2 happen every session. Steps 3-4 are triggered by graph state or run on a weekly cadence.

Prompts are available in tools that support MCP prompts (e.g., Claude Code).

---

## Troubleshooting

### "Node not found" error

The `nodeId` must match exactly (e.g., `hyp-001`, not `HYP-001` or `hypothesis-001`). Use `list-nodes` first to see available IDs.

### "npx: command not found" or server fails to start

Ensure Node.js (v18+) and npm are installed and available in your PATH. If using a version manager (nvm, fnm), make sure the correct version is active in the shell that launches your AI tool.

```bash
# Verify
node --version   # Should be v18+
npx --version    # Should be available
npx @beomjk/emdd --version
```

### Windows: MCP server not starting or tools not found

On Windows, `npx` must be invoked through `cmd /c` for MCP clients to resolve it correctly. Use `cmd` as the command and prepend `/c npx` to the arguments. See each tool section above for Windows-specific examples.

### MCP server does not appear in tool list

1. Verify the config file is in the correct location for your tool.
2. Restart the AI tool after adding the configuration.
3. Check that `emdd` is installed or accessible via `npx`.

### "graphDir" — what path to use?

Point to the `graph/` directory inside your EMDD project. If your project is at `/home/user/my-research`, the graphDir is `/home/user/my-research/graph`.

Most AI tools set the working directory to the project root, so `./graph` usually works.

### Server exits immediately

The MCP server uses stdio transport — it reads from stdin and writes to stdout. It is not meant to be run interactively. Your AI tool manages the server's lifecycle automatically.

### Permission errors on global install

If `npm install -g @beomjk/emdd` fails with permission errors:

```bash
# Option 1: Use npx (no global install needed)
npx @beomjk/emdd mcp

# Option 2: Fix npm permissions
# See https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```
