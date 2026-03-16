---
id: knw-001
type: knowledge
title: "Defect Detection Requirements"
status: ACTIVE
confidence: 0.95
created: 2026-02-01
updated: 2026-02-01
tags: [domain, requirements, defect-detection]
links:
  - target: hyp-001
    relation: informs
  - target: hyp-002
    relation: informs
---

## Content

Production line constraints for automated visual defect detection:

- **Inference latency**: must be under 100ms per frame to keep up with line speed.
- **Accuracy**: minimum 90% detection rate across all defect classes.
- **Hardware budget**: single NVIDIA T4 GPU per inspection station.
- **Defect taxonomy**: scratch, pit, stain, inclusion, rolled-in scale (5 types).
- **Dataset**: 5000 labeled images collected over 6 months of production.

## Source

Internal manufacturing quality team specifications (Q4 2025 review).
