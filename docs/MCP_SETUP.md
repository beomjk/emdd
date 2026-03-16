# EMDD MCP Server Setup

> Connect your AI coding assistant to the EMDD knowledge graph via the Model Context Protocol.

## Overview

The EMDD MCP server exposes the knowledge graph to any MCP-compatible AI coding assistant. It provides:

- **7 tools** for reading, creating, and analyzing graph nodes and edges
- **4 prompts** for guided workflows (context loading, episode creation, consolidation, health review)

The server communicates over stdio transport and is started with `emdd mcp`.

## Quick Start

```bash
# Install emdd globally (or use npx)
npm install -g emdd

# Initialize an EMDD project (if you haven't already)
emdd init my-research

# Verify the MCP server starts
emdd mcp
# (the server will wait for stdio input — Ctrl+C to stop)
```

Then configure your AI tool using one of the sections below.

---

## Claude Code

```bash
claude mcp add emdd -- npx emdd mcp
```

This registers the EMDD MCP server with Claude Code. Tools and prompts become available immediately in your next session.

**Optional: Slash commands.** For guided workflows, copy the `.claude/commands/` files from this repository into your project:

```bash
# From your project root
cp -r node_modules/emdd/.claude/commands .claude/commands
```

Or create them manually — see the [Slash Commands](#slash-commands-for-claude-code) section below.

---

## Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "emdd": {
      "command": "npx",
      "args": ["emdd", "mcp"]
    }
  }
}
```

Restart Cursor to pick up the new configuration.

---

## Windsurf

Open Windsurf settings and navigate to the MCP configuration section. Add a new server:

- **Name:** `emdd`
- **Command:** `npx`
- **Arguments:** `emdd mcp`
- **Transport:** stdio

Alternatively, if Windsurf supports a config file (e.g., `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "emdd": {
      "command": "npx",
      "args": ["emdd", "mcp"]
    }
  }
}
```

---

## Continue IDE

Add to your `.continue/config.yaml`:

```yaml
mcpServers:
  - name: emdd
    command: npx
    args:
      - emdd
      - mcp
```

Restart the Continue extension after saving.

---

## VS Code (Copilot)

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "emdd": {
      "command": "npx",
      "args": ["emdd", "mcp"]
    }
  }
}
```

This makes the EMDD tools available to GitHub Copilot's agent mode.

---

## Tool Reference

All tools accept a `graphDir` parameter — the path to your EMDD `graph/` directory.

| Tool | Description | Parameters |
|------|-------------|------------|
| `list-nodes` | List all nodes, optionally filtered by type and/or status | `graphDir`, `type?`, `status?` |
| `read-node` | Read a single node by ID, returning full content including body | `graphDir`, `nodeId` |
| `create-node` | Create a new node of the given type with the given slug | `graphDir`, `type`, `slug`, `lang?` |
| `create-edge` | Add an edge (link) from source to target with the given relation | `graphDir`, `source`, `target`, `relation` |
| `health` | Compute a health report for the graph | `graphDir` |
| `check` | Check consolidation triggers | `graphDir` |
| `promote` | Identify findings eligible for promotion to knowledge | `graphDir` |

### Parameter Details

- **`graphDir`** — Absolute or relative path to the `graph/` directory (e.g., `./graph` or `/home/user/project/graph`)
- **`type`** — Node type: `hypothesis`, `experiment`, `finding`, `knowledge`, `question`, `decision`, `episode`
- **`status`** — Any valid status string for the node type (e.g., `proposed`, `testing`, `supported`, `refuted`, `active`)
- **`nodeId`** — Node ID in the format `prefix-NNN` (e.g., `hyp-001`, `fnd-003`)
- **`slug`** — URL-friendly slug for new nodes (e.g., `surface-crack-analysis`)
- **`relation`** — Edge relation type: `supports`, `contradicts`, `produces`, `spawns`, `depends_on`, `tests`, `promotes`, `answers`, `extends`, `relates_to`, `informs`, `part_of`, `context_for`, `revises`, `confirms`
- **`lang`** — Language locale: `en` (default) or `ko`

---

## Prompt Reference

| Prompt | Description |
|--------|-------------|
| `context-loading` | Load graph context at the start of a session — summarizes graph state, active hypotheses, and latest episode |
| `episode-creation` | Guided workflow for writing an Episode node at the end of a session |
| `consolidation` | Step-by-step guide for running a Consolidation ceremony |
| `health-review` | Analyze graph health and generate recommendations |

Prompts are available in tools that support MCP prompts (e.g., Claude Code). They can also be used as slash commands — see below.

---

## Slash Commands for Claude Code

The following slash command files can be placed in `.claude/commands/` in your project. They provide the same workflows as the MCP prompts but in Claude Code's native slash command format.

| File | Slash Command | Purpose |
|------|---------------|---------|
| `emdd-context.md` | `/emdd-context` | Context loading at session start |
| `emdd-episode.md` | `/emdd-episode` | Episode creation at session end |
| `emdd-consolidation.md` | `/emdd-consolidation` | Consolidation ceremony execution |
| `emdd-health.md` | `/emdd-health` | Health review and recommendations |

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
npx emdd --version
```

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

If `npm install -g emdd` fails with permission errors:

```bash
# Option 1: Use npx (no global install needed)
npx emdd mcp

# Option 2: Fix npm permissions
# See https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```
