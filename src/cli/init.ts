import fs from 'node:fs';
import path from 'node:path';
import { NODE_TYPE_DIRS } from '../graph/types.js';
import { t } from '../i18n/index.js';
import {
  generateRulesFile,
  generateSkillFiles,
  getToolEnumerationString,
  isValidTool,
  SKILL_TOOLS,
  toolSupportsSkills,
  type SkillToolType,
  type ToolType,
} from '../rules/generators.js';

const MCP_SETUP_HINTS: Record<Exclude<ToolType, 'all'>, string> = {
  claude: 'claude mcp add emdd -- npx @beomjk/emdd mcp\n             Windows: claude mcp add emdd -- cmd /c npx @beomjk/emdd mcp',
  codex: 'codex mcp add emdd -- npx @beomjk/emdd mcp\n             Windows: codex mcp add emdd -- cmd /c npx @beomjk/emdd mcp',
  cursor: 'Add to .cursor/mcp.json: {"mcpServers":{"emdd":{"command":"npx","args":["@beomjk/emdd","mcp"]}}}\n             Windows: {"mcpServers":{"emdd":{"command":"cmd","args":["/c","npx","@beomjk/emdd","mcp"]}}}',
  windsurf: 'Add to Windsurf MCP settings: command "npx", args ["@beomjk/emdd", "mcp"]\n             Windows: command "cmd", args ["/c", "npx", "@beomjk/emdd", "mcp"]',
  cline: 'Add to .continue/config.yaml: mcpServers > name: emdd, command: npx, args: [@beomjk/emdd, mcp]\n             Windows: command: cmd, args: [/c, npx, @beomjk/emdd, mcp]',
  copilot: 'Add to .vscode/mcp.json: {"servers":{"emdd":{"command":"npx","args":["@beomjk/emdd","mcp"]}}}\n             Windows: {"servers":{"emdd":{"command":"cmd","args":["/c","npx","@beomjk/emdd","mcp"]}}}',
};

// Compile-time guard: every SkillToolType must appear as a key of MCP_SETUP_HINTS
// because printNextSteps iterates SKILL_TOOLS and indexes into MCP_SETUP_HINTS.
// Without this, a new SkillToolType would only blow up at runtime as
// `MCP_SETUP_HINTS[ht] === undefined` printed under the next-steps banner.
type _SkillToolsHaveHints = Exclude<SkillToolType, keyof typeof MCP_SETUP_HINTS>;
const _skillToolsHaveHints: _SkillToolsHaveHints extends never ? true : never = true;
void _skillToolsHaveHints;

function printNextSteps(tool: ToolType): void {
  // For --tool all, print MCP hints for every skill-capable assistant — they are
  // the first-class one-liner setups, while non-skill tools (cursor/windsurf/...)
  // need multi-line config and are covered by the MCP_SETUP.md link below.
  // Deriving from SKILL_TOOLS (rather than a literal list) means a future
  // skill-capable tool flows through automatically — no second source to update.
  const hintTools: Array<Exclude<ToolType, 'all'>> =
    tool === 'all' ? [...SKILL_TOOLS] : [tool as Exclude<ToolType, 'all'>];

  console.log('');
  console.log(`  ${t('init.next_steps_header')}`);
  console.log('');
  console.log(`    ${t('init.ai_recommended')}`);
  for (const ht of hintTools) {
    console.log(`      ${MCP_SETUP_HINTS[ht]}`);
  }
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
  // Validate --tool BEFORE any filesystem mutation so an invalid value fails
  // fast with a clear message instead of crashing mid-init (after creating
  // graph/) with a TypeError when MCP_SETUP_HINTS[tool] resolves to undefined.
  const rawTool = options.tool ?? 'claude';
  if (!isValidTool(rawTool)) {
    throw new Error(
      `Invalid --tool value: "${rawTool}". Valid values: ${getToolEnumerationString(', ')}`,
    );
  }
  const tool: ToolType = rawTool;

  // Check if already initialized (graph dir check)
  const isNewProject = !fs.existsSync(graphDir);
  if (!isNewProject) {
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
  const skillTools: readonly SkillToolType[] =
    tool === 'all' ? SKILL_TOOLS : toolSupportsSkills(tool) ? [tool] : [];
  let skillsCreated = 0;
  for (const skillTool of skillTools) {
    const skillResult = generateSkillFiles(target, { force: options.force, tool: skillTool });
    for (const created of skillResult.created) {
      console.log(`Created ${created}`);
    }
    for (const skipped of skillResult.skipped) {
      console.log(`Skipped (already exists): ${skipped}`);
    }
    skillsCreated += skillResult.created.length;
  }

  // Print MCP-add next steps when (a) a fresh project was just initialized, OR
  // (b) at least one new rules/skills file was written this run. The second
  // case covers `emdd init . --tool codex` re-run on an existing claude project:
  // without it, the codex MCP-add hint was never shown, leaving Codex installed
  // but unconfigured. Stays quiet on a pure no-op re-run where everything was
  // already in place (avoids spamming the banner on every invocation).
  if (isNewProject || result.created.length > 0 || skillsCreated > 0) {
    printNextSteps(tool);
  }
}
