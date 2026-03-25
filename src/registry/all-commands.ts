import { CommandRegistry } from './registry.js';

// Read commands
import { listNodesDef } from './commands/list-nodes.js';
import { readNodeDef } from './commands/read-node.js';
import { neighborsDef } from './commands/neighbors.js';
import { gapsDef } from './commands/gaps.js';

// Write commands
import { createNodeDef } from './commands/create-node.js';
import { createEdgeDef } from './commands/create-edge.js';
import { deleteEdgeDef } from './commands/delete-edge.js';
import { updateNodeDef } from './commands/update-node.js';
import { markDoneDef } from './commands/mark-done.js';
import { indexGraphDef } from './commands/index-graph.js';

// Analysis commands
import { healthDef } from './commands/health.js';
import { checkDef } from './commands/check.js';
import { promoteDef } from './commands/promote.js';
import { confidencePropagateDef } from './commands/confidence-propagate.js';
import { transitionsDef } from './commands/transitions.js';
import { killCheckDef } from './commands/kill-check.js';
import { branchGroupsDef } from './commands/branch-groups.js';
import { lintDef } from './commands/lint.js';
import { backlogDef } from './commands/backlog.js';
import { analyzeRefutationDef } from './commands/analyze-refutation.js';
import { markConsolidatedDef } from './commands/mark-consolidated.js';

export function createDefaultRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  // Read commands
  registry.register(listNodesDef);
  registry.register(readNodeDef);
  registry.register(neighborsDef);
  registry.register(gapsDef);

  // Write commands
  registry.register(createNodeDef);
  registry.register(createEdgeDef);
  registry.register(deleteEdgeDef);
  registry.register(updateNodeDef);
  registry.register(markDoneDef);
  registry.register(indexGraphDef);

  // Analysis commands
  registry.register(healthDef);
  registry.register(checkDef);
  registry.register(promoteDef);
  registry.register(confidencePropagateDef);
  registry.register(transitionsDef);
  registry.register(killCheckDef);
  registry.register(branchGroupsDef);
  registry.register(lintDef);
  registry.register(backlogDef);
  registry.register(analyzeRefutationDef);
  registry.register(markConsolidatedDef);

  return registry;
}
