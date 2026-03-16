---
id: qst-001
type: question
title: "Can Knowledge Distillation Close the Accuracy Gap?"
status: OPEN
created: 2026-02-20
updated: 2026-02-20
tags: [distillation, future-work, mobilenet]
links: []
---

## Question

Can knowledge distillation from the ResNet-18 teacher to a MobileNetV3 student close the 7.1 percentage point accuracy gap, bringing the lightweight model above the 90% threshold?

## Context

fnd-003 shows MobileNetV3 is 3x faster but 7%p less accurate. If distillation can recover most of this gap, a lighter deployment would be feasible for resource-constrained edge stations. Published distillation results on ImageNet suggest 2-4%p recovery is typical, which may not be sufficient for our use case.

This remains an open question for future investigation.
