import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../src/graph/loader.js', () => ({
  resolveGraphDir: vi.fn(() => '/mock/graph'),
}));

vi.mock('../../../src/web/server.js', () => ({
  createDashboardServer: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import { serveCommand } from '../../../src/cli/serve.js';
import { resolveGraphDir } from '../../../src/graph/loader.js';
import { createDashboardServer } from '../../../src/web/server.js';
import { serve } from '@hono/node-server';

// ── Helpers ────────────────────────────────────────────────────────────

function makeFakeGraph(nodeCount = 5, edgeCount = 3) {
  return {
    nodes: Array.from({ length: nodeCount }, (_, i) => ({ id: `n-${i}` })),
    edges: Array.from({ length: edgeCount }, (_, i) => ({ id: `e-${i}` })),
    loadedAt: new Date().toISOString(),
  };
}

function makeFakeCache(graph: ReturnType<typeof makeFakeGraph>) {
  return {
    load: vi.fn().mockResolvedValue(graph),
    invalidate: vi.fn(),
    getGraph: vi.fn(),
    getHealth: vi.fn(),
    getRawGraph: vi.fn(),
    getClusters: vi.fn(),
  };
}

function makeFakeDashboard(graph: ReturnType<typeof makeFakeGraph>) {
  return {
    app: { fetch: vi.fn() },
    cache: makeFakeCache(graph),
  } as any;
}

/**
 * Create an EventEmitter that emits an error when an 'error' listener is attached.
 * Uses queueMicrotask so the listener is registered before the error fires.
 */
function makeErrorEmitter(code: string, message: string): EventEmitter {
  const emitter = new EventEmitter();
  const origOnce = emitter.once.bind(emitter);
  emitter.once = function (event: string, listener: (...args: any[]) => void) {
    origOnce(event, listener);
    if (event === 'error') {
      queueMicrotask(() => {
        emitter.emit('error', Object.assign(new Error(message), { code }));
      });
    }
    return this;
  } as any;
  return emitter;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('serveCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const mockServe = vi.mocked(serve);
  const mockCreateDashboardServer = vi.mocked(createDashboardServer);
  const mockResolveGraphDir = vi.mocked(resolveGraphDir);

  // Suppress PromiseRejectionHandledWarning from Node.
  // The error-path tests intentionally reject promises that are then caught
  // by the try/catch in tryListen. Node's global handler fires before the
  // synchronous catch runs, producing a spurious warning.
  let origListeners: NodeJS.UnhandledRejectionListener[];

  beforeEach(() => {
    vi.useFakeTimers();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();

    mockResolveGraphDir.mockReturnValue('/mock/graph');
    mockCreateDashboardServer.mockReturnValue(makeFakeDashboard(makeFakeGraph()));

    // Default: serve returns a silent emitter (success path)
    mockServe.mockReturnValue(new EventEmitter() as any);

    // Save and suppress unhandledRejection listeners so vitest does not
    // report caught-but-briefly-unhandled promise rejections as errors.
    origListeners = process.rawListeners('unhandledRejection') as NodeJS.UnhandledRejectionListener[];
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', () => {
      // intentionally swallowed — these are caught by tryListen's try/catch
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.useRealTimers();

    // Restore original unhandledRejection listeners
    process.removeAllListeners('unhandledRejection');
    for (const l of origListeners) {
      process.on('unhandledRejection', l);
    }
  });

  it('happy path: starts server and logs URL with correct node/edge counts', async () => {
    mockCreateDashboardServer.mockReturnValue(makeFakeDashboard(makeFakeGraph(10, 7)));

    const p = serveCommand(undefined, { port: 3000, open: false });
    await vi.advanceTimersByTimeAsync(100);
    await p;

    const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allLogs).toContain('http://localhost:3000');
    expect(allLogs).toContain('10 nodes');
    expect(allLogs).toContain('7 edges');
  });

  it('opens browser when open: true', async () => {
    const p = serveCommand(undefined, { port: 4000, open: true });
    await vi.advanceTimersByTimeAsync(100);
    await p;

    const { default: openBrowser } = await import('open');
    expect(openBrowser).toHaveBeenCalledWith('http://localhost:4000');
  });

  it('does NOT open browser when open: false', async () => {
    const p = serveCommand(undefined, { port: 4001, open: false });
    await vi.advanceTimersByTimeAsync(100);
    await p;

    const { default: openBrowser } = await import('open');
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it('falls back to next port on EADDRINUSE and warns about port change', async () => {
    mockServe
      .mockReturnValueOnce(makeErrorEmitter('EADDRINUSE', 'listen EADDRINUSE') as any)
      .mockReturnValueOnce(new EventEmitter() as any);

    const p = serveCommand(undefined, { port: 5000, open: false });
    await vi.advanceTimersByTimeAsync(100);
    await p;

    const allLogs = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allLogs).toContain('Port 5000');
    expect(allLogs).toContain('5001');
    expect(allLogs).toContain('http://localhost:5001');
  });

  it('throws when all ports are exhausted', async () => {
    mockServe.mockImplementation(() => makeErrorEmitter('EADDRINUSE', 'listen EADDRINUSE') as any);

    const p = serveCommand(undefined, { port: 6000, open: false });
    await vi.advanceTimersByTimeAsync(200);

    await expect(p).rejects.toThrow('All ports');
  });

  it('rethrows non-EADDRINUSE errors immediately without retry', async () => {
    mockServe.mockReturnValue(makeErrorEmitter('EACCES', 'permission denied') as any);

    const p = serveCommand(undefined, { port: 7000, open: false });
    await vi.advanceTimersByTimeAsync(100);

    await expect(p).rejects.toThrow('permission denied');
    expect(mockServe).toHaveBeenCalledTimes(1);
  });
});
