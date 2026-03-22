import type { z } from 'zod';

export interface McpOptions {
  /** Override MCP tool name (default: CommandDef.name) */
  toolName?: string;
}

export interface CliOptions {
  /** Override CLI command name (default: CommandDef.name) */
  commandName?: string;
  /** CLI command aliases */
  aliases?: string[];
}

export interface CommandDef<
  TInput extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TOutput = unknown,
> {
  /** Unique command name in kebab-case */
  name: string;

  /** Bilingual description */
  description: { en: string; ko: string };

  /** Command classification */
  category: 'read' | 'write' | 'analysis';

  /** Zod input schema — drives CLI option generation and MCP input schema */
  schema: TInput;

  /** Core execution function. graphDir is injected by the adapter. */
  execute: (input: z.infer<TInput> & { graphDir: string }) => Promise<TOutput>;

  /** CLI format function — produces chalk-formatted string for terminal output. */
  format: (output: TOutput, locale: string) => string;

  /** Predicate that returns true when the result indicates logical failure (e.g. lint errors found).
   *  CLI adapter calls process.exit(1) after printing output. MCP adapter ignores this. */
  shouldFail?: (output: TOutput) => boolean;

  /** MCP-specific options. Set to false to exclude from MCP. */
  mcp?: McpOptions | false;

  /** CLI-specific options. Set to false to exclude from CLI. */
  cli?: CliOptions | false;
}
