import type {
  SerializedGraph,
  VisualCluster,
  HealthReport,
  PromoteCandidate,
  CheckResult,
} from '../../types.js';
import type { NeighborNode } from '../../../graph/types.js';

export interface NodeDetailResponse {
  id: string;
  title: string;
  type: string;
  status?: string;
  confidence?: number;
  tags?: string[];
  links?: { target: string; relation: string }[];
  body: string | null;
  created?: string;
  updated?: string;
  invalid?: boolean;
  parseError?: string;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json() as T;
}

export async function fetchGraph(init?: RequestInit): Promise<SerializedGraph> {
  return apiFetch<SerializedGraph>('/api/graph', init);
}

export async function fetchNodeDetail(id: string, init?: RequestInit): Promise<NodeDetailResponse> {
  return apiFetch<NodeDetailResponse>(`/api/node/${encodeURIComponent(id)}`, init);
}

export async function fetchNeighbors(
  id: string,
  depth: number,
  init?: RequestInit,
): Promise<{ center: string; depth: number; neighbors: NeighborNode[] }> {
  return apiFetch(`/api/neighbors/${encodeURIComponent(id)}?depth=${depth}`, init);
}

export async function fetchHealth(init?: RequestInit): Promise<HealthReport> {
  return apiFetch<HealthReport>('/api/health', init);
}

export async function fetchPromotionCandidates(
  init?: RequestInit,
): Promise<{ candidates: PromoteCandidate[] }> {
  return apiFetch('/api/promotion-candidates', init);
}

export async function fetchConsolidation(init?: RequestInit): Promise<CheckResult> {
  return apiFetch<CheckResult>('/api/consolidation', init);
}

export async function fetchClusters(init?: RequestInit): Promise<{ clusters: VisualCluster[] }> {
  return apiFetch('/api/clusters', init);
}

export async function triggerRefresh(
  init?: RequestInit,
): Promise<{ reloaded: boolean; loadedAt: string; nodeCount: number }> {
  return apiFetch('/api/refresh', { method: 'POST', ...init });
}

export async function fetchExportHtml(
  layout: string,
  types?: string[],
  statuses?: string[],
): Promise<string> {
  const params = new URLSearchParams({ layout });
  if (types?.length) params.set('types', types.join(','));
  if (statuses?.length) params.set('statuses', statuses.join(','));

  const res = await fetch(`/api/export?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}
