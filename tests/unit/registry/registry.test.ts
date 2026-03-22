import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { CommandRegistry } from '../../../src/registry/registry.js';
import type { CommandDef } from '../../../src/registry/types.js';

function makeCommand(overrides: Partial<CommandDef> & { name: string }): CommandDef {
  return {
    description: 'Test command',
    category: 'read',
    schema: z.object({}),
    execute: async () => ({}),
    format: () => '',
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register()', () => {
    it('registers a command successfully', () => {
      const cmd = makeCommand({ name: 'list-nodes' });
      registry.register(cmd);
      expect(registry.get('list-nodes')).toBe(cmd);
    });

    it('throws on duplicate name', () => {
      const cmd = makeCommand({ name: 'list-nodes' });
      registry.register(cmd);
      expect(() => registry.register(cmd)).toThrow(/duplicate|already registered/i);
    });
  });

  describe('get()', () => {
    it('returns undefined for unknown name', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('returns registered command by name', () => {
      const cmd = makeCommand({ name: 'health' });
      registry.register(cmd);
      expect(registry.get('health')).toBe(cmd);
    });
  });

  describe('getAll()', () => {
    it('returns empty array when no commands registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered commands', () => {
      const cmd1 = makeCommand({ name: 'list-nodes' });
      const cmd2 = makeCommand({ name: 'health', category: 'analysis' });
      registry.register(cmd1);
      registry.register(cmd2);
      expect(registry.getAll()).toHaveLength(2);
      expect(registry.getAll()).toContain(cmd1);
      expect(registry.getAll()).toContain(cmd2);
    });
  });
});
