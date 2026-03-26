// ── Prompt Metadata (Single Source of Truth) ───────────────────────
// Canonical prompt names, descriptions, and parameter info.
// Used by prompt registration files and doc-tables generator.

export interface PromptMeta {
  name: string;
  description: string;
  hasGraphDir: boolean;
  hasLang: boolean;
}

export const PROMPT_META: PromptMeta[] = [
  {
    name: 'context-loading',
    description: 'Load EMDD graph context for session start — provides a summary of nodes, edges, health, and structural gaps',
    hasGraphDir: true,
    hasLang: true,
  },
  {
    name: 'episode-creation',
    description: 'Step-by-step guide for writing an EMDD Episode node — includes frontmatter template, mandatory sections, and linking instructions',
    hasGraphDir: false,
    hasLang: false,
  },
  {
    name: 'consolidation',
    description: 'Consolidation execution guide — checks triggers and provides a step-by-step procedure for promoting findings, generating questions, and updating hypotheses',
    hasGraphDir: true,
    hasLang: true,
  },
  {
    name: 'health-review',
    description: 'Full health dashboard with actionable recommendations — analyzes node distribution, structural gaps, and link density',
    hasGraphDir: true,
    hasLang: true,
  },
];
