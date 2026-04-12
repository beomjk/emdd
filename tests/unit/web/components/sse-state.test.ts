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

  it('calls handler on "graph-updated" event after debounce', () => {
    const handler = vi.fn();
    sseState.onGraphUpdated(handler);
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('graph-updated');
    // Handler is debounced — not called synchronously
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(sseState.lastUpdate).not.toBeNull();
  });

  it('debounces rapid graph-updated events into a single handler call', () => {
    const handler = vi.fn();
    sseState.onGraphUpdated(handler);
    sseState.connect();
    const es = MockEventSource.instances[0];
    // Fire 5 rapid events within the debounce window
    for (let i = 0; i < 5; i++) es.emit('graph-updated');
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls handler on reconnect (not on initial connect)', () => {
    const handler = vi.fn();
    sseState.onGraphUpdated(handler);
    sseState.connect();
    const es1 = MockEventSource.instances[0];
    es1.emit('connected'); // initial → handler NOT called
    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();

    es1.triggerError(); // drop
    vi.advanceTimersByTime(3000);
    const es2 = MockEventSource.instances[1];
    es2.emit('connected'); // reconnect → handler called
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports multiple subscribers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    sseState.onGraphUpdated(h1);
    sseState.onGraphUpdated(h2);
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('graph-updated');
    vi.advanceTimersByTime(200);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('onGraphUpdated returns unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = sseState.onGraphUpdated(handler);
    sseState.connect();
    const es = MockEventSource.instances[0];
    unsub();
    es.emit('graph-updated');
    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();
  });

  it('disconnect clears all handlers', () => {
    const handler = vi.fn();
    sseState.onGraphUpdated(handler);
    sseState.disconnect();
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.emit('graph-updated');
    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();
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
