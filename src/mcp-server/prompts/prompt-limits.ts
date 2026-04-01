// ── Prompt Display Limits ───────────────────────────────────────────
// Centralized constants for prompt rendering.
// Schema-level constants (THRESHOLDS, CEREMONY_TRIGGERS) live in
// schema.config.ts → derive-constants.ts. These are prompt-specific
// display limits that control how much data each section shows.

export const PROMPT_LIMITS = {
  /** Maximum episodes shown in Episode Arc table */
  episodeArc: 5,
  /** Maximum episodes referenced in Episode Directive */
  episodeDirective: 3,
  /** Maximum pending backlog items shown */
  backlogDigest: 15,
  /** Maximum transition recommendations shown */
  activeFrontier: 10,
  /** Maximum open questions shown */
  openQuestions: 10,
  /** Consecutive blocked sessions to trigger warning */
  blockedStreakThreshold: 2,
  /** Maximum recently changed nodes in episode-creation */
  recentNodes: 20,
} as const;
