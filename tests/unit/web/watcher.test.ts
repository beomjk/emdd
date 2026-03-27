import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileWatcher } from '../../../src/web/watcher.js';
import type { FileWatcher } from '../../../src/web/watcher.js';

describe('createFileWatcher', () => {
  let tmpDir: string;
  let watcher: FileWatcher | null = null;

  function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-watcher-'));
  }

  afterEach(() => {
    watcher?.close();
    watcher = null;
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('emits change event when .md file is modified', async () => {
    tmpDir = makeTmpDir();
    const mdFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(mdFile, '---\nid: test\n---\n');

    watcher = createFileWatcher(tmpDir);
    const onChange = vi.fn();
    watcher.on('change', onChange);

    // Wait a tick for watcher to initialize, then modify
    await new Promise((r) => setTimeout(r, 50));
    fs.writeFileSync(mdFile, '---\nid: test\nstatus: UPDATED\n---\n');

    // Wait for debounce (300ms) + buffer
    await new Promise((r) => setTimeout(r, 500));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores non-.md file changes', async () => {
    tmpDir = makeTmpDir();
    const txtFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(txtFile, 'hello');

    watcher = createFileWatcher(tmpDir);
    const onChange = vi.fn();
    watcher.on('change', onChange);

    await new Promise((r) => setTimeout(r, 50));
    fs.writeFileSync(txtFile, 'world');

    await new Promise((r) => setTimeout(r, 500));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('debounces rapid changes into single event', async () => {
    tmpDir = makeTmpDir();
    const mdFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(mdFile, 'initial');

    watcher = createFileWatcher(tmpDir);
    const onChange = vi.fn();
    watcher.on('change', onChange);

    await new Promise((r) => setTimeout(r, 50));
    // Rapid writes
    fs.writeFileSync(mdFile, 'change-1');
    fs.writeFileSync(mdFile, 'change-2');
    fs.writeFileSync(mdFile, 'change-3');

    await new Promise((r) => setTimeout(r, 500));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('close() stops the watcher', async () => {
    tmpDir = makeTmpDir();
    const mdFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(mdFile, 'initial');

    watcher = createFileWatcher(tmpDir);
    const onChange = vi.fn();
    watcher.on('change', onChange);

    watcher.close();

    await new Promise((r) => setTimeout(r, 50));
    fs.writeFileSync(mdFile, 'after-close');

    await new Promise((r) => setTimeout(r, 500));

    expect(onChange).not.toHaveBeenCalled();
    watcher = null; // already closed
  });
});
