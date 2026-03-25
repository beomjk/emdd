import fs from 'node:fs';
import path from 'node:path';
import { NODE_TYPE_DIRS } from '../graph/types.js';
import { t } from '../i18n/index.js';
import { generateRulesFile, type ToolType } from '../rules/generators.js';

export function initCommand(targetPath: string | undefined, options: { lang?: string; tool?: string; force?: boolean }): void {
  const target = path.resolve(targetPath ?? '.');
  const graphDir = path.join(target, 'graph');
  const configPath = path.join(target, '.emdd.yml');
  const lang = options.lang ?? 'en';
  const tool: ToolType = (options.tool as ToolType) ?? 'claude';

  // Check if already initialized (graph dir check)
  if (fs.existsSync(graphDir)) {
    console.log(t('init.already_exists', { path: target }));
  } else {
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

  // Generate tool-specific rules files
  const result = generateRulesFile(tool, target, { force: options.force });

  for (const created of result.created) {
    console.log(`Created ${created}`);
  }
  for (const skipped of result.skipped) {
    console.log(`Skipped (already exists): ${skipped}`);
  }
}
