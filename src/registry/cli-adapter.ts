import type { Command } from 'commander';
import type { z } from 'zod';
import chalk from 'chalk';
import type { CommandRegistry } from './registry.js';
import { resolveGraphDir } from '../graph/loader.js';
import { getLocale, setLocale, t } from '../i18n/index.js';

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

/** Extract warnings array from command output, if present. */
function extractWarnings(output: unknown): string[] {
  if (output && typeof output === 'object' && 'warnings' in output && Array.isArray((output as Record<string, unknown>).warnings)) {
    return ((output as Record<string, unknown>).warnings as unknown[]).map(String);
  }
  return [];
}

export class CliAdapter {
  constructor(private registry: CommandRegistry) {}

  attachTo(program: Command): void {
    for (const def of this.registry.getAll()) {
      if (def.cli === false) continue;

      const cliOpts = (def.cli && typeof def.cli === 'object') ? def.cli : undefined;
      const cmdName = cliOpts?.commandName ?? def.name;

      const cmd = program.command(cmdName);
      cmd.description(def.description);

      // Register positional arguments before schema options
      const positionalKeys = cliOpts?.positional ?? [];
      for (const key of positionalKeys) {
        if (!(key in def.schema.shape)) {
          throw new Error(`Positional key "${key}" not found in schema for command "${def.name}"`);
        }
        const zodField = def.schema.shape[key] as z.ZodType;
        const inner = unwrapZod(zodField);
        let desc = zodField.description || key;
        if (zodDefType(inner) === 'enum') {
          desc = `${desc} (${getEnumValues(inner).join('|')})`;
        }
        cmd.argument(`[${key}]`, desc);
      }

      // Map Zod schema to commander options
      this.addSchemaOptions(cmd, def.schema, positionalKeys);

      // Add --json, --lang, --graphDir per-command flags (skip if schema already defines them)
      const schemaKeys = new Set(Object.keys(def.schema.shape));
      if (!schemaKeys.has('json')) cmd.option('--json', 'Output as JSON');
      if (!schemaKeys.has('lang')) cmd.option('--lang <locale>', 'Language locale');
      if (!schemaKeys.has('graphDir')) cmd.option('--graphDir <path>', 'Path to graph directory');

      // CLI aliases
      if (cliOpts?.aliases) {
        cmd.aliases(cliOpts.aliases);
      }

      // Action handler
      cmd.action(async (...args: unknown[]) => {
        const options = args[positionalKeys.length] as Record<string, unknown>;

        // Merge positional values into options (positional takes precedence)
        for (let i = 0; i < positionalKeys.length; i++) {
          options[positionalKeys[i]] = args[i] ?? options[positionalKeys[i]];
        }

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
                console.error(chalk.yellow(t('error.cli_malformed_record', { key, pair })));
              }
            }
            input[key] = record;
          }
        }

        const parseResult = def.schema.safeParse(input);
        if (!parseResult.success) {
          const messages = parseResult.error.issues.map(
            (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
          );
          const errorMsg = `${t('error.cli_validation_failed')}\n${messages.join('\n')}`;
          if (json) {
            console.log(JSON.stringify({ error: errorMsg }, null, 2));
          } else {
            console.error(errorMsg);
          }
          process.exit(1);
          return;
        }

        try {
          const graphDir = resolveGraphDir(options.graphDir as string | undefined);
          const output = await def.execute({ ...parseResult.data, graphDir } as z.infer<typeof def.schema> & { graphDir: string });

          if (json) {
            console.log(JSON.stringify(output, null, 2));
          } else {
            for (const w of extractWarnings(output)) {
              console.error(chalk.yellow(w));
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

  private addSchemaOptions(cmd: Command, schema: z.ZodObject<z.ZodRawShape>, positionalKeys: string[] = []): void {
    const shape = schema.shape;
    const positionalSet = new Set(positionalKeys);

    for (const [key, val] of Object.entries(shape)) {
      const zodType = val as z.ZodType;
      const desc = zodType.description || key;
      const inner = unwrapZod(zodType);
      const isOpt = zodType.isOptional() || positionalSet.has(key);
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
