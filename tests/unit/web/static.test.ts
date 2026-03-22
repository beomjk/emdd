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

  it('GET /app.js serves JS with application/javascript content type', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('console.log("hello");');

    const app = createStaticRoutes();
    const res = await app.request('/app.js');

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

  it('GET /nonexistent.js returns 404 when file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const app = createStaticRoutes();
    const res = await app.request('/nonexistent.js');

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
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
});
