---
id: exp-001
type: experiment
title: "ResNet-18 Baseline Training"
status: COMPLETED
created: 2026-02-05
updated: 2026-02-15
tags: [resnet, baseline, training]
links:
  - target: fnd-001
    relation: produces
---

## Design

- **Model**: ResNet-18 pretrained on ImageNet, final FC layer replaced (5-class output).
- **Dataset**: 5000 labeled defect images, stratified 80/20 train/test split.
- **Validation**: 5-fold cross-validation on training set for hyperparameter selection.
- **Training**: SGD with momentum 0.9, learning rate 1e-3 with cosine annealing, 50 epochs.
- **Augmentation**: random horizontal flip, rotation (+/-15 deg), color jitter.

## Results

See fnd-001 for detailed findings. Achieved 94.2% test accuracy with 38ms inference time on T4 GPU.
