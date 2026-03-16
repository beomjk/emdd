import fs from 'node:fs';
import path from 'node:path';
import { NODE_TYPE_DIRS } from '../graph/types.js';
import { t } from '../i18n/index.js';

export function initCommand(targetPath: string | undefined, options: { lang?: string }): void {
  const target = path.resolve(targetPath ?? '.');
  const graphDir = path.join(target, 'graph');
  const configPath = path.join(target, '.emdd.yml');
  const lang = options.lang ?? 'en';

  // Check if already initialized
  if (fs.existsSync(graphDir)) {
    console.log(t('init.already_exists', { path: target }));
    return;
  }

  // Create graph/ and all subdirectories
  fs.mkdirSync(graphDir, { recursive: true });
  for (const dir of Object.values(NODE_TYPE_DIRS)) {
    fs.mkdirSync(path.join(graphDir, dir), { recursive: true });
  }

  // Create .emdd.yml config
  const config = [
    `lang: ${lang}`,
    `version: "1.0"`,
    '',
  ].join('\n');
  fs.writeFileSync(configPath, config, 'utf-8');

  console.log(t('init.success', { path: target }));
  console.log(t('init.next_steps'));
}
