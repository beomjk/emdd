let _connected = $state(false);
let _lastUpdate = $state<string | null>(null);
let _eventSource: EventSource | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _handler: (() => void) | null = null;
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
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      // On reconnect, trigger a graph refresh so the client picks up any
      // mutations that happened during the disconnected window. EventSource
      // has no replay buffer, so graph-updated events broadcast during the
      // gap are already lost — the only way to recover is to refetch.
      if (wasReconnect) _handler?.();
    });

    _eventSource.addEventListener('graph-updated', () => {
      _lastUpdate = new Date().toISOString();
      _handler?.();
    });

    _eventSource.onerror = () => {
      _eventSource?.close();
      _eventSource = null;
      _connected = false;

      if (!_reconnectTimer) {
        _reconnectTimer = setTimeout(() => {
          _reconnectTimer = null;
          sseState.connect();
        }, 3000);
      }
    };
  },

  disconnect() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    _eventSource?.close();
    _eventSource = null;
    _connected = false;
    _hasBeenConnected = false;
  },

  onGraphUpdated(handler: () => void) {
    _handler = handler;
  },
};
