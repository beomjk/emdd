import { describe, it, expect } from 'vitest';
import { DOC_GENERATORS } from '../../../src/schema/doc-tables.js';

// ── readme-cli-core ──────────────────────────────────────────────────

describe('readme-cli-core', () => {
  const gen = () => DOC_GENERATORS['readme-cli-core']();

  it('produces a table with 8 data rows', () => {
    const lines = gen().split('\n').filter(l => l.startsWith('| `emdd'));
    expect(lines).toHaveLength(8);
  });

  it('contains init (non-registry)', () => {
    expect(gen()).toContain('`emdd init');
  });

  it('uses CLI command names', () => {
    const output = gen();
    expect(output).toContain('`emdd new');
    expect(output).toContain('`emdd read');
    expect(output).toContain('`emdd list');
    expect(output).toContain('`emdd update');
    expect(output).toContain('`emdd link');
    expect(output).toContain('`emdd unlink');
    expect(output).toContain('`emdd done');
  });

  it('includes attribution comment', () => {
    expect(gen()).toContain('<!-- Generated from command registry');
  });
});

// ── readme-cli-analysis ──────────────────────────────────────────────

describe('readme-cli-analysis', () => {
  const gen = () => DOC_GENERATORS['readme-cli-analysis']();

  it('produces a table with 13 data rows', () => {
    const lines = gen().split('\n').filter(l => l.startsWith('| `emdd'));
    expect(lines).toHaveLength(13);
  });

  it('contains neighbors and gaps (overridden to analysis)', () => {
    const output = gen();
    expect(output).toContain('`emdd neighbors');
    expect(output).toContain('`emdd gaps');
  });

  it('contains analysis commands', () => {
    const output = gen();
    expect(output).toContain('`emdd health');
    expect(output).toContain('`emdd lint');
    expect(output).toContain('`emdd transitions');
    expect(output).toContain('`emdd branches');
  });
});

// ── readme-cli-export ────────────────────────────────────────────────

describe('readme-cli-export', () => {
  const gen = () => DOC_GENERATORS['readme-cli-export']();

  it('produces a table with 5 data rows', () => {
    const lines = gen().split('\n').filter(l => l.startsWith('| `emdd'));
    expect(lines).toHaveLength(5);
  });

  it('contains non-registry export commands', () => {
    const output = gen();
    expect(output).toContain('`emdd serve');
    expect(output).toContain('`emdd graph');
    expect(output).toContain('`emdd mcp');
    expect(output).toContain('`emdd export-html');
  });

  it('contains index-graph (overridden to export)', () => {
    expect(gen()).toContain('`emdd index');
  });
});

// ── mcp-tool-count ───────────────────────────────────────────────────

describe('mcp-tool-count', () => {
  const gen = () => DOC_GENERATORS['mcp-tool-count']();

  it('contains "22 tools"', () => {
    expect(gen()).toContain('22 tools');
  });

  it('contains "4 prompts"', () => {
    expect(gen()).toContain('4 prompts');
  });
});

// ── mcp-tool-table ───────────────────────────────────────────────────

describe('mcp-tool-table', () => {
  const gen = () => DOC_GENERATORS['mcp-tool-table']();

  it('produces a table with 22 data rows', () => {
    const lines = gen().split('\n').filter(l => l.startsWith('| `'));
    expect(lines).toHaveLength(22);
  });

  it('uses MCP tool name overrides', () => {
    const output = gen();
    expect(output).toContain('`graph-neighbors`');
    expect(output).toContain('`graph-gaps`');
    expect(output).toContain('`status-transitions`');
  });
});

// ── mcp-prompt-table ─────────────────────────────────────────────────

describe('mcp-prompt-table', () => {
  const gen = () => DOC_GENERATORS['mcp-prompt-table']();

  it('produces a table with 4 data rows', () => {
    const lines = gen().split('\n').filter(l => l.startsWith('| `'));
    expect(lines).toHaveLength(4);
  });

  it('contains all four prompts', () => {
    const output = gen();
    expect(output).toContain('context-loading');
    expect(output).toContain('episode-creation');
    expect(output).toContain('consolidation');
    expect(output).toContain('health-review');
  });
});

// ── agent-tools ──────────────────────────────────────────────────────

describe('agent-tools', () => {
  const gen = () => DOC_GENERATORS['agent-tools']();

  it('has category headers', () => {
    const output = gen();
    expect(output).toContain('**Read operations:**');
    expect(output).toContain('**Write operations:**');
    expect(output).toContain('**Analysis operations:**');
    expect(output).toContain('**Prompts:**');
  });

  it('uses MCP tool names', () => {
    const output = gen();
    expect(output).toContain('`graph-neighbors`');
    expect(output).toContain('`graph-gaps`');
    expect(output).toContain('`status-transitions`');
  });
});
