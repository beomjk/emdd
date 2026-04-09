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
  type CheckResult,
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
  });

  describe('checkGraphDir', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdd-doctor-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns pass when graph/ exists with nodes', () => {
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );
      const result = checkGraphDir(tmpDir);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('graph/');
    });

    it('returns fail when no graph/ directory', () => {
      const emptyDir = path.join(tmpDir, 'empty');
      fs.mkdirSync(emptyDir);
      const result = checkGraphDir(emptyDir);
      expect(result.status).toBe('fail');
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
      // Invalid YAML frontmatter
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
    it('returns pass for clean fixture graph', async () => {
      const fixtureDir = path.join(__dirname, '../../fixtures/sample-graph');
      const result = await checkLint(fixtureDir);
      // fixture may have warnings, but should not fail
      expect(['pass', 'warn']).toContain(result.status);
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

    it('returns info with "none" when no rules found', () => {
      const result = checkToolRules(tmpDir);
      expect(result.status).toBe('info');
      expect(result.message).toContain('No AI tool rules');
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
      // Create a proper graph/ structure
      const graphDir = path.join(tmpDir, 'graph');
      fs.mkdirSync(path.join(graphDir, 'hypotheses'), { recursive: true });
      fs.writeFileSync(
        path.join(graphDir, 'hypotheses', 'hyp-001-test.md'),
        '---\nid: hyp-001\ntitle: Test\ntype: hypothesis\nstatus: PROPOSED\n---\nBody',
      );

      const results = await runDoctorChecks(tmpDir);
      expect(results.length).toBeGreaterThanOrEqual(7);
      // Every result has required fields
      for (const r of results) {
        expect(r.name).toBeTruthy();
        expect(['pass', 'warn', 'fail', 'info']).toContain(r.status);
        expect(r.message).toBeTruthy();
      }
    });

    it('includes graph checks when graph/ exists', async () => {
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
    });

    it('skips graph checks when no graph/ exists', async () => {
      const emptyDir = path.join(tmpDir, 'empty');
      fs.mkdirSync(emptyDir);
      const results = await runDoctorChecks(emptyDir);
      const names = results.map(r => r.name);
      expect(names).toContain('graph-dir');
      expect(names).not.toContain('parse');
      expect(names).not.toContain('lint');
    });
  });
});
