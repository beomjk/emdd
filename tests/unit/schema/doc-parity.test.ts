import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOC_GENERATORS } from '../../../src/schema/doc-tables.js';
import { createDefaultRegistry } from '../../../src/registry/all-commands.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');

// ── AUTO marker presence ────────────────────────────────────────────

describe('AUTO marker presence', () => {
  it('README.md contains cli-core, cli-analysis, cli-export markers', () => {
    const content = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    expect(content).toContain('<!-- AUTO:readme-cli-core -->');
    expect(content).toContain('<!-- /AUTO:readme-cli-core -->');
    expect(content).toContain('<!-- AUTO:readme-cli-analysis -->');
    expect(content).toContain('<!-- /AUTO:readme-cli-analysis -->');
    expect(content).toContain('<!-- AUTO:readme-cli-export -->');
    expect(content).toContain('<!-- /AUTO:readme-cli-export -->');
  });

  it('MCP_SETUP.md contains mcp-tool-count, mcp-tool-table, mcp-prompt-table markers', () => {
    const content = readFileSync(path.join(ROOT, 'docs/MCP_SETUP.md'), 'utf-8');
    expect(content).toContain('<!-- AUTO:mcp-tool-count -->');
    expect(content).toContain('<!-- /AUTO:mcp-tool-count -->');
    expect(content).toContain('<!-- AUTO:mcp-tool-table -->');
    expect(content).toContain('<!-- /AUTO:mcp-tool-table -->');
    expect(content).toContain('<!-- AUTO:mcp-prompt-table -->');
    expect(content).toContain('<!-- /AUTO:mcp-prompt-table -->');
  });

  it('emdd-agent.md contains agent-tools marker', () => {
    const content = readFileSync(path.join(ROOT, 'src/rules/emdd-agent.md'), 'utf-8');
    expect(content).toContain('<!-- AUTO:agent-tools -->');
    expect(content).toContain('<!-- /AUTO:agent-tools -->');
  });
});

// ── Freshness ───────────────────────────────────────────────────────

describe('doc-table freshness', () => {
  const markerRegex = /<!-- AUTO:(\S+) -->\n([\s\S]*?)<!-- \/AUTO:\1 -->/g;

  function extractMarkerContent(content: string, markerName: string): string | null {
    const regex = new RegExp(`<!-- AUTO:${markerName} -->\\n([\\s\\S]*?)\\n<!-- /AUTO:${markerName} -->`);
    const match = content.match(regex);
    return match ? match[1] : null;
  }

  it('README.md cli-core content matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    const current = extractMarkerContent(content, 'readme-cli-core');
    const expected = DOC_GENERATORS['readme-cli-core']();
    expect(current).toBe(expected);
  });

  it('README.md cli-analysis content matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    const current = extractMarkerContent(content, 'readme-cli-analysis');
    const expected = DOC_GENERATORS['readme-cli-analysis']();
    expect(current).toBe(expected);
  });

  it('README.md cli-export content matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    const current = extractMarkerContent(content, 'readme-cli-export');
    const expected = DOC_GENERATORS['readme-cli-export']();
    expect(current).toBe(expected);
  });

  it('MCP_SETUP.md tool count matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'docs/MCP_SETUP.md'), 'utf-8');
    const current = extractMarkerContent(content, 'mcp-tool-count');
    const expected = DOC_GENERATORS['mcp-tool-count']();
    expect(current).toBe(expected);
  });

  it('MCP_SETUP.md tool table matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'docs/MCP_SETUP.md'), 'utf-8');
    const current = extractMarkerContent(content, 'mcp-tool-table');
    const expected = DOC_GENERATORS['mcp-tool-table']();
    expect(current).toBe(expected);
  });

  it('MCP_SETUP.md prompt table matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'docs/MCP_SETUP.md'), 'utf-8');
    const current = extractMarkerContent(content, 'mcp-prompt-table');
    const expected = DOC_GENERATORS['mcp-prompt-table']();
    expect(current).toBe(expected);
  });

  it('emdd-agent.md agent-tools matches generator output', () => {
    const content = readFileSync(path.join(ROOT, 'src/rules/emdd-agent.md'), 'utf-8');
    const current = extractMarkerContent(content, 'agent-tools');
    const expected = DOC_GENERATORS['agent-tools']();
    expect(current).toBe(expected);
  });
});

// ── Count parity ────────────────────────────────────────────────────

describe('command count parity', () => {
  it('total CLI commands in README equals registry (minus cli:false) plus non-registry', () => {
    const allDefs = createDefaultRegistry().getAll();
    const cliDefs = allDefs.filter(d => d.cli !== false);
    const nonRegistryCount = 7; // init, graph, serve, export-html, mcp, doctor, workflow (all defined directly in cli.ts)
    const expectedTotal = cliDefs.length + nonRegistryCount;

    // Count data rows across all 3 README tables
    const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
    const dataRows = [...readme.matchAll(/\| `emdd /g)];
    expect(dataRows.length).toBe(expectedTotal);
  });
});
