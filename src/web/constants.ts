import {
  POSITIVE_STATUSES,
  NEGATIVE_STATUSES,
  IN_PROGRESS_STATUSES,
  TERMINAL_STATUSES,
} from '../graph/types.js';
import type { NodeType } from '../graph/types.js';

export interface GraphThemeTokenSet {
  nodeText: string;
  clusterFill: string;
  clusterBorder: string;
  highlightUnderlay: string;
  selectionUnderlay: string;
  selectionOutline: string;
  groupLabelBg: string;
}

// ── Node type colors (single source of truth) ───────────────────────

export const NODE_COLORS: Record<NodeType, string> = {
  hypothesis: '#4A90D9',
  experiment: '#7B68EE',
  finding: '#50C878',
  knowledge: '#DAA520',
  question: '#FF8C42',
  episode: '#A0A0A0',
  decision: '#20B2AA',
};

export function getNodeColor(type: string): string {
  return NODE_COLORS[type as NodeType] ?? '#999';
}

export const GRAPH_THEME_TOKENS: Record<'light' | 'dark', GraphThemeTokenSet> = {
  light: {
    nodeText: '#1F2933',
    clusterFill: 'rgba(74, 144, 217, 0.08)',
    clusterBorder: 'rgba(74, 144, 217, 0.3)',
    highlightUnderlay: 'rgba(74, 144, 217, 0.16)',
    selectionUnderlay: 'rgba(74, 144, 217, 0.24)',
    selectionOutline: 'rgba(248, 250, 252, 0.92)',
    groupLabelBg: 'rgba(255, 255, 255, 0.82)',
  },
  dark: {
    nodeText: '#F5F7FA',
    clusterFill: 'rgba(93, 173, 226, 0.14)',
    clusterBorder: 'rgba(93, 173, 226, 0.45)',
    highlightUnderlay: 'rgba(93, 173, 226, 0.22)',
    selectionUnderlay: 'rgba(93, 173, 226, 0.3)',
    selectionOutline: 'rgba(12, 18, 32, 0.9)',
    groupLabelBg: 'rgba(15, 23, 41, 0.84)',
  },
};

export function getGraphThemeTokens(theme?: string): GraphThemeTokenSet {
  return theme === 'dark' ? GRAPH_THEME_TOKENS.dark : GRAPH_THEME_TOKENS.light;
}

// ── Status border encoding ──────────────────────────────────────────

export function getStatusBorder(node: { status: string; invalid?: boolean }): {
  width: number;
  style: string;
  color: string;
} {
  if (node.invalid) return { width: 2, style: 'dashed', color: '#FF9800' };
  const s = node.status;
  if (POSITIVE_STATUSES.has(s)) return { width: 3, style: 'solid', color: '#2ECC71' };
  if (NEGATIVE_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#E74C3C' };
  if (IN_PROGRESS_STATUSES.has(s)) return { width: 2, style: 'solid', color: '#3498DB' };
  if (TERMINAL_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#95A5A6' };
  return { width: 1, style: 'solid', color: '#95A5A6' }; // Initial/Open
}

// ── Status border legend for UI rendering ───────────────────────────

export const STATUS_BORDER_LEGEND: Array<[label: string, borderStyle: string, borderColor: string, borderWidth: number]> = [
  ['Positive', 'solid', '#2ECC71', 3],
  ['Negative', 'dashed', '#E74C3C', 2],
  ['In Progress', 'solid', '#3498DB', 2],
  ['Initial', 'solid', '#95A5A6', 1],
  ['Terminal', 'dashed', '#95A5A6', 2],
  ['Invalid', 'dashed', '#FF9800', 2],
];

export const GRAPH_STATE_CUE_LEGEND = [
  ['Selected', 'selected', 'Thicker border and focus ring'],
  ['Highlighted', 'highlighted', 'Halo while neighbors stay readable'],
  ['Grouped', 'grouped', 'Rounded container with labeled surface'],
  ['Invalid', 'invalid', 'Dashed border fallback'],
] as const;
