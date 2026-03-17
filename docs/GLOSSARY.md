# EMDD Glossary

> Bilingual term reference for EMDD. Korean terms from the original specification are mapped to their English equivalents used throughout the English documentation.

## Node Types

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 지식 (Knowledge) | Knowledge | Confirmed facts, literature, domain rules | §6.2 |
| 가설 (Hypothesis) | Hypothesis | Testable claim with confidence and risk level | §6.2 |
| 실험 (Experiment) | Experiment | Unit of work to validate a hypothesis | §6.2 |
| 발견 (Finding) | Finding | Fact or pattern discovered from experiments/analysis | §6.2 |
| 질문 (Question) | Question | Open research question | §6.2 |
| 결정 (Decision) | Decision | Recorded decision with rationale | §6.2 |
| 에피소드 (Episode) | Episode | Record of one exploration loop | §6.3 |

## Finding Subtypes (spec only, not yet implemented in CLI/MCP)

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 관찰 (observation) | Observation | Concrete result directly observed from a single experiment/analysis | §6.2 |
| 인사이트 (insight) | Insight | Higher-order pattern discovered by combining multiple Findings/Knowledge | §6.2 |
| 부정적 결과 (negative) | Negative Finding | Confirmed absence or failure -- "X is not the case" | §6.2 |

## Edge Types

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 지지 (SUPPORTS) | SUPPORTS | A supports B (strength: 0.0--1.0) | §6.4 |
| 모순 (CONTRADICTS) | CONTRADICTS | A contradicts B (severity: FATAL / WEAKENING / TENSION) | §6.4 |
| 확인 (CONFIRMS) | CONFIRMS | A strongly confirms B (convenience alias for SUPPORTS with strength >= 0.9) | §6.4 |
| 파생 (SPAWNS) | SPAWNS | B is derived from A (e.g., Question to Hypothesis) | §6.4 |
| 생성 (PRODUCES) | PRODUCES | A's execution produces B (e.g., Episode to Finding) | §6.4 |
| 답변 (ANSWERS) | ANSWERS | A provides an answer to B (completeness: 0.0--1.0) | §6.4 |
| 수정 (REVISES) | REVISES | A is a revised version of B | §6.4 |
| 승격 (PROMOTES) | PROMOTES | A is promoted to B (Finding to Knowledge) | §6.4 |
| 의존 (DEPENDS_ON) | DEPENDS_ON | A depends on B (LOGICAL / PRACTICAL / TEMPORAL) | §6.4 |
| 확장 (EXTENDS) | EXTENDS | A explores deeper based on B's results | §6.4 |
| 관련 (RELATES_TO) | RELATES_TO | A and B are related (weak directionality, Zettelkasten-style) | §6.4 |
| 영향 (INFORMS) | INFORMS | A influences B's judgment (DECISIVE / SIGNIFICANT / MINOR) | §6.4 |
| 부분 (PART_OF) | PART_OF | A is a sub-element of B | §6.4 |
| 맥락 (CONTEXT_FOR) | CONTEXT_FOR | A provides context/background for B | §6.4 |

## Statuses & States

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 제안됨 (PROPOSED) | PROPOSED | Hypothesis initial state | §6.5 |
| 검증 중 (TESTING) | TESTING | Connected Experiment is RUNNING | §6.5 |
| 지지됨 (SUPPORTED) | SUPPORTED | SUPPORTS edge with strength >= 0.7 | §6.5 |
| 반증됨 (REFUTED) | REFUTED | CONTRADICTS edge exists | §6.5 |
| 수정됨 (REVISED) | REVISED | Partial support/refutation leads to revised hypothesis | §6.5 |
| 보류 (DEFERRED) | DEFERRED | Explicitly deferred by the researcher | §6.5 |
| 이의 제기 (CONTESTED) | CONTESTED | Team members disagree on verdict (team protocol) | §7.2b |
| 계획됨 (PLANNED) | PLANNED | Experiment initial state | §6.5 |
| 실행 중 (RUNNING) | RUNNING | Experiment is being executed | §6.5 |
| 완료 (COMPLETED) | COMPLETED | Experiment finished successfully | §6.5 |
| 실패 (FAILED) | FAILED | Experiment failed | §6.5 |
| 포기 (ABANDONED) | ABANDONED | Experiment abandoned, or branch group abandoned (not valid for Question) | §6.5 |
| 초안 (DRAFT) | DRAFT | Finding initial state | §6.5 |
| 검증됨 (VALIDATED) | VALIDATED | Finding validated by evidence | §6.5 |
| 승격됨 (PROMOTED) | PROMOTED | Finding promoted to knowledge | §6.5 |
| 열림 (OPEN) | OPEN | Question is open | §6.5 |
| 해결됨 (RESOLVED) | RESOLVED | Question resolved | §6.5 |
| 답변됨 (ANSWERED) | ANSWERED | Question answered | §6.5 |
| 수렴 (CONVERGED) | CONVERGED | Branch group converged (branch group only, not valid for Question) | §6.5 |
| 병합됨 (MERGED) | MERGED | Branch group merged (branch group only, not valid for Question) | §6.5 |
| 수락됨 (ACCEPTED) | ACCEPTED | Decision accepted | §6.5 |
| 되돌림 (REVERTED) | REVERTED | Decision reverted | §6.5 |
| 활성 (ACTIVE) | ACTIVE | Knowledge or episode is current and valid | §6.6 |
| 논쟁 중 (DISPUTED) | DISPUTED | Knowledge contradicted by new Finding | §6.6 |
| 대체됨 (SUPERSEDED) | SUPERSEDED | Knowledge replaced by newer Knowledge | §6.6 |
| 철회됨 (RETRACTED) | RETRACTED | Knowledge contradiction confirmed, no replacement | §6.6 |
| 미착수 | Not Started (`[ ]`) | Episode next-step default state | §6.3 |
| 완료 | Done (`[done]`) | Episode next-step completed | §6.3 |
| 보류 | Deferred (`[deferred]`) | Episode next-step postponed | §6.3 |
| 무효화 | Superseded (`[superseded]`) | Episode next-step invalidated by new information | §6.3 |

## Ceremonies & Workflows

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 정리 세러모니 | Consolidation Ceremony | Structuring accumulated Findings into Knowledge/Questions/Hypotheses (30--60 min) | §7.4 |
| 주간 그래프 리뷰 | Weekly Graph Review | Graph health check, pruning, restructuring (Friday, 90 min) | §7.4 |
| 마일스톤 세러모니 | Milestone Ceremony | Triggered when a hypothesis is confirmed or refuted (30 min) | §7.4 |
| 반증 세러모니 | Knowledge Refutation Ceremony | Triggered when Knowledge is RETRACTED (30--60 min) | §7.4 |
| 피벗 세러모니 | Pivot Ceremony | Major direction change when multiple hypotheses fail (2--3 hours) | §7.4 |
| 모닝 브리핑 | Morning Briefing | Daily context loading, AI report review, direction setting (30 min) | §7.2 |
| 일일 리플렉션 | Daily Reflection | End-of-day Episode writing, consolidation check, next-day planning (30 min) | §7.2 |
| 미드데이 체크포인트 | Midday Checkpoint | Quick graph micro-update of surprising items (15 min) | §7.2 |
| 딥 워크 | Deep Work | Focused experiment execution blocks (3--4 hours) | §7.2 |
| 프로젝트 킥오프 | Project Kickoff | Day 0 setup: problem, constraints, literature, hypotheses, questions (~3 hours) | §7.1 |
| 컨텍스트 로딩 | Context Loading | Protocol for loading relevant nodes before starting an exploration loop | §6.9 |

## Core Concepts

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 살아있는 지식 구조 | Living Knowledge Structure | The graph as a living artifact representing known and unknown | §4 |
| 연구 기억 | Research Memory | The graph's role as a record of attempted paths, failed hypotheses, and direction changes | §4 |
| 신뢰도 | Confidence | Bayesian-inspired confidence score (0.0--1.0) propagated through evidential edges | §6.7 |
| 승격 | Promotion | Elevating a Finding to Knowledge status during Consolidation | §6.2 |
| 반증 | Refutation | Disproving a hypothesis or retracting Knowledge via contradicting evidence | §6.5, §6.6 |
| 구조적 공백 | Structural Gap | Missing connections in the graph that signal unexplored research directions | §6.8 |
| 위험 전파 경로 | Risk Propagation Path | Chain of dependencies where one failure cascades to others | §3 (Principle 5) |
| 마찰 예산 | Friction Budget | Cap on daily graph-maintenance overhead (target 45 min, max 60 min/day) | §7.5 |
| 묵음 규칙 / 인터럽트 버짓 | Silence Rules / Interrupt Budget | Limits on when and how often AI may proactively intervene | §7.3 |
| 스크래치패드 | Scratchpad | Ephemeral daily notes taken during Deep Work to capture surprises | §7.2 |
| 열린 질문 | Open Question | Unresolved research question in the graph | §6.2 |
| 진입점 | Entry Point | The primary node in a topic cluster to read first | §6.9 |
| 토픽 클러스터 | Topic Cluster | Thematic grouping of nodes in `_index.md` with a designated entry point | §6.9 |
| 선행 읽기 | Prerequisite Reading | Nodes listed in an Episode's "next steps" that must be read before starting work | §6.3 |
| 프루닝 | Pruning | Archiving contradicted or stale low-priority nodes ("archive, don't delete") | §7.4 |
| 고아 정리 | Orphan Cleanup | Connecting orphan Findings (no outgoing SPAWNS) to Questions or Hypotheses | §6.8, §7.4 |
| 도약 | Leap | Intuitive, non-logical connections that only a human researcher can make | §4 |
| 취향 | Taste | The researcher's judgment on what is worth pursuing (Principle 7) | §3, §4 |
| 탐구 | Exploration | The fundamental act of open-ended research that EMDD structures | §1 |
| 공백 | Gap | An absence in the graph (disconnected clusters, untested hypotheses, etc.) | §6.8 |
| 가정 레지스터 | Assumption Register | DDP-style registry of all hypotheses ranked by risk x uncertainty | §7.1 |
| 킬 기준 | Kill Criterion | Pre-defined threshold that, if met, falsifies a hypothesis | §6.2 |
| 오버나이트 리포트 | Overnight Report | AI-generated daily brief summarizing results and recommendations | §7.2 |
| 이중 촉발 진화 | Dual Trigger Evolution | Graph evolves from both human input and AI pattern detection | §3 (Principle 6) |
| 시간적 진화 | Temporal Evolution | Preserving the full history of node creation, modification, and deprecation | §3 (Principle 4) |
| 아카이브 | Archive | Deprecated nodes moved to archived layer, restorable if needed | §7.4 |
| 반증 캐스케이드 비용 | Refutation Cascade Cost | Downstream impact when a Knowledge node is retracted | §6.2 |
| 정리 트리거 | Consolidation Trigger | Conditions that mandate running a Consolidation Ceremony | §7.4 |
| 정리 힌트 | Consolidation Hint | `extends: know-NNN` tag in Finding links to accelerate promotion review | §6.2 |

## Roles

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 연구자 | Researcher (Human) | Exercises taste, judgment, and leaps; creates nodes and judges hypotheses | §4 |
| 그래프 | Graph (Artifact) | Living knowledge structure serving as knowledge map, roadmap, and research memory | §4 |
| 정원사 | Gardener (AI Agent) | AI as graph gardener -- maintains, detects patterns, suggests gaps; never architect | §4 |

## Severity Levels

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 치명적 (FATAL) | FATAL | Core premise collapsed; confidence penalty x0.5 | §6.6 |
| 약화 (WEAKENING) | WEAKENING | Partial contradiction; confidence penalty x0.7 | §6.6 |
| 긴장 (TENSION) | TENSION | Interpretive difference; confidence penalty x0.9 | §6.6 |

## Gap Types

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 분리된 클러스터 | Disconnected Clusters | Communities with fewer than threshold inter-cluster edges | §6.8 |
| 미검증 가설 | Untested Hypotheses | PROPOSED hypotheses that have aged beyond N days | §6.8 |
| 차단 질문 | Blocking Questions | OPEN questions with urgency=BLOCKING | §6.8 |
| 오래된 지식 | Stale Knowledge | Knowledge nodes with aged sources in clusters with newer additions | §6.8 |
| 고아 발견 | Orphan Findings | Finding nodes with no outgoing SPAWNS edges | §6.8 |

## Anti-Patterns

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 과구조화 | Over-Structuring | Graph becomes bureaucracy; too much time on metadata | §9 |
| 과소 입력 | Under-Feeding | Graph starves; only successes recorded, no failures or doubts | §9 |
| 맹목적 추종 | Blind Following | Uncritically executing AI suggestions | §9 |
| 조기 수렴 | Premature Convergence | Diving deep on first success without exploring alternatives | §9 |
| 발견의 무덤 | Finding Cemetery | Findings pile up without promotion, question generation, or hypothesis updates | §9 |
| 그래프 기억상실 | Graph Amnesia | Deleting wrong hypotheses instead of deprecating; losing temporal history | §9 |

## Integration Patterns

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 통합 패턴 | Integration Pattern | Defined workflow for connecting external tools to the EMDD graph | §8.6 |
| 출처 추적 | Provenance | `meta.source` field preserving origin of nodes from external systems | §8.6 |
| 교차 참조 | Cross-reference (xref) | `meta.xref` field linking nodes across separate graphs | §8.6, §13 |

## Scale & Performance

| Korean | English | Description | Spec Section |
|--------|---------|-------------|--------------|
| 규모 기준점 | Scale Tier | Graph size classification: Lite (~50), Standard (~200), Large (~500), Enterprise (~1000+) | §13.1 |
| 그래프 분할 | Graph Partitioning | Splitting a large graph by time, topic, or core/detail layers | §13.4 |
| 그래프 연방화 | Graph Federation | Multi-project graph architecture with shared knowledge layer | §13.5 |
| 아카이빙 | Archiving | Moving resolved/inactive nodes to `archive/` directory | §13.4 |
