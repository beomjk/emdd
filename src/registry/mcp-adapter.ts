import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CommandRegistry } from './registry.js';
import { resolveGraphDir } from '../graph/loader.js';

export class McpAdapter {
  constructor(private registry: CommandRegistry) {}

  registerTools(server: McpServer): void {
    for (const def of this.registry.getAll()) {
      if (def.mcp === false) continue;

      const toolName = (def.mcp && typeof def.mcp === 'object' && def.mcp.toolName)
        ? def.mcp.toolName
        : def.name;

      // Augment schema with optional graphDir parameter
      const augmentedSchema = def.schema.extend({
        graphDir: z.string().optional().describe('Path to the EMDD graph directory'),
      });

      server.tool(
        toolName,
        def.description.en,
        augmentedSchema.shape,
        async (input: Record<string, unknown>) => {
          try {
            const graphDir = (input.graphDir as string) || resolveGraphDir();
            const { graphDir: _g, ...rest } = input;
            const output = await def.execute({ ...rest, graphDir } as z.infer<typeof def.schema> & { graphDir: string });
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
            };
          } catch (err) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
            };
          }
        },
      );
    }
  }
}
