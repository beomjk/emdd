// ── Spec Table Generator ────────────────────────────────────────────
// Updates SPEC_EN.md tables from schema.config.ts using AUTO markers.
// Transition tables are delegated to @beomjk/state-engine's generateDocs().

import { readFile, writeFile } from 'node:fs/promises';
import { defineSchema, generateDocs } from '@beomjk/state-engine/schema';
import {
  entityDefinitions,
  nodeMetadata,
  nodeDisplayOrder,
  forwardEdges,
  reverseEdges,
  thresholds,
  transitionPolicy,
  impactClassification,
  attributeModifiers,
  impactThreshold,
  maxCascadeDepth,
  reverseDirectionEdges,
  type NodeTypeName,
} from './schema.config.js';
import { ALL_PRESET_FNS } from './preset-names.js';

export interface UpdateResult {
  updatedSections: string[];
  warnings: string[];
  unchanged: boolean;
}

// ── Build SchemaDefinition for transition table generation ────────────

const schemaDef = defineSchema({
  presetNames: ALL_PRESET_FNS,
  entities: entityDefinitions,
  policy: { mode: transitionPolicy.mode },
});

// ── Table Generators ────────────────────────────────────────────────

const GENERATORS: Record<string, () => string> = {
  'node-types': generateNodeTypesTable,
  'statuses': generateStatusesTable,
  'edge-types': generateEdgeTypesTable,
  'reverse-labels': generateReverseLabelsTable,
  'thresholds': generateThresholdsTable,
  'transition-rules': generateTransitionRulesTable,
  // manual-transitions: generator ready; add <!-- AUTO:manual-transitions --> marker to SPEC docs to activate
  'manual-transitions': generateManualTransitionsTable,
  'impact-edge-classification': generateImpactEdgeClassificationTable,
  'impact-attribute-modifiers': generateImpactAttributeModifiersTable,
  'impact-config': generateImpactConfigTable,
};

function generateNodeTypesTable(): string {
  const ordered = nodeDisplayOrder.map(name => ({
    name,
    ...nodeMetadata[name as NodeTypeName],
    statusCount: entityDefinitions[name].statuses.length,
  }));
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Type | Prefix | Directory | Status Count |',
    '|------|--------|-----------|-------------|',
  ];
  for (const nt of ordered) {
    lines.push(`| ${nt.name} | ${nt.prefix} | ${nt.directory} | ${nt.statusCount} |`);
  }
  return lines.join('\n');
}

function generateStatusesTable(): string {
  const ordered = nodeDisplayOrder.map(name => ({
    name,
    statuses: entityDefinitions[name].statuses,
  }));
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Type | Statuses |',
    '|------|----------|',
  ];
  for (const nt of ordered) {
    lines.push(`| ${nt.name} | ${nt.statuses.join(', ')} |`);
  }
  return lines.join('\n');
}

function generateEdgeTypesTable(): string {
  const sorted = [...forwardEdges].sort();
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| # | Edge Type |',
    '|---|-----------|',
  ];
  for (let i = 0; i < sorted.length; i++) {
    lines.push(`| ${i + 1} | ${sorted[i]} |`);
  }
  return lines.join('\n');
}

function generateReverseLabelsTable(): string {
  const entries = Object.entries(reverseEdges).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Reverse Label | Forward Edge |',
    '|---------------|-------------|',
  ];
  for (const [rev, fwd] of entries) {
    lines.push(`| ${rev} | ${fwd} |`);
  }
  return lines.join('\n');
}

function generateThresholdsTable(): string {
  const entries = Object.entries(thresholds).sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Threshold | Value |',
    '|-----------|-------|',
  ];
  for (const [key, value] of entries) {
    lines.push(`| ${key} | ${value} |`);
  }
  return lines.join('\n');
}

function generateTransitionRulesTable(): string {
  const docs = generateDocs(schemaDef, { tables: ['transitions'] });
  return `<!-- Generated via @beomjk/state-engine — DO NOT EDIT -->\n${docs['transitions']}`;
}

function generateManualTransitionsTable(): string {
  const docs = generateDocs(schemaDef, { tables: ['manual-transitions'] });
  return `<!-- Generated via @beomjk/state-engine — DO NOT EDIT -->\n${docs['manual-transitions']}`;
}

// ── Impact Analysis Tables ──────────────────────────────────────────

function generateImpactEdgeClassificationTable(): string {
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Class | Base Factor | Edges | Meaning |',
    '|-------|------------|-------|---------|',
  ];
  const meanings: Record<string, string> = {
    conducts: 'Strong causal/evidential link — impact passes through readily',
    attenuates: 'Weaker or indirect link — impact is dampened',
    blocks: 'Structural/organizational link — impact does not propagate',
  };
  for (const [cls, def] of Object.entries(impactClassification)) {
    const edges = [...def.edges].map(e => `\`${e}\``).join(', ');
    lines.push(`| **${cls}** | ${def.baseFactor} | ${edges} | ${meanings[cls] ?? ''} |`);
  }
  return lines.join('\n');
}

function generateImpactAttributeModifiersTable(): string {
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Attribute | Values | Multiplier |',
    '|-----------|--------|-----------|',
    '| **strength** | 0.0 – 1.0 | Direct multiplier |',
    '| **completeness** | 0.0 – 1.0 | Direct multiplier |',
  ];
  for (const [attr, values] of Object.entries(attributeModifiers)) {
    const parts = Object.entries(values).map(([k, v]) => `${k} (${v})`).join(', ');
    lines.push(`| **${attr}** | ${parts} | |`);
  }
  return lines.join('\n');
}

function generateImpactConfigTable(): string {
  const lines = [
    '<!-- Generated from schema.config.ts — DO NOT EDIT -->',
    '| Constant | Default | Purpose |',
    '|----------|---------|---------|',
    `| \`impactClassification\` | see above | Edge-to-propagation-class mapping |`,
    `| \`attributeModifiers\` | see above | Attribute value multipliers |`,
    `| \`impactThreshold\` | ${impactThreshold} | Minimum score to continue propagation |`,
    `| \`maxCascadeDepth\` | ${maxCascadeDepth} | Maximum BFS hops |`,
    `| \`reverseDirectionEdges\` | \`${JSON.stringify([...reverseDirectionEdges])}\` | Edges where impact flows target→source |`,
  ];
  return lines.join('\n');
}

// ── Public API ──────────────────────────────────────────────────────

export function generateTable(markerName: string): string {
  const generator = GENERATORS[markerName];
  if (!generator) {
    throw new Error(`Unknown marker name: ${markerName}`);
  }
  return generator();
}

/** Generic marker-replacement engine. Replaces content between AUTO markers using the provided generators map. */
export async function updateAutoMarkers(
  filePath: string,
  generators: Record<string, () => string>,
): Promise<UpdateResult> {
  let content = await readFile(filePath, 'utf-8');
  const updatedSections: string[] = [];
  const warnings: string[] = [];
  const originalContent = content;

  // Find all AUTO marker pairs
  const markerRegex = /<!-- AUTO:(\S+) -->([\s\S]*?)<!-- \/AUTO:\1 -->/g;

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
    const generator = generators[markerName];
    if (!generator) {
      warnings.push(`Unknown marker name: ${markerName}`);
      return _fullMatch;
    }

    const generated = generator();
    updatedSections.push(markerName);
    return `<!-- AUTO:${markerName} -->\n${generated}\n<!-- /AUTO:${markerName} -->`;
  });

  if (openMarkers.length === 0) {
    warnings.push('No AUTO markers found in spec file');
  }

  const unchanged = content === originalContent;
  if (!unchanged) {
    await writeFile(filePath, content, 'utf-8');
  }

  return { updatedSections, warnings, unchanged };
}

export async function updateSpecTables(
  specPath: string,
): Promise<UpdateResult> {
  return updateAutoMarkers(specPath, GENERATORS);
}

// ── Shared CLI Runner ───────────────────────────────────────────────

export async function runAutoMarkerCli(
  files: string[],
  generators: Record<string, () => string>,
): Promise<void> {
  const { accessSync } = await import('node:fs');

  for (const file of files) {
    try {
      accessSync(file);
    } catch {
      continue; // skip if file doesn't exist
    }

    const result = await updateAutoMarkers(file, generators);

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        console.warn(`WARNING [${file}]: ${w}`);
      }
    }

    if (result.updatedSections.length > 0) {
      console.log(`[${file}] Updated sections: ${result.updatedSections.join(', ')}`);
    } else if (result.unchanged) {
      console.log(`[${file}] No changes needed`);
    }
  }
}

// ── CLI Entry Point ─────────────────────────────────────────────────

const SPEC_FILES = [
  'docs/spec/SPEC_EN.md',
  'docs/spec/SPEC_KO.md',
  'docs/IMPACT_ANALYSIS.md',
];

async function main(): Promise<void> {
  await runAutoMarkerCli(SPEC_FILES, GENERATORS);
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('/spec-tables.ts') || process.argv[1].endsWith('/spec-tables.js'));
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
