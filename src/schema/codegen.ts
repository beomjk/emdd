// ── Code Generator ──────────────────────────────────────────────────
// Generates src/graph/types.generated.ts from graph-schema.yaml.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GraphSchema } from './validator.js';

const HEADER = '// @generated — DO NOT EDIT. Source: graph-schema.yaml';

// ── Public API ──────────────────────────────────────────────────────

export function generateTypesFile(schema: GraphSchema): string {
  const sections: string[] = [
    HEADER,
    '',
    generateNodeTypesSection(schema),
    generateEdgeTypesSection(schema),
    generateEdgeCategoriesSection(schema),
    generateStatusCategoriesSection(schema),
    generateEdgeEnumSection(schema),
    generateStatusEnumSection(schema),
    generateThresholdsSection(schema),
    generateTransitionsSection(schema),
    generateValidValuesSection(schema),
    generateValidValueEnumsSection(schema),
    generateEdgeAttributesInterfaceSection(schema),
    generateEdgeAttributeAffinitySection(schema),
    generateTransitionPolicySection(schema),
    generateCeremonyTriggersSection(schema),
    '', // trailing newline
  ];

  return sections.join('\n');
}

// ── Section Generators ──────────────────────────────────────────────

function generateNodeTypesSection(schema: GraphSchema): string {
  const sorted = [...schema.nodeTypes].sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [];

  // ── NodeType union
  lines.push(sectionComment('Node Types'));
  lines.push('');
  lines.push('export type NodeType =');
  for (const nt of sorted) {
    lines.push(`  | '${nt.name}'`);
  }
  lines.push(';');
  lines.push('');

  // ── NODE_TYPES array
  lines.push('export const NODE_TYPES: NodeType[] = [');
  for (const nt of sorted) {
    lines.push(`  '${nt.name}',`);
  }
  lines.push('];');

  // ── NODE_DISPLAY_ORDER (domain-meaningful order for display)
  const DOMAIN_ORDER: string[] = ['hypothesis', 'experiment', 'finding', 'knowledge', 'question', 'decision', 'episode'];
  const displayOrder = [
    ...DOMAIN_ORDER.filter(n => sorted.some(nt => nt.name === n)),
    ...sorted.map(nt => nt.name).filter(n => !DOMAIN_ORDER.includes(n)),
  ];
  lines.push('');
  lines.push('export const NODE_DISPLAY_ORDER: NodeType[] = [');
  for (const name of displayOrder) {
    lines.push(`  '${name}',`);
  }
  lines.push('];');
  lines.push('');

  // ── NODE_TYPE_DIRS
  lines.push(sectionComment('Node Type → Directory Mapping'));
  lines.push('');
  lines.push('export const NODE_TYPE_DIRS: Record<NodeType, string> = {');
  for (const nt of sorted) {
    lines.push(`  ${nt.name}: '${nt.directory}',`);
  }
  lines.push('};');
  lines.push('');

  // ── ID_PREFIXES
  lines.push(sectionComment('ID Prefixes'));
  lines.push('');
  lines.push('export const ID_PREFIXES: Record<NodeType, string> = {');
  for (const nt of sorted) {
    lines.push(`  ${nt.name}: '${nt.prefix}',`);
  }
  lines.push('};');
  lines.push('');

  // ── PREFIX_TO_TYPE
  const prefixEntries = sorted.map(nt => ({ prefix: nt.prefix, name: nt.name }));
  prefixEntries.sort((a, b) => a.prefix.localeCompare(b.prefix));
  lines.push('export const PREFIX_TO_TYPE: Record<string, NodeType> = {');
  for (const e of prefixEntries) {
    lines.push(`  ${e.prefix}: '${e.name}',`);
  }
  lines.push('};');
  lines.push('');

  // ── VALID_STATUSES
  lines.push(sectionComment('Valid Statuses per Node Type'));
  lines.push('');
  lines.push('export const VALID_STATUSES: Record<NodeType, readonly string[]> = {');
  for (const nt of sorted) {
    const statuses = nt.statuses.map(s => `'${s}'`).join(', ');
    lines.push(`  ${nt.name}: [${statuses}],`);
  }
  lines.push('};');
  lines.push('');

  // ── REQUIRED_FIELDS
  lines.push(sectionComment('Required Fields per Node Type'));
  lines.push('');
  lines.push('export const REQUIRED_FIELDS: Record<NodeType, readonly string[]> = {');
  for (const nt of sorted) {
    const fields = nt.requiredFields.map(f => `'${f}'`).join(', ');
    lines.push(`  ${nt.name}: [${fields}],`);
  }
  lines.push('};');

  return lines.join('\n');
}

function generateEdgeTypesSection(schema: GraphSchema): string {
  const forward = [...schema.edgeTypes.forward].sort();
  const reverseEntries = Object.entries(schema.edgeTypes.reverse).sort(([a], [b]) => a.localeCompare(b));
  const allEdges = [...forward, ...reverseEntries.map(([k]) => k)].sort();
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Edge Types'));
  lines.push('');

  // ── EdgeType union (forward + reverse keys, sorted)
  lines.push('export type EdgeType =');
  for (const e of allEdges) {
    lines.push(`  | '${e}'`);
  }
  lines.push(';');
  lines.push('');

  // ── EDGE_TYPES (forward only, sorted)
  lines.push('export const EDGE_TYPES = new Set<string>([');
  for (const e of forward) {
    lines.push(`  '${e}',`);
  }
  lines.push(']);');
  lines.push('');

  // ── REVERSE_LABELS
  lines.push('export const REVERSE_LABELS: Record<string, string> = {');
  for (const [key, value] of reverseEntries) {
    lines.push(`  ${key}: '${value}',`);
  }
  lines.push('};');
  lines.push('');

  // ── ALL_VALID_RELATIONS (computed)
  lines.push('export const ALL_VALID_RELATIONS = new Set<string>([');
  lines.push('  ...EDGE_TYPES,');
  lines.push('  ...Object.keys(REVERSE_LABELS),');
  lines.push(']);');

  return lines.join('\n');
}

function generateThresholdsSection(schema: GraphSchema): string {
  const entries = Object.entries(schema.thresholds).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Thresholds'));
  lines.push('');
  lines.push('export const THRESHOLDS = {');
  for (const [key, value] of entries) {
    lines.push(`  ${key}: ${value},`);
  }
  lines.push('} as const;');

  return lines.join('\n');
}

function generateTransitionsSection(schema: GraphSchema): string {
  const lines: string[] = [];

  // ── TRANSITION_TABLE
  lines.push('');
  lines.push(sectionComment('Transition Table'));
  lines.push('');
  lines.push('export const TRANSITION_TABLE: Partial<Record<NodeType, { from: string; to: string; conditions: { fn: string; args: Record<string, unknown> }[] }[]>> = {');

  const typeNames = Object.keys(schema.transitions).sort();
  for (const typeName of typeNames) {
    const rules = schema.transitions[typeName];
    lines.push(`  ${typeName}: [`);
    for (const rule of rules) {
      const conditionsStr = rule.conditions.map(c => {
        const argsStr = Object.entries(c.args)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ');
        return `{ fn: '${c.fn}', args: { ${argsStr} } }`;
      }).join(', ');
      lines.push(`    { from: '${rule.from}', to: '${rule.to}', conditions: [${conditionsStr}] },`);
    }
    lines.push('  ],');
  }
  lines.push('};');

  // ── MANUAL_TRANSITIONS
  if (schema.manualTransitions && Object.keys(schema.manualTransitions).length > 0) {
    lines.push('');
    lines.push('export const MANUAL_TRANSITIONS: Partial<Record<NodeType, { from: string; to: string }[]>> = {');
    const mtTypeNames = Object.keys(schema.manualTransitions).sort();
    for (const typeName of mtTypeNames) {
      const rules = schema.manualTransitions[typeName];
      lines.push(`  ${typeName}: [`);
      for (const rule of rules) {
        lines.push(`    { from: '${rule.from}', to: '${rule.to}' },`);
      }
      lines.push('  ],');
    }
    lines.push('};');
  } else {
    lines.push('');
    lines.push('export const MANUAL_TRANSITIONS: Partial<Record<NodeType, { from: string; to: string }[]>> = {};');
  }

  return lines.join('\n');
}

function generateValidValuesSection(schema: GraphSchema): string {
  const entries = Object.entries(schema.validValues).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Valid Values'));
  lines.push('');

  for (const [key, values] of entries) {
    const constName = `VALID_${camelToScreamingSnake(key)}`;
    const vals = values.map(v => `'${v}'`).join(', ');
    lines.push(`export const ${constName} = [${vals}] as const;`);
  }

  return lines.join('\n');
}

function singularize(key: string): string {
  if (key.endsWith('ies')) return key.slice(0, -3) + 'y'; // urgencies → urgency
  if (key.endsWith('s')) return key.slice(0, -1); // impacts → impact, dependencyTypes → dependencyType
  return key;
}

function generateValidValueEnumsSection(schema: GraphSchema): string {
  const entries = Object.entries(schema.validValues).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Valid Value Enums'));
  lines.push('');

  for (const [key, values] of entries) {
    const singular = singularize(key);
    const constName = camelToScreamingSnake(singular);
    lines.push(`export const ${constName} = {`);
    for (const v of values) {
      lines.push(`  ${v}: '${v}',`);
    }
    lines.push('} as const;');
  }

  lines.push('');
  for (const [key] of entries) {
    const singular = singularize(key);
    const pascalName = singular.charAt(0).toUpperCase() + singular.slice(1);
    const validArrayName = `VALID_${camelToScreamingSnake(key)}`;
    lines.push(`export type ${pascalName} = (typeof ${validArrayName})[number];`);
  }

  return lines.join('\n');
}

function generateCeremonyTriggersSection(schema: GraphSchema): string {
  if (!schema.ceremonies) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Ceremony Triggers'));
    lines.push('');
    lines.push('export const CEREMONY_TRIGGERS = {} as const satisfies Record<string, Record<string, number | boolean>>;');
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(sectionComment('Ceremony Triggers'));
  lines.push('');
  lines.push('export const CEREMONY_TRIGGERS = {');

  const ceremonyNames = Object.keys(schema.ceremonies).sort();
  for (const name of ceremonyNames) {
    const ceremony = schema.ceremonies[name];
    const triggerEntries = Object.entries(ceremony.triggers).sort(([a], [b]) => a.localeCompare(b));
    lines.push(`  ${name}: {`);
    for (const [key, value] of triggerEntries) {
      lines.push(`    ${key}: ${value},`);
    }
    lines.push('  },');
  }

  lines.push('} as const satisfies Record<string, Record<string, number | boolean>>;');
  return lines.join('\n');
}

function generateTransitionPolicySection(schema: GraphSchema): string {
  if (!schema.transitionPolicy) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Transition Policy'));
    lines.push('');
    lines.push("export const TRANSITION_POLICY_DEFAULT = 'off' as const;");
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(sectionComment('Transition Policy'));
  lines.push('');
  lines.push(`export const TRANSITION_POLICY_DEFAULT = '${schema.transitionPolicy.mode}' as const;`);

  return lines.join('\n');
}

function generateEdgeAttributesInterfaceSection(schema: GraphSchema): string {
  if (!schema.edgeAttributes) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Edge Attributes Interface'));
    lines.push('');
    lines.push('export interface EdgeAttributes {}');
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_NAMES = [] as const;');
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_TYPES: Record<string, \'number\' | \'enum\'> = {};');
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_RANGES: Record<string, { min?: number; max?: number }> = {};');
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_ENUM_VALUES: Record<string, readonly string[]> = {};');
    return lines.join('\n');
  }

  const entries = Object.entries(schema.edgeAttributes).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Edge Attributes Interface'));
  lines.push('');
  lines.push('export interface EdgeAttributes {');
  for (const [name, def] of entries) {
    if (def.type === 'number') {
      lines.push(`  ${name}?: number;`);
    } else if (def.type === 'enum' && def.valuesRef) {
      const constName = `VALID_${camelToScreamingSnake(def.valuesRef)}`;
      lines.push(`  ${name}?: typeof ${constName}[number];`);
    }
  }
  lines.push('}');

  // Also export the known attribute names for runtime use
  lines.push('');
  const attrNames = entries.map(([n]) => `'${n}'`).join(', ');
  lines.push(`export const EDGE_ATTRIBUTE_NAMES = [${attrNames}] as const;`);

  // Export attribute type map for runtime type detection (number vs enum)
  lines.push('');
  lines.push("export const EDGE_ATTRIBUTE_TYPES: Record<string, 'number' | 'enum'> = {");
  for (const [name, def] of entries) {
    lines.push(`  ${name}: '${def.type}',`);
  }
  lines.push('};');

  // Export numeric range bounds from schema (single source of truth for min/max)
  const numericEntries = entries.filter(([, def]) => def.type === 'number' && (def.min !== undefined || def.max !== undefined));
  lines.push('');
  if (numericEntries.length > 0) {
    lines.push('export const EDGE_ATTRIBUTE_RANGES: Record<string, { min?: number; max?: number }> = {');
    for (const [name, def] of numericEntries) {
      const parts: string[] = [];
      if (def.min !== undefined) parts.push(`min: ${def.min}`);
      if (def.max !== undefined) parts.push(`max: ${def.max}`);
      lines.push(`  ${name}: { ${parts.join(', ')} },`);
    }
    lines.push('};');
  } else {
    lines.push('export const EDGE_ATTRIBUTE_RANGES: Record<string, { min?: number; max?: number }> = {};');
  }

  // Export enum attribute → valid values mapping (single source of truth for enum validation)
  const enumEntries = entries.filter(([, def]) => def.type === 'enum' && def.valuesRef);
  if (enumEntries.length > 0) {
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_ENUM_VALUES: Record<string, readonly string[]> = {');
    for (const [name, def] of enumEntries) {
      const constName = `VALID_${camelToScreamingSnake(def.valuesRef!)}`;
      lines.push(`  ${name}: ${constName},`);
    }
    lines.push('};');
  } else {
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_ENUM_VALUES: Record<string, readonly string[]> = {};');
  }

  return lines.join('\n');
}

function generateEdgeAttributeAffinitySection(schema: GraphSchema): string {
  if (!schema.edgeAttributeAffinity) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Edge Attribute Affinity'));
    lines.push('');
    lines.push('export const EDGE_ATTRIBUTE_AFFINITY: Partial<Record<EdgeType, readonly string[]>> = {};');
    return lines.join('\n');
  }

  const entries = Object.entries(schema.edgeAttributeAffinity).sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Edge Attribute Affinity'));
  lines.push('');
  lines.push('export const EDGE_ATTRIBUTE_AFFINITY: Partial<Record<EdgeType, readonly string[]>> = {');
  for (const [edgeType, attrs] of entries) {
    const vals = attrs.map(a => `'${a}'`).join(', ');
    lines.push(`  ${edgeType}: [${vals}],`);
  }
  lines.push('};');

  return lines.join('\n');
}

function generateEdgeCategoriesSection(schema: GraphSchema): string {
  if (!schema.edgeCategories) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Edge Categories'));
    lines.push('');
    lines.push('// No edge categories defined');
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(sectionComment('Edge Categories'));
  lines.push('');

  const categories = Object.entries(schema.edgeCategories).sort(([a], [b]) => a.localeCompare(b));
  for (const [category, edges] of categories) {
    const constName = `${camelToScreamingSnake(category)}_EDGES`;
    const sorted = [...edges].sort();
    const vals = sorted.map(e => `'${e}'`).join(', ');
    lines.push(`export const ${constName} = new Set<string>([${vals}]);`);

    // Generate union type per category
    const typeName = category
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'EdgeType';
    const unionMembers = sorted.map(e => `'${e}'`).join(' | ');
    lines.push(`export type ${typeName} = ${unionMembers};`);
  }

  return lines.join('\n');
}

function generateStatusCategoriesSection(schema: GraphSchema): string {
  if (!schema.statusCategories) {
    const lines: string[] = [];
    lines.push('');
    lines.push(sectionComment('Status Categories'));
    lines.push('');
    lines.push('// No status categories defined');
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(sectionComment('Status Categories'));
  lines.push('');

  const categories = Object.entries(schema.statusCategories).sort(([a], [b]) => a.localeCompare(b));
  for (const [category, statuses] of categories) {
    const constName = `${camelToScreamingSnake(category)}_STATUSES`;
    const sorted = [...statuses].sort();
    const vals = sorted.map(s => `'${s}'`).join(', ');
    lines.push(`export const ${constName} = new Set<string>([${vals}]);`);
  }

  return lines.join('\n');
}

function generateEdgeEnumSection(schema: GraphSchema): string {
  const forward = [...schema.edgeTypes.forward];
  const reverseKeys = Object.keys(schema.edgeTypes.reverse);
  const allEdgeNames = [...new Set([...forward, ...reverseKeys])].sort();
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Edge Enum'));
  lines.push('');
  lines.push('export const EDGE = {');
  for (const e of allEdgeNames) {
    lines.push(`  ${e}: '${e}',`);
  }
  lines.push('} as const satisfies Record<EdgeType, EdgeType>;');

  return lines.join('\n');
}

function generateStatusEnumSection(schema: GraphSchema): string {
  const allStatuses = new Set<string>();
  for (const nt of schema.nodeTypes) {
    for (const s of nt.statuses) {
      allStatuses.add(s);
    }
  }
  const sorted = [...allStatuses].sort();
  const lines: string[] = [];

  lines.push('');
  lines.push(sectionComment('Status Enum'));
  lines.push('');
  lines.push('export const STATUS = {');
  for (const s of sorted) {
    lines.push(`  ${s}: '${s}',`);
  }
  lines.push('} as const;');

  return lines.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────

function sectionComment(title: string): string {
  const pad = '─'.repeat(Math.max(1, 65 - title.length));
  return `// ── ${title} ${pad}`;
}

function camelToScreamingSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

// ── CLI Entry Point ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const { loadSchema } = await import('./loader.js');

  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const graphDirIdx = args.indexOf('--graph-dir');
  const graphDirArg = graphDirIdx >= 0 ? args[graphDirIdx + 1] : undefined;

  const schema = await loadSchema();
  const output = generateTypesFile(schema);

  const outPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../graph/types.generated.ts',
  );
  await writeFile(outPath, output, 'utf-8');

  const nodeCount = schema.nodeTypes.length;
  const edgeCount = schema.edgeTypes.forward.length;
  const ruleCount = Object.values(schema.transitions).flat().length;
  console.log(`Generated ${nodeCount} node types, ${edgeCount} edge types, ${ruleCount} transition rules`);
  console.log(`  → ${outPath}`);

  // Compat check (T010.5 — integrated after compat-checker is implemented)
  try {
    const { checkCompatibility } = await import('./compat-checker.js');
    const { resolveGraphDir } = await import('../graph/loader.js');

    let graphDir: string;
    try {
      graphDir = graphDirArg ?? resolveGraphDir(process.cwd());
    } catch {
      console.warn('WARNING: No graph directory found — skipping compatibility check');
      return;
    }

    const result = await checkCompatibility(schema, graphDir);

    if (result.warnings.length > 0) {
      console.warn('\nWARNING: Compatibility issues with existing graph files:');
      for (const w of result.warnings) {
        console.warn(`  - ${w.path}: ${w.message}`);
      }
      if (strict) {
        console.warn('  (--strict mode: treating warnings as errors)');
        process.exitCode = 1;
      } else {
        console.warn('  (use --strict to fail on warnings)');
      }
    }

    if (result.errors.length > 0) {
      console.error('\nERROR: Incompatible graph files:');
      for (const e of result.errors) {
        console.error(`  - ${e.path}: ${e.message}`);
      }
      process.exitCode = 1;
    }
  } catch {
    // compat-checker not yet available — skip silently
  }
}

// Run CLI when executed directly
const isMain = process.argv[1] &&
  (process.argv[1].endsWith('/codegen.ts') || process.argv[1].endsWith('/codegen.js'));
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
