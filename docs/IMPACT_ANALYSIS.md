# Impact Analysis

Impact analysis answers the question: **"If this node changes, what else is affected?"**

It traces cascade effects through the knowledge graph using BFS-based scoring and, optionally, state-engine simulation to predict automatic status transitions.

## Two Modes

### Current-Status Mode

Computes structural impact scores from a seed node based on the existing graph topology. No state changes are simulated.

```bash
emdd impact hyp-001
```

```
Impact Analysis: hyp-001 (TESTING)

 Node       Type         Status       Score   Best    Hops  Auto-Transition
 ────────── ──────────── ──────────── ─────── ─────── ───── ───────────────
 exp-002    experiment   RUNNING      0.80    0.80    1     —
 fnd-003    finding      VALIDATED    0.64    0.64    2     —

Summary: 2 nodes affected | Max score: 0.80 | Avg: 0.72
```

### What-If Mode

Simulates a hypothetical status change on the seed node, then traces both:
1. **BFS scoring** — structural propagation through edges
2. **Cascade simulation** — automatic status transitions triggered by the change

```bash
emdd impact hyp-001 --whatIf RETRACTED
```

```
Impact Analysis: hyp-001 (TESTING → RETRACTED)

 Node       Type         Status       Score   Best    Hops  Auto-Transition
 ────────── ──────────── ──────────── ─────── ─────── ───── ───────────────
 exp-002    experiment   RUNNING      0.80    0.80    1     RUNNING → BLOCKED
 fnd-003    finding      VALIDATED    0.64    0.64    2     —
 knw-005    knowledge    ACTIVE       0.00    0.00    N/A   ACTIVE → CONTESTED

Summary: 3 nodes affected | Max score: 0.80 | Avg: 0.48
Cascade: 2 auto-transition(s), 0 unresolved conflict(s)
```

Nodes with `Hops: N/A` are affected only by cascade transitions (not reachable via BFS).

## How Scoring Works

### Edge Classification

Every forward edge is classified into one of three propagation categories:

| Class | Base Factor | Edges | Meaning |
|-------|------------|-------|---------|
| **conducts** | 0.8 | `supports`, `contradicts`, `confirms`, `depends_on`, `revises`, `tests` | Strong causal/evidential link — impact passes through readily |
| **attenuates** | 0.4 | `informs`, `extends`, `produces`, `spawns`, `answers`, `promotes`, `resolves` | Weaker or indirect link — impact is dampened |
| **blocks** | 0.0 | `relates_to`, `part_of`, `context_for` | Structural/organizational link — impact does not propagate |

### Attribute Modifiers

Edge attributes further modify the base factor:

| Attribute | Values | Multiplier |
|-----------|--------|-----------|
| **strength** | 0.0 – 1.0 | Direct multiplier |
| **completeness** | 0.0 – 1.0 | Direct multiplier |
| **severity** | FATAL (1.0), WEAKENING (0.7), TENSION (0.4) | |
| **impact** | DECISIVE (1.0), SIGNIFICANT (0.7), MINOR (0.3) | |
| **dependencyType** | LOGICAL (1.0), PRACTICAL (0.7), TEMPORAL (0.5) | |

The effective edge factor is: `baseFactor × strength × severity × impact × dependencyType × completeness`, clamped to [0, 1].

### Noisy-OR Aggregation

When a node is reachable via multiple paths, scores are aggregated using the [Noisy-OR](https://en.wikipedia.org/wiki/Noisy-or_model) model:

```
aggregateScore = 1 − ∏(1 − pathScoreᵢ)
```

This means additional paths always increase (never decrease) the aggregate score, and it naturally stays in [0, 1].

### Traversal Bounds

- **Threshold**: paths with score below 0.01 are pruned (configurable in `schema.config.ts`)
- **Max depth**: BFS stops after 10 hops (configurable in `schema.config.ts`)
- **Relaxation**: revisited nodes only re-propagate if the aggregate meaningfully increased

## MCP Tool

The same analysis is available as an MCP tool:

```json
{
  "tool": "impact-analysis",
  "arguments": {
    "graphDir": "/path/to/graph",
    "nodeId": "hyp-001",
    "whatIf": "RETRACTED"
  }
}
```

The tool returns a structured JSON response with `seed`, `impactedNodes`, `cascadeTrace` (what-if only), and `summary`.

## Configuration

All impact analysis constants are defined in `src/schema/schema.config.ts`:

| Constant | Default | Purpose |
|----------|---------|---------|
| `impactClassification` | see above | Edge-to-propagation-class mapping |
| `attributeModifiers` | see above | Attribute value multipliers |
| `impactThreshold` | 0.01 | Minimum score to continue propagation |
| `maxCascadeDepth` | 10 | Maximum BFS hops |
| `reverseDirectionEdges` | `['depends_on']` | Edges where impact flows target→source |

To customize, edit `schema.config.ts` and run `npm run build`.
