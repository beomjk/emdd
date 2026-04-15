import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type {
  SerializedGraph,
  SerializedNode,
  SerializedEdge,
  ExportRenderOptions,
  VisualCluster,
} from './types.js';
import { NODE_COLORS, getGraphThemeTokens } from './constants.js';
import {
  getClusterVisualState,
  getNodeVisualState,
  resolveGraphTheme,
} from './visual-state.js';

export interface ExportResult {
  html: string;
  nodeCount: number;
  edgeCount: number;
}

// ── HTML escaping for export ────────────────────────────────────────

/** Escape angle brackets in strings embedded inside `<script>` blocks.
 *  Replacing `<` with `\u003c` prevents the HTML5 parser from entering
 *  "script data escaped state" via `<!--` or `<script` sequences, and
 *  also prevents the classic `</script>` breakout. */
function escapeScriptContent(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

// ── Filter graph ────────────────────────────────────────────────────

function filterGraph(
  graph: SerializedGraph,
  options: ExportRenderOptions,
): { nodes: SerializedNode[]; edges: SerializedEdge[] } {
  let nodes = graph.nodes;

  if (options.types) {
    const typeSet = new Set(options.types);
    nodes = nodes.filter((n) => typeSet.has(n.type));
  }
  if (options.statuses) {
    const statusSet = new Set(options.statuses);
    // Mirror the frontend's `|| !status` fallback: nodes without a status
    // field (coerced to '' by cache.ts) stay visible regardless of filter.
    nodes = nodes.filter((n) => !n.status || statusSet.has(n.status));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  let edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );
  if (options.edgeTypes) {
    const edgeTypeSet = new Set(options.edgeTypes);
    edges = edges.filter((e) => edgeTypeSet.has(e.relation));
  }

  return { nodes, edges };
}

function filterClusters(
  clusters: VisualCluster[] | undefined,
  visibleNodeIds: Set<string>,
): VisualCluster[] {
  if (!clusters) return [];

  return clusters
    .map((cluster) => ({
      ...cluster,
      nodeIds: cluster.nodeIds.filter((nodeId) => visibleNodeIds.has(nodeId)),
    }))
    .filter((cluster) => cluster.nodeIds.length > 0);
}

// ── Read bundled JS from node_modules ───────────────────────────────

function readVendorBundle(): string {
  const require = createRequire(import.meta.url);
  const cytoscapePath = require.resolve('cytoscape/dist/cytoscape.min.js');
  const fcosePath = require.resolve('cytoscape-fcose/cytoscape-fcose.js');
  const dagrePath = require.resolve('cytoscape-dagre/cytoscape-dagre.js');

  const cytoscape = fs.readFileSync(cytoscapePath, 'utf-8');
  const fcose = fs.readFileSync(fcosePath, 'utf-8');
  const dagre = fs.readFileSync(dagrePath, 'utf-8');

  return `${cytoscape}\n${fcose}\n${dagre}`;
}

// ── Generate standalone HTML ────────────────────────────────────────

export function generateExportHtml(
  graph: SerializedGraph,
  options: ExportRenderOptions = {},
): ExportResult {
  const layout = options.layout ?? 'force';
  const theme = resolveGraphTheme(options.theme);
  const themeTokens = getGraphThemeTokens(theme);
  const { nodes, edges } = filterGraph(graph, options);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const clusters = filterClusters(options.clusters, visibleNodeIds);
  const exportThemeColors = theme === 'dark'
    ? {
      pageBg: '#0f172a',
      panelBg: '#111827',
      panelBorder: '#334155',
      headerText: '#e2e8f0',
      mutedText: '#94a3b8',
      edgeColor: '#64748b',
      badgeColor: '#475569',
      shadow: 'rgba(2, 6, 23, 0.45)',
    }
    : {
      pageBg: '#f8fafc',
      panelBg: '#ffffff',
      panelBorder: '#d9e2ec',
      headerText: '#334155',
      mutedText: '#64748b',
      edgeColor: '#94a3b8',
      badgeColor: '#475569',
      shadow: 'rgba(15, 23, 42, 0.12)',
    };

  // Build Cytoscape elements JSON
  const elements: Array<{ group: string; data: Record<string, unknown> }> = [];
  const parentByNodeId = new Map<string, string>();

  for (const cluster of clusters) {
    const visualState = getClusterVisualState({
      theme,
      isManual: cluster.isManual,
    });
    elements.push({
      group: 'nodes',
      data: {
        id: cluster.id,
        label: cluster.label,
        isCluster: true,
        isManual: cluster.isManual,
        bgColor: visualState.fillColor,
        borderWidth: visualState.borderWidth,
        borderStyle: visualState.borderStyle,
        borderColor: visualState.borderColor,
        textColor: visualState.textColor,
        labelBgColor: themeTokens.groupLabelBg,
      },
    });

    for (const nodeId of cluster.nodeIds) {
      if (!parentByNodeId.has(nodeId)) {
        parentByNodeId.set(nodeId, cluster.id);
      }
    }
  }

  for (const node of nodes) {
    const visualState = getNodeVisualState(node, { theme });
    const label = node.title.length > 20 ? node.title.slice(0, 19) + '…' : node.title || node.id;
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label,
        parent: parentByNodeId.get(node.id),
        type: node.type,
        status: node.status,
        invalid: node.invalid ?? false,
        bgColor: visualState.fillColor,
        borderWidth: visualState.borderWidth,
        borderStyle: visualState.borderStyle,
        borderColor: visualState.borderColor,
        textColor: visualState.textColor,
        title: node.title,
        confidence: node.confidence,
        tags: node.tags,
        links: node.links,
      },
    });
  }

  for (const edge of edges) {
    elements.push({
      group: 'edges',
      data: {
        id: `${edge.source}-${edge.relation}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
      },
    });
  }

  const vendorJs = readVendorBundle();
  const elementsJson = escapeScriptContent(JSON.stringify(elements));
  const exportStateJson = escapeScriptContent(JSON.stringify({
    layout,
    theme,
    filters: {
      types: options.types ?? [],
      statuses: options.statuses ?? [],
      edgeTypes: options.edgeTypes ?? [],
    },
  }));
  const layoutConfig = layout === 'hierarchical'
    ? `{ name: 'dagre', rankDir: 'TB', nodeSep: 50, rankSep: 80, animate: false, nodeDimensionsIncludeLabels: true }`
    : `{ name: 'fcose', animate: false, quality: 'proof', nodeDimensionsIncludeLabels: true }`;

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EMDD Graph Export</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{color-scheme:${theme};--export-bg:${exportThemeColors.pageBg};--export-panel:${exportThemeColors.panelBg};--export-border:${exportThemeColors.panelBorder};--export-text:${themeTokens.nodeText};--export-header:${exportThemeColors.headerText};--export-muted:${exportThemeColors.mutedText};--export-edge:${exportThemeColors.edgeColor};--export-badge:${exportThemeColors.badgeColor};--export-shadow:${exportThemeColors.shadow}}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;height:100vh;overflow:hidden;display:flex;flex-direction:column;background:var(--export-bg);color:var(--export-text)}
#header{height:40px;border-bottom:1px solid var(--export-border);display:flex;align-items:center;padding:0 16px;background:var(--export-panel);font-weight:600;font-size:14px;color:var(--export-header)}
#header span{margin-left:8px;font-weight:400;font-size:12px;color:var(--export-muted)}
#cy{flex:1}
#detail{display:none;position:fixed;right:16px;top:56px;width:300px;max-height:calc(100vh - 72px);background:var(--export-panel);border:1px solid var(--export-border);border-radius:8px;padding:16px;overflow-y:auto;box-shadow:0 8px 24px var(--export-shadow);z-index:10;color:var(--export-text)}
#detail h3{margin-bottom:8px;font-size:14px}
#detail .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:4px;color:#fff}
#detail .meta{font-size:12px;color:var(--export-muted);margin-top:8px}
#detail .close{position:absolute;top:8px;right:12px;cursor:pointer;font-size:16px;color:var(--export-muted)}
</style>
</head>
<body>
<div id="header">EMDD Graph Export<span>${nodes.length} nodes, ${edges.length} edges &middot; ${new Date().toLocaleDateString()}</span></div>
<div id="cy"></div>
<div id="detail"><span class="close" onclick="document.getElementById('detail').style.display='none'">&times;</span><div id="detail-content"></div></div>
<script>
${vendorJs}
</script>
<script>
(function(){
cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);
var exportState = ${exportStateJson};
var elements = ${elementsJson};
var cy = cytoscape({
  container: document.getElementById('cy'),
  elements: elements,
  style: [
    {selector:'node',style:{'background-color':'data(bgColor)','border-width':'data(borderWidth)','border-style':'data(borderStyle)','border-color':'data(borderColor)',label:'data(label)','font-size':'10px','text-valign':'bottom','text-margin-y':6,color:'data(textColor)',width:30,height:30}},
    {selector:'node[?invalid]',style:{'border-style':'dashed','border-color':'#FF9800','border-width':2}},
    {selector:'node[?isCluster]',style:{'background-color':'data(bgColor)','background-opacity':1,'border-width':'data(borderWidth)','border-color':'data(borderColor)','border-style':'data(borderStyle)',shape:'roundrectangle',label:'data(label)','font-size':'12px','text-valign':'top','text-halign':'center','text-margin-y':-8,color:'data(textColor)','font-weight':'bold','text-background-color':'data(labelBgColor)','text-background-opacity':1,'text-background-padding':4,padding:'16px','min-width':'80px','min-height':'60px'}},
    {selector:'edge',style:{width:1.5,'line-color':'${exportThemeColors.edgeColor}','target-arrow-color':'${exportThemeColors.edgeColor}','target-arrow-shape':'triangle','curve-style':'bezier','arrow-scale':0.8}},
  ],
  layout: ${layoutConfig},
  wheelSensitivity: 0.3
});
cy.on('tap','node[?isCluster]',function(e){
  var children = e.target.children();
  if (children.length) {
    cy.animate({fit:{eles:children,padding:40}},{duration:500});
  }
});
cy.on('mouseover','edge',function(e){e.target.style('label',e.target.data('relation'));e.target.style('font-size','9px');e.target.style('color','${exportThemeColors.mutedText}');e.target.style('text-rotation','autorotate')});
cy.on('mouseout','edge',function(e){e.target.style('label','')});
var colors=${escapeScriptContent(JSON.stringify(NODE_COLORS))};
function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
cy.on('tap','node[!isCluster]',function(e){
  var d=e.target.data();
  var h='<h3>'+esc(d.title)+'</h3>';
  h+='<span class="badge" style="background:'+(colors[d.type]||'#999')+'">'+esc(d.type)+'</span>';
  if(d.status)h+='<span class="badge" style="background:${exportThemeColors.badgeColor}">'+esc(d.status)+'</span>';
  h+='<div class="meta">';
  h+='<b>ID:</b> '+esc(d.id)+'<br>';
  if(d.confidence!=null)h+='<b>Confidence:</b> '+(d.confidence*100).toFixed(0)+'%<br>';
  if(d.tags&&d.tags.length)h+='<b>Tags:</b> '+esc(d.tags.join(', '))+'<br>';
  if(d.links&&d.links.length){h+='<b>Links:</b><ul>';d.links.forEach(function(l){h+='<li>'+esc(l.relation)+' \u2192 '+esc(l.target)+'</li>'});h+='</ul>'}
  if(d.invalid)h+='<br><b style="color:#FF9800">\u26a0 Invalid node:</b> '+esc(d.title);
  h+='</div>';
  document.getElementById('detail-content').innerHTML=h;
  document.getElementById('detail').style.display='block';
});
cy.on('tap',function(e){if(e.target===cy)document.getElementById('detail').style.display='none'});
})();
</script>
</body>
</html>`;

  return { html, nodeCount: nodes.length, edgeCount: edges.length };
}
