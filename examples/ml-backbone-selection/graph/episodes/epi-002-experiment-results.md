---
id: epi-002
type: episode
title: "Experiment Results and Analysis"
status: COMPLETED
created: 2026-02-15
updated: 2026-02-20
tags: [experiments, analysis]
links: []
---

## Goals

- [x] Complete ResNet-18 training (exp-001)
- [x] Complete MobileNetV3 training (exp-002)
- [x] Record accuracy and latency findings
- [x] Compare results against kill criteria

## Notes

Both experiments completed successfully. ResNet-18 achieved 94.2% accuracy (fnd-001), exceeding the 90% threshold. MobileNetV3 reached only 87.1% (fnd-002), triggering its kill criterion. The latency comparison (fnd-003) showed MobileNet is 3x faster, but since both models meet the 100ms constraint, accuracy is the deciding factor. hyp-001 moved to SUPPORTED, hyp-002 to REFUTED.
