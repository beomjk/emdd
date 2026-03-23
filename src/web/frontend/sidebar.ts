import { panToNode, pulseNode } from './graph.js';
import { NODE_COLORS } from './constants.js';
import type { HealthReport, GapDetail, PromoteCandidate, CheckResult } from '../types.js';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Health metrics section ───────────────────────────────────────────

function renderMetrics(health: HealthReport): string {
  const avgConf = health.avgConfidence != null
    ? `${(health.avgConfidence * 100).toFixed(0)}%`
    : 'N/A';

  return `
    <div class="sidebar-section">
      <h4 class="sidebar-heading">Overview</h4>
      <div class="metric-grid">
        <div class="metric"><span class="metric-value">${health.totalNodes}</span><span class="metric-label">Nodes</span></div>
        <div class="metric"><span class="metric-value">${health.totalEdges}</span><span class="metric-label">Edges</span></div>
        <div class="metric"><span class="metric-value">${health.linkDensity.toFixed(2)}</span><span class="metric-label">Density</span></div>
        <div class="metric"><span class="metric-value">${avgConf}</span><span class="metric-label">Avg Conf</span></div>
        <div class="metric"><span class="metric-value">${health.openQuestions}</span><span class="metric-label">Open Q's</span></div>
      </div>
    </div>`;
}

// ── Type distribution ────────────────────────────────────────────────

function renderTypeDistribution(byType: Record<string, number>): string {
  const maxCount = Math.max(...Object.values(byType), 1);
  let bars = '';
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    if (count === 0) continue;
    const pct = (count / maxCount) * 100;
    const color = NODE_COLORS[type as import('../../graph/types.js').NodeType] ?? '#999';
    bars += `<div class="type-bar-row">
      <span class="type-bar-label">${type}</span>
      <div class="type-bar-track"><div class="type-bar-fill" style="width:${pct}%;background:${color};"></div></div>
      <span class="type-bar-count">${count}</span>
    </div>`;
  }
  return `<div class="sidebar-section"><h4 class="sidebar-heading">Types</h4>${bars}</div>`;
}

// ── Status distribution ──────────────────────────────────────────────

function renderStatusDistribution(statusDist: Record<string, Record<string, number>>): string {
  let html = '<div class="sidebar-section"><h4 class="sidebar-heading">Status</h4>';
  for (const [type, statuses] of Object.entries(statusDist)) {
    const entries = Object.entries(statuses).filter(([, c]) => c > 0);
    if (entries.length === 0) continue;
    html += `<div style="margin-bottom:6px;"><span style="font-size:11px;color:#888;">${type}</span><div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">`;
    for (const [status, count] of entries) {
      html += `<span class="status-badge">${escapeHtml(status)} <b>${count}</b></span>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

// ── Gaps section (clickable navigation) ──────────────────────────────

function renderGaps(gapDetails: GapDetail[]): string {
  if (gapDetails.length === 0) return '';

  let html = '<div class="sidebar-section"><h4 class="sidebar-heading">Gaps</h4>';
  for (const gap of gapDetails) {
    const nodeLinks = gap.nodeIds.map((id) =>
      `<a href="#" class="gap-node-link" data-node-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`
    ).join(', ');
    html += `<div class="gap-item">
      <span class="gap-type">${escapeHtml(gap.type.replace(/_/g, ' '))}</span>
      <span class="gap-message">${escapeHtml(gap.message)}</span>
      <span class="gap-nodes">${nodeLinks}</span>
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Deferred items ───────────────────────────────────────────────────

function renderDeferred(items: string[]): string {
  if (items.length === 0) return '';
  const links = items.map((id) =>
    `<a href="#" class="gap-node-link" data-node-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`
  ).join(', ');
  return `<div class="sidebar-section"><h4 class="sidebar-heading">Deferred</h4><span class="gap-nodes">${links}</span></div>`;
}

// ── Promotion candidates ─────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  confidence: 'High confidence',
  de_facto: 'De facto usage',
  both: 'Confidence + usage',
};

function renderPromotionCandidates(candidates: PromoteCandidate[]): string {
  if (candidates.length === 0) return '';
  let html = '<div class="sidebar-section"><h4 class="sidebar-heading">Ready for Promotion</h4>';
  for (const c of candidates) {
    html += `<div class="promo-item">
      <a href="#" class="gap-node-link" data-node-id="${escapeHtml(c.id)}">${escapeHtml(c.id)}</a>
      <span style="font-size:11px;color:#888;">conf: ${(c.confidence * 100).toFixed(0)}% · ${c.supports} supports · ${escapeHtml(REASON_LABELS[c.reason] ?? c.reason)}</span>
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Consolidation triggers ───────────────────────────────────────────

function renderConsolidation(result: CheckResult): string {
  const hasTriggers = result.triggers.length > 0;
  const hasOrphans = result.orphanFindings.length > 0;
  const hasDeferred = result.deferredItems.length > 0;
  if (!hasTriggers && !hasOrphans && !hasDeferred) return '';

  let html = '<div class="sidebar-section"><h4 class="sidebar-heading">Consolidation Needed</h4>';

  for (const t of result.triggers) {
    html += `<div class="gap-item"><span class="gap-message">${escapeHtml(t.message)}</span></div>`;
  }

  if (hasOrphans) {
    const links = result.orphanFindings.map((id) =>
      `<a href="#" class="gap-node-link" data-node-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`
    ).join(', ');
    html += `<div style="margin-top:4px;font-size:11px;"><span style="color:#888;">Orphan findings:</span> ${links}</div>`;
  }

  if (hasDeferred) {
    const links = result.deferredItems.map((id) =>
      `<a href="#" class="gap-node-link" data-node-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`
    ).join(', ');
    html += `<div style="margin-top:4px;font-size:11px;"><span style="color:#888;">Deferred:</span> ${links}</div>`;
  }

  html += '</div>';
  return html;
}

// ── Wire click handlers ──────────────────────────────────────────────

function wireGapNavigation(container: HTMLElement, onNodeClick?: (id: string) => void): void {
  container.querySelectorAll('.gap-node-link').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const nodeId = (el as HTMLElement).dataset.nodeId;
      if (!nodeId) return;
      panToNode(nodeId);
      pulseNode(nodeId);
      onNodeClick?.(nodeId);
    });
  });
}

// ── Main render function ─────────────────────────────────────────────

export async function renderHealthSidebar(
  container: HTMLElement,
  callbacks?: { onNodeClick?: (id: string) => void },
): Promise<void> {
  // Fetch all data in parallel
  const [healthRes, promoRes, consolRes] = await Promise.all([
    fetch('/api/health'),
    fetch('/api/promotion-candidates'),
    fetch('/api/consolidation'),
  ]);

  const health: HealthReport = await healthRes.json();
  const { candidates }: { candidates: PromoteCandidate[] } = await promoRes.json();
  const consolidation: CheckResult = await consolRes.json();

  // Build sidebar HTML — prepend before filter section
  const healthHtml = `<div id="health-sidebar">
    ${renderMetrics(health)}
    ${renderTypeDistribution(health.byType)}
    ${renderStatusDistribution(health.statusDistribution)}
    ${renderGaps(health.gapDetails)}
    ${renderDeferred(health.deferredItems)}
    ${renderPromotionCandidates(candidates)}
    ${renderConsolidation(consolidation)}
    <hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
  </div>`;

  // Insert health section at the top of sidebar (before filters)
  const existing = container.querySelector('#health-sidebar');
  if (existing) existing.remove();

  container.insertAdjacentHTML('afterbegin', healthHtml);

  // Wire gap navigation clicks
  const healthEl = container.querySelector('#health-sidebar')!;
  wireGapNavigation(healthEl as HTMLElement, callbacks?.onNodeClick);
}
