---
id: dec-001
type: decision
title: "Adopt ResNet-18 as Production Backbone"
status: ACCEPTED
created: 2026-02-25
updated: 2026-02-25
tags: [architecture, backbone, production]
links:
  - target: fnd-001
    relation: supported_by
  - target: fnd-003
    relation: supported_by
---

## Decision

Adopt ResNet-18 (pretrained ImageNet, fine-tuned on defect dataset) as the production backbone for the automated defect detection system.

## Rationale

- Accuracy of 94.2% exceeds the 90% minimum requirement (fnd-001).
- Inference latency of 38ms is well within the 100ms constraint.
- Both candidates meet the latency requirement, so accuracy is the decisive factor (fnd-003).
- MobileNetV3 was refuted due to accuracy shortfall (hyp-002 REFUTED).

## Alternatives

1. **MobileNetV3-Small**: Rejected. 87.1% accuracy below threshold despite 3x speed advantage.
2. **Knowledge distillation**: Deferred as future work (qst-001). May revisit if edge deployment becomes a priority.
3. **EfficientNet-B0**: Not evaluated in this cycle. Could be a future candidate.
