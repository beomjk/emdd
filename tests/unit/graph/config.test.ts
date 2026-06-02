import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, DEFAULT_CONFIG } from '../../../src/graph/config.js';

describe('loadConfig', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-config-'));
    graphDir = join(tmpDir, 'graph');
    mkdirSync(graphDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads .emdd.yml from graph parent directory', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'lang: ko',
      'version: "2.0"',
      'gaps:',
      '  untested_days: 10',
      '  stale_days: 60',
    ].join('\n'));

    const config = loadConfig(graphDir);
    expect(config.lang).toBe('ko');
    expect(config.version).toBe('2.0');
    expect(config.gaps.untested_days).toBe(10);
    expect(config.gaps.stale_days).toBe(60);
  });

  it('returns default config when file does not exist', () => {
    const config = loadConfig(graphDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('parses gaps thresholds correctly', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'gaps:',
      '  untested_days: 7',
      '  stale_days: 60',
      '  orphan_min_outgoing: 1',
      '  blocking_days: 5',
      '  min_cluster_edges: 3',
    ].join('\n'));

    const config = loadConfig(graphDir);
    expect(config.gaps.untested_days).toBe(7);
    expect(config.gaps.stale_days).toBe(60);
    expect(config.gaps.orphan_min_outgoing).toBe(1);
    expect(config.gaps.blocking_days).toBe(5);
    expect(config.gaps.min_cluster_edges).toBe(3);
  });

  it('merges partial config with defaults (deep merge)', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'lang: ko',
      'gaps:',
      '  untested_days: 10',
    ].join('\n'));

    const config = loadConfig(graphDir);
    expect(config.lang).toBe('ko');
    expect(config.version).toBe(DEFAULT_CONFIG.version);
    expect(config.gaps.untested_days).toBe(10);
    expect(config.gaps.stale_days).toBe(DEFAULT_CONFIG.gaps.stale_days);
    expect(config.gaps.orphan_min_outgoing).toBe(DEFAULT_CONFIG.gaps.orphan_min_outgoing);
    expect(config.gaps.blocking_days).toBe(DEFAULT_CONFIG.gaps.blocking_days);
    expect(config.gaps.min_cluster_edges).toBe(DEFAULT_CONFIG.gaps.min_cluster_edges);
  });

  it('handles malformed YAML (returns defaults)', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), '{ invalid yaml: [[[');
    const config = loadConfig(graphDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe('loadConfig — structural_* thresholds (011, US3)', () => {
  let tmpDir: string;
  let graphDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'emdd-config-sg-'));
    graphDir = join(tmpDir, 'graph');
    mkdirSync(graphDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('K1: defaults 3 / 1 / 5 when the keys are unset', () => {
    const config = loadConfig(graphDir);
    expect(config.gaps.structural_min_cluster_size).toBe(3);
    expect(config.gaps.structural_max_bridges).toBe(1);
    expect(config.gaps.structural_max_gaps).toBe(5);
  });

  it('loads structural_* values from .emdd.yml', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'gaps:',
      '  structural_min_cluster_size: 4',
      '  structural_max_bridges: 2',
      '  structural_max_gaps: 10',
    ].join('\n'));
    const config = loadConfig(graphDir);
    expect(config.gaps.structural_min_cluster_size).toBe(4);
    expect(config.gaps.structural_max_bridges).toBe(2);
    expect(config.gaps.structural_max_gaps).toBe(10);
  });

  it('K2: negative / zero / non-numeric values fall back to defaults', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'gaps:',
      '  structural_min_cluster_size: -1', // negative → default
      '  structural_max_bridges: 0',       // zero → default (≥1 required)
      '  structural_max_gaps: "lots"',     // non-numeric → default
    ].join('\n'));
    const config = loadConfig(graphDir);
    expect(config.gaps.structural_min_cluster_size).toBe(3);
    expect(config.gaps.structural_max_bridges).toBe(1);
    expect(config.gaps.structural_max_gaps).toBe(5);
  });

  it('K2: fractional structural values fall back to defaults', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), [
      'gaps:',
      '  structural_min_cluster_size: 2.5',
      '  structural_max_bridges: 1.5',
      '  structural_max_gaps: 0.5',
    ].join('\n'));
    const config = loadConfig(graphDir);
    expect(config.gaps.structural_min_cluster_size).toBe(3);
    expect(config.gaps.structural_max_bridges).toBe(1);
    expect(config.gaps.structural_max_gaps).toBe(5);
  });

  it('K2: orphan_min_outgoing keeps its valid 0 default (positive check NOT applied to legacy keys)', () => {
    writeFileSync(join(tmpDir, '.emdd.yml'), ['gaps:', '  orphan_min_outgoing: 0'].join('\n'));
    const config = loadConfig(graphDir);
    expect(config.gaps.orphan_min_outgoing).toBe(0);
  });
});
