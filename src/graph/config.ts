import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface GapThresholds {
  untested_days: number;
  untested_episodes: number;
  stale_days: number;
  orphan_min_outgoing: number;
  blocking_days: number;
  blocking_episodes: number;
  min_cluster_edges: number;
}

export interface EmddConfig {
  lang: string;
  version: string;
  gaps: GapThresholds;
}

export const DEFAULT_CONFIG: EmddConfig = {
  lang: 'en',
  version: '1.0',
  gaps: {
    untested_days: 5,
    untested_episodes: 3,
    stale_days: 90,
    orphan_min_outgoing: 0,
    blocking_days: 7,
    blocking_episodes: 3,
    min_cluster_edges: 2,
  },
};

export function loadConfig(graphDir: string): EmddConfig {
  const configPath = path.join(path.dirname(graphDir), '.emdd.yml');

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch {
    return { ...DEFAULT_CONFIG, gaps: { ...DEFAULT_CONFIG.gaps } };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_CONFIG, gaps: { ...DEFAULT_CONFIG.gaps } };
    }
  } catch {
    return { ...DEFAULT_CONFIG, gaps: { ...DEFAULT_CONFIG.gaps } };
  }

  const gaps = (parsed.gaps ?? {}) as Record<string, unknown>;

  return {
    lang: typeof parsed.lang === 'string' ? parsed.lang : DEFAULT_CONFIG.lang,
    version: typeof parsed.version === 'string' ? parsed.version : DEFAULT_CONFIG.version,
    gaps: {
      untested_days: typeof gaps.untested_days === 'number' ? gaps.untested_days : DEFAULT_CONFIG.gaps.untested_days,
      untested_episodes: typeof gaps.untested_episodes === 'number' ? gaps.untested_episodes : DEFAULT_CONFIG.gaps.untested_episodes,
      stale_days: typeof gaps.stale_days === 'number' ? gaps.stale_days : DEFAULT_CONFIG.gaps.stale_days,
      orphan_min_outgoing: typeof gaps.orphan_min_outgoing === 'number' ? gaps.orphan_min_outgoing : DEFAULT_CONFIG.gaps.orphan_min_outgoing,
      blocking_days: typeof gaps.blocking_days === 'number' ? gaps.blocking_days : DEFAULT_CONFIG.gaps.blocking_days,
      blocking_episodes: typeof gaps.blocking_episodes === 'number' ? gaps.blocking_episodes : DEFAULT_CONFIG.gaps.blocking_episodes,
      min_cluster_edges: typeof gaps.min_cluster_edges === 'number' ? gaps.min_cluster_edges : DEFAULT_CONFIG.gaps.min_cluster_edges,
    },
  };
}
