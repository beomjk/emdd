export const messages: Record<string, string> = {
  // Health dashboard
  'health.title': 'EMDD Health Dashboard',
  'health.total_nodes': 'Total Nodes',
  'health.by_type': 'By Type',
  'health.hypothesis_status': 'Hypothesis Status',
  'health.avg_confidence': 'Average Confidence',
  'health.open_questions': 'Open Questions',
  'health.orphan_findings': 'Orphan Findings',
  'health.link_density': 'Link Density',
  'health.recent_activity': 'Recent Activity',
  'health.gaps': 'Structural Gaps',

  // CLI descriptions
  'cli.description': 'CLI for Evolving Mindmap-Driven Development',
  'cli.init.desc': 'Initialize EMDD project',
  'cli.new.desc': 'Create a new node',
  'cli.health.desc': 'Show health dashboard',
  'cli.check.desc': 'Check consolidation triggers',
  'cli.lint.desc': 'Validate graph schema and links',
  'cli.promote.desc': 'Identify promotion candidates',
  'cli.index.desc': 'Generate _index.md',
  'cli.graph.desc': 'Generate _graph.mmd',
  'cli.update.desc': 'Update node frontmatter',
  'cli.link.desc': 'Add a link between nodes',
  'cli.done.desc': 'Mark episode item as done',
  'cli.backlog.desc': 'Show backlog items',

  // New node
  'new.created': 'Created {type} node: {id}',
  'new.invalid_type': 'Invalid node type: {type}. Valid types: {valid}',

  // Init
  'init.success': 'EMDD project initialized at {path}',
  'init.already_exists': 'EMDD project already exists at {path}',
  'init.next_steps': 'Next: emdd new hypothesis <slug>',

  // Lint
  'lint.clean': 'All nodes valid. No errors found.',
  'lint.errors_found': '{count} error(s) found',
  'lint.warnings_found': '{count} warning(s) found',
  'lint.missing_field': 'Missing required field: {field}',
  'lint.invalid_status': 'Invalid status "{status}" for type {type}. Valid: {valid}',
  'lint.confidence_range': 'Confidence must be between 0.0 and 1.0, got {value}',
  'lint.invalid_relation': 'Invalid link relation: {relation}',
  'lint.broken_link': 'Link target "{target}" not found in graph',

  // Check
  'check.title': 'Consolidation Trigger Check',
  'check.findings_threshold': 'Findings pending consolidation: {count} (threshold: {threshold})',
  'check.episodes_threshold': 'Episodes since last consolidation: {count} (threshold: {threshold})',
  'check.stale_hypothesis': 'Stale hypothesis: {id} ({days} days in {status})',
  'check.no_triggers': 'No consolidation triggers active',

  // Promote
  'promote.title': 'Promotion Candidates',
  'promote.candidate': '{id}: confidence={confidence}, supports={supports}',
  'promote.no_candidates': 'No promotion candidates found',

  // Update
  'update.success': 'Updated {id}: {field} = {value}',
  'update.node_not_found': 'Node not found: {id}',

  // Link
  'link.success': 'Linked {source} → {target} ({relation})',
  'link.invalid_relation': 'Invalid relation: {relation}. Valid: {valid}',

  // Done
  'done.success': 'Marked as [{marker}]: {item}',
  'done.item_not_found': 'Item not found in {id}: {item}',
  'done.invalid_marker': 'Invalid marker: {marker}. Valid markers: done, deferred, superseded',
  'done.already_marked': 'Item already marked in {id}: {item}',

  // Index
  'index.generated': 'Generated _index.md ({nodes} nodes)',

  // Graph
  'graph.generated': 'Generated _graph.mmd ({nodes} nodes, {edges} edges)',

  // Backlog
  'backlog.title': 'Backlog Items',
  'backlog.empty': 'No pending backlog items',

  // Errors
  'error.graph_not_found': 'No graph/ directory found',
  'error.node_not_found': 'Node not found: {id}',
};
