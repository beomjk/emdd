import type { SSEStreamingApi } from 'hono/streaming';

export interface SSEManager {
  addClient(stream: SSEStreamingApi): void;
  removeClient(stream: SSEStreamingApi): void;
  broadcast(event: string, data: string): Promise<void>;
  clientCount(): number;
}

export function createSSEManager(): SSEManager {
  const clients = new Set<SSEStreamingApi>();

  return {
    addClient(stream: SSEStreamingApi): void {
      clients.add(stream);
    },

    removeClient(stream: SSEStreamingApi): void {
      clients.delete(stream);
    },

    async broadcast(event: string, data: string): Promise<void> {
      const dead: SSEStreamingApi[] = [];
      for (const client of clients) {
        try {
          await client.writeSSE({ event, data });
        } catch {
          dead.push(client);
        }
      }
      for (const d of dead) {
        clients.delete(d);
      }
    },

    clientCount(): number {
      return clients.size;
    },
  };
}
