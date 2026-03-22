import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CommandRegistry } from './registry.js';
import { resolveGraphDir } from '../graph/loader.js';
import { getLocale, setLocale } from '../i18n/index.js';

export class McpAdapter {
  constructor(private registry: CommandRegistry) {}

  registerTools(server: McpServer): void {
    for (const def of this.registry.getAll()) {
      if (def.mcp === false) continue;

      const toolName = (def.mcp && typeof def.mcp === 'object' && def.mcp.toolName)
        ? def.mcp.toolName
        : def.name;

      // Augment schema with optional graphDir and lang parameters
      const augmentedSchema = def.schema.extend({
        graphDir: z.string().optional().describe('Path to the EMDD graph directory'),
        lang: z.string().optional().describe('Language locale (en or ko)'),
      });

      server.tool(
        toolName,
        def.description,
        augmentedSchema.shape,
        async (input: Record<string, unknown>) => {
          const locale = getLocale(input.lang as string | undefined);
          setLocale(locale);
          try {
            const graphDir = (input.graphDir as string) || resolveGraphDir();
            const { graphDir: _g, lang: _l, ...rest } = input;
            const output = await def.execute({ ...rest, graphDir } as z.infer<typeof def.schema> & { graphDir: string });
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
            };
          } catch (err) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
            };
          } finally {
            setLocale(getLocale()); // restore to env default
          }
        },
      );
    }
  }
}
