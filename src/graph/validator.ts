import type { Node, Graph, NodeType } from './types.js';
import {
  VALID_STATUSES, REQUIRED_FIELDS, ALL_VALID_RELATIONS,
  VALID_SEVERITIES, VALID_DEPENDENCY_TYPES, VALID_IMPACTS,
  VALID_FINDING_TYPES, VALID_URGENCIES, VALID_RISK_LEVELS, VALID_REVERSIBILITIES,
  EDGE_ATTRIBUTE_AFFINITY,
} from './types.js';
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

    if (link.strength !== undefined && (link.strength < 0.0 || link.strength > 1.0)) {
      errors.push({
        nodeId: id, field: 'links',
        message: `Edge attribute strength must be between 0.0 and 1.0, got ${link.strength}`,
        severity: 'warning',
      });
    }

    if (link.severity !== undefined && !(VALID_SEVERITIES as readonly string[]).includes(link.severity)) {
      errors.push({
        nodeId: id, field: 'links',
        message: `Invalid severity "${link.severity}". Valid: ${VALID_SEVERITIES.join(', ')}`,
        severity: 'warning',
      });
    }

    if (link.completeness !== undefined && (link.completeness < 0.0 || link.completeness > 1.0)) {
      errors.push({
        nodeId: id, field: 'links',
        message: `Edge attribute completeness must be between 0.0 and 1.0, got ${link.completeness}`,
        severity: 'warning',
      });
    }

    if (link.dependencyType !== undefined && !(VALID_DEPENDENCY_TYPES as readonly string[]).includes(link.dependencyType)) {
      errors.push({
        nodeId: id, field: 'links',
        message: `Invalid dependencyType "${link.dependencyType}". Valid: ${VALID_DEPENDENCY_TYPES.join(', ')}`,
        severity: 'warning',
      });
    }

    if (link.impact !== undefined && !(VALID_IMPACTS as readonly string[]).includes(link.impact)) {
      errors.push({
        nodeId: id, field: 'links',
        message: `Invalid impact "${link.impact}". Valid: ${VALID_IMPACTS.join(', ')}`,
        severity: 'warning',
      });
    }

    // Edge attribute affinity validation
    const attrKeys = (['strength', 'severity', 'completeness', 'dependencyType', 'impact'] as const)
      .filter(k => (link as Record<string, unknown>)[k] !== undefined);
    if (attrKeys.length > 0) {
      const allowed = EDGE_ATTRIBUTE_AFFINITY[link.relation];
      if (!allowed) {
        errors.push({
          nodeId: id, field: 'links',
          message: `Edge affinity violation: "${link.relation}" does not allow any attributes, but has [${attrKeys.join(', ')}]`,
          severity: 'error',
        });
      } else {
        const invalid = attrKeys.filter(k => !allowed.includes(k));
        if (invalid.length > 0) {
          errors.push({
            nodeId: id, field: 'links',
            message: `Edge affinity violation: "${link.relation}" allows [${allowed.join(', ')}], but has disallowed [${invalid.join(', ')}]`,
            severity: 'error',
          });
        }
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
