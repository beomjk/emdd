import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

vi.mock('../../../src/graph/loader.js', () => ({
  resolveGraphDir: vi.fn().mockReturnValue('/mock/graph'),
}));

vi.mock('../../../src/web/cache.js', () => ({
  createGraphCache: vi.fn().mockReturnValue({
    load: vi.fn().mockResolvedValue({
      nodes: [{ id: 'n1' }],
      edges: [],
      loadedAt: '2026-01-01',
    }),
  }),
}));

vi.mock('../../../src/web/export.js', () => ({
  generateExportHtml: vi.fn().mockReturnValue({
    html: '<html>mock</html>',
    nodeCount: 5,
    edgeCount: 3,
  }),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      writeFileSync: vi.fn(),
    },
  };
});

import fs from 'node:fs';
import { generateExportHtml } from '../../../src/web/export.js';
import { exportHtmlCommand } from '../../../src/cli/export-html.js';

describe('exportHtmlCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('uses default output path graph-dashboard.html when outputArg is undefined', async () => {
    await exportHtmlCommand(undefined, { layout: 'force' });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall[0]).toBe(path.resolve('graph-dashboard.html'));
    expect(writeCall[1]).toBe('<html>mock</html>');
    expect(writeCall[2]).toBe('utf-8');
  });

  it('uses custom output path when outputArg is provided', async () => {
    await exportHtmlCommand('my-export.html', { layout: 'force' });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writeCall[0]).toBe(path.resolve('my-export.html'));
  });

  it('passes hierarchical layout to generateExportHtml', async () => {
    await exportHtmlCommand(undefined, { layout: 'hierarchical' });

    const exportCall = vi.mocked(generateExportHtml).mock.calls[0];
    expect(exportCall[1]).toMatchObject({ layout: 'hierarchical' });
  });

  it('converts non-hierarchical layout values to force', async () => {
    await exportHtmlCommand(undefined, { layout: 'cose' });

    const exportCall = vi.mocked(generateExportHtml).mock.calls[0];
    expect(exportCall[1]).toMatchObject({ layout: 'force' });
  });

  it('parses comma-separated types into array', async () => {
    await exportHtmlCommand(undefined, { layout: 'force', types: 'hypothesis,finding' });

    const exportCall = vi.mocked(generateExportHtml).mock.calls[0];
    expect(exportCall[1]).toMatchObject({ types: ['hypothesis', 'finding'] });
  });

  it('parses comma-separated statuses into array', async () => {
    await exportHtmlCommand(undefined, { layout: 'force', statuses: 'TESTING,SUPPORTED' });

    const exportCall = vi.mocked(generateExportHtml).mock.calls[0];
    expect(exportCall[1]).toMatchObject({ statuses: ['TESTING', 'SUPPORTED'] });
  });

  it('passes undefined for types and statuses when not provided', async () => {
    await exportHtmlCommand(undefined, { layout: 'force' });

    const exportCall = vi.mocked(generateExportHtml).mock.calls[0];
    expect(exportCall[1]).toMatchObject({ types: undefined, statuses: undefined, theme: undefined });
  });

  it('console output includes file path, node count, and edge count', async () => {
    await exportHtmlCommand(undefined, { layout: 'force' });

    const logCalls = consoleSpy.mock.calls.map((call) => call[0] as string);
    const allOutput = logCalls.join('\n');

    expect(allOutput).toContain(path.resolve('graph-dashboard.html'));
    expect(allOutput).toContain('5 nodes');
    expect(allOutput).toContain('3 edges');
  });
});
