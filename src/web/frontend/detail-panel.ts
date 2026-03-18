import type { SerializedNode } from '../types.js';

interface NodeDetailResponse {
  id: string;
  title: string;
  type: string;
  status?: string;
  confidence?: number;
  tags?: string[];
  links?: { target: string; relation: string }[];
  body?: string | null;
  created?: string;
  updated?: string;
  invalid?: boolean;
  parseError?: string;
}

let currentDepth = 2;
let onDepthChange: ((depth: number) => void) | null = null;

export function setDepthChangeHandler(handler: (depth: number) => void): void {
  onDepthChange = handler;
}

export function getCurrentDepth(): number {
  return currentDepth;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(md: string): string {
  // Basic markdown → HTML: headings, bold, italic, lists, code
  return md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function typeBadge(type: string): string {
  const colors: Record<string, string> = {
    hypothesis: '#4A90D9',
    experiment: '#7B68EE',
    finding: '#50C878',
    knowledge: '#DAA520',
    question: '#FF8C42',
    episode: '#A0A0A0',
    decision: '#20B2AA',
  };
  const color = colors[type] ?? '#999';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;background:${color};color:#fff;font-size:11px;font-weight:600;">${type}</span>`;
}

function statusBadge(status: string): string {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;background:#eee;color:#555;font-size:11px;font-weight:500;">${status}</span>`;
}

function confidenceBar(value: number): string {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#2ECC71' : pct >= 50 ? '#F39C12' : '#E74C3C';
  return `<div style="margin:4px 0;">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#888;"><span>Confidence</span><span>${pct}%</span></div>
    <div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
    </div>
  </div>`;
}

export async function showDetailPanel(nodeId: string): Promise<void> {
  const panel = document.getElementById('detail-panel')!;
  panel.classList.add('open');

  const res = await fetch(`/api/node/${nodeId}`);
  if (!res.ok) {
    panel.innerHTML = `<p style="color:#999;">Node not found: ${escapeHtml(nodeId)}</p>`;
    return;
  }

  const node: NodeDetailResponse = await res.json();

  if (node.invalid) {
    panel.innerHTML = `
      <div style="margin-bottom:12px;">
        <h3 style="font-size:15px;margin-bottom:4px;">${escapeHtml(node.title || node.id)}</h3>
        <div style="margin:6px 0;">${typeBadge(node.type)}</div>
        <div style="padding:12px;background:#fff3e0;border:1px solid #FF9800;border-radius:4px;margin-top:12px;">
          <strong style="color:#e65100;">⚠ Invalid Node</strong>
          <p style="margin-top:4px;font-size:12px;color:#555;">${escapeHtml(node.parseError ?? 'Unknown error')}</p>
        </div>
      </div>`;
    return;
  }

  let html = `<div style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#999;">${escapeHtml(node.id)}</span>
      <button id="detail-close" style="border:none;background:none;cursor:pointer;font-size:16px;color:#999;">✕</button>
    </div>
    <h3 style="font-size:15px;margin:4px 0;">${escapeHtml(node.title)}</h3>
    <div style="margin:6px 0;display:flex;gap:6px;">
      ${typeBadge(node.type)}
      ${node.status ? statusBadge(node.status) : ''}
    </div>`;

  if (node.confidence != null) {
    html += confidenceBar(node.confidence);
  }

  if (node.tags && node.tags.length > 0) {
    html += `<div style="margin:8px 0;">${node.tags.map((t) => `<span style="display:inline-block;padding:1px 6px;margin:2px;border-radius:2px;background:#f0f0f0;font-size:11px;">${escapeHtml(t)}</span>`).join('')}</div>`;
  }

  // Hop depth buttons
  html += `<div style="margin:10px 0;display:flex;gap:4px;align-items:center;">
    <span style="font-size:11px;color:#888;">Local graph:</span>
    ${[1, 2, 3].map((d) => `<button class="hop-btn" data-depth="${d}" style="padding:2px 8px;border:1px solid ${d === currentDepth ? '#3498DB' : '#ccc'};border-radius:3px;background:${d === currentDepth ? '#3498DB' : '#fff'};color:${d === currentDepth ? '#fff' : '#555'};cursor:pointer;font-size:11px;">${d} hop</button>`).join('')}
  </div>`;

  // Linked nodes
  if (node.links && node.links.length > 0) {
    html += `<div style="margin:10px 0;"><strong style="font-size:12px;">Links</strong>`;
    for (const link of node.links) {
      html += `<div style="margin:3px 0;font-size:12px;">
        <a href="#" class="link-to-node" data-id="${escapeHtml(link.target)}" style="color:#3498DB;text-decoration:none;">${escapeHtml(link.target)}</a>
        <span style="color:#aaa;font-size:11px;">${escapeHtml(link.relation)}</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Markdown body
  if (node.body) {
    html += `<hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
      <div style="font-size:12px;line-height:1.5;">${renderMarkdown(node.body)}</div>`;
  }

  html += `</div>`;
  panel.innerHTML = html;

  // Wire close button
  panel.querySelector('#detail-close')?.addEventListener('click', () => hideDetailPanel());

  // Wire hop buttons
  panel.querySelectorAll('.hop-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const depth = parseInt((e.target as HTMLElement).dataset.depth ?? '2', 10);
      currentDepth = depth;
      onDepthChange?.(depth);
      // Update button styles
      panel.querySelectorAll('.hop-btn').forEach((b) => {
        const d = parseInt((b as HTMLElement).dataset.depth ?? '0', 10);
        (b as HTMLElement).style.border = `1px solid ${d === depth ? '#3498DB' : '#ccc'}`;
        (b as HTMLElement).style.background = d === depth ? '#3498DB' : '#fff';
        (b as HTMLElement).style.color = d === depth ? '#fff' : '#555';
      });
    });
  });

  // Wire linked node clicks
  panel.querySelectorAll('.link-to-node').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = (e.target as HTMLElement).dataset.id;
      if (id) showDetailPanel(id);
    });
  });
}

export function hideDetailPanel(): void {
  const panel = document.getElementById('detail-panel')!;
  panel.classList.remove('open');
  panel.innerHTML = '';
}
