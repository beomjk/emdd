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
    description: { en: 'Test command', ko: '테스트 커맨드' },
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
});
