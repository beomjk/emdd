import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => {
  const existsSync = vi.fn();
  const readFileSync = vi.fn();
  return {
    default: { existsSync, readFileSync },
    existsSync,
    readFileSync,
  };
});

import fs from 'node:fs';
import { createStaticRoutes } from '../../../src/web/routes/static.js';

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.readFileSync).mockReset();
});

describe('createStaticRoutes', () => {
  it('GET / serves index.html with text/html content type', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('<html><body>Hello</body></html>');

    const app = createStaticRoutes();
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toBe('<html><body>Hello</body></html>');
  });

  it('GET /bundle.js serves JS with application/javascript content type', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('console.log("hello");');

    const app = createStaticRoutes();
    const res = await app.request('/bundle.js');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/javascript; charset=utf-8');
    expect(await res.text()).toBe('console.log("hello");');
  });

  it('GET /style.css serves CSS with text/css content type', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('body { margin: 0; }');

    const app = createStaticRoutes();
    const res = await app.request('/style.css');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(await res.text()).toBe('body { margin: 0; }');
  });

  it('GET /bundle.js returns 404 when file does not exist on disk', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const app = createStaticRoutes();
    const res = await app.request('/bundle.js');

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  it('rejects backend .js files not in the allowlist with 404', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('// compiled backend source');

    const app = createStaticRoutes();
    // Prior to the allowlist, the broad regex served every compiled
    // backend .js file (server.js, cache.js, routes/api.js, ...) to any
    // client. The allowlist now blocks them.
    for (const path of ['/server.js', '/cache.js', '/sse.js', '/watcher.js', '/export.js', '/constants.js']) {
      const res = await app.request(path);
      expect(res.status, `expected 404 for ${path}`).toBe(404);
    }
    // readFileSync must never be called for disallowed paths
    const readCalls = vi.mocked(fs.readFileSync).mock.calls.filter(
      (c) => typeof c[0] === 'string' && !c[0].includes('bundle.js') && !c[0].includes('style.css'),
    );
    // The prod/dev detection reads index.html; that's fine. Nothing else.
    for (const c of readCalls) {
      expect(c[0]).toMatch(/index\.html$/);
    }
  });

  it('rejects .js paths with directory segments (e.g., /routes/api.js)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('// backend route');

    const app = createStaticRoutes();
    // The allowlist only permits bare filenames. Nested paths don't match
    // the route regex at all.
    const res = await app.request('/routes/api.js');
    expect(res.status).toBe(404);
  });

  it('uses devDir when prodDir does not contain index.html', async () => {
    // existsSync is called once for the prodDir check — return false to trigger devDir
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('<html>dev</html>');

    const app = createStaticRoutes();
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>dev</html>');

    // Verify existsSync was called (for the prodDir/index.html check)
    expect(fs.existsSync).toHaveBeenCalled();

    // readFileSync should have been called with a path containing dist/web
    const readCall = vi.mocked(fs.readFileSync).mock.calls[0][0] as string;
    expect(readCall).toContain('dist/web');
  });

  it('rejects path traversal attempts (URL-encoded separators) with 404', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('secret');

    const app = createStaticRoutes();
    // The allowlist check fires before the path-traversal defense and rejects
    // any filename not in { bundle.js, style.css } with a 404. That's a
    // stronger guarantee than the previous 403 — the URL-encoded traversal
    // attempt can't even reach the path-traversal check.
    const res = await app.request('/..%2F..%2F..%2Fetc%2Fpasswd.js');

    expect(res.status).toBe(404);
    // readFileSync must not be called for traversal paths
    const fileReads = vi.mocked(fs.readFileSync).mock.calls.filter(
      (c) => typeof c[0] === 'string' && /passwd/.test(c[0]),
    );
    expect(fileReads).toHaveLength(0);
  });
});
