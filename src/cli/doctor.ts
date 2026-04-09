import fs from 'node:fs';
import path from 'node:path';
import { resolveGraphDir } from '../graph/loader.js';
import { loadGraph } from '../graph/loader.js';
import { lintGraphFromDir } from '../graph/operations.js';
import { loadConfig, DEFAULT_CONFIG } from '../graph/config.js';
import { VERSION } from '../version.js';
import { t } from '../i18n/index.js';

export interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  details?: string[];
}

const MIN_NODE_VERSION = 18;

export function checkNodeVersion(): CheckResult {
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

export function checkGraphDir(startPath?: string): CheckResult {
  try {
    const graphDir = resolveGraphDir(startPath);
    const entries = fs.readdirSync(graphDir, { recursive: true })
      .filter(e => String(e).endsWith('.md'));
    return {
      name: 'graph-dir',
      status: 'pass',
      message: t('doctor.graph_found', { count: String(entries.length) }),
    };
  } catch {
    return {
      name: 'graph-dir',
      status: 'fail',
      message: t('doctor.graph_not_found'),
    };
  }
}

export async function checkGraphParsing(graphDir: string): Promise<CheckResult> {
  const graph = await loadGraph(graphDir, { permissive: true });
  const errors = graph.errors ?? [];
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

export async function checkLint(graphDir: string): Promise<CheckResult> {
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

export function checkConfig(graphDir: string): CheckResult {
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

const TOOL_RULES: Array<{ name: string; paths: string[] }> = [
  { name: '.claude', paths: ['.claude/CLAUDE.md'] },
  { name: '.cursor', paths: ['.cursor/rules'] },
  { name: '.windsurf', paths: ['.windsurf/rules'] },
  { name: '.clinerules', paths: ['.clinerules'] },
  { name: '.github/copilot', paths: ['.github/copilot-instructions.md'] },
];

export function checkToolRules(projectDir: string): CheckResult {
  const found: string[] = [];
  for (const tool of TOOL_RULES) {
    for (const p of tool.paths) {
      if (fs.existsSync(path.join(projectDir, p))) {
        found.push(tool.name);
        break;
      }
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

export function checkVersion(): CheckResult {
  return {
    name: 'version',
    status: 'info',
    message: t('doctor.version', { version: VERSION }),
  };
}

export async function runDoctorChecks(startPath?: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  results.push(checkNodeVersion());

  const graphDirResult = checkGraphDir(startPath);
  results.push(graphDirResult);

  // Graph-dependent checks only if graph/ was found
  if (graphDirResult.status === 'pass') {
    const graphDir = resolveGraphDir(startPath);
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
