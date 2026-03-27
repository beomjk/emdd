import { watch, type FSWatcher } from 'node:fs';
import { EventEmitter } from 'node:events';

export interface FileWatcher extends EventEmitter {
  close(): void;
}

/**
 * Watch a graph directory for .md file changes with debouncing.
 * Emits 'change' event (debounced 300ms) when markdown files are modified.
 */
export function createFileWatcher(graphDir: string): FileWatcher {
  const emitter = new EventEmitter() as FileWatcher;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;

  try {
    watcher = watch(graphDir, { recursive: true }, (_event, filename) => {
      if (!filename || !filename.endsWith('.md')) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        emitter.emit('change');
      }, 300);
    });

    watcher.on('error', () => {
      // Silently ignore watcher errors (e.g., directory deleted)
    });
  } catch {
    // fs.watch may fail on some platforms — watcher stays null
  }

  emitter.close = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher?.close();
    watcher = null;
  };

  return emitter;
}
