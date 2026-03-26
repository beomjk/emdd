// ── Prompt Metadata (Single Source of Truth) ───────────────────────
// Canonical prompt names, descriptions, and parameter info.
// Used by prompt registration files and doc-tables generator.

export interface PromptMeta {
  name: string;
  description: string;
  hasGraphDir: boolean;
  hasLang: boolean;
  group?: string;
  order?: number;
}

export const PROMPT_META: PromptMeta[] = [
  {
    name: 'context-loading',
    description: '[Cycle 1/4 · Session Start] Load EMDD graph context — provides a summary of nodes, edges, health, and structural gaps',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 1,
  },
  {
    name: 'episode-creation',
    description: '[Cycle 2/4 · Session End] Step-by-step guide for writing an EMDD Episode node — includes frontmatter template, mandatory sections, and linking instructions',
    hasGraphDir: false,
    hasLang: false,
    group: 'session-cycle',
    order: 2,
  },
  {
    name: 'consolidation',
    description: '[Cycle 3/4 · Maintenance] Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 3,
  },
  {
    name: 'health-review',
    description: '[Cycle 4/4 · Review] Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density',
    hasGraphDir: true,
    hasLang: true,
    group: 'session-cycle',
    order: 4,
  },
];
