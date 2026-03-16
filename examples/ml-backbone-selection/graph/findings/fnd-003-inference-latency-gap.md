---
id: fnd-003
type: finding
title: "Inference Latency Gap: 3x Faster but 7%p Accuracy Loss"
status: VALIDATED
confidence: 0.85
created: 2026-02-15
updated: 2026-02-20
tags: [latency, accuracy-tradeoff, comparison]
links:
  - target: qst-001
    relation: spawns
---

## Summary

MobileNetV3 achieves 3.2x lower inference latency than ResNet-18 (12ms vs 38ms), but at the cost of a 7.1 percentage point accuracy gap (87.1% vs 94.2%). Both models comfortably meet the 100ms latency constraint, making latency a non-differentiator for this deployment.

## Evidence

| Metric | ResNet-18 | MobileNetV3 | Delta |
|--------|-----------|-------------|-------|
| Accuracy | 94.2% | 87.1% | -7.1%p |
| Latency | 38ms | 12ms | -68% |
| Model size | 44.7 MB | 9.8 MB | -78% |
| FLOPs | 1.8G | 0.06G | -97% |

Since both models meet the latency constraint, the accuracy gap is decisive.
