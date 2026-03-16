---
id: fnd-001
type: finding
title: "ResNet-18 Achieves 94.2% Accuracy"
status: PROMOTED
confidence: 0.9
created: 2026-02-15
updated: 2026-02-25
tags: [resnet, accuracy, performance]
links:
  - target: hyp-001
    relation: supports
  - target: knw-002
    relation: promotes
---

## Summary

ResNet-18 achieves 94.2% overall accuracy on the defect detection test set with 38ms average inference latency on a single T4 GPU. All five defect classes exceed the 90% per-class threshold.

## Evidence

- Overall accuracy: 94.2% (5-fold CV mean: 93.8% +/- 0.7%)
- Per-class accuracy: scratch 95.1%, pit 93.4%, stain 96.2%, inclusion 91.8%, rolled-in scale 94.5%
- Inference latency: 38ms (well within the 100ms constraint)
- Model size: 44.7 MB

Promoted to knw-002 during consolidation (epi-003).
