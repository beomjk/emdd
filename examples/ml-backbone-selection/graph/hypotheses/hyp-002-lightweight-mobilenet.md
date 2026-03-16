---
id: hyp-002
type: hypothesis
title: "MobileNetV3 Matches Accuracy with Lower Latency"
status: REFUTED
confidence: 0.2
created: 2026-02-03
updated: 2026-02-22
tags: [mobilenet, backbone, latency]
links:
  - target: exp-002
    relation: tested_by
---

## Hypothesis

MobileNetV3-Small can achieve equivalent accuracy (>90%) to ResNet-18 while reducing inference latency by at least 50%, making it the preferred backbone for deployment.

## Rationale

MobileNetV3 uses depthwise separable convolutions and neural architecture search optimizations. On ImageNet, it achieves competitive accuracy at a fraction of the FLOPs. The hypothesis is that this efficiency advantage transfers to defect detection.

**Kill criterion**: If accuracy drops below 90% or the latency improvement is less than 30%, the hypothesis is refuted.
