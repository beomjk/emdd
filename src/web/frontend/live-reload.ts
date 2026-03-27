let eventSource: EventSource | null = null;
let onGraphUpdated: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function setGraphUpdatedHandler(handler: () => void): void {
  onGraphUpdated = handler;
}

export function connectSSE(): void {
  if (eventSource) return;

  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('connected', () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });

  eventSource.addEventListener('graph-updated', () => {
    onGraphUpdated?.();
  });

  eventSource.onerror = () => {
    eventSource?.close();
    eventSource = null;

    // Reconnect after 3 seconds
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSSE();
      }, 3000);
    }
  };
}

export function disconnectSSE(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  eventSource?.close();
  eventSource = null;
}
