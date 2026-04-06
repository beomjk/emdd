#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './cli/init.js';
import { graphCommand } from './cli/graph.js';
import { serveCommand } from './cli/serve.js';
import { exportHtmlCommand } from './cli/export-html.js';
import { startMcpServer } from './mcp-server/index.js';
import { VERSION } from './version.js';
import { CliAdapter } from './registry/cli-adapter.js';
import { createDefaultRegistry } from './registry/all-commands.js';

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
const registry = createDefaultRegistry();

new CliAdapter(registry).attachTo(program);

// ── Non-registry commands (init, graph, serve, export-html, mcp) ──
program
  .command('init [path]')
  .description('Initialize EMDD project')
  .option('--lang <locale>', 'Language (en|ko)', 'en')
  .option('--tool <tool>', 'AI tool rules to generate (claude|cursor|windsurf|cline|copilot|all)', 'claude')
  .option('--force', 'Overwrite existing rules files')
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

program
  .command('workflow')
  .description('Show the EMDD research session cycle')
  .action(() => {
    const h = (text: string) => chalk.bold.cyan(text);
    const cmd = (text: string) => chalk.yellow(text);
    const mcp = (text: string) => chalk.gray(text);

    console.log();
    console.log(h('EMDD Research Session Cycle'));
    console.log();
    console.log(`  ${chalk.bold('1. Context Loading')}  ${mcp('[MCP: context-loading]')}`);
    console.log(`     Load graph state and identify gaps`);
    console.log(`     ${cmd('emdd list')}  ${cmd('emdd read <id>')}  ${cmd('emdd health')}`);
    console.log();
    console.log(`  ${chalk.bold('2. Exploration')}  ${mcp('[MCP: use tools]')}`);
    console.log(`     Create nodes, link evidence, update status`);
    console.log(`     ${cmd('emdd create-node')}  ${cmd('emdd create-edge')}  ${cmd('emdd update-node')}`);
    console.log();
    console.log(`  ${chalk.bold('3. Episode Creation')}  ${mcp('[MCP: episode-creation]')}`);
    console.log(`     Record session findings as an Episode node`);
    console.log(`     ${cmd('emdd create-node episode <slug>')}`);
    console.log();
    console.log(`  ${chalk.bold('4. Maintenance')}  ${mcp('[MCP: consolidation, health-review]')}`);
    console.log(`     Promote findings, resolve questions, check health`);
    console.log(`     ${cmd('emdd check')}  ${cmd('emdd promote')}  ${cmd('emdd health')}`);
    console.log();
    console.log(chalk.gray('  Run any command with --help for details.'));
    console.log();
  });

program.parse();
