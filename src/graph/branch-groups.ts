import { loadGraph } from './loader.js';
import { getHypothesisMeta } from './accessors.js';

export interface BranchCandidate {
  id: string;
  confidence: number;
  status: string;
  role: string;
}

export interface BranchGroup {
  groupId: string;
  candidates: BranchCandidate[];
  convergenceReady: boolean;
  convergenceReason: string;
  warnings: string[];
  oldestCreated: string;
}

const MAX_ACTIVE_GROUPS = 3;
const MAX_CANDIDATES = 4;
const MAX_OPEN_WEEKS = 4;

export async function listBranchGroups(graphDir: string): Promise<BranchGroup[]> {
  const graph = await loadGraph(graphDir);
  const groupMap = new Map<string, BranchCandidate[]>();
  const groupDates = new Map<string, string[]>();

  for (const [, node] of graph.nodes) {
    if (node.type !== 'hypothesis') continue;
    const meta = getHypothesisMeta(node);
    if (!meta?.branch_group) continue;

    const bg = meta.branch_group;
    if (!groupMap.has(bg)) {
      groupMap.set(bg, []);
      groupDates.set(bg, []);
    }
    groupMap.get(bg)!.push({
      id: node.id,
      confidence: node.confidence ?? 0,
      status: node.status ?? 'PROPOSED',
      role: meta.branch_role ?? 'candidate',
    });
    if (node.meta.created) {
      groupDates.get(bg)!.push(String(node.meta.created));
    }
  }

  const activeGroupIds = [...groupMap.keys()];
  const groups: BranchGroup[] = [];

  for (const [groupId, members] of groupMap) {
    const candidates = members.filter(m => m.role === 'candidate');
    const warnings: string[] = [];

    // Max active groups
    if (activeGroupIds.length > MAX_ACTIVE_GROUPS) {
      warnings.push(`More than ${MAX_ACTIVE_GROUPS} active branch groups`);
    }

    // Max candidates
    if (candidates.length > MAX_CANDIDATES) {
      warnings.push(`More than ${MAX_CANDIDATES} candidates in group ${groupId}`);
    }

    // Check duration
    const dates = groupDates.get(groupId) ?? [];
    const oldestCreated = dates.sort()[0] ?? '';
    if (oldestCreated) {
      const created = new Date(oldestCreated);
      const weeksElapsed = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 7);
      if (weeksElapsed > MAX_OPEN_WEEKS) {
        warnings.push(`Branch group ${groupId} has been OPEN for more than 4 weeks`);
      }
    }

    // Convergence detection
    let convergenceReady = false;
    let convergenceReason = '';

    // 1. Confidence gap >= 0.3
    if (candidates.length >= 2) {
      const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
      const gap = sorted[0].confidence - sorted[1].confidence;
      if (gap >= 0.3) {
        convergenceReady = true;
        convergenceReason = `confidence gap >= 0.3 (${sorted[0].id}: ${sorted[0].confidence} vs ${sorted[1].id}: ${sorted[1].confidence})`;
      }
    }

    // 2. All but one REFUTED
    if (!convergenceReady && candidates.length >= 2) {
      const nonRefuted = candidates.filter(c => c.status !== 'REFUTED');
      if (nonRefuted.length === 1) {
        convergenceReady = true;
        convergenceReason = `All candidates but ${nonRefuted[0].id} are REFUTED`;
      }
    }

    // 3. Time limit: group open >= 2 weeks
    if (!convergenceReady && oldestCreated) {
      const created = new Date(oldestCreated);
      const weeksElapsed = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 7);
      if (weeksElapsed >= 2) {
        convergenceReady = true;
        convergenceReason = `Time limit reached: ${Math.floor(weeksElapsed)} weeks (default: 2 weeks)`;
      }
    }

    groups.push({
      groupId,
      candidates,
      convergenceReady,
      convergenceReason,
      warnings,
      oldestCreated,
    });
  }

  return groups;
}
