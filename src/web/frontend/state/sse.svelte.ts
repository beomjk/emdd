let _connected = $state(false);
let _lastUpdate = $state<string | null>(null);
let _eventSource: EventSource | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _handler: (() => void) | null = null;

export const sseState = {
  get connected(): boolean { return _connected; },
  get lastUpdate(): string | null { return _lastUpdate; },

  connect() {
    if (_eventSource) return;

    _eventSource = new EventSource('/api/events');

    _eventSource.addEventListener('connected', () => {
      _connected = true;
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
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
  },

  onGraphUpdated(handler: () => void) {
    _handler = handler;
  },
};
