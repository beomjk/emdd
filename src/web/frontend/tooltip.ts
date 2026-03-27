import { getNodeColor } from './constants.js';

interface TooltipData {
  title: string;
  type: string;
  status?: string;
  confidence?: number;
  tags?: string[];
  bodyPreview?: string;
}

let tooltipEl: HTMLElement | null = null;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function showTooltip(
  data: TooltipData,
  renderedPos: { x: number; y: number },
  container: HTMLElement,
): void {
  hideTooltip();

  const el = document.createElement('div');
  el.className = 'node-tooltip';

  let html = `<div class="node-tooltip-title">${escapeHtml(data.title)}</div>`;

  // Badges
  const typeColor = getNodeColor(data.type);
  html += '<div class="node-tooltip-badges">';
  html += `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${typeColor};color:#fff;font-size:10px;font-weight:600;">${escapeHtml(data.type)}</span>`;
  if (data.status) {
    html += `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:var(--bg-badge);color:var(--text-secondary);font-size:10px;">${escapeHtml(data.status)}</span>`;
  }
  html += '</div>';

  // Confidence
  if (data.confidence != null) {
    const pct = Math.round(data.confidence * 100);
    html += `<div class="node-tooltip-confidence">Confidence: ${pct}%</div>`;
  }

  // Tags (max 3)
  if (data.tags && data.tags.length > 0) {
    const shown = data.tags.slice(0, 3);
    html += '<div class="node-tooltip-tags">';
    for (const tag of shown) {
      html += `<span class="node-tooltip-tag">${escapeHtml(tag)}</span>`;
    }
    if (data.tags.length > 3) {
      html += `<span class="node-tooltip-tag">+${data.tags.length - 3}</span>`;
    }
    html += '</div>';
  }

  // Body preview
  if (data.bodyPreview) {
    html += `<div class="node-tooltip-body">${escapeHtml(data.bodyPreview)}</div>`;
  }

  el.innerHTML = html;
  container.appendChild(el);
  tooltipEl = el;

  // Position with viewport clamping
  const rect = container.getBoundingClientRect();
  const tooltipRect = el.getBoundingClientRect();

  let left = renderedPos.x + 15;
  let top = renderedPos.y - tooltipRect.height / 2;

  // Clamp right edge
  if (left + tooltipRect.width > rect.width) {
    left = renderedPos.x - tooltipRect.width - 15;
  }
  // Clamp bottom
  if (top + tooltipRect.height > rect.height) {
    top = rect.height - tooltipRect.height - 8;
  }
  // Clamp left
  if (left < 0) {
    left = 8;
  }
  // Clamp top
  if (top < 0) {
    top = 8;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}
