import { describe, it, expect } from 'vitest';
import cytoscape from 'cytoscape';

/**
 * Regression test for a CRITICAL cluster-cascade bug in CytoscapeGraph.svelte.
 *
 * Issue: Cytoscape's `.remove()` on a compound parent also removes every
 * descendant. The prior implementation in `applyClustersToGraph` did
 * `cyInst.nodes('[?isCluster]').remove()` and then tried to re-add child
 * references by `getElementById(nodeId)` — but those domain nodes had
 * already been deleted as a side effect of removing their parent.
 *
 * The fix is to **orphan** the children first (`children().move({parent: null})`)
 * before removing the cluster parents. These tests lock that behavior in by
 * exercising real Cytoscape (headless mode), not the mocked one used in
 * CytoscapeGraph.test.ts — the mock's flat-map implementation does not
 * model compound cascade semantics and could not have caught the bug.
 */
describe('cluster cascade regression', () => {
  function createGraphWithCluster(): cytoscape.Core {
    const cy = cytoscape({ headless: true, styleEnabled: false });
    cy.add([
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'c' } },
    ]);
    cy.add({ data: { id: 'cluster-1', isCluster: true } });
    cy.getElementById('a').move({ parent: 'cluster-1' });
    cy.getElementById('b').move({ parent: 'cluster-1' });
    return cy;
  }

  it('buggy pattern (remove without orphaning) deletes clustered children', () => {
    const cy = createGraphWithCluster();
    expect(cy.nodes().map((n) => n.id()).sort()).toEqual(['a', 'b', 'c', 'cluster-1']);

    // This is what the old code did. Confirms the bug reproduces.
    cy.nodes('[?isCluster]').remove();

    const remaining = cy.nodes().map((n) => n.id()).sort();
    expect(remaining).toEqual(['c']);
    expect(cy.getElementById('a').length).toBe(0);
    expect(cy.getElementById('b').length).toBe(0);
  });

  it('fixed pattern (orphan then remove) preserves clustered children', () => {
    const cy = createGraphWithCluster();

    // This is what CytoscapeGraph.svelte now does in applyClustersToGraph.
    const existingClusters = cy.nodes('[?isCluster]');
    existingClusters.children().move({ parent: null });
    existingClusters.remove();

    const remaining = cy.nodes().map((n) => n.id()).sort();
    expect(remaining).toEqual(['a', 'b', 'c']);
    expect(cy.getElementById('a').length).toBe(1);
    expect(cy.getElementById('b').length).toBe(1);
    // Cluster parent itself is gone
    expect(cy.getElementById('cluster-1').length).toBe(0);
  });

  it('re-clustering after orphan-remove rebuilds the parent without loss', () => {
    const cy = createGraphWithCluster();

    // Simulate applyClustersToGraph running a second time with the fix
    const existingClusters = cy.nodes('[?isCluster]');
    existingClusters.children().move({ parent: null });
    existingClusters.remove();

    // Now rebuild — same pattern as the for-loop in applyClustersToGraph
    cy.add({ data: { id: 'cluster-1', isCluster: true } });
    for (const nodeId of ['a', 'b']) {
      const node = cy.getElementById(nodeId);
      if (node.length > 0 && !node.isChild()) {
        node.move({ parent: 'cluster-1' });
      }
    }

    expect(cy.nodes().map((n) => n.id()).sort()).toEqual(['a', 'b', 'c', 'cluster-1']);
    expect(cy.getElementById('a').isChild()).toBe(true);
    expect(cy.getElementById('b').isChild()).toBe(true);
    expect(cy.getElementById('a').parent().id()).toBe('cluster-1');
  });
});
