#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { newCommand } from './commands/new.js';
import { lintCommand } from './commands/lint.js';
import { healthCommand } from './commands/health.js';
import { checkCommand } from './commands/check.js';
import { promoteCommand } from './commands/promote.js';
import { updateCommand } from './commands/update.js';
import { linkCommand } from './commands/link.js';
import { doneCommand } from './commands/done.js';
import { indexCommand } from './commands/index.js';
import { graphCommand } from './commands/graph.js';
import { backlogCommand } from './commands/backlog.js';
import { resolveGraphDir } from './graph/loader.js';
import { startMcpServer } from './mcp-server/index.js';
import { VERSION } from './version.js';

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

program
  .command('init [path]')
  .description('Initialize EMDD project')
  .option('--lang <locale>', 'Language', 'en')
  .option('--tool <tool>', 'AI tool rules to generate (claude|cursor|windsurf|cline|copilot|all)', 'claude')
  .action(withCliErrorHandling(async (path, options) => {
    initCommand(path, options);
  }));

program
  .command('new <type> <slug>')
  .description('Create a new node')
  .option('--path <path>', 'Project path')
  .action(withCliErrorHandling(async (type, slug, options) => {
    await newCommand(type, slug, options);
  }));

program
  .command('lint [path]')
  .description('Validate graph schema and links')
  .action(withCliErrorHandling(async (path) => {
    await lintCommand(path);
  }));

program
  .command('health [path]')
  .description('Show health dashboard')
  .action(withCliErrorHandling(async (path) => {
    await healthCommand(path);
  }));

program
  .command('check [path]')
  .description('Check consolidation triggers')
  .action(withCliErrorHandling(async (path) => {
    const graphDir = resolveGraphDir(path);
    const result = await checkCommand(graphDir);
    if (result.triggers.length === 0) {
      console.log('No consolidation triggers active.');
    } else {
      for (const trigger of result.triggers) {
        console.log(`TRIGGER  ${trigger.type}  ${trigger.message}`);
      }
    }
  }));

program
  .command('promote [path]')
  .description('Identify findings eligible for promotion')
  .action(withCliErrorHandling(async (path) => {
    const graphDir = resolveGraphDir(path);
    const result = await promoteCommand(graphDir);
    if (result.candidates.length === 0) {
      console.log('No promotion candidates found.');
    } else {
      for (const c of result.candidates) {
        console.log(`CANDIDATE  ${c.id}  confidence=${c.confidence}  supports=${c.supports}`);
      }
    }
  }));

program
  .command('update <node-id>')
  .description('Update frontmatter fields on a node')
  .option('--set <key=value...>', 'Key-value pairs to set')
  .option('--path <path>', 'Project path')
  .action(withCliErrorHandling(async (nodeId, options) => {
    const graphDir = resolveGraphDir(options.path);
    const updates: Record<string, string> = {};
    if (options.set) {
      const pairs = Array.isArray(options.set) ? options.set : [options.set];
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) {
          console.error(`Invalid key=value: ${pair}`);
          process.exit(1);
        }
        updates[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
      }
    }
    await updateCommand(graphDir, nodeId, updates);
    console.log(`Updated ${nodeId}`);
  }));

program
  .command('link <source> <target> <relation>')
  .description('Add a link between nodes')
  .option('--path <path>', 'Project path')
  .action(withCliErrorHandling(async (source, target, relation, options) => {
    const graphDir = resolveGraphDir(options.path);
    await linkCommand(graphDir, source, target, relation);
    console.log(`Linked ${source} -> ${target} (${relation})`);
  }));

program
  .command('done <episode-id> <item>')
  .description('Mark a checklist item as done')
  .option('--path <path>', 'Project path')
  .action(withCliErrorHandling(async (episodeId, item, options) => {
    const graphDir = resolveGraphDir(options.path);
    await doneCommand(graphDir, episodeId, item);
    console.log(`Done: ${item}`);
  }));

program
  .command('index [path]')
  .description('Generate _index.md for the graph')
  .action(withCliErrorHandling(async (path) => {
    const graphDir = resolveGraphDir(path);
    const result = await indexCommand(graphDir);
    console.log(`Index generated: ${result.nodeCount} nodes`);
  }));

program
  .command('graph [path]')
  .description('Generate _graph.mmd Mermaid diagram')
  .action(withCliErrorHandling(async (path) => {
    const graphDir = resolveGraphDir(path);
    const result = await graphCommand(graphDir);
    console.log(`Graph generated: ${result.nodeCount} nodes, ${result.edgeCount} edges`);
  }));

program
  .command('backlog')
  .description('Show unchecked backlog items')
  .option('--path <path>', 'Project path')
  .option('--status <status>', 'Filter by status')
  .action(withCliErrorHandling(async (options) => {
    const graphDir = resolveGraphDir(options.path);
    const result = await backlogCommand(graphDir, options.status);
    if (result.items.length === 0) {
      console.log('No backlog items.');
    } else {
      for (const item of result.items) {
        console.log(`[ ] ${item.episodeId}  ${item.text}`);
      }
    }
  }));

program
  .command('mcp')
  .description('Start MCP server over stdio')
  .action(withCliErrorHandling(async () => {
    await startMcpServer();
  }));

program.parse();
