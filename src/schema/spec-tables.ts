// ── Spec Table Generator ────────────────────────────────────────────
// Updates SPEC_EN.md tables from graph-schema.yaml using AUTO markers.
// Transition tables are delegated to @beomjk/state-engine's generateDocs().

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateDocs } from '@beomjk/state-engine/schema';
import type { GraphSchema } from './validator.js';
import { toSchemaDefinition } from './schema-bridge.js';

export interface UpdateResult {
  updatedSections: string[];
  warnings: string[];
  unchanged: boolean;
}

// Domain-meaningful display order for node types
const DOMAIN_ORDER = ['hypothesis', 'experiment', 'finding', 'knowledge', 'question', 'decision', 'episode'];

function sortByDomainOrder<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = DOMAIN_ORDER.indexOf(a.name);
    const bi = DOMAIN_ORDER.indexOf(b.name);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// ── Table Generators ────────────────────────────────────────────────

const GENERATORS: Record<string, (schema: GraphSchema) => string> = {
  'node-types': generateNodeTypesTable,
  'statuses': generateStatusesTable,
  'edge-types': generateEdgeTypesTable,
  'reverse-labels': generateReverseLabelsTable,
  'thresholds': generateThresholdsTable,
  'transition-rules': generateTransitionRulesTable,
  'manual-transitions': generateManualTransitionsTable,
};

function generateNodeTypesTable(schema: GraphSchema): string {
  const sorted = sortByDomainOrder(schema.nodeTypes);
  const lines = [
    '<!-- Generated from graph-schema.yaml — DO NOT EDIT -->',
    '| Type | Prefix | Directory | Status Count |',
    '|------|--------|-----------|-------------|',
  ];
  for (const nt of sorted) {
    lines.push(`| ${nt.name} | ${nt.prefix} | ${nt.directory} | ${nt.statuses.length} |`);
  }
  return lines.join('\n');
}

function generateStatusesTable(schema: GraphSchema): string {
  const sorted = sortByDomainOrder(schema.nodeTypes);
  const lines = [
    '<!-- Generated from graph-schema.yaml — DO NOT EDIT -->',
    '| Type | Statuses |',
    '|------|----------|',
  ];
  for (const nt of sorted) {
    lines.push(`| ${nt.name} | ${nt.statuses.join(', ')} |`);
  }
  return lines.join('\n');
}

function generateEdgeTypesTable(schema: GraphSchema): string {
  const sorted = [...schema.edgeTypes.forward].sort();
  const lines = [
    '<!-- Generated from graph-schema.yaml — DO NOT EDIT -->',
    '| # | Edge Type |',
    '|---|-----------|',
  ];
  for (let i = 0; i < sorted.length; i++) {
    lines.push(`| ${i + 1} | ${sorted[i]} |`);
  }
  return lines.join('\n');
}

function generateReverseLabelsTable(schema: GraphSchema): string {
  const entries = Object.entries(schema.edgeTypes.reverse).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '<!-- Generated from graph-schema.yaml — DO NOT EDIT -->',
    '| Reverse Label | Forward Edge |',
    '|---------------|-------------|',
  ];
  for (const [rev, fwd] of entries) {
    lines.push(`| ${rev} | ${fwd} |`);
  }
  return lines.join('\n');
}

function generateThresholdsTable(schema: GraphSchema): string {
  const entries = Object.entries(schema.thresholds).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '<!-- Generated from graph-schema.yaml — DO NOT EDIT -->',
    '| Threshold | Value |',
    '|-----------|-------|',
  ];
  for (const [key, value] of entries) {
    lines.push(`| ${key} | ${value} |`);
  }
  return lines.join('\n');
}

function generateTransitionRulesTable(schema: GraphSchema): string {
  const schemaDef = toSchemaDefinition(schema);
  const docs = generateDocs(schemaDef, { tables: ['transitions'] });
  return `<!-- Generated via @beomjk/state-engine — DO NOT EDIT -->\n${docs['transitions']}`;
}

function generateManualTransitionsTable(schema: GraphSchema): string {
  const schemaDef = toSchemaDefinition(schema);
  const docs = generateDocs(schemaDef, { tables: ['manual-transitions'] });
  return `<!-- Generated via @beomjk/state-engine — DO NOT EDIT -->\n${docs['manual-transitions']}`;
}

// ── Public API ──────────────────────────────────────────────────────

export function generateTable(schema: GraphSchema, markerName: string): string {
  const generator = GENERATORS[markerName];
  if (!generator) {
    throw new Error(`Unknown marker name: ${markerName}`);
  }
  return generator(schema);
}

export async function updateSpecTables(
  schemaPath: string,
  specPath: string,
): Promise<UpdateResult> {
  const { loadSchema } = await import('./loader.js');
  const schema = await loadSchema(schemaPath);

  let content = await readFile(specPath, 'utf-8');
  const updatedSections: string[] = [];
  const warnings: string[] = [];
  const originalContent = content;

  // Find all AUTO marker pairs
  const markerRegex = /<!-- AUTO:(\S+) -->([\s\S]*?)<!-- \/AUTO:\1 -->/g;
  let match: RegExpExecArray | null;

  // Check for unpaired markers
  const openMarkers = [...content.matchAll(/<!-- AUTO:(\S+) -->/g)].map(m => m[1]);
  const closeMarkers = [...content.matchAll(/<!-- \/AUTO:(\S+) -->/g)].map(m => m[1]);

  for (const name of openMarkers) {
    if (!closeMarkers.includes(name)) {
      throw new Error(`Unpaired AUTO marker: <!-- AUTO:${name} --> has no closing marker`);
    }
  }
  for (const name of closeMarkers) {
    if (!openMarkers.includes(name)) {
      throw new Error(`Unpaired AUTO marker: <!-- /AUTO:${name} --> has no opening marker`);
    }
  }

  // Replace content between markers
  content = content.replace(markerRegex, (_fullMatch, markerName: string) => {
    const generator = GENERATORS[markerName];
    if (!generator) {
      warnings.push(`Unknown marker name: ${markerName}`);
      return _fullMatch;
    }

    const generated = generator(schema);
    updatedSections.push(markerName);
    return `<!-- AUTO:${markerName} -->\n${generated}\n<!-- /AUTO:${markerName} -->`;
  });

  if (openMarkers.length === 0) {
    warnings.push('No AUTO markers found in spec file');
  }

  const unchanged = content === originalContent;
  if (!unchanged) {
    await writeFile(specPath, content, 'utf-8');
  }

  return { updatedSections, warnings, unchanged };
}

// ── CLI Entry Point ─────────────────────────────────────────────────

const SPEC_FILES = [
  'docs/spec/SPEC_EN.md',
  'docs/spec/SPEC_KO.md',
];

async function main(): Promise<void> {
  const { accessSync } = await import('node:fs');

  for (const specFile of SPEC_FILES) {
    try {
      accessSync(specFile);
    } catch {
      continue; // skip if file doesn't exist
    }

    const result = await updateSpecTables('graph-schema.yaml', specFile);

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.warn(`WARNING [${specFile}]: ${w}`);
      }
    }

    if (result.updatedSections.length > 0) {
      console.log(`[${specFile}] Updated sections: ${result.updatedSections.join(', ')}`);
    } else if (result.unchanged) {
      console.log(`[${specFile}] No changes needed`);
    }
  }
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('/spec-tables.ts') || process.argv[1].endsWith('/spec-tables.js'));
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
