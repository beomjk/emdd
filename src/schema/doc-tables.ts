// ── Doc Table Generators ────────────────────────────────────────────
// Generates README, MCP_SETUP, and emdd-agent.md tables from the
// command registry. Uses the same AUTO marker pattern as spec-tables.ts.

import { createDefaultRegistry } from '../registry/all-commands.js';
import { describeParam, unwrapZod, zodDefType, getEnumValues } from '../registry/schema-introspect.js';
import type { CommandDef } from '../registry/types.js';
import type { z } from 'zod';
import { runAutoMarkerCli } from './spec-tables.js';
import { PROMPT_META } from '../mcp-server/prompts/meta.js';

// ── Non-Registry Commands (defined in src/cli.ts) ──────────────────

interface NonRegistryCommand {
  cliName: string;
  description: string;
  positional?: string;
  options: string;
}

const NON_REGISTRY_COMMANDS: NonRegistryCommand[] = [
  { cliName: 'init', description: 'Initialize a new EMDD project', positional: '[path]', options: '`--tool claude\\|cursor\\|windsurf\\|cline\\|copilot\\|all`, `--lang en\\|ko`, `--force`' },
  { cliName: 'serve', description: 'Start web dashboard server', positional: '[path]', options: '`-p, --port`, `--no-open`' },
  { cliName: 'export-html', description: 'Export graph as standalone HTML file', positional: '[output]', options: '`--layout force\\|hierarchical`, `--types`, `--statuses`' },
  { cliName: 'graph', description: 'Generate `_graph.mmd` (Mermaid diagram)', positional: '[path]', options: '' },
  { cliName: 'mcp', description: 'Start MCP server (stdio transport)', options: '' },
  { cliName: 'doctor', description: 'Diagnose EMDD environment', options: '`--lang en\\|ko`' },
];

// ── Prompt Metadata (derived from PROMPT_META SSOT) ────────────────

function promptParams(meta: typeof PROMPT_META[number]): string {
  if (!meta.hasGraphDir && !meta.hasLang) return '(none)';
  const parts: string[] = [];
  if (meta.hasGraphDir) parts.push('`graphDir` (required)');
  if (meta.hasLang) parts.push('`lang?`');
  return parts.join(', ');
}

// ── README Doc Group Mapping ────────────────────────────────────────

type DocGroup = 'core' | 'analysis' | 'export';

const DOC_GROUP_OVERRIDES: Record<string, DocGroup> = {
  'neighbors': 'analysis',
  'index-graph': 'export',
};

const NON_REGISTRY_GROUP: Record<string, DocGroup> = {
  'init': 'core',
  'serve': 'export',
  'export-html': 'export',
  'graph': 'export',
  'mcp': 'export',
  'doctor': 'core',
};

function getDocGroup(def: CommandDef): DocGroup {
  if (DOC_GROUP_OVERRIDES[def.name]) return DOC_GROUP_OVERRIDES[def.name];
  if (def.category === 'analysis') return 'analysis';
  return 'core'; // read + write → core by default
}

// ── Helpers ─────────────────────────────────────────────────────────

function getCliName(def: CommandDef): string {
  if (def.cli && typeof def.cli === 'object' && def.cli.commandName) {
    return def.cli.commandName;
  }
  return def.name;
}

function getMcpToolName(def: CommandDef): string {
  if (def.mcp && typeof def.mcp === 'object' && def.mcp.toolName) {
    return def.mcp.toolName;
  }
  return def.name;
}

function getPositionalKeys(def: CommandDef): string[] {
  if (def.cli && typeof def.cli === 'object' && def.cli.positional) {
    return def.cli.positional;
  }
  return [];
}

function buildCliRow(def: CommandDef): string {
  const cliName = getCliName(def);
  const positionalKeys = getPositionalKeys(def);
  const positionals = positionalKeys.map(k => `<${k}>`).join(' ');
  const cmdStr = positionals ? `\`emdd ${cliName} ${positionals}\`` : `\`emdd ${cliName}\``;

  // Gather non-positional optional params from schema
  const shape = def.schema.shape;
  const positionalSet = new Set(positionalKeys);
  const optionKeys: string[] = [];
  for (const [key, val] of Object.entries(shape)) {
    if (positionalSet.has(key)) continue;
    const zodField = val as z.ZodType;
    const inner = unwrapZod(zodField);
    if (zodDefType(inner) === 'enum') {
      optionKeys.push(`\`--${key} ${getEnumValues(inner).join('\\|')}\``);
    } else {
      optionKeys.push(`\`--${key}\``);
    }
  }

  const desc = optionKeys.length > 0
    ? `${def.description} (${optionKeys.join(', ')})`
    : def.description;

  return `| ${cmdStr} | ${desc} |`;
}

function buildNonRegistryRow(cmd: NonRegistryCommand): string {
  const positional = cmd.positional ?? '';
  const cmdStr = positional ? `\`emdd ${cmd.cliName} ${positional}\`` : `\`emdd ${cmd.cliName}\``;
  const desc = cmd.options
    ? `${cmd.description} (${cmd.options})`
    : cmd.description;
  return `| ${cmdStr} | ${desc} |`;
}

function buildMcpToolRow(def: CommandDef): string {
  const toolName = getMcpToolName(def);
  const shape = def.schema.shape;
  const params: string[] = ['`graphDir`'];
  for (const [key, val] of Object.entries(shape)) {
    const zodField = val as z.ZodType;
    params.push(`\`${describeParam(key, zodField)}\``);
  }
  return `| \`${toolName}\` | ${def.description} | ${params.join(', ')} |`;
}

// ── Generators ──────────────────────────────────────────────────────

function getRegistryDefs(): CommandDef[] {
  return createDefaultRegistry().getAll();
}

function generateReadmeCliTable(group: DocGroup): string {
  const allDefs = getRegistryDefs();
  const rows: string[] = [];

  if (group === 'core') {
    // Add init first
    const init = NON_REGISTRY_COMMANDS.find(c => c.cliName === 'init')!;
    rows.push(buildNonRegistryRow(init));
  }

  // Add registry commands for this group (exclude cli:false)
  for (const def of allDefs) {
    if (def.cli === false) continue;
    if (getDocGroup(def) !== group) continue;
    rows.push(buildCliRow(def));
  }

  // Add non-registry commands for this group (excluding init which is already added above)
  for (const cmd of NON_REGISTRY_COMMANDS) {
    if (cmd.cliName === 'init') continue; // already added
    if (NON_REGISTRY_GROUP[cmd.cliName] === group) {
      rows.push(buildNonRegistryRow(cmd));
    }
  }

  const lines = [
    '<!-- Generated from command registry — DO NOT EDIT -->',
    '| Command | Description |',
    '|---------|-------------|',
    ...rows,
  ];
  return lines.join('\n');
}

function generateMcpToolCount(): string {
  const allDefs = getRegistryDefs();
  const toolCount = allDefs.filter(def => def.mcp !== false).length;
  const promptCount = PROMPT_META.length;
  return [
    '<!-- Generated from command registry — DO NOT EDIT -->',
    `- **${toolCount} tools** for reading, creating, updating, and analyzing graph nodes and edges`,
    `- **${promptCount} prompts** for guided workflows (context loading, episode creation, consolidation, health review)`,
  ].join('\n');
}

function generateMcpToolTable(): string {
  const allDefs = getRegistryDefs();
  const rows: string[] = [];
  for (const def of allDefs) {
    if (def.mcp === false) continue;
    rows.push(buildMcpToolRow(def));
  }
  const lines = [
    '<!-- Generated from command registry — DO NOT EDIT -->',
    '| Tool | Description | Parameters |',
    '|------|-------------|------------|',
    ...rows,
  ];
  return lines.join('\n');
}

function generateMcpPromptTable(): string {
  const rows = PROMPT_META.map(p => `| \`${p.name}\` | ${promptParams(p)} | ${p.description} |`);
  const lines = [
    '<!-- Generated from command registry — DO NOT EDIT -->',
    '| Prompt | Parameters | Description |',
    '|--------|-----------|-------------|',
    ...rows,
  ];
  return lines.join('\n');
}

function generateAgentTools(): string {
  const allDefs = getRegistryDefs();
  const sections: string[] = [
    '<!-- Generated from command registry — DO NOT EDIT -->',
  ];

  const groups: { label: string; category: string }[] = [
    { label: 'Read operations', category: 'read' },
    { label: 'Write operations', category: 'write' },
    { label: 'Analysis operations', category: 'analysis' },
  ];

  for (const g of groups) {
    const defs = allDefs.filter(d => d.category === g.category && d.mcp !== false);
    sections.push('');
    sections.push(`**${g.label}:**`);
    for (const def of defs) {
      const toolName = getMcpToolName(def);
      sections.push(`- \`${toolName}\` — ${def.description}`);
    }
  }

  // Prompts
  sections.push('');
  sections.push('**Prompts:**');
  for (const p of PROMPT_META) {
    sections.push(`- \`${p.name}\` — ${p.description}`);
  }

  return sections.join('\n');
}

// ── Public API ──────────────────────────────────────────────────────

export const DOC_GENERATORS: Record<string, () => string> = {
  'readme-cli-core': () => generateReadmeCliTable('core'),
  'readme-cli-analysis': () => generateReadmeCliTable('analysis'),
  'readme-cli-export': () => generateReadmeCliTable('export'),
  'mcp-tool-count': generateMcpToolCount,
  'mcp-tool-table': generateMcpToolTable,
  'mcp-prompt-table': generateMcpPromptTable,
  'agent-tools': generateAgentTools,
};

// ── CLI Entry Point ─────────────────────────────────────────────────

const DOC_FILES = ['README.md', 'docs/MCP_SETUP.md', 'src/rules/emdd-agent.md'];

async function main(): Promise<void> {
  await runAutoMarkerCli(DOC_FILES, DOC_GENERATORS);
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('/doc-tables.ts') || process.argv[1].endsWith('/doc-tables.js'));
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
