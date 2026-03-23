import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SerializedGraph, SerializedNode, SerializedEdge } from './types.js';
import type { LayoutMode } from './frontend/graph.js';
import { POSITIVE_STATUSES, NEGATIVE_STATUSES, IN_PROGRESS_STATUSES, TERMINAL_STATUSES } from '../graph/types.js';

export interface ExportOptions {
  layout?: LayoutMode;
  types?: string[];
  statuses?: string[];
}

export interface ExportResult {
  html: string;
  nodeCount: number;
  edgeCount: number;
}

// ── Node visual encoding (mirrors frontend/graph.ts) ────────────────

const NODE_COLORS: Record<string, string> = {
  hypothesis: '#4A90D9',
  experiment: '#7B68EE',
  finding: '#50C878',
  knowledge: '#DAA520',
  question: '#FF8C42',
  episode: '#A0A0A0',
  decision: '#20B2AA',
};

function getStatusBorder(node: SerializedNode): { width: number; style: string; color: string } {
  if (node.invalid) return { width: 2, style: 'dashed', color: '#FF9800' };
  const s = node.status;
  if (POSITIVE_STATUSES.has(s)) return { width: 3, style: 'solid', color: '#2ECC71' };
  if (NEGATIVE_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#E74C3C' };
  if (IN_PROGRESS_STATUSES.has(s)) return { width: 2, style: 'solid', color: '#3498DB' };
  if (TERMINAL_STATUSES.has(s)) return { width: 2, style: 'dashed', color: '#95A5A6' };
  return { width: 1, style: 'solid', color: '#95A5A6' };
}

// ── Filter graph ────────────────────────────────────────────────────

function filterGraph(
  graph: SerializedGraph,
  options: ExportOptions,
): { nodes: SerializedNode[]; edges: SerializedEdge[] } {
  let nodes = graph.nodes;

  if (options.types && options.types.length > 0) {
    const typeSet = new Set(options.types);
    nodes = nodes.filter((n) => typeSet.has(n.type));
  }
  if (options.statuses && options.statuses.length > 0) {
    const statusSet = new Set(options.statuses);
    nodes = nodes.filter((n) => statusSet.has(n.status));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  return { nodes, edges };
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
  options: ExportOptions = {},
): ExportResult {
  const layout = options.layout ?? 'force';
  const { nodes, edges } = filterGraph(graph, options);

  // Build Cytoscape elements JSON
  const elements: Array<{ group: string; data: Record<string, unknown> }> = [];

  for (const node of nodes) {
    const border = getStatusBorder(node);
    const label = node.title.length > 20 ? node.title.slice(0, 19) + '…' : node.title || node.id;
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label,
        type: node.type,
        status: node.status,
        invalid: node.invalid ?? false,
        bgColor: NODE_COLORS[node.type] ?? '#999',
        borderWidth: border.width,
        borderStyle: border.style,
        borderColor: border.color,
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
  const elementsJson = JSON.stringify(elements);
  const layoutName = layout === 'hierarchical' ? 'dagre' : 'fcose';

  const layoutConfig = layout === 'hierarchical'
    ? `{ name: 'dagre', rankDir: 'TB', nodeSep: 50, rankSep: 80, animate: false, nodeDimensionsIncludeLabels: true }`
    : `{ name: 'fcose', animate: false, quality: 'proof', nodeDimensionsIncludeLabels: true }`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EMDD Graph Export</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;height:100vh;overflow:hidden;display:flex;flex-direction:column;background:#fafafa;color:#333}
#header{height:40px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;padding:0 16px;background:#fff;font-weight:600;font-size:14px;color:#555}
#header span{margin-left:8px;font-weight:400;font-size:12px;color:#999}
#cy{flex:1}
#detail{display:none;position:fixed;right:16px;top:56px;width:300px;max-height:calc(100vh - 72px);background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px;overflow-y:auto;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:10}
#detail h3{margin-bottom:8px;font-size:14px}
#detail .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:4px;color:#fff}
#detail .meta{font-size:12px;color:#666;margin-top:8px}
#detail .close{position:absolute;top:8px;right:12px;cursor:pointer;font-size:16px;color:#999}
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
var elements = ${elementsJson};
var cy = cytoscape({
  container: document.getElementById('cy'),
  elements: elements,
  style: [
    {selector:'node',style:{'background-color':'data(bgColor)','border-width':'data(borderWidth)','border-style':'data(borderStyle)','border-color':'data(borderColor)',label:'data(label)','font-size':'10px','text-valign':'bottom','text-margin-y':6,color:'#555',width:30,height:30}},
    {selector:'node[?invalid]',style:{'border-style':'dashed','border-color':'#FF9800','border-width':2}},
    {selector:'edge',style:{width:1.5,'line-color':'#ccc','target-arrow-color':'#ccc','target-arrow-shape':'triangle','curve-style':'bezier','arrow-scale':0.8}},
  ],
  layout: ${layoutConfig},
  wheelSensitivity: 0.3
});
cy.on('mouseover','edge',function(e){e.target.style('label',e.target.data('relation'));e.target.style('font-size','9px');e.target.style('color','#888');e.target.style('text-rotation','autorotate')});
cy.on('mouseout','edge',function(e){e.target.style('label','')});
var colors={hypothesis:'#4A90D9',experiment:'#7B68EE',finding:'#50C878',knowledge:'#DAA520',question:'#FF8C42',episode:'#A0A0A0',decision:'#20B2AA'};
cy.on('tap','node',function(e){
  var d=e.target.data();
  var h='<h3>'+d.title+'</h3>';
  h+='<span class="badge" style="background:'+(colors[d.type]||'#999')+'">'+d.type+'</span>';
  if(d.status)h+='<span class="badge" style="background:#666">'+d.status+'</span>';
  h+='<div class="meta">';
  h+='<b>ID:</b> '+d.id+'<br>';
  if(d.confidence!=null)h+='<b>Confidence:</b> '+(d.confidence*100).toFixed(0)+'%<br>';
  if(d.tags&&d.tags.length)h+='<b>Tags:</b> '+d.tags.join(', ')+'<br>';
  if(d.links&&d.links.length){h+='<b>Links:</b><ul>';d.links.forEach(function(l){h+='<li>'+l.relation+' → '+l.target+'</li>'});h+='</ul>'}
  if(d.invalid)h+='<br><b style="color:#FF9800">⚠ Invalid node:</b> '+d.title;
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
