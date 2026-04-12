let _connected = $state(false);
let _lastUpdate = $state<string | null>(null);
let _eventSource: EventSource | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _handlers = new Set<() => void>();
// Exponential backoff: start at 1s, double each failure, cap at 30s.
let _reconnectDelay = 1000;
const _MAX_RECONNECT_DELAY = 30_000;
// Track whether this session has ever connected. The first 'connected' event
// is the initial handshake (the caller's $effect already kicks off loadGraph),
// but any subsequent 'connected' event means we reconnected after a drop —
// and any graph-updated events broadcast during the outage were lost, so we
// must force a refetch.
let _hasBeenConnected = false;

export const sseState = {
  get connected(): boolean { return _connected; },
  get lastUpdate(): string | null { return _lastUpdate; },

  connect() {
    if (_eventSource) return;

    _eventSource = new EventSource('/api/events');

    _eventSource.addEventListener('connected', () => {
      const wasReconnect = _hasBeenConnected;
      _connected = true;
      _hasBeenConnected = true;
      _reconnectDelay = 1000; // reset backoff on successful connect
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      // On reconnect, trigger a graph refresh so the client picks up any
      // mutations that happened during the disconnected window. EventSource
      // has no replay buffer, so graph-updated events broadcast during the
      // gap are already lost — the only way to recover is to refetch.
      if (wasReconnect) _handlers.forEach((h) => h());
    });

    _eventSource.addEventListener('graph-updated', () => {
      _lastUpdate = new Date().toISOString();
      // Debounce rapid-fire SSE events (e.g., bulk file operations that
      // trigger dozens of fs-watcher events within milliseconds) so the
      // client only refetches once per burst.
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        _debounceTimer = null;
        _handlers.forEach((h) => h());
      }, 200);
    });

    _eventSource.onerror = () => {
      _eventSource?.close();
      _eventSource = null;
      _connected = false;

      if (!_reconnectTimer) {
        _reconnectTimer = setTimeout(() => {
          _reconnectTimer = null;
          sseState.connect();
        }, _reconnectDelay);
        _reconnectDelay = Math.min(_reconnectDelay * 2, _MAX_RECONNECT_DELAY);
      }
    };
  },

  disconnect() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    _eventSource?.close();
    _eventSource = null;
    _connected = false;
    _hasBeenConnected = false;
    _reconnectDelay = 1000;
    _handlers.clear();
  },

  onGraphUpdated(handler: () => void): () => void {
    _handlers.add(handler);
    return () => { _handlers.delete(handler); };
  },
};
