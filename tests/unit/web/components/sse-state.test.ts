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
    vi.advanceTimersByTime(1000); // initial backoff is 1s
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

  it('reconnects after error with 1s initial delay', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];
    es.triggerError();

    expect(sseState.connected).toBe(false);
    expect(es.close).toHaveBeenCalled();

    // Should not reconnect immediately
    expect(MockEventSource.instances).toHaveLength(1);

    // Not yet at 1s
    vi.advanceTimersByTime(999);
    expect(MockEventSource.instances).toHaveLength(1);

    // At 1s — reconnect fires
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toBe('/api/events');
  });

  it('exponential backoff doubles delay on each failure (1s → 2s → 4s)', () => {
    sseState.connect();

    // First failure: 1s delay
    MockEventSource.instances[0].triggerError();
    vi.advanceTimersByTime(999);
    expect(MockEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);

    // Second failure: 2s delay
    MockEventSource.instances[1].triggerError();
    vi.advanceTimersByTime(1999);
    expect(MockEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(3);

    // Third failure: 4s delay
    MockEventSource.instances[2].triggerError();
    vi.advanceTimersByTime(3999);
    expect(MockEventSource.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it('backoff caps at 30s', () => {
    sseState.connect();

    // Drive delay to 32s (1→2→4→8→16→32), which should cap at 30s
    for (let i = 0; i < 5; i++) {
      MockEventSource.instances[MockEventSource.instances.length - 1].triggerError();
      // Advance past max possible delay to trigger reconnect
      vi.advanceTimersByTime(30_000);
    }

    // 6th failure: delay should be capped at 30s, not 32s
    const countBefore = MockEventSource.instances.length;
    MockEventSource.instances[countBefore - 1].triggerError();

    vi.advanceTimersByTime(29_999);
    expect(MockEventSource.instances).toHaveLength(countBefore);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(countBefore + 1);
  });

  it('backoff resets to 1s after successful reconnect', () => {
    sseState.connect();

    // Fail twice to increase delay to 2s
    MockEventSource.instances[0].triggerError();
    vi.advanceTimersByTime(1000);
    MockEventSource.instances[1].triggerError();
    vi.advanceTimersByTime(2000);

    // Successful reconnect
    MockEventSource.instances[2].emit('connected');

    // Next failure should use 1s delay again (reset)
    MockEventSource.instances[2].triggerError();
    vi.advanceTimersByTime(999);
    expect(MockEventSource.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it('rapid errors do not create duplicate reconnect timers', () => {
    sseState.connect();
    const es = MockEventSource.instances[0];

    // Fire multiple errors before the reconnect timer fires
    es.triggerError();
    es.triggerError();
    es.triggerError();

    // Only ONE reconnect should happen after the initial 1s delay
    vi.advanceTimersByTime(1000);
    expect(MockEventSource.instances).toHaveLength(2);

    // No additional reconnects from the duplicate errors
    vi.advanceTimersByTime(5000);
    expect(MockEventSource.instances).toHaveLength(2);
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
