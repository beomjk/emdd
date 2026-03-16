---
id: exp-002
type: experiment
title: "MobileNetV3 Comparison Experiment"
status: COMPLETED
created: 2026-02-05
updated: 2026-02-15
tags: [mobilenet, comparison, training]
links:
  - target: fnd-002
    relation: produces
  - target: fnd-003
    relation: produces
---

## Design

- **Model**: MobileNetV3-Small pretrained on ImageNet, classifier head replaced (5-class).
- **Dataset**: Same 5000 images, identical train/test split as exp-001.
- **Validation**: 5-fold cross-validation, same folds as exp-001.
- **Training**: Same optimizer and schedule as exp-001 for fair comparison.
- **Augmentation**: Identical augmentation pipeline.

## Results

See fnd-002 and fnd-003 for detailed findings. Achieved 87.1% accuracy with 12ms inference. Accuracy fell short of the 90% threshold.
