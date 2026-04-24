import fs from 'node:fs';
import path from 'node:path';
import { NODE_TYPE_DIRS } from '../graph/types.js';
import { t } from '../i18n/index.js';
import { generateRulesFile, generateSkillFiles, type ToolType } from '../rules/generators.js';

const MCP_SETUP_HINTS: Record<Exclude<ToolType, 'all'>, string> = {
  claude: 'claude mcp add emdd -- npx @beomjk/emdd mcp\n             Windows: claude mcp add emdd -- cmd /c npx @beomjk/emdd mcp',
  codex: 'codex mcp add emdd -- npx @beomjk/emdd mcp\n             Windows: codex mcp add emdd -- cmd /c npx @beomjk/emdd mcp',
  cursor: 'Add to .cursor/mcp.json: {"mcpServers":{"emdd":{"command":"npx","args":["@beomjk/emdd","mcp"]}}}\n             Windows: {"mcpServers":{"emdd":{"command":"cmd","args":["/c","npx","@beomjk/emdd","mcp"]}}}',
  windsurf: 'Add to Windsurf MCP settings: command "npx", args ["@beomjk/emdd", "mcp"]\n             Windows: command "cmd", args ["/c", "npx", "@beomjk/emdd", "mcp"]',
  cline: 'Add to .continue/config.yaml: mcpServers > name: emdd, command: npx, args: [@beomjk/emdd, mcp]\n             Windows: command: cmd, args: [/c, npx, @beomjk/emdd, mcp]',
  copilot: 'Add to .vscode/mcp.json: {"servers":{"emdd":{"command":"npx","args":["@beomjk/emdd","mcp"]}}}\n             Windows: {"servers":{"emdd":{"command":"cmd","args":["/c","npx","@beomjk/emdd","mcp"]}}}',
};

function printNextSteps(tool: ToolType): void {
  const displayTool = tool === 'all' ? 'claude' : (tool as Exclude<ToolType, 'all'>);

  console.log('');
  console.log(`  ${t('init.next_steps_header')}`);
  console.log('');
  console.log(`    ${t('init.ai_recommended')}`);
  console.log(`      ${MCP_SETUP_HINTS[displayTool]}`);
  console.log('');
  console.log(`    ${t('init.ai_then')}`);
  console.log('');
  console.log(`    ${t('init.cli_alternative')}`);
  console.log(`      ${t('init.cli_command')}`);
  if (tool === 'all') {
    console.log('');
    console.log(`    ${t('init.mcp_docs')}`);
  }
}

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
    printNextSteps(tool);
  }

  // Generate tool-specific rules files
  const result = generateRulesFile(tool, target, { force: options.force });

  for (const created of result.created) {
    console.log(`Created ${created}`);
  }
  for (const skipped of result.skipped) {
    console.log(`Skipped (already exists): ${skipped}`);
  }

  // Generate repository-local skills for tools that support them.
  const skillTools = tool === 'all' ? ['claude', 'codex'] as const : tool === 'claude' || tool === 'codex' ? [tool] as const : [];
  for (const skillTool of skillTools) {
    const skillResult = generateSkillFiles(target, { force: options.force, tool: skillTool });
    for (const created of skillResult.created) {
      console.log(`Created ${created}`);
    }
    for (const skipped of skillResult.skipped) {
      console.log(`Skipped (already exists): ${skipped}`);
    }
  }
}
