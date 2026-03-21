#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './cli/init.js';
import { graphCommand } from './cli/graph.js';
import { serveCommand } from './cli/serve.js';
import { exportHtmlCommand } from './cli/export-html.js';
import { startMcpServer } from './mcp-server/index.js';
import { VERSION } from './version.js';
import { CommandRegistry } from './registry/registry.js';
import { CliAdapter } from './registry/cli-adapter.js';
import { listNodesDef } from './registry/commands/list-nodes.js';
import { createNodeDef } from './registry/commands/create-node.js';
import { healthDef } from './registry/commands/health.js';
import { readNodeDef } from './registry/commands/read-node.js';
import { neighborsDef } from './registry/commands/neighbors.js';
import { gapsDef } from './registry/commands/gaps.js';
import { createEdgeDef } from './registry/commands/create-edge.js';
import { deleteEdgeDef } from './registry/commands/delete-edge.js';
import { updateNodeDef } from './registry/commands/update-node.js';
import { markDoneDef } from './registry/commands/mark-done.js';
import { checkDef } from './registry/commands/check.js';
import { promoteDef } from './registry/commands/promote.js';
import { confidencePropagateDef } from './registry/commands/confidence-propagate.js';
import { transitionsDef } from './registry/commands/transitions.js';
import { killCheckDef } from './registry/commands/kill-check.js';
import { branchGroupsDef } from './registry/commands/branch-groups.js';
import { lintDef } from './registry/commands/lint.js';
import { backlogDef } from './registry/commands/backlog.js';
import { indexGraphDef } from './registry/commands/index-graph.js';
import { analyzeRefutationDef } from './registry/commands/analyze-refutation.js';

function withCliErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name('emdd')
  .description('CLI for Evolving Mindmap-Driven Development')
  .version(VERSION);

// ── Registry-based commands ─────────────────────────────────────────
const registry = new CommandRegistry();

// Read commands
registry.register(listNodesDef);
registry.register(readNodeDef);
registry.register(neighborsDef);
registry.register(gapsDef);

// Write commands
registry.register(createNodeDef);
registry.register(createEdgeDef);
registry.register(deleteEdgeDef);
registry.register(updateNodeDef);
registry.register(markDoneDef);

// Analysis commands
registry.register(healthDef);
registry.register(checkDef);
registry.register(promoteDef);
registry.register(confidencePropagateDef);
registry.register(transitionsDef);
registry.register(killCheckDef);
registry.register(branchGroupsDef);
registry.register(lintDef);
registry.register(backlogDef);
registry.register(indexGraphDef);
registry.register(analyzeRefutationDef);

new CliAdapter(registry).attachTo(program);

// ── Non-registry commands (init, graph, serve, export-html, mcp) ──
program
  .command('init [path]')
  .description('Initialize EMDD project')
  .option('--lang <locale>', 'Language', 'en')
  .option('--tool <tool>', 'AI tool rules to generate (claude|cursor|windsurf|cline|copilot|all)', 'claude')
  .action(withCliErrorHandling(async (path, options) => {
    initCommand(path, options);
  }));

program
  .command('graph [path]')
  .description('Generate _graph.mmd Mermaid diagram')
  .action(withCliErrorHandling(async (path) => {
    const { resolveGraphDir } = await import('./graph/loader.js');
    const graphDir = resolveGraphDir(path);
    const result = await graphCommand(graphDir);
    console.log(`Graph generated: ${result.nodeCount} nodes, ${result.edgeCount} edges`);
  }));

program
  .command('serve [path]')
  .description('Start web dashboard server')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('--no-open', 'Do not open browser automatically')
  .action(withCliErrorHandling(async (path, options) => {
    await serveCommand(path, {
      port: parseInt(options.port, 10),
      open: options.open,
    });
  }));

program
  .command('export-html [output]')
  .description('Export graph as standalone HTML file')
  .option('--layout <layout>', 'Layout type (force, hierarchical)', 'force')
  .option('--types <types>', 'Comma-separated node types to include')
  .option('--statuses <statuses>', 'Comma-separated statuses to include')
  .action(withCliErrorHandling(async (output, options) => {
    await exportHtmlCommand(output, options);
  }));

program
  .command('mcp')
  .description('Start MCP server over stdio')
  .action(withCliErrorHandling(async () => {
    await startMcpServer();
  }));

program.parse();
