import chalk from 'chalk';
import { serve } from '@hono/node-server';
import { resolveGraphDir } from '../graph/loader.js';
import { createDashboardServer } from '../web/server.js';
import type { Server } from 'node:http';

interface ServeOptions {
  port: number;
  open: boolean;
}

async function tryListen(
  app: Parameters<typeof serve>[0]['fetch'],
  port: number,
  maxRetries: number = 10,
): Promise<{ server: Server; port: number }> {
  for (let i = 0; i <= maxRetries; i++) {
    const currentPort = port + i;
    try {
      const server = await new Promise<Server>((resolve, reject) => {
        const s = serve({ fetch: app, port: currentPort });
        // @hono/node-server returns the http.Server directly
        const httpServer = s as unknown as Server;
        httpServer.once('error', reject);
        // Give it a tick to bind
        setTimeout(() => {
          httpServer.removeListener('error', reject);
          resolve(httpServer);
        }, 100);
      });
      if (i > 0) {
        console.log(chalk.yellow(`⚠ Port ${port} is in use, using port ${currentPort}`));
      }
      return { server, port: currentPort };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
        continue;
      }
      throw err;
    }
  }
  throw new Error(`All ports ${port}-${port + maxRetries} are in use`);
}

export async function serveCommand(pathArg: string | undefined, options: ServeOptions): Promise<void> {
  const graphDir = resolveGraphDir(pathArg);
  const { app, cache, watcher } = createDashboardServer(graphDir);

  // Pre-load graph to get stats
  const graph = await cache.load();

  const { port: actualPort } = await tryListen(app.fetch, options.port);

  const url = `http://localhost:${actualPort}`;
  const edgeCount = graph.edges.length;
  const nodeCount = graph.nodes.length;

  console.log(chalk.cyan(`🌐 EMDD Dashboard started at ${url}`));
  console.log(chalk.gray(`   Graph: ${nodeCount} nodes, ${edgeCount} edges`));
  console.log(chalk.gray(`   Press Ctrl+C to stop`));

  if (options.open) {
    const { default: openBrowser } = await import('open');
    await openBrowser(url);
  }

  // Clean up file watcher on process exit
  const cleanup = () => { watcher.close(); process.exit(0); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
