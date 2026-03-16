import type { Node } from './types.js';

export interface HypothesisMeta {
  risk_level?: string;
  kill_criterion?: string;
  priority?: number;
  branch_group?: string;
  branch_role?: string;
}

export interface FindingMeta {
  finding_type?: string;
  sources?: string[];
}

export interface QuestionMeta {
  question_type?: string;
  urgency?: string;
  answer_summary?: string;
}

export interface EpisodeMeta {
  trigger?: string;
  duration?: string;
  outcome?: string;
  spawned?: string[];
  dead_ends?: string[];
}

export interface ExperimentMeta {
  config?: Record<string, unknown>;
  results?: Record<string, unknown>;
  artifacts?: string[];
}

export interface DecisionMeta {
  alternatives_considered?: string[];
  reversibility?: string;
}

export interface KnowledgeMeta {
  knowledge_type?: string;
  source?: string;
}

function extract<T>(node: Node, expectedType: string, keys: string[]): T | null {
  if (node.type !== expectedType) return null;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (node.meta[key] !== undefined) {
      result[key] = node.meta[key];
    }
  }
  return result as T;
}

export function getHypothesisMeta(node: Node): HypothesisMeta | null {
  return extract<HypothesisMeta>(node, 'hypothesis', [
    'risk_level', 'kill_criterion', 'priority', 'branch_group', 'branch_role',
  ]);
}

export function getFindingMeta(node: Node): FindingMeta | null {
  return extract<FindingMeta>(node, 'finding', ['finding_type', 'sources']);
}

export function getQuestionMeta(node: Node): QuestionMeta | null {
  return extract<QuestionMeta>(node, 'question', ['question_type', 'urgency', 'answer_summary']);
}

export function getEpisodeMeta(node: Node): EpisodeMeta | null {
  return extract<EpisodeMeta>(node, 'episode', ['trigger', 'duration', 'outcome', 'spawned', 'dead_ends']);
}

export function getExperimentMeta(node: Node): ExperimentMeta | null {
  return extract<ExperimentMeta>(node, 'experiment', ['config', 'results', 'artifacts']);
}

export function getDecisionMeta(node: Node): DecisionMeta | null {
  return extract<DecisionMeta>(node, 'decision', ['alternatives_considered', 'reversibility']);
}

export function getKnowledgeMeta(node: Node): KnowledgeMeta | null {
  return extract<KnowledgeMeta>(node, 'knowledge', ['knowledge_type', 'source']);
}
