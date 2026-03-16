---
id: fnd-002
type: finding
title: "MobileNetV3 Accuracy 87.1% Below Threshold"
status: VALIDATED
confidence: 0.8
created: 2026-02-15
updated: 2026-02-20
tags: [mobilenet, accuracy, underperformance]
links:
  - target: hyp-002
    relation: contradicts
---

## Summary

MobileNetV3-Small achieves only 87.1% overall accuracy on the defect detection test set, falling below the 90% minimum threshold. The model particularly struggles with the inclusion and rolled-in scale defect classes.

## Evidence

- Overall accuracy: 87.1% (5-fold CV mean: 86.5% +/- 1.2%)
- Per-class accuracy: scratch 91.3%, pit 88.7%, stain 92.1%, inclusion 82.4%, rolled-in scale 81.0%
- Inference latency: 12ms (68% faster than ResNet-18)
- Model size: 9.8 MB

The accuracy shortfall triggers hyp-002's kill criterion (below 90%).
