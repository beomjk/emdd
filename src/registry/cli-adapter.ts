import type { Command } from 'commander';
import type { z } from 'zod';
import chalk from 'chalk';
import type { CommandRegistry } from './registry.js';
import { resolveGraphDir } from '../graph/loader.js';
import { getLocale, setLocale } from '../i18n/index.js';

/** Get the Zod v4 schema type string via public API */
function zodDefType(schema: z.ZodType): string {
  return schema.type;
}

/** Unwrap optional/default wrappers recursively to get the inner type */
function unwrapZod(schema: z.ZodType): z.ZodType {
  let current = schema;
  while (current.type === 'optional' || current.type === 'default') {
    current = (current as z.ZodOptional | z.ZodDefault).unwrap() as z.ZodType;
  }
  return current;
}

/** Get enum values from a ZodEnum via public .options */
function getEnumValues(schema: z.ZodType): string[] {
  return (schema as z.ZodEnum).options.map(String);
}

export class CliAdapter {
  constructor(private registry: CommandRegistry) {}

  attachTo(program: Command): void {
    for (const def of this.registry.getAll()) {
      if (def.cli === false) continue;

      const cmdName = (def.cli && typeof def.cli === 'object' && def.cli.commandName)
        ? def.cli.commandName
        : def.name;

      const cmd = program.command(cmdName);
      cmd.description(def.description);

      // Map Zod schema to commander options
      this.addSchemaOptions(cmd, def.schema);

      // Add --json, --lang, --graphDir per-command flags (skip if schema already defines them)
      const schemaKeys = new Set(Object.keys(def.schema.shape));
      if (!schemaKeys.has('json')) cmd.option('--json', 'Output as JSON');
      if (!schemaKeys.has('lang')) cmd.option('--lang <locale>', 'Language locale');
      if (!schemaKeys.has('graphDir')) cmd.option('--graphDir <path>', 'Path to graph directory');

      // CLI aliases
      if (def.cli && typeof def.cli === 'object' && def.cli.aliases) {
        cmd.aliases(def.cli.aliases);
      }

      // Action handler
      cmd.action(async (options: Record<string, unknown>) => {
        const json = Boolean(options.json);
        const locale = getLocale(options.lang as string | undefined);
        setLocale(locale);

        // Strip only adapter-injected keys; preserve schema-defined keys (e.g. create-node's lang)
        const input: Record<string, unknown> = { ...options };
        delete input.json;
        if (!schemaKeys.has('lang')) delete input.lang;
        delete input.graphDir;

        // Convert variadic record options (string[]) to Record<string, string>
        for (const [key, val] of Object.entries(def.schema.shape)) {
          const inner = unwrapZod(val as z.ZodType);
          if (zodDefType(inner) === 'record' && Array.isArray(input[key])) {
            const record: Record<string, string> = {};
            for (const pair of input[key] as string[]) {
              const eqIdx = pair.indexOf('=');
              if (eqIdx > 0) {
                record[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
              } else {
                console.error(chalk.yellow(`Warning: ignored malformed --${key} entry "${pair}" (expected key=value)`));
              }
            }
            input[key] = record;
          }
        }

        try {
          const graphDir = resolveGraphDir(options.graphDir as string | undefined);
          const output = await def.execute({ ...input, graphDir } as z.infer<typeof def.schema> & { graphDir: string });

          if (json) {
            console.log(JSON.stringify(output, null, 2));
          } else {
            // Generic warnings handling
            const maybeWarnings = output as Record<string, unknown> | null;
            if (maybeWarnings && Array.isArray(maybeWarnings.warnings)) {
              for (const w of maybeWarnings.warnings) {
                console.error(chalk.yellow(String(w)));
              }
            }
            console.log(def.format(output));
          }

          if (def.shouldFail?.(output)) process.exit(1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (json) {
            console.log(JSON.stringify({ error: message }, null, 2));
          } else {
            console.error(`Error: ${message}`);
          }
          process.exit(1);
        }
      });
    }
  }

  private addSchemaOptions(cmd: Command, schema: z.ZodObject<z.ZodRawShape>): void {
    const shape = schema.shape;

    for (const [key, val] of Object.entries(shape)) {
      const zodType = val as z.ZodType;
      const desc = zodType.description || key;
      const inner = unwrapZod(zodType);
      const isOpt = zodType.isOptional();
      const innerType = zodDefType(inner);

      if (innerType === 'boolean') {
        cmd.option(`--${key}`, desc);
      } else if (innerType === 'number') {
        if (isOpt) {
          cmd.option(`--${key} <value>`, desc, parseFloat);
        } else {
          cmd.requiredOption(`--${key} <value>`, desc, parseFloat);
        }
      } else if (innerType === 'enum') {
        const values = getEnumValues(inner);
        if (isOpt) {
          cmd.option(`--${key} <value>`, `${desc} (${values.join('|')})`);
        } else {
          cmd.requiredOption(`--${key} <value>`, `${desc} (${values.join('|')})`);
        }
      } else if (innerType === 'record') {
        cmd.option(`--${key} <key=value...>`, desc);
      } else {
        // Default: string
        if (isOpt) {
          cmd.option(`--${key} <value>`, desc);
        } else {
          cmd.requiredOption(`--${key} <value>`, desc);
        }
      }
    }
  }
}
