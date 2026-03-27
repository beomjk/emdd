import { describe, it, expect, vi } from 'vitest';
import { createSSEManager } from '../../../src/web/sse.js';

function mockStream() {
  return {
    writeSSE: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('createSSEManager', () => {
  it('starts with zero clients', () => {
    const mgr = createSSEManager();
    expect(mgr.clientCount()).toBe(0);
  });

  it('adds and removes clients', () => {
    const mgr = createSSEManager();
    const s1 = mockStream();
    const s2 = mockStream();

    mgr.addClient(s1);
    mgr.addClient(s2);
    expect(mgr.clientCount()).toBe(2);

    mgr.removeClient(s1);
    expect(mgr.clientCount()).toBe(1);
  });

  it('broadcasts to all connected clients', async () => {
    const mgr = createSSEManager();
    const s1 = mockStream();
    const s2 = mockStream();

    mgr.addClient(s1);
    mgr.addClient(s2);

    await mgr.broadcast('test-event', '{"foo":"bar"}');

    expect(s1.writeSSE).toHaveBeenCalledWith({ event: 'test-event', data: '{"foo":"bar"}' });
    expect(s2.writeSSE).toHaveBeenCalledWith({ event: 'test-event', data: '{"foo":"bar"}' });
  });

  it('removes dead clients on broadcast error', async () => {
    const mgr = createSSEManager();
    const alive = mockStream();
    const dead = mockStream();
    dead.writeSSE.mockRejectedValue(new Error('connection closed'));

    mgr.addClient(alive);
    mgr.addClient(dead);

    await mgr.broadcast('test', 'data');

    expect(mgr.clientCount()).toBe(1);
    expect(alive.writeSSE).toHaveBeenCalled();
  });

  it('does not throw when broadcasting with no clients', async () => {
    const mgr = createSSEManager();
    await expect(mgr.broadcast('test', 'data')).resolves.toBeUndefined();
  });
});
