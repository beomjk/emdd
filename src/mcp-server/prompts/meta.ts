// ── Prompt Metadata (Single Source of Truth) ───────────────────────
// Canonical prompt names, descriptions, and parameter info.
// Used by prompt registration files and doc-tables generator.

import type { CeremonyRhythm } from '../../graph/types.js';

export interface PromptMeta {
  name: string;
  description: string;
  hasGraphDir: boolean;
  hasLang: boolean;
  /** Logical grouping for related prompts (e.g., 'session-cycle'). Used by doc-tables and future prompt-listing UIs. */
  group?: string;
  /** Display order within a group (1-based). Used by doc-tables and future prompt-listing UIs. */
  order?: number;
  /** Ceremony rhythm classification — informational signal for AI agents. */
  rhythm?: CeremonyRhythm;
  /** Human-readable execution point (e.g., '/emdd-open', 'manual_or_scheduler'). */
  execution_point?: string;
}

export const PROMPT_META: PromptMeta[] = [
  {
    name: 'context-loading',
    description: '[Cycle 1/4 · Session Start] Load EMDD graph context — provides a summary of nodes, edges, health, and structural gaps',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 1,
    rhythm: 'PER_SESSION',
    execution_point: '/emdd-open',
  },
  {
    name: 'episode-creation',
    description: '[Cycle 2/4 · Session End] Step-by-step guide for writing an EMDD Episode node — includes frontmatter template, mandatory sections, and linking instructions',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 2,
    rhythm: 'PER_SESSION',
    execution_point: '/emdd-close',
  },
  {
    name: 'consolidation',
    description: '[Cycle 3/4 · Maintenance] Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 3,
    rhythm: 'PER_SESSION',
    execution_point: '/emdd-close',
  },
  {
    name: 'health-review',
    description: '[Cycle 4/4 · Review] Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 4,
    rhythm: 'PERIODIC',
    execution_point: 'manual_or_scheduler',
  },
];
