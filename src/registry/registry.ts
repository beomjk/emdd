import type { z } from 'zod';
import type { CommandDef } from './types.js';

export class CommandRegistry {
  private commands = new Map<string, CommandDef>();

  register<TInput extends z.ZodObject<z.ZodRawShape>, TOutput>(def: CommandDef<TInput, TOutput>): void {
    if (this.commands.has(def.name)) {
      throw new Error(`Command already registered: ${def.name}`);
    }
    // Store as base type — adapters consume via getAll() which returns CommandDef[]
    this.commands.set(def.name, def as CommandDef);
  }

  get(name: string): CommandDef | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandDef[] {
    return [...this.commands.values()];
  }

  getByCategory(category: 'read' | 'write' | 'analysis'): CommandDef[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }
}
