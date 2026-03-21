import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { CommandRegistry } from '../../../src/registry/registry.js';
import type { CommandDef } from '../../../src/registry/types.js';

function makeCommand(overrides: Partial<CommandDef> & { name: string }): CommandDef {
  return {
    description: { en: 'Test command', ko: '테스트 커맨드' },
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

  describe('getByCategory()', () => {
    it('returns empty array for category with no commands', () => {
      expect(registry.getByCategory('write')).toEqual([]);
    });

    it('filters commands by category', () => {
      const read1 = makeCommand({ name: 'list-nodes', category: 'read' });
      const read2 = makeCommand({ name: 'read-node', category: 'read' });
      const write1 = makeCommand({ name: 'create-node', category: 'write' });
      const analysis1 = makeCommand({ name: 'health', category: 'analysis' });

      registry.register(read1);
      registry.register(read2);
      registry.register(write1);
      registry.register(analysis1);

      const reads = registry.getByCategory('read');
      expect(reads).toHaveLength(2);
      expect(reads).toContain(read1);
      expect(reads).toContain(read2);

      expect(registry.getByCategory('write')).toEqual([write1]);
      expect(registry.getByCategory('analysis')).toEqual([analysis1]);
    });
  });
});
