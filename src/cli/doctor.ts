import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { resolveGraphDir } from '../graph/loader.js';
import { loadGraph } from '../graph/loader.js';
import { lintGraphFromDir } from '../graph/operations.js';
import { VERSION } from '../version.js';
import { t } from '../i18n/index.js';
import { EMDD_RULES_MARKER } from '../rules/generators.js';

export interface DoctorCheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  details?: string[];
}

const MIN_NODE_VERSION = 18;

export function checkNodeVersion(): DoctorCheckResult {
  const major = parseInt(process.version.slice(1), 10);
  return {
    name: 'node-version',
    status: major >= MIN_NODE_VERSION ? 'pass' : 'fail',
    message: t('doctor.node_version', {
      version: process.version,
      required: String(MIN_NODE_VERSION),
    }),
  };
}

export function checkGraphDir(graphDir: string | undefined): DoctorCheckResult {
  if (!graphDir) {
    return {
      name: 'graph-dir',
      status: 'fail',
      message: t('doctor.graph_not_found'),
    };
  }
  const entries = fs.readdirSync(graphDir, { recursive: true })
    .filter(e => {
      const s = String(e);
      return s.endsWith('.md') && !s.split(/[\\/]/).some(p => p.startsWith('_'));
    });
  return {
    name: 'graph-dir',
    status: 'pass',
    message: t('doctor.graph_found', { count: String(entries.length) }),
  };
}

export async function checkGraphParsing(graphDir: string): Promise<DoctorCheckResult> {
  const graph = await loadGraph(graphDir, { permissive: true });
  const errors = graph.errors;
  if (errors.length === 0) {
    return {
      name: 'parse',
      status: 'pass',
      message: t('doctor.parse_ok'),
    };
  }
  return {
    name: 'parse',
    status: 'warn',
    message: t('doctor.parse_errors', { count: String(errors.length) }),
    details: errors,
  };
}

export async function checkLint(graphDir: string): Promise<DoctorCheckResult> {
  const lintErrors = await lintGraphFromDir(graphDir);
  const errorCount = lintErrors.filter(e => e.severity === 'error').length;
  const warningCount = lintErrors.filter(e => e.severity === 'warning').length;

  if (errorCount === 0 && warningCount === 0) {
    return { name: 'lint', status: 'pass', message: t('doctor.lint_clean') };
  }
  if (errorCount === 0) {
    return {
      name: 'lint',
      status: 'warn',
      message: t('doctor.lint_warnings', { warnings: String(warningCount) }),
    };
  }
  return {
    name: 'lint',
    status: 'fail',
    message: t('doctor.lint_errors', {
      errors: String(errorCount),
      warnings: String(warningCount),
    }),
    details: lintErrors.map(e => `[${e.severity.toUpperCase()}] ${e.nodeId}.${e.field}: ${e.message}`),
  };
}

export function checkConfig(graphDir: string): DoctorCheckResult {
  const configPath = path.join(path.dirname(graphDir), '.emdd.yml');
  const exists = fs.existsSync(configPath);
  if (exists) {
    return {
      name: 'config',
      status: 'info',
      message: t('doctor.config_custom'),
    };
  }
  return {
    name: 'config',
    status: 'info',
    message: t('doctor.config_default'),
  };
}

type ToolRuleEntry = {
  name: string;
  paths: string[];
  // Optional content check: path is only counted when the file matches this predicate.
  // Used for AGENTS.md because the filename is shared with a non-EMDD cross-tool convention.
  contentCheck?: (body: string) => boolean;
};

const TOOL_RULES: ToolRuleEntry[] = [
  { name: '.claude', paths: ['.claude/CLAUDE.md'] },
  // Generated AGENTS.md always opens with EMDD_RULES_MARKER at line 1;
  // startsWith (not includes) avoids false positives when user prose mentions EMDD.
  { name: 'AGENTS.md', paths: ['AGENTS.md'], contentCheck: (body) => body.startsWith(EMDD_RULES_MARKER) },
  { name: '.cursor', paths: ['.cursor/rules/emdd.mdc'] },
  { name: '.windsurf', paths: ['.windsurf/rules/emdd.md'] },
  { name: '.clinerules', paths: ['.clinerules/emdd.md'] },
  { name: '.github/copilot', paths: ['.github/copilot-instructions.md'] },
];

export function checkToolRules(projectDir: string): DoctorCheckResult {
  const found: string[] = [];
  for (const tool of TOOL_RULES) {
    for (const p of tool.paths) {
      const fullPath = path.join(projectDir, p);
      if (!fs.existsSync(fullPath)) continue;
      if (tool.contentCheck) {
        const body = fs.readFileSync(fullPath, 'utf-8');
        if (!tool.contentCheck(body)) continue;
      }
      found.push(tool.name);
      break;
    }
  }
  if (found.length === 0) {
    return { name: 'tool-rules', status: 'info', message: t('doctor.tool_none') };
  }
  return {
    name: 'tool-rules',
    status: 'info',
    message: t('doctor.tool_rules', { found: found.join(', ') }),
  };
}

export function checkVersion(): DoctorCheckResult {
  return {
    name: 'version',
    status: 'info',
    message: t('doctor.version', { version: VERSION }),
  };
}

export async function runDoctorChecks(startPath?: string): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  results.push(checkNodeVersion());

  let graphDir: string | undefined;
  try {
    graphDir = resolveGraphDir(startPath);
  } catch {
    // graph/ not found — checkGraphDir will report fail
  }

  results.push(checkGraphDir(graphDir));

  // Graph-dependent checks only if graph/ was found
  if (graphDir) {
    results.push(await checkGraphParsing(graphDir));
    results.push(await checkLint(graphDir));
    results.push(checkConfig(graphDir));

    // Tool rules: check project root (parent of graph/)
    const projectDir = path.dirname(graphDir);
    results.push(checkToolRules(projectDir));
  }

  results.push(checkVersion());

  return results;
}

export function formatDoctorResults(results: DoctorCheckResult[], version: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold.cyan(t('doctor.title', { version })));
  lines.push('');
  const icons: Record<string, string> = {
    pass: chalk.green('\u2713'),
    warn: chalk.yellow('~'),
    fail: chalk.red('\u2717'),
    info: chalk.blue('\u2139'),
  };
  for (const r of results) {
    lines.push(`  ${icons[r.status]} ${r.message}`);
    if (r.details) {
      for (const d of r.details.slice(0, 5)) {
        lines.push(`    ${chalk.gray(d)}`);
      }
      if (r.details.length > 5) {
        lines.push(`    ${chalk.gray(`... and ${r.details.length - 5} more`)}`);
      }
    }
  }
  const fails = results.filter(r => r.status === 'fail').length;
  const warns = results.filter(r => r.status === 'warn').length;
  lines.push('');
  if (fails > 0) {
    lines.push(`  ${chalk.red(t('doctor.summary_fail', { count: String(fails) }))}`);
  } else if (warns > 0) {
    lines.push(`  ${chalk.yellow(t('doctor.summary_warn', { count: String(warns) }))}`);
  } else {
    lines.push(`  ${chalk.green(t('doctor.summary_pass'))}`);
  }
  lines.push('');
  return lines.join('\n');
}
