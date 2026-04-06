import fs from 'node:fs';
import type { FileOp } from './types.js';

/**
 * Execute a list of file operations (mkdir / write).
 */
export async function executeOps(ops: FileOp[]): Promise<void> {
  for (const op of ops) {
    switch (op.kind) {
      case 'mkdir':
        if (!fs.existsSync(op.path)) {
          fs.mkdirSync(op.path, { recursive: true });
        }
        break;
      case 'write':
        fs.writeFileSync(op.path, op.content, 'utf-8');
        break;
    }
  }
}
