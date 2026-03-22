import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { z } from 'zod';
import { CommandRegistry } from '../../../src/registry/registry.js';
import { CliAdapter } from '../../../src/registry/cli-adapter.js';
import type { CommandDef } from '../../../src/registry/types.js';

// Mock resolveGraphDir for action tests
vi.mock('../../../src/graph/loader.js', () => ({
  resolveGraphDir: () => '/mock/graph',
  loadGraph: vi.fn(),
}));

function makeCommand(overrides: Partial<CommandDef> & { name: string }): CommandDef {
  return {
    description: 'Test command',
    category: 'read',
    schema: z.object({}),
    execute: async () => ({ result: 'ok' }),
    format: () => 'formatted output',
    ...overrides,
  };
}

describe('CliAdapter', () => {
  let registry: CommandRegistry;
  let adapter: CliAdapter;
  let program: Command;

  beforeEach(() => {
    registry = new CommandRegistry();
    adapter = new CliAdapter(registry);
    program = new Command();
    program.name('emdd').exitOverride(); // prevent process.exit in tests
  });

  describe('Zod→commander option mapping', () => {
    it('maps z.string() to required --name <value>', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          filter: z.string().describe('A filter value'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find(o => o.long === '--filter');
      expect(opt).toBeDefined();
      expect(opt!.mandatory).toBe(true);
    });

    it('maps z.string().optional() to optional --name <value>', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          filter: z.string().optional().describe('Optional filter'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--filter');
      expect(opt).toBeDefined();
      expect(opt!.mandatory).toBeFalsy();
    });

    it('maps z.number() to --name <value> with parseFloat', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          count: z.number().describe('A count'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--count');
      expect(opt).toBeDefined();
    });

    it('maps z.boolean() to flag --name', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          verbose: z.boolean().optional().describe('Verbose mode'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--verbose');
      expect(opt).toBeDefined();
    });

    it('maps z.enum() to --name <value> with choices', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          mode: z.enum(['strict', 'warn', 'off']).describe('Mode'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--mode');
      expect(opt).toBeDefined();
    });

    it('unwraps z.number().optional().default() to number (recursive unwrap)', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          depth: z.number().optional().default(1).describe('BFS depth'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--depth');
      expect(opt).toBeDefined();
      // parseFloat should be set as the argument parser
      expect(opt!.parseArg).toBe(parseFloat);
    });

    it('maps z.record() to variadic --key <key=value...>', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          set: z.record(z.string(), z.string()).describe('Key-value pairs'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const opt = cmd!.options.find(o => o.long === '--set');
      expect(opt).toBeDefined();
    });

    it('uses cli.commandName override', () => {
      registry.register(makeCommand({
        name: 'list-nodes',
        cli: { commandName: 'list' },
      }));
      adapter.attachTo(program);

      expect(program.commands.find(c => c.name() === 'list')).toBeDefined();
      expect(program.commands.find(c => c.name() === 'list-nodes')).toBeUndefined();
    });

    it('skips commands with cli: false', () => {
      registry.register(makeCommand({
        name: 'mcp-only',
        cli: false,
      }));
      adapter.attachTo(program);

      expect(program.commands).toHaveLength(0);
    });
  });

  describe('--json flag', () => {
    it('adds --json option to each command', () => {
      registry.register(makeCommand({ name: 'test-cmd' }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const jsonOpt = cmd!.options.find(o => o.long === '--json');
      expect(jsonOpt).toBeDefined();
    });
  });

  describe('--lang flag', () => {
    it('adds --lang option to each command', () => {
      registry.register(makeCommand({ name: 'test-cmd' }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      const langOpt = cmd!.options.find(o => o.long === '--lang');
      expect(langOpt).toBeDefined();
    });
  });

  describe('format vs JSON output', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('calls format() when --json is not set', async () => {
      const formatFn = vi.fn().mockReturnValue('chalk output');
      const executeFn = vi.fn().mockResolvedValue({ data: 'test' });

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
        format: formatFn,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(executeFn).toHaveBeenCalled();
      expect(formatFn).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('chalk output');
    });

    it('outputs JSON when --json is set', async () => {
      const formatFn = vi.fn().mockReturnValue('chalk output');
      const executeFn = vi.fn().mockResolvedValue({ data: 'test' });

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
        format: formatFn,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--json']);

      expect(executeFn).toHaveBeenCalled();
      expect(formatFn).not.toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      expect(JSON.parse(output)).toEqual({ data: 'test' });
    });
  });

  describe('error handling', () => {
    it('outputs error as JSON when --json is set', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('boom'));
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--json']);

      const jsonOutput = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.error).toBe('boom');
      expect(exitSpy).toHaveBeenCalledWith(1);

      logSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('outputs error to stderr when --json is not set', async () => {
      const executeFn = vi.fn().mockRejectedValue(new Error('boom'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(errorSpy).toHaveBeenCalledWith('Error: boom');
      expect(exitSpy).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('warnings handling', () => {
    it('writes warnings to stderr before main output', async () => {
      const executeFn = vi.fn().mockResolvedValue({ data: 'ok', warnings: ['warn1', 'warn2'] });
      const formatFn = vi.fn().mockReturnValue('formatted');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
        format: formatFn,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy.mock.calls[0][0]).toContain('warn1');
      expect(errorSpy.mock.calls[1][0]).toContain('warn2');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('record (key=value) conversion', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('converts key=value string array to Record<string, string>', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          set: z.record(z.string(), z.string()).optional().describe('Key-value pairs'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--set', 'foo=bar', '--set', 'baz=qux']);

      expect(executeFn).toHaveBeenCalled();
      const args = executeFn.mock.calls[0][0];
      expect(args.set).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('warns and skips malformed entry without =', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          set: z.record(z.string(), z.string()).optional().describe('Key-value pairs'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--set', 'valid=yes', '--set', 'malformed']);

      expect(executeFn).toHaveBeenCalled();
      const args = executeFn.mock.calls[0][0];
      expect(args.set).toEqual({ valid: 'yes' });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('malformed')
      );
    });

    it('handles value containing = sign correctly', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          set: z.record(z.string(), z.string()).optional().describe('Key-value pairs'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--set', 'key=val=ue']);

      expect(executeFn).toHaveBeenCalled();
      const args = executeFn.mock.calls[0][0];
      expect(args.set).toEqual({ key: 'val=ue' });
    });
  });

  describe('Zod input validation', () => {
    it('rejects input that violates z.string().min() constraint', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          title: z.string().min(3).describe('Title'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--title', 'ab']);

      expect(executeFn).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed'),
      );

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('rejects input that violates z.number().min().max() constraint', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          threshold: z.number().min(0).max(1).describe('Threshold'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--threshold', '5']);

      expect(executeFn).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed'),
      );

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('outputs JSON error when --json is set and validation fails', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          title: z.string().min(3).describe('Title'),
        }),
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--title', 'ab', '--json']);

      expect(executeFn).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      const jsonOutput = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.error).toContain('Input validation failed');

      logSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('shouldFail handling', () => {
    it('calls process.exit(1) when shouldFail returns true', async () => {
      const executeFn = vi.fn().mockResolvedValue({ data: 'ok' });
      const formatFn = vi.fn().mockReturnValue('formatted');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
        format: formatFn,
        shouldFail: () => true,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(formatFn).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      logSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('does not exit when shouldFail returns false', async () => {
      const executeFn = vi.fn().mockResolvedValue({ data: 'ok' });
      const formatFn = vi.fn().mockReturnValue('formatted');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      registry.register(makeCommand({
        name: 'test-cmd',
        execute: executeFn,
        format: formatFn,
        shouldFail: () => false,
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(formatFn).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('positional arguments', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('T001: command with cli.positional registers Commander .argument()', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      expect(cmd).toBeDefined();
      expect(cmd!.registeredArguments).toHaveLength(1);
      expect(cmd!.registeredArguments[0].name()).toBe('arg1');
    });

    it('T002: positional arg value is received and passed to execute()', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', 'myval']);

      expect(executeFn).toHaveBeenCalled();
      const input = executeFn.mock.calls[0][0];
      expect(input.arg1).toBe('myval');
    });

    it('T003: named --arg1 still works for positional field (backward compat)', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', '--arg1', 'myval']);

      expect(executeFn).toHaveBeenCalled();
      const input = executeFn.mock.calls[0][0];
      expect(input.arg1).toBe('myval');
    });

    it('T004: positional takes precedence over named when both provided', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', 'pos-val', '--arg1', 'named-val']);

      expect(executeFn).toHaveBeenCalled();
      const input = executeFn.mock.calls[0][0];
      expect(input.arg1).toBe('pos-val');
    });

    it('T005: missing required positional triggers Zod validation error', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd']);

      expect(executeFn).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Input validation failed'),
      );
    });

    it('T006: command WITHOUT cli.positional has no registeredArguments', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          filter: z.string().describe('A filter'),
        }),
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      expect(cmd).toBeDefined();
      expect(cmd!.registeredArguments).toHaveLength(0);
    });

    it('T007: multi-positional command receives args in order', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          a: z.string().describe('A'),
          b: z.string().describe('B'),
          c: z.string().describe('C'),
        }),
        cli: { positional: ['a', 'b', 'c'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', 'v1', 'v2', 'v3']);

      expect(executeFn).toHaveBeenCalled();
      const input = executeFn.mock.calls[0][0];
      expect(input.a).toBe('v1');
      expect(input.b).toBe('v2');
      expect(input.c).toBe('v3');
    });

    it('T008: positional + named optional flags mix', async () => {
      const executeFn = vi.fn().mockResolvedValue({ ok: true });
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          id: z.string().describe('Node ID'),
          depth: z.number().optional().default(1).describe('Depth'),
        }),
        cli: { positional: ['id'] },
        execute: executeFn,
        format: () => 'ok',
      }));
      adapter.attachTo(program);

      await program.parseAsync(['node', 'emdd', 'test-cmd', 'node-001', '--depth', '3']);

      expect(executeFn).toHaveBeenCalled();
      const input = executeFn.mock.calls[0][0];
      expect(input.id).toBe('node-001');
      expect(input.depth).toBe(3);
    });

    it('T009: --help output includes positional arg names in usage line', () => {
      registry.register(makeCommand({
        name: 'test-cmd',
        schema: z.object({
          arg1: z.string().describe('First arg'),
        }),
        cli: { positional: ['arg1'] },
      }));
      adapter.attachTo(program);

      const cmd = program.commands.find(c => c.name() === 'test-cmd');
      expect(cmd).toBeDefined();
      const helpText = cmd!.helpInformation();
      expect(helpText).toContain('[arg1]');
    });
  });
});
