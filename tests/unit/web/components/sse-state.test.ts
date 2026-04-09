import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sseState } from '../../../../src/web/frontend/state/sse.svelte.js';

// Minimal EventSource mock
type ESListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onerror: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, ESListener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: ESListener) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }

  close = vi.fn();

  // Test helpers
  emit(type: string, data?: string) {
    const event = new MessageEvent(type, { data: data ?? '' });
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  triggerError() {
    this.onerror?.(new Event('error'));
  }
}

describe('sseState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    // Reset state between tests
    sseState.disconnect();
  });

  afterEach(() => {
    sseState.disconnect();
    vi.useRealTimers();
    delete (globalThis as any).EventSource;
  });

  it('starts disconnected', () => {
    expect(sseState.connected).toBe(false);
    expect(sseState.lastUpdate).toBeNull();
  });

  it('connect creates EventSource to /api/events', () => {
    sseState.connect();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/events');
  });

  it('sets connected=true on "connected" event', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('connected');
    expect(sseState.connected).toBe(true);
  });

  it('calls handler on "graph-updated" event', () => {
    const handler = vi.fn();
    sseState.onGraphUpdated(handler);
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('graph-updated');
    expect(handler).toHaveBeenCalledOnce();
    expect(sseState.lastUpdate).not.toBeNull();
  });

  it('does not create duplicate EventSource on repeated connect()', () => {
    sseState.connect();
    sseState.connect();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('disconnect closes EventSource and resets state', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('connected');
    expect(sseState.connected).toBe(true);

    sseState.disconnect();
    expect(es.close).toHaveBeenCalled();
    expect(sseState.connected).toBe(false);
  });

  it('reconnects after error with 3s delay', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.triggerError();

    expect(sseState.connected).toBe(false);
    expect(es.close).toHaveBeenCalled();

    // Should not reconnect immediately
    expect(MockEventSource.instances).toHaveLength(1);

    // Advance past reconnect delay
    vi.advanceTimersByTime(3000);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toBe('/api/events');
  });

  it('disconnect cancels pending reconnect timer', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.triggerError();

    // Reconnect timer is pending
    sseState.disconnect();

    // Advance time — should NOT create new EventSource
    vi.advanceTimersByTime(5000);
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
