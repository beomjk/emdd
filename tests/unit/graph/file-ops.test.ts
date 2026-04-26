import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeOps } from '../../../src/graph/file-ops.js';

describe('executeOps', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-fops-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a directory with mkdir', async () => {
    const dir = join(tmpDir, 'nested', 'deep');
    await executeOps([{ kind: 'mkdir', path: dir }]);
    expect(existsSync(dir)).toBe(true);
  });

  it('is a no-op when mkdir target already exists', async () => {
    const dir = join(tmpDir, 'a');
    await executeOps([{ kind: 'mkdir', path: dir }, { kind: 'mkdir', path: dir }]);
    expect(existsSync(dir)).toBe(true);
  });

  it('writes file contents with write', async () => {
    const file = join(tmpDir, 'out.txt');
    await executeOps([{ kind: 'write', path: file, content: 'hello' }]);
    expect(readFileSync(file, 'utf-8')).toBe('hello');
  });

  it('overwrites existing files on write', async () => {
    const file = join(tmpDir, 'out.txt');
    await executeOps([{ kind: 'write', path: file, content: 'first' }]);
    await executeOps([{ kind: 'write', path: file, content: 'second' }]);
    expect(readFileSync(file, 'utf-8')).toBe('second');
  });

  it('executes mkdir + write sequentially for a new directory', async () => {
    const dir = join(tmpDir, 'sub');
    const file = join(dir, 'f.txt');
    await executeOps([
      { kind: 'mkdir', path: dir },
      { kind: 'write', path: file, content: 'ok' },
    ]);
    expect(readFileSync(file, 'utf-8')).toBe('ok');
  });
});
