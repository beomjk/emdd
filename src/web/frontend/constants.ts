import {
  POSITIVE_STATUSES,
  NEGATIVE_STATUSES,
  IN_PROGRESS_STATUSES,
  TERMINAL_STATUSES,
  INITIAL_STATUSES,
} from '../../graph/types.js';
import type { NodeType } from '../../graph/types.js';

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
