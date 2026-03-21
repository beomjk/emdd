import type { CommandDef } from './types.js';

export class CommandRegistry {
  private commands = new Map<string, CommandDef>();

  register(def: CommandDef): void {
    if (this.commands.has(def.name)) {
      throw new Error(`Command already registered: ${def.name}`);
    }
    this.commands.set(def.name, def);
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
