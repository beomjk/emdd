import type { Node, Graph, NodeType } from './types.js';
import { VALID_STATUSES, REQUIRED_FIELDS, ALL_VALID_RELATIONS } from './types.js';
import { t } from '../i18n/index.js';

export interface LintError {
  nodeId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate a single node for schema correctness.
 * Returns an array of LintError objects.
 */
export function lintNode(node: Node): LintError[] {
  const errors: LintError[] = [];
  const id = node.id;

  // Check type field
  if (!node.type) {
    errors.push({
      nodeId: id,
      field: 'type',
      message: t('lint.missing_field', { field: 'type' }),
      severity: 'error',
    });
    // Can't do type-specific checks without a type
    return errors;
  }

  // Check if type is a valid NodeType
  const validTypes = Object.keys(VALID_STATUSES);
  if (!validTypes.includes(node.type)) {
    errors.push({
      nodeId: id,
      field: 'type',
      message: t('lint.missing_field', { field: 'type' }),
      severity: 'error',
    });
    return errors;
  }

  const nodeType = node.type as NodeType;

  // Check title
  if (!node.title) {
    errors.push({
      nodeId: id,
      field: 'title',
      message: t('lint.missing_field', { field: 'title' }),
      severity: 'error',
    });
  }

  // Check status
  if (!node.status) {
    errors.push({
      nodeId: id,
      field: 'status',
      message: t('lint.missing_field', { field: 'status' }),
      severity: 'error',
    });
  } else {
    const validStatuses = VALID_STATUSES[nodeType];
    if (validStatuses && !validStatuses.includes(node.status)) {
      errors.push({
        nodeId: id,
        field: 'status',
        message: t('lint.invalid_status', {
          status: node.status,
          type: nodeType,
          valid: validStatuses.join(', '),
        }),
        severity: 'error',
      });
    }
  }

  // Check confidence range
  if (node.confidence !== undefined) {
    if (node.confidence < 0.0 || node.confidence > 1.0) {
      errors.push({
        nodeId: id,
        field: 'confidence',
        message: t('lint.confidence_range', { value: String(node.confidence) }),
        severity: 'error',
      });
    }
  }

  // Check type-specific required fields: confidence for hypothesis, finding, knowledge
  const requiredFields = REQUIRED_FIELDS[nodeType] ?? [];
  if (requiredFields.includes('confidence') && node.confidence === undefined) {
    errors.push({
      nodeId: id,
      field: 'confidence',
      message: t('lint.missing_field', { field: 'confidence' }),
      severity: 'warning',
    });
  }

  // Check link relations
  for (const link of node.links) {
    if (!ALL_VALID_RELATIONS.has(link.relation)) {
      errors.push({
        nodeId: id,
        field: 'links',
        message: t('lint.invalid_relation', { relation: link.relation }),
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validate an entire graph: per-node checks + cross-node link integrity.
 */
export function lintGraph(graph: Graph): LintError[] {
  const errors: LintError[] = [];

  for (const node of graph.nodes.values()) {
    errors.push(...lintNode(node));

    // Check link targets exist in graph
    for (const link of node.links) {
      if (!graph.nodes.has(link.target)) {
        errors.push({
          nodeId: node.id,
          field: 'links',
          message: t('lint.broken_link', { target: link.target }),
          severity: 'error',
        });
      }
    }
  }

  return errors;
}
