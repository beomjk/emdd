/**
 * Generates docs/assets/demo.svg — a 3-panel storyboard showing
 * Setup → AI Session Cycle → Knowledge Graph.
 *
 * Run: tsx scripts/generate-demo-svg.ts
 *      npm run demo:svg
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_COLORS } from '../src/web/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../docs/assets/demo.svg');

// ── Layout constants ────────────────────────────────────────────────

const PAD = 16;
const PANEL_W = 260;
const PANEL_H = 310;
const PANEL_R = 8;
const GAP = 24;
const ARROW_W = 14;
const TOTAL_W = PAD * 2 + PANEL_W * 3 + (GAP + ARROW_W + GAP) * 2;
const TOTAL_H = PAD * 2 + PANEL_H;

const P1_X = PAD;
const P2_X = PAD + PANEL_W + GAP + ARROW_W + GAP;
const P3_X = PAD + (PANEL_W + GAP + ARROW_W + GAP) * 2;
const PANEL_Y = PAD;

// ── Color palette (Tokyo Night) ─────────────────────────────────────

const C = {
  bg:          '#1a1b26',
  panelBg:     '#24273a',
  panelBorder: '#3b3f5c',
  text:        '#c0caf5',
  textMuted:   '#a9b1d6',
  dim:         '#565f89',
  cmd:         '#7dcfff',
  success:     '#9ece6a',
  header:      '#bb9af7',
  badge:       '#7aa2f7',
  accent:      '#ff9e64',
  arrow:       '#565f89',
  separator:   '#3b3f5c',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function text(
  x: number, y: number, content: string,
  opts: { fill?: string; size?: number; family?: 'mono' | 'sans'; weight?: string; anchor?: string } = {},
): string {
  const fill = opts.fill ?? C.text;
  const size = opts.size ?? 11;
  const cls = opts.family === 'sans' ? 'sans' : 'mono';
  const weight = opts.weight ? ` font-weight="${opts.weight}"` : '';
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" class="${cls}"${weight}${anchor}>${esc(content)}</text>`;
}

function rect(
  x: number, y: number, w: number, h: number,
  opts: { fill?: string; rx?: number; stroke?: string; strokeW?: number; opacity?: number } = {},
): string {
  const fill = opts.fill ?? C.panelBg;
  const rx = opts.rx ?? 0;
  const stroke = opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.strokeW ?? 1}"` : '';
  const opacity = opts.opacity != null ? ` opacity="${opts.opacity}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke}${opacity}/>`;
}

function circle(cx: number, cy: number, r: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

// ── Panel badge (circled number) ────────────────────────────────────

function badge(x: number, y: number, num: number): string {
  return [
    circle(x, y, 10, C.badge),
    `<text x="${x}" y="${y + 4}" fill="#1a1b26" font-size="11" class="sans" font-weight="bold" text-anchor="middle">${num}</text>`,
  ].join('\n');
}

// ── Panel frame ─────────────────────────────────────────────────────

function panelFrame(x: number, y: number, title: string, num: number): string {
  return [
    rect(x, y, PANEL_W, PANEL_H, { rx: PANEL_R, stroke: C.panelBorder }),
    badge(x + 18, y + 20, num),
    text(x + 34, y + 24, title, { fill: C.header, size: 12, family: 'sans', weight: 'bold' }),
  ].join('\n');
}

// ── Arrow between panels ────────────────────────────────────────────

function panelArrow(fromPanelX: number): string {
  const x = fromPanelX + PANEL_W + GAP;
  const y = PANEL_Y + PANEL_H / 2;
  return `<path d="M${x},${y} l${ARROW_W - 5},0 l-4,-4 m4,4 l-4,4" stroke="${C.arrow}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ── Panel 1: Setup ──────────────────────────────────────────────────

function buildPanel1(): string {
  const x = P1_X;
  const y = PANEL_Y;
  const lx = x + 14;
  const lh = 15;

  const parts: string[] = [panelFrame(x, y, 'Setup', 1)];

  // Terminal area background (includes chrome)
  const termY = y + 38;
  const termH = 118;
  parts.push(
    rect(x + 8, termY, PANEL_W - 16, termH, { fill: '#1a1b26', rx: 6 }),
  );

  // Terminal chrome (traffic light dots inside terminal)
  const dotY = termY + 12;
  parts.push(
    circle(x + 22, dotY, 4, '#ff5f58'),
    circle(x + 34, dotY, 4, '#ffbd2e'),
    circle(x + 46, dotY, 4, '#18c132'),
  );

  // CLI output inside terminal area
  let ly = termY + 30;
  parts.push(
    text(lx + 4, ly, '$', { fill: C.success, size: 10 }),
    text(lx + 16, ly, 'emdd init my-research \\', { fill: C.cmd, size: 10 }),
    text(lx + 16, ly += lh, '  --tool claude', { fill: C.cmd, size: 10 }),
    text(lx + 4, ly += lh * 1.4, '\u2714 EMDD project initialized', { fill: C.success, size: 9.5 }),
    text(lx + 4, ly += lh, "\u2714 Rules generated for claude", { fill: C.success, size: 9.5 }),
  );

  // Separator
  const sepY = termY + termH + 12;
  parts.push(
    `<line x1="${x + 20}" y1="${sepY}" x2="${x + PANEL_W - 20}" y2="${sepY}" stroke="${C.separator}" stroke-width="0.5" stroke-dasharray="4,3"/>`,
  );

  // What's next section — guidance for the user
  ly = sepY + 20;
  parts.push(
    text(lx, ly, "What's next?", { fill: C.text, size: 11, weight: 'bold' }),

    text(lx + 2, ly += lh * 1.3, '\u25B8 Connect your AI via MCP', { fill: C.accent, size: 9.5 }),
    text(lx + 10, ly += lh, 'claude mcp add emdd \\', { fill: C.cmd, size: 9 }),
    text(lx + 10, ly += lh * 0.9, '  -- npx @beomjk/emdd mcp', { fill: C.cmd, size: 9 }),

    text(lx + 2, ly += lh * 1.5, '\u25B8 Then ask your AI:', { fill: C.accent, size: 9.5 }),
    text(lx + 10, ly += lh, '"Load the EMDD context', { fill: C.textMuted, size: 9.5 }),
    text(lx + 10, ly += lh * 0.9, ' and start the first session."', { fill: C.textMuted, size: 9.5 }),
  );

  return `<g>${parts.join('\n')}</g>`;
}

// ── Panel 2: AI Session Cycle ───────────────────────────────────────

function buildPanel2(): string {
  const x = P2_X;
  const y = PANEL_Y;

  const boxW = 170;
  const boxH = 36;
  const loopSpace = 30;  // space reserved for repeat arrow on right
  const bx = x + (PANEL_W - boxW - loopSpace) / 2;  // shift left to visually center with repeat arrow
  const startY = y + 48;

  interface Step {
    name: string;
    label: string;
    fill: string;
    dimmed?: boolean;
  }

  const steps: Step[] = [
    { name: 'context-loading',   label: 'Session Start',  fill: '#2d4f7c' },
    { name: 'your work',         label: '',               fill: 'none', dimmed: true },
    { name: 'episode-creation',  label: 'Session End',    fill: '#3d2d5c' },
    { name: 'consolidation',     label: 'Maintenance',    fill: '#2d4a3d' },
    { name: 'health-review',     label: 'Review',         fill: '#4a3d2d' },
  ];

  const parts: string[] = [panelFrame(x, y, 'AI Session Cycle', 2)];

  // Render steps and collect positions
  let cy = startY;
  const stepMids: { cx: number; top: number; bot: number; dimmed?: boolean }[] = [];
  const centerX = bx + boxW / 2;

  for (const step of steps) {
    if (step.dimmed) {
      // "your work" hint — dotted border box, dim text
      const hintH = 24;
      const hintY = cy + 8;
      const hintPad = 15;
      parts.push(
        `<rect x="${bx + hintPad}" y="${hintY}" width="${boxW - hintPad * 2}" height="${hintH}" rx="4" fill="none" stroke="${C.dim}" stroke-width="1" stroke-dasharray="4,3"/>`,
        text(centerX, hintY + 16, '\u00b7 \u00b7  your work  \u00b7 \u00b7', {
          fill: C.dim, size: 9.5, family: 'sans', anchor: 'middle',
        }),
      );
      stepMids.push({ cx: centerX, top: hintY, bot: hintY + hintH, dimmed: true });
      cy += hintH + 24;
    } else {
      parts.push(
        rect(bx, cy, boxW, boxH, { fill: step.fill, rx: 6 }),
        text(centerX, cy + 15, step.name, {
          fill: C.text, size: 10.5, family: 'mono', weight: 'bold', anchor: 'middle',
        }),
        text(centerX, cy + 28, step.label, {
          fill: C.textMuted, size: 8.5, family: 'sans', anchor: 'middle',
        }),
      );
      stepMids.push({ cx: centerX, top: cy, bot: cy + boxH });
      cy += boxH + 14;
    }
  }

  // Arrows between ALL consecutive steps (including to/from "your work")
  for (let i = 0; i < stepMids.length - 1; i++) {
    const from = stepMids[i];
    const to = stepMids[i + 1];
    const fromY = from.bot + 2;
    const toY = to.top - 2;
    parts.push(
      `<path d="M${centerX},${fromY} L${centerX},${toY}" stroke="${C.dim}" stroke-width="1.2" marker-end="url(#arrowDown)"/>`,
    );
  }

  // Repeat arrow: right side, from health-review back to context-loading
  const first = stepMids[0];
  const last = stepMids[stepMids.length - 1];
  const loopX = bx + boxW + 16;
  const loopTop = first.top + (first.bot - first.top) / 2;
  const loopBot = last.top + (last.bot - last.top) / 2;
  parts.push(
    // Dashed path (no marker — manual arrowhead instead)
    `<path d="M${bx + boxW + 1},${loopBot} L${loopX},${loopBot} L${loopX},${loopTop} L${bx + boxW + 4},${loopTop}" stroke="${C.dim}" stroke-width="1" stroke-dasharray="3,3" fill="none"/>`,
    // Manual arrowhead pointing LEFT at context-loading box edge
    `<path d="M${bx + boxW + 8},${loopTop - 4} L${bx + boxW + 1},${loopTop} L${bx + boxW + 8},${loopTop + 4}" stroke="${C.dim}" stroke-width="1.2" fill="none"/>`,
    text(loopX + 5, (loopTop + loopBot) / 2 + 3, 'repeat', { fill: C.dim, size: 7.5, family: 'sans' }),
  );

  return `<g>${parts.join('\n')}</g>`;
}

// ── Panel 3: Knowledge Graph ────────────────────────────────────────

function buildPanel3(): string {
  const x = P3_X;
  const y = PANEL_Y;

  interface GNode { id: string; type: string; cx: number; cy: number; label: string }

  const nodes: GNode[] = [
    { id: 'knw', type: 'knowledge', cx: 80,  cy: 58,  label: 'knw' },
    { id: 'h1',  type: 'hypothesis', cx: 50,  cy: 108, label: 'hyp' },
    { id: 'h2',  type: 'hypothesis', cx: 175, cy: 85,  label: 'hyp' },
    { id: 'e1',  type: 'experiment', cx: 90,  cy: 155, label: 'exp' },
    { id: 'q1',  type: 'question',   cx: 205, cy: 135, label: 'qst' },
    { id: 'f1',  type: 'finding',    cx: 55,  cy: 205, label: 'fnd' },
    { id: 'f2',  type: 'finding',    cx: 145, cy: 195, label: 'fnd' },
    { id: 'd1',  type: 'decision',   cx: 195, cy: 205, label: 'dec' },
  ];

  const edges: [string, string][] = [
    ['knw', 'h1'], ['knw', 'h2'],
    ['h1', 'e1'], ['h2', 'q1'],
    ['e1', 'f1'], ['e1', 'f2'],
    ['f1', 'd1'], ['f2', 'd1'],
    ['q1', 'f2'],
  ];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const R = 13;

  const parts: string[] = [panelFrame(x, y, 'Knowledge Graph', 3)];

  // Edges (center-to-center)
  for (const [fromId, toId] of edges) {
    const from = nodeMap.get(fromId)!;
    const to = nodeMap.get(toId)!;
    parts.push(
      `<line x1="${x + from.cx}" y1="${y + from.cy}" x2="${x + to.cx}" y2="${y + to.cy}" stroke="${C.panelBorder}" stroke-width="1.2" opacity="0.5"/>`,
    );
  }

  // Nodes
  for (const node of nodes) {
    const color = NODE_COLORS[node.type as keyof typeof NODE_COLORS] ?? '#999';
    parts.push(
      circle(x + node.cx, y + node.cy, R, color),
      text(x + node.cx, y + node.cy + 3.5, node.label, {
        fill: '#1a1b26', size: 7.5, family: 'sans', weight: 'bold', anchor: 'middle',
      }),
    );
  }

  // Legend (2 columns at bottom, vertically centered circle+text)
  const legendY = y + 240;
  const legendTypes = [
    ['hypothesis', 'experiment', 'finding'],
    ['question', 'knowledge', 'decision'],
  ];
  const colW = 120;

  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < legendTypes[col].length; row++) {
      const type = legendTypes[col][row];
      const lx = x + 22 + col * colW;
      const ly = legendY + row * 17;
      const color = NODE_COLORS[type as keyof typeof NODE_COLORS] ?? '#999';
      parts.push(
        circle(lx, ly, 4.5, color),
        // +1 offset instead of +3.5 for proper vertical centering with small text
        text(lx + 10, ly + 3, type, { fill: C.dim, size: 8.5, family: 'sans' }),
      );
    }
  }

  return `<g>${parts.join('\n')}</g>`;
}

// ── Assemble SVG ────────────────────────────────────────────────────

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOTAL_W} ${TOTAL_H}" role="img" aria-labelledby="demo-title demo-desc">
<title id="demo-title">EMDD Demo: Setup, AI Session Cycle, and Knowledge Graph</title>
<desc id="demo-desc">Three-panel storyboard: (1) Initialize an EMDD project and connect an AI assistant via MCP, (2) Follow the 4-step session cycle — context-loading, episode-creation, consolidation, health-review, (3) Build an evolving knowledge graph with typed nodes and edges.</desc>
<defs>
  <marker id="arrowDown" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
    <path d="M0,0 L4,3 L0,6" fill="none" stroke="${C.dim}" stroke-width="1"/>
  </marker>
  <marker id="arrowLeft" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto">
    <path d="M8,0 L2,3 L8,6" fill="none" stroke="${C.dim}" stroke-width="1"/>
  </marker>
</defs>
<style>
  .mono { font-family: 'SF Mono','Menlo','Consolas','Monaco',monospace; }
  .sans { font-family: -apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif; }
</style>
${rect(0, 0, TOTAL_W, TOTAL_H, { fill: C.bg, rx: 12 })}
${buildPanel1()}
${panelArrow(P1_X)}
${buildPanel2()}
${panelArrow(P2_X)}
${buildPanel3()}
</svg>
`;

writeFileSync(outPath, svg.trim(), 'utf-8');
const sizeKB = (Buffer.byteLength(svg, 'utf-8') / 1024).toFixed(1);
console.log(`\u2714 Generated ${outPath} (${sizeKB} KB)`);
