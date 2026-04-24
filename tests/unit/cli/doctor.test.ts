import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setLocale } from '../../../src/i18n/index.js';

import {
  checkNodeVersion,
  checkGraphDir,
  checkGraphParsing,
  checkLint,
  checkConfig,
  checkToolRules,
  checkVersion,
  runDoctorChecks,
  formatDoctorResults,
  type DoctorCheckResult,
} from '../../../src/cli/doctor.js';

describe('emdd doctor', () => {
  beforeEach(() => {
    setLocale('en');
  });

  describe('checkNodeVersion', () => {
    it('returns pass for current Node.js version', () => {
      const result = checkNodeVersion();
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Node.js');
    });

    it('returns fail when Node version is below minimum', () => {
      const original = process.version;
      Object.defineProperty(process, 'version', { value: 'v16.0.0', configurable: true });
      try {
        const result = checkNodeVersion();
        expect(result.status).toBe('fail');
      } finally {
        Object.defineProperty(process, 'version', { value: original, configurable: true });
      }
    });
  });

  describe('checkGraphDir', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns pass when graph dir has nodes', () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );
      const result = checkGraphDir(graphDir);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('graph/');
    });

    it('returns fail when graphDir is undefined', () => {
      const result = checkGraphDir(undefined);
      expect(result.status).toBe('fail');
    });

    it('excludes _-prefixed directories from count', () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.mkdirSync(path.join(graphDir, '_drafts'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );
      fs.writeFileSync(
        path.join(graphDir, '_drafts', 'draft.md'),
        '# Draft',
      );
      const result = checkGraphDir(graphDir);
      expect(result.status).toBe('pass');
      // Only the non-_prefixed .md file should count
      expect(result.message).toContain('(1 nodes)');
    });
  });

  describe('checkGraphParsing', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-parse-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns pass when all nodes parse', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );
      const result = await checkGraphParsing(graphDir);
      expect(result.status).toBe('pass');
    });

    it('returns warn when nodes have parse errors', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-bad.md'),
        '---\n: invalid yaml\n---\n',
      );
      const result = await checkGraphParsing(graphDir);
      expect(result.status).toBe('warn');
      expect(result.details).toBeDefined();
      expect(result.details!.length).toBeGreaterThan(0);
    });
  });

  describe('checkLint', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-lint-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns pass or warn for fixture graph', async () => {
      const fixtureDir = path.join(__dirname, '../../fixtures/sample-graph');
      const result = await checkLint(fixtureDir);
      expect(['pass', 'warn']).toContain(result.status);
    });

    it('returns warn when only warnings are present', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      // Hypothesis without confidence → lint warning
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test Hypothesis\ntype: hypothesis\nstatus: PROPOSED\nlinks: []\n---\nBody',
      );
      const result = await checkLint(graphDir);
      expect(result.status).toBe('warn');
      expect(result.name).toBe('lint');
    });

    it('returns fail with formatted details when errors are present', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      // Invalid status → lint error
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: BADSTATUS\nconfidence: 0.5\nlinks: []\n---\nBody',
      );
      const result = await checkLint(graphDir);
      expect(result.status).toBe('fail');
      expect(result.details).toBeDefined();
      expect(result.details!.length).toBeGreaterThan(0);
      // Details format: [SEVERITY] nodeId.field: message
      expect(result.details![0]).toMatch(/^\[ERROR\] hyp-001\./);
    });
  });

  describe('checkConfig', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-config-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns info with "default" when no .emdd.yml', () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(graphDir);
      const result = checkConfig(graphDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('default');
    });

    it('returns info with "custom" when .emdd.yml exists', () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(graphDir);
      fs.writeFileSync(path.join(tmpDir, '.emdd.yml'), 'lang: ko\n');
      const result = checkConfig(graphDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('custom');
    });
  });

  describe('checkToolRules', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-rules-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns info with found tools when rules exist', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.claude', 'CLAUDE.md'), '# rules');
      const result = checkToolRules(tmpDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('.claude');
    });

    it('returns info when Codex AGENTS.md rules exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# rules');
      const result = checkToolRules(tmpDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('AGENTS.md');
    });

    it('returns info with "none" when no rules found', () => {
      const result = checkToolRules(tmpDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('No AI tool rules');
    });

    it('reports multiple tools when several rules exist', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.claude', 'CLAUDE.md'), '');
      fs.mkdirSync(path.join(tmpDir, '.cursor', 'rules'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.cursor', 'rules', 'emdd.mdc'), '');
      fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
      const result = checkToolRules(tmpDir);
      expect(result.message).toContain('.claude');
      expect(result.message).toContain('.cursor');
      expect(result.message).toContain('AGENTS.md');
    });
  });

  describe('checkVersion', () => {
    it('returns info with version string', () => {
      const result = checkVersion();
      expect(result.status).toBe('info');
      expect(result.message).toMatch(/emdd v\d+\.\d+\.\d+/);
    });
  });

  describe('runDoctorChecks', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-run-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns all check results when graph/ exists', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );

      const results = await runDoctorChecks(tmpDir);
      expect(results.length).toBeGreaterThanOrEqual(7);
      for (const r of results) {
        expect(r.name).toBeTruthy();
        expect(['pass', 'warn', 'fail', 'info']).toContain(r.status);
        expect(r.message).toBeTruthy();
      }
    });

    it('includes all graph-dependent checks when graph/ exists', async () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );

      const results = await runDoctorChecks(tmpDir);
      const names = results.map(r => r.name);
      expect(names).toContain('graph-dir');
      expect(names).toContain('parse');
      expect(names).toContain('lint');
      expect(names).toContain('config');
      expect(names).toContain('tool-rules');
    });

    it('skips all graph-dependent checks when no graph/ exists', async () => {
      const emptyDir = path.join(tmpDir, 'empty');
      fs.mkdirSync(emptyDir);
      const results = await runDoctorChecks(emptyDir);
      const names = results.map(r => r.name);
      expect(names).toContain('graph-dir');
      expect(names).not.toContain('parse');
      expect(names).not.toContain('lint');
      expect(names).not.toContain('config');
      expect(names).not.toContain('tool-rules');
    });
  });

  describe('formatDoctorResults', () => {
    it('includes all result messages in output', () => {
      const results: DoctorCheckResult[] = [
        { name: 'test-pass', status: 'pass', message: 'All good' },
        { name: 'test-warn', status: 'warn', message: 'Warning here' },
        { name: 'test-fail', status: 'fail', message: 'Failure detected' },
        { name: 'test-info', status: 'info', message: 'Information' },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      expect(output).toContain('All good');
      expect(output).toContain('Warning here');
      expect(output).toContain('Failure detected');
      expect(output).toContain('Information');
    });

    it('includes version in title', () => {
      const output = formatDoctorResults([], '2.5.0');
      expect(output).toContain('2.5.0');
    });

    it('truncates details at 5 items', () => {
      const results: DoctorCheckResult[] = [
        {
          name: 'many-details',
          status: 'fail',
          message: 'Many issues',
          details: ['detail-1', 'detail-2', 'detail-3', 'detail-4', 'detail-5', 'detail-6', 'detail-7'],
        },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      expect(output).toContain('detail-1');
      expect(output).toContain('detail-5');
      expect(output).not.toContain('detail-6');
      expect(output).not.toContain('detail-7');
      expect(output).toContain('... and 2 more');
    });

    it('shows all details when 5 or fewer', () => {
      const results: DoctorCheckResult[] = [
        {
          name: 'few-details',
          status: 'warn',
          message: 'Some issues',
          details: ['a', 'b', 'c'],
        },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      expect(output).toContain('a');
      expect(output).toContain('b');
      expect(output).toContain('c');
      expect(output).not.toContain('more');
    });

    it('shows fail summary when failures exist', () => {
      const results: DoctorCheckResult[] = [
        { name: 'f1', status: 'fail', message: 'Failed 1' },
        { name: 'f2', status: 'fail', message: 'Failed 2' },
        { name: 'w1', status: 'warn', message: 'Warned' },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      // doctor.summary_fail = '{count} issue(s) found'
      expect(output).toContain('2 issue(s) found');
    });

    it('shows warn summary when only warnings exist', () => {
      const results: DoctorCheckResult[] = [
        { name: 'p', status: 'pass', message: 'OK' },
        { name: 'w', status: 'warn', message: 'Warned' },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      // doctor.summary_warn = '{count} warning(s)'
      expect(output).toContain('1 warning(s)');
    });

    it('shows pass summary when all pass or info', () => {
      const results: DoctorCheckResult[] = [
        { name: 'p', status: 'pass', message: 'OK' },
        { name: 'i', status: 'info', message: 'Info' },
      ];
      const output = formatDoctorResults(results, '1.0.0');
      // doctor.summary_pass = 'All checks passed'
      expect(output).toContain('All checks passed');
    });
  });
});
