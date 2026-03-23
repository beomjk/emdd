import type { EdgeType } from './types.js';
import { EDGE_ATTRIBUTE_AFFINITY, EDGE_ATTRIBUTE_NAMES } from './types.js';

export interface AffinityViolation {
  relation: string;
  invalidAttrs: string[];
  allowedAttrs: string[] | null;
}

/** Extract which known edge attribute keys are present on an object. */
export function getPresentAttrKeys(obj: Record<string, unknown>): string[] {
  return EDGE_ATTRIBUTE_NAMES.filter(k => obj[k] !== undefined);
}

/**
 * Check edge attribute affinity for a given relation.
 * Returns null if no violation, or a violation descriptor.
 */
export function checkEdgeAffinity(
  relation: string,
  presentAttrKeys: string[],
): AffinityViolation | null {
  if (presentAttrKeys.length === 0) return null;

  const allowed = EDGE_ATTRIBUTE_AFFINITY[relation as EdgeType];
  if (!allowed) {
    return { relation, invalidAttrs: presentAttrKeys, allowedAttrs: null };
  }

  const invalid = presentAttrKeys.filter(k => !allowed.includes(k));
  if (invalid.length > 0) {
    return { relation, invalidAttrs: invalid, allowedAttrs: [...allowed] };
  }

  return null;
}
