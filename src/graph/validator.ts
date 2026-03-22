import type { Node, Graph, NodeType } from './types.js';
import {
  VALID_STATUSES, REQUIRED_FIELDS, ALL_VALID_RELATIONS,
  VALID_FINDING_TYPES, VALID_URGENCIES, VALID_RISK_LEVELS, VALID_REVERSIBILITIES,
  EDGE_ATTRIBUTE_RANGES, EDGE_ATTRIBUTE_ENUM_VALUES,
} from './types.js';
import { checkEdgeAffinity, getPresentAttrKeys } from './edge-attrs.js';
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
      message: t('lint.invalid_type', { type: node.type, valid: validTypes.join(', ') }),
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

  // Check link relations and edge attributes
  for (const link of node.links) {
    if (!ALL_VALID_RELATIONS.has(link.relation)) {
      errors.push({
        nodeId: id,
        field: 'links',
        message: t('lint.invalid_relation', { relation: link.relation }),
        severity: 'error',
      });
    }

    // Numeric range checks driven by schema-declared EDGE_ATTRIBUTE_RANGES
    for (const [attrName, { min, max }] of Object.entries(EDGE_ATTRIBUTE_RANGES)) {
      const val = (link as unknown as Record<string, unknown>)[attrName];
      if (val !== undefined && (typeof val !== 'number' || isNaN(val as number) || (min !== undefined && val < min) || (max !== undefined && val > max))) {
        errors.push({
          nodeId: id, field: 'links',
          message: `Edge attribute ${attrName} must be between ${min ?? '-Infinity'} and ${max ?? 'Infinity'}, got ${val}`,
          severity: 'warning',
        });
      }
    }

    // Enum attribute checks (driven by schema-declared EDGE_ATTRIBUTE_ENUM_VALUES)
    for (const [attrName, validValues] of Object.entries(EDGE_ATTRIBUTE_ENUM_VALUES)) {
      const val = (link as unknown as Record<string, unknown>)[attrName];
      if (val !== undefined && !(validValues as readonly string[]).includes(String(val))) {
        errors.push({
          nodeId: id, field: 'links',
          message: `Invalid ${attrName} "${val}". Valid: ${validValues.join(', ')}`,
          severity: 'warning',
        });
      }
    }

    // Edge attribute affinity validation
    const violation = checkEdgeAffinity(link.relation, getPresentAttrKeys(link as unknown as Record<string, unknown>));
    if (violation) {
      if (violation.allowedAttrs === null) {
        errors.push({
          nodeId: id, field: 'links',
          message: `Edge affinity violation: "${link.relation}" does not allow any attributes, but has [${violation.invalidAttrs.join(', ')}]`,
          severity: 'error',
        });
      } else {
        errors.push({
          nodeId: id, field: 'links',
          message: `Edge affinity violation: "${link.relation}" allows [${violation.allowedAttrs.join(', ')}], but has disallowed [${violation.invalidAttrs.join(', ')}]`,
          severity: 'error',
        });
      }
    }
  }

  // Type-specific meta validation
  if (nodeType === 'finding' && node.meta.finding_type !== undefined) {
    if (!(VALID_FINDING_TYPES as readonly string[]).includes(String(node.meta.finding_type))) {
      errors.push({
        nodeId: id, field: 'finding_type',
        message: `Invalid finding_type "${node.meta.finding_type}". Valid: ${VALID_FINDING_TYPES.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  if (nodeType === 'question' && node.meta.urgency !== undefined) {
    if (!(VALID_URGENCIES as readonly string[]).includes(String(node.meta.urgency))) {
      errors.push({
        nodeId: id, field: 'urgency',
        message: `Invalid urgency "${node.meta.urgency}". Valid: ${VALID_URGENCIES.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  if (nodeType === 'hypothesis' && node.meta.risk_level !== undefined) {
    if (!(VALID_RISK_LEVELS as readonly string[]).includes(String(node.meta.risk_level))) {
      errors.push({
        nodeId: id, field: 'risk_level',
        message: `Invalid risk_level "${node.meta.risk_level}". Valid: ${VALID_RISK_LEVELS.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  if (nodeType === 'decision' && node.meta.reversibility !== undefined) {
    if (!(VALID_REVERSIBILITIES as readonly string[]).includes(String(node.meta.reversibility))) {
      errors.push({
        nodeId: id, field: 'reversibility',
        message: `Invalid reversibility "${node.meta.reversibility}". Valid: ${VALID_REVERSIBILITIES.join(', ')}`,
        severity: 'warning',
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
