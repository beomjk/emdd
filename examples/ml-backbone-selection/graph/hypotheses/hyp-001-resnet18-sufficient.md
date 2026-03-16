---
id: hyp-001
type: hypothesis
title: "ResNet-18 Sufficient for 90%+ Accuracy"
status: SUPPORTED
confidence: 0.85
created: 2026-02-03
updated: 2026-02-22
tags: [resnet, backbone, accuracy]
links:
  - target: exp-001
    relation: tested_by
---

## Hypothesis

ResNet-18, pretrained on ImageNet and fine-tuned on our defect dataset, can achieve >90% classification accuracy across all five defect types while meeting the 100ms inference constraint.

## Rationale

ResNet-18 is a well-established lightweight backbone that balances depth and computational cost. Its residual connections help with gradient flow even on small datasets. Published results on similar industrial inspection tasks suggest 90-95% accuracy is achievable.

**Kill criterion**: If accuracy falls below 88% on any single defect class after hyperparameter tuning, this hypothesis is refuted.
