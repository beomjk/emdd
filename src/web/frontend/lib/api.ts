import type {
  SerializedGraph,
  VisualCluster,
  HealthReport,
  PromoteCandidate,
  CheckResult,
} from '../../types.js';
import { dashboardState } from '../state/dashboard.svelte.js';

interface NodeDetailResponse {
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
  dashboardState.error = null;
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json() as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    dashboardState.error = `Failed to fetch ${url}: ${message}`;
    throw e;
  }
}

export async function fetchGraph(): Promise<SerializedGraph> {
  return apiFetch<SerializedGraph>('/api/graph');
}

export async function fetchNodeDetail(id: string): Promise<NodeDetailResponse> {
  return apiFetch<NodeDetailResponse>(`/api/node/${encodeURIComponent(id)}`);
}

export async function fetchNeighbors(
  id: string,
  depth: number,
): Promise<{ center: string; depth: number; neighbors: string[] }> {
  return apiFetch(`/api/neighbors/${encodeURIComponent(id)}?depth=${depth}`);
}

export async function fetchHealth(): Promise<HealthReport> {
  return apiFetch<HealthReport>('/api/health');
}

export async function fetchPromotionCandidates(): Promise<{ candidates: PromoteCandidate[] }> {
  return apiFetch('/api/promotion-candidates');
}

export async function fetchConsolidation(): Promise<CheckResult> {
  return apiFetch<CheckResult>('/api/consolidation');
}

export async function fetchClusters(): Promise<{ clusters: VisualCluster[] }> {
  return apiFetch('/api/clusters');
}

export async function triggerRefresh(): Promise<{ reloaded: boolean; loadedAt: string; nodeCount: number }> {
  return apiFetch('/api/refresh', { method: 'POST' });
}

export async function fetchExportHtml(
  layout: string,
  types?: string[],
  statuses?: string[],
): Promise<string> {
  const params = new URLSearchParams({ layout });
  if (types?.length) params.set('types', types.join(','));
  if (statuses?.length) params.set('statuses', statuses.join(','));

  dashboardState.error = null;
  try {
    const res = await fetch(`/api/export?${params}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    dashboardState.error = `Failed to export: ${message}`;
    throw e;
  }
}
