---
id: fnd-005
type: finding
title: "Batch Size Impact on Convergence"
status: VALIDATED
confidence: 0.70
created: 2026-02-21
updated: 2026-02-22
tags: [training, batch-size]
links:
  - target: exp-001
    relation: relates_to
---

## Summary

Larger batch sizes (64 vs 16) lead to faster convergence but slightly lower final accuracy.

## Evidence

- Training curves compared across batch sizes 16, 32, 64
