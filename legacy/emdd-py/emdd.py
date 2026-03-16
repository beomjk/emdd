# /// script
# requires-python = ">=3.11"
# dependencies = ["python-frontmatter", "typer", "rich", "pyyaml"]
# ///
"""EMDD CLI — Deterministic rules for Evolving Mindmap-Driven Development graphs."""

from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

import frontmatter
import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="EMDD graph management CLI", no_args_is_help=True)
console = Console()

# ── Edge type normalization ──────────────────────────────────────────

REVERSE_LABELS: dict[str, str] = {
    "confirmed_by": "confirms",
    "supported_by": "supports",
    "answered_by": "answers",
    "spawned_from": "spawns",
    "produced_by": "produces",
}

EDGE_TYPES = {
    # evidence
    "supports", "contradicts", "confirms",
    # generation
    "spawns", "produces", "answers", "revises", "promotes",
    # structure
    "depends_on", "extends", "relates_to", "informs",
    # composition
    "part_of", "context_for",
    # aliases used in practice
    "tests", "answers_to",
}

ALL_VALID_RELATIONS = EDGE_TYPES | set(REVERSE_LABELS.keys())

# ── Node types and directories ───────────────────────────────────────

NODE_TYPE_DIRS: dict[str, str] = {
    "hypothesis": "hypotheses",
    "experiment": "experiments",
    "finding": "findings",
    "knowledge": "knowledge",
    "question": "questions",
    "decision": "decisions",
    "episode": "episodes",
}

ID_PREFIXES: dict[str, str] = {
    "finding": "find",
    "episode": "ep",
    "experiment": "exp",
    "question": "q",
    "knowledge": "know",
    "hypothesis": "hyp",
    "decision": "dec",
}

_PREFIX_TO_TYPE: dict[str, str] = {v: k for k, v in ID_PREFIXES.items()}

# ── Slash command templates (embedded for init) ──────────────────────

_SLASH_CMD_CONTEXT = """\
# EMDD Context Loading

새로운 탐구 세션을 시작하기 전에 컨텍스트를 로딩한다. 다음 단계를 순서대로 수행하라:

## 0. CLI 보조 데이터 수집

먼저 CLI로 현황을 수집한다:
```bash
uv run {EMDD_PY} backlog
uv run {EMDD_PY} check
```

## 1. 최신 Episode 확인

`graph/episodes/` 디렉토리에서 가장 최근 Episode 파일을 찾아 읽는다.
"다음에 할 것" 섹션에서:
- `[ ]` (미착수) 항목과 그 선행 읽기 노드 목록을 추출한다
- `[deferred]` 항목이 있으면 별도로 표시한다

## 2. 선행 읽기 노드 로딩

추출한 선행 읽기 노드들을 실제로 읽는다. 각 노드의 핵심 내용을 간략히 요약하여 사용자에게 보여준다.

## 3. 클러스터 진입점 확인

`graph/_index.md`를 읽고, 오늘 작업과 관련된 토픽 클러스터의 진입점 노드를 식별한다.
선행 읽기에 이미 포함되지 않은 진입점이 있으면 추가로 읽는다.

## 4. 열린 질문 확인

`graph/_index.md`에서 **open** 상태인 Question 목록을 추출한다.
오늘 탐구에서 답을 발견할 수 있는 질문이 있는지 사용자에게 알려준다.

## 5. 브리핑 출력

다음 포맷으로 요약을 출력한다:

```
=== EMDD Context Brief ===

[이전 Episode] ep-XXX: (제목)

[미착수 다음 단계]
1. (항목) — 선행 읽기: (노드 목록)
2. ...

[보류 중인 항목] (있으면)
- (항목) — 보류 이유

[관련 클러스터] (클러스터 이름) — 진입점: (노드)
[선행 읽기 요약]
- (노드 ID): (1줄 요약)
- ...

[관련 열린 질문]
- q-XXX: (질문)

[Consolidation] (check 결과 요약)

오늘 어떤 작업을 진행할까요?
```
"""

_SLASH_CMD_EPISODE = """\
# EMDD Episode 생성

현재 대화 세션의 내용을 분석하여 Episode 노드 초안을 생성한다.

## 수집할 정보

현재 대화를 역순으로 스캔하여 다음을 추출한다:

1. **목표**: 세션 시작 시 사용자가 요청한 작업
2. **시도한 것**: 실제로 실행한 도구 호출, 분석, 코드 작성 등 (성공한 것)
3. **막혔던 것**: 에러, 실패한 시도, 수정이 필요했던 가정
4. **하지 않기로 한 것**: 의식적으로 건너뛴 접근법 (사용자와 논의했거나 AI가 판단한 것)
5. **생성된 노드**: 이 세션에서 만든 Finding, Knowledge, Question 등
6. **떠오른 질문**: 세션 중 언급되었으나 추구하지 않은 의문

## Episode 파일 생성

다음 포맷으로 `graph/episodes/ep-NNN-{slug}.md` 파일을 생성한다.
NNN은 기존 Episode 번호의 다음 번호, slug는 작업 내용의 2-3단어 요약.

```markdown
---
id: ep-NNN
type: episode
trigger: "(세션 시작 트리거)"
created: (오늘 날짜)
duration: ~Nh
outcome: (success / partial / blocked)
created_by: human:bjkim + ai:claude
tags: [(관련 태그), (not-pursued:기각항목1), ...]
links:
  - target: (생성된 노드)
    relation: produces
  - target: (기반이 된 노드)
    relation: extends
  - target: (생성된 질문)
    relation: spawns
---

# EP-NNN: (제목)

## 목표
(1-2문장)

## 시도한 것
- [x] (성공한 접근 1)
- [x] (성공한 접근 2)

## 막혔던 것 / 실패
- (에러/실패와 해결 방법)

## 하지 않기로 한 것
- (기각한 방향): (이유)

## 다음에 할 것
- [ ] (다음 단계 1)
  - 선행 읽기: (관련 노드)
- [ ] (다음 단계 2)
  - 선행 읽기: (관련 노드)

## 떠오른 질문
- (미해결 의문)
```

## 후속 작업 (CLI 자동화)

초안 확인 후 다음 CLI 명령을 순서대로 실행한다:

1. Episode 파일 생성 → `uv run {EMDD_PY} new episode {slug}`
   → 생성된 템플릿 파일에 초안 내용(frontmatter links, tags, body)을 반영
2. Finding 생성 (있으면) → `uv run {EMDD_PY} new finding {slug}` × N
3. Question 생성 (있으면) → `uv run {EMDD_PY} new question {slug}` × N
4. 노드 간 링크 → `uv run {EMDD_PY} link ep-NNN find-NNN produces`
5. 이전 Episode 완료 마킹 → `uv run {EMDD_PY} done ep-{prev} "{항목}"`
6. Question 상태 변경 → `uv run {EMDD_PY} update q-NNN --set status=resolved`
7. 인덱스 갱신 → `uv run {EMDD_PY} index`
8. 트리거 체크 → `uv run {EMDD_PY} check`
"""

_SLASH_CMD_CONSOLIDATION = """\
# EMDD Consolidation 체크 및 실행

그래프의 Consolidation 트리거를 확인하고, 해당되면 정리를 실행한다.

## 1. 트리거 체크 (CLI)

```bash
uv run {EMDD_PY} check
```

위 결과가 "Consolidation 필요"이면 다음 단계를 진행한다.

## 2. Consolidation 실행 (트리거 시)

사용자 확인을 받은 후, 5단계를 순서대로 수행한다:

### 2.1 승격 (Finding → Knowledge)
- 각 Finding의 confidence를 확인
- 다른 Finding이나 실험 결과로 독립적으로 지지되는 Finding을 식별
- hint가 있는 Finding부터 검토 (frontmatter의 `extends: know-NNN` 링크)
- 승격 후보를 사용자에게 제시하고 승인을 받은 뒤:
  ```bash
  uv run {EMDD_PY} new knowledge {slug}
  uv run {EMDD_PY} link know-NNN find-NNN promotes
  ```

### 2.2 분할 (비대 Experiment)
- 5개 이상의 Finding이 연결된 Experiment를 식별
- 의미 단위로 분할 제안 (사용자 승인 후 실행)

### 2.3 질문 생성
- 모든 Episode의 "떠오른 질문" 중 아직 Question 노드가 없는 것을 수집
- `[deferred]` 항목 중 Question으로 승격할 후보를 식별
  ```bash
  uv run {EMDD_PY} new question {slug}
  uv run {EMDD_PY} link q-NNN ep-NNN spawned_from
  ```

### 2.4 가설 갱신
- 새 Finding/Knowledge에 의해 confidence가 변경되어야 할 Hypothesis를 식별
- 변경 제안을 사용자에게 보여주고 승인 후:
  ```bash
  uv run {EMDD_PY} update hyp-NNN --set confidence=0.8
  ```

### 2.5 고아 정리
- outgoing 링크가 없는 Finding 노드를 식별
- 관련 Question이나 Hypothesis와 연결:
  ```bash
  uv run {EMDD_PY} link find-NNN q-NNN answers
  ```

## 3. 완료 후

```bash
uv run {EMDD_PY} index
```

Consolidation 실행 사실을 기록하지는 않는다 (정리는 메타 활동).
"""

_SLASH_CMD_HEALTH = """\
# EMDD 그래프 건강도 대시보드

그래프의 현재 상태를 CLI로 수집하여 건강도 리포트를 출력한다.

## 1. CLI 데이터 수집

```bash
uv run {EMDD_PY} health
uv run {EMDD_PY} backlog
```

## 2. 보완 분석

CLI 출력에 추가로 다음을 확인한다:

- `graph/_index.md`의 클러스터 구조와 진입점 상태
- 모든 Episode의 "다음에 할 것"에서 `[deferred]` 항목의 구체적 내용
- `not-pursued:` 태그의 항목별 목록 (숫자뿐 아니라 내용)

## 3. 종합 리포트

CLI 출력과 보완 분석을 합쳐 다음 포맷으로 사용자에게 보고한다:

```
=== EMDD Graph Health ===

(health 커맨드 출력 요약)

[Backlog 현황]
  pending: N건
  deferred: N건
  (주요 항목 나열)

[추가 분석]
  (클러스터 진입점 상태, not-pursued 목록 등)

[권장 조치]
  (해당 시 Consolidation 권장, 특정 항목 검토 등)
```
"""

STATUS_OPEN = {"proposed", "testing", "pending"}
STATUS_RESOLVED_Q = {"resolved", "answered"}


def is_question_open(node: "Node") -> bool:
    """Determine if a Question node is open (unanswered)."""
    # urgency: resolved → resolved
    if node.meta.get("urgency", "").lower() == "resolved":
        return False
    # status field if present
    if node.status and node.status in STATUS_RESOLVED_Q:
        return False
    # answer_summary with actual content → resolved
    ans = node.meta.get("answer_summary")
    if ans is not None and ans and str(ans).lower() != "null":
        return False
    return True


# ── Data model ───────────────────────────────────────────────────────

@dataclass
class Link:
    target: str
    relation: str
    relation_canonical: str  # normalized (reverse labels resolved)
    is_reverse: bool
    strength: Optional[float] = None
    severity: Optional[str] = None
    completeness: Optional[float] = None


@dataclass
class Node:
    id: str
    type: str
    path: Path
    status: Optional[str] = None
    confidence: Optional[float] = None
    tags: list[str] = field(default_factory=list)
    links: list[Link] = field(default_factory=list)
    meta: dict = field(default_factory=dict)  # all frontmatter


@dataclass
class Graph:
    nodes: dict[str, Node] = field(default_factory=dict)  # id -> Node
    root: Path = field(default=Path("."))

    @property
    def by_type(self) -> dict[str, list[Node]]:
        result: dict[str, list[Node]] = defaultdict(list)
        for node in self.nodes.values():
            result[node.type].append(node)
        return result


# ── Graph loading ────────────────────────────────────────────────────

def find_graph_root(start: Path | None = None) -> Path:
    """Walk up from start to find a directory containing graph/."""
    p = (start or Path.cwd()).resolve()
    while p != p.parent:
        if (p / "graph").is_dir():
            return p / "graph"
        p = p.parent
    typer.echo("Error: graph/ directory not found.", err=True)
    raise typer.Exit(1)


def parse_link(raw: dict) -> Link:
    rel = raw.get("relation", "relates_to").lower()
    is_reverse = rel in REVERSE_LABELS
    canonical = REVERSE_LABELS.get(rel, rel)
    return Link(
        target=raw.get("target", ""),
        relation=rel,
        relation_canonical=canonical,
        is_reverse=is_reverse,
        strength=raw.get("strength"),
        severity=raw.get("severity"),
        completeness=raw.get("completeness"),
    )


def load_node(path: Path) -> Node | None:
    try:
        post = frontmatter.load(path)
    except Exception:
        return None
    meta = dict(post.metadata)
    node_id = meta.get("id", path.stem)
    node_type = meta.get("type", "unknown")
    links_raw = meta.get("links", []) or []
    links = [parse_link(lk) for lk in links_raw if isinstance(lk, dict)]
    return Node(
        id=node_id,
        type=node_type,
        path=path,
        status=(meta.get("status") or "").lower() or None,
        confidence=meta.get("confidence"),
        tags=meta.get("tags", []) or [],
        links=links,
        meta=meta,
    )


def load_graph(graph_dir: Path) -> Graph:
    g = Graph(root=graph_dir)
    # Root-level files (problem.md, constraints.md)
    for md in graph_dir.glob("*.md"):
        if md.name.startswith("_"):
            continue
        node = load_node(md)
        if node:
            g.nodes[node.id] = node
    # Subdirectory files
    for subdir in graph_dir.iterdir():
        if not subdir.is_dir() or subdir.name.startswith("_"):
            continue
        for md in sorted(subdir.glob("*.md")):
            node = load_node(md)
            if node:
                g.nodes[node.id] = node
    return g


# ── Consolidation check ─────────────────────────────────────────────

@app.command()
def check(path: Optional[Path] = typer.Argument(None, help="Project root or graph/ path")):
    """Check consolidation triggers."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)
    bt = g.by_type

    findings = bt.get("finding", [])
    knowledge = bt.get("knowledge", [])
    episodes = bt.get("episode", [])
    questions = bt.get("question", [])
    experiments = bt.get("experiment", [])

    # 1. Unpromoted findings
    promoted_ids: set[str] = set()
    for kn in knowledge:
        for lk in kn.links:
            if lk.relation_canonical == "promotes":
                promoted_ids.add(lk.target)
    unpromoted = [f for f in findings if f.id not in promoted_ids]
    unpromoted_trigger = len(unpromoted) >= 5

    # 2. Episode accumulation
    ep_count = len(episodes)
    ep_trigger = ep_count >= 3

    # 3. Open questions = 0
    open_qs = [q for q in questions if is_question_open(q)]
    q_trigger = len(open_qs) == 0 and len(questions) > 0

    # 4. Catch-all experiment (5+ findings)
    exp_finding_count: dict[str, int] = defaultdict(int)
    for f in findings:
        for lk in f.links:
            if lk.relation in ("produced_by",) or lk.relation_canonical == "produces":
                exp_finding_count[lk.target] += 1
    for e in experiments:
        for lk in e.links:
            if lk.relation_canonical in ("produces", "spawns"):
                exp_finding_count[e.id] += 1
    overloaded_exps = {eid: c for eid, c in exp_finding_count.items() if c >= 5}
    exp_trigger = len(overloaded_exps) > 0

    # 5. Deferred items in episodes
    deferred_count = 0
    for ep in episodes:
        deferred_count += sum(1 for t in ep.tags if t.startswith("not-pursued:"))
        # Also count [deferred] in episode body if we can
    deferred_trigger = deferred_count >= 3

    any_triggered = unpromoted_trigger or ep_trigger or q_trigger or exp_trigger or deferred_trigger

    # Output
    console.print("\n[bold]=== EMDD Consolidation Check ===[/bold]\n")
    _print_trigger("Finding 미승격", len(unpromoted), 5, unpromoted_trigger)
    _print_trigger("Episode 축적", ep_count, 3, ep_trigger)
    _print_trigger("열린 Question", len(open_qs), ">0", q_trigger, invert=True)
    _print_trigger("Catch-all Experiment", len(overloaded_exps), 1, exp_trigger, label_fmt="{v}개 과부하")
    _print_trigger("not-pursued 누적", deferred_count, 3, deferred_trigger)

    if any_triggered:
        console.print("\n[bold red]→ Consolidation 필요[/bold red]\n")
    else:
        console.print("\n[bold green]→ Consolidation 불필요[/bold green]\n")


def _print_trigger(name: str, value, threshold, triggered: bool, invert: bool = False, label_fmt: str | None = None):
    status = "[red]TRIGGERED[/red]" if triggered else "[green]OK[/green]"
    val_str = label_fmt.format(v=value) if label_fmt else f"{value}개"
    thr_str = f"임계: {threshold}" if not invert else "임계: 0 (환각 경고)"
    console.print(f"  {name}: {val_str} ({thr_str}) → {status}")


# ── Health dashboard ─────────────────────────────────────────────────

@app.command()
def health(path: Optional[Path] = typer.Argument(None, help="Project root or graph/ path")):
    """Display graph health dashboard."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)
    bt = g.by_type

    findings = bt.get("finding", [])
    knowledge = bt.get("knowledge", [])
    hypotheses = bt.get("hypothesis", [])
    experiments = bt.get("experiment", [])
    questions = bt.get("question", [])
    episodes = bt.get("episode", [])
    decisions = bt.get("decision", [])

    # Promoted count
    promoted_ids: set[str] = set()
    for kn in knowledge:
        for lk in kn.links:
            if lk.relation_canonical == "promotes":
                promoted_ids.add(lk.target)
    unpromoted = len(findings) - len(promoted_ids & {f.id for f in findings})

    # Hypothesis statuses
    hyp_status: dict[str, int] = defaultdict(int)
    for h in hypotheses:
        hyp_status[h.status or "unknown"] += 1

    # Question statuses
    open_qs = [q for q in questions if is_question_open(q)]
    resolved_qs = len(questions) - len(open_qs)

    # Experiment statuses
    exp_status: dict[str, int] = defaultdict(int)
    for e in experiments:
        exp_status[e.status or "unknown"] += 1

    # not-pursued count
    not_pursued = sum(1 for ep in episodes for t in ep.tags if t.startswith("not-pursued:"))

    total = len(g.nodes)

    # Output
    console.print("\n[bold]=== EMDD Graph Health ===[/bold]\n")

    console.print("[bold]노드 현황[/bold]")
    table = Table(show_header=False, padding=(0, 2))
    table.add_column(style="cyan", min_width=14)
    table.add_column()
    table.add_row("Knowledge", f"{len(knowledge)}개")
    hyp_detail = ", ".join(f"{k}: {v}" for k, v in sorted(hyp_status.items()))
    table.add_row("Hypothesis", f"{len(hypotheses)}개 ({hyp_detail})")
    exp_detail = ", ".join(f"{k}: {v}" for k, v in sorted(exp_status.items()))
    table.add_row("Experiment", f"{len(experiments)}개 ({exp_detail})")
    table.add_row("Finding", f"{len(findings)}개 (미승격: {unpromoted})")
    table.add_row("Question", f"{len(questions)}개 (open: {len(open_qs)}, resolved: {resolved_qs})")
    table.add_row("Episode", f"{len(episodes)}개")
    table.add_row("Decision", f"{len(decisions)}개")
    table.add_row("[bold]총 노드[/bold]", f"[bold]{total}개[/bold]")
    console.print(table)

    # Health metrics
    console.print("\n[bold]건강 지표[/bold]")
    promo_rate = f"{len(promoted_ids)}/{len(findings)}" if findings else "N/A"
    promo_pct = f"({len(promoted_ids) / len(findings) * 100:.0f}%)" if findings else ""
    avg_q = f"{len(questions) / len(episodes):.1f}개" if episodes else "N/A"
    console.print(f"  Finding→Knowledge 승격률: {promo_rate} {promo_pct}")
    console.print(f"  Episode당 평균 Question:  {avg_q}")
    console.print(f"  열린 Question 수:         {len(open_qs)}개")
    console.print(f"  not-pursued 누적:         {not_pursued}개")

    # Warnings
    console.print("\n[bold]경고[/bold]")
    warnings = 0
    if unpromoted >= 5:
        console.print(f"  [yellow]⚠ Finding Cemetery: 미승격 Finding {unpromoted}개 (임계 5)[/yellow]")
        warnings += 1
    if len(open_qs) == 0 and len(questions) > 0:
        console.print("  [yellow]⚠ Question 고갈: 열린 Question 0개[/yellow]")
        warnings += 1
    if len(episodes) >= 3:
        console.print(f"  [yellow]⚠ Consolidation 필요: Episode {len(episodes)}개 축적[/yellow]")
        warnings += 1
    if not_pursued >= 3:
        console.print(f"  [yellow]⚠ 보류 항목 검토 필요: not-pursued {not_pursued}개 (임계 3)[/yellow]")
        warnings += 1
    if warnings == 0:
        console.print("  [green]✓ 건강 상태 양호[/green]")
    console.print()


# ── Index generation ─────────────────────────────────────────────────

@app.command()
def index(
    path: Optional[Path] = typer.Argument(None, help="Project root or graph/ path"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="Print to stdout instead of writing"),
):
    """Generate _index.md from graph nodes."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)
    bt = g.by_type

    lines: list[str] = []
    lines.append("---")
    lines.append(f"generated: {date.today().isoformat()}")
    lines.append(f"node_count: {len(g.nodes)}")
    lines.append("---")
    lines.append("")
    lines.append("# EMDD Graph Index")
    lines.append("")

    # Problem & Constraints (root-level)
    root_nodes = [n for n in g.nodes.values() if n.type in ("problem", "knowledge") and n.path.parent == graph_dir]
    if root_nodes:
        for n in root_nodes:
            rel = n.path.relative_to(graph_dir)
            lines.append(f"- [[{rel.with_suffix('')}]] — {_title_from_path(n.path)}")
        lines.append("")

    # Decisions
    decisions = bt.get("decision", [])
    if decisions:
        lines.append("## Decisions")
        for d in sorted(decisions, key=lambda n: n.id):
            rel = d.path.relative_to(graph_dir)
            lines.append(f"- [[{rel.with_suffix('')}]] — {_title_from_path(d.path)}")
        lines.append("")

    lines.append("---")
    lines.append("")

    # Cluster detection: group by shared tags (simple heuristic)
    # For now, output by type in flat structure
    # Hypotheses
    hypotheses = bt.get("hypothesis", [])
    if hypotheses:
        lines.append("## Hypotheses")
        table_lines = ["| ID | Status | Confidence |", "|----|--------|------------|"]
        for h in sorted(hypotheses, key=lambda n: n.id):
            rel = d.path.relative_to(graph_dir) if d else ""
            st = f"**{h.status}**" if h.status in ("confirmed", "refuted") else (h.status or "?")
            conf = f"{h.confidence:.2f}" if h.confidence is not None else "?"
            rel = h.path.relative_to(graph_dir)
            table_lines.append(f"| [[{rel.with_suffix('')}]] | {st} | {conf} |")
        lines.extend(table_lines)
        lines.append("")

    # Knowledge
    knowledge = bt.get("knowledge", [])
    if knowledge:
        lines.append("## Knowledge")
        for k in sorted(knowledge, key=lambda n: n.id):
            if k in root_nodes:
                continue
            rel = k.path.relative_to(graph_dir)
            lines.append(f"- [[{rel.with_suffix('')}]] — {_title_from_path(k.path)}")
        lines.append("")

    # Findings
    findings = bt.get("finding", [])
    if findings:
        lines.append("## Findings")
        promoted_ids: set[str] = set()
        for kn in knowledge:
            for lk in kn.links:
                if lk.relation_canonical == "promotes":
                    promoted_ids.add(lk.target)
        for f in sorted(findings, key=lambda n: n.id):
            rel = f.path.relative_to(graph_dir)
            promoted_mark = " ← promoted" if f.id in promoted_ids else ""
            lines.append(f"- [[{rel.with_suffix('')}]] — {_title_from_path(f.path)}{promoted_mark}")
        lines.append("")

    # Questions
    questions = bt.get("question", [])
    open_qs = [q for q in questions if is_question_open(q)]
    resolved = [q for q in questions if not is_question_open(q)]

    if open_qs:
        lines.append("## Open Questions")
        for q in sorted(open_qs, key=lambda n: n.id):
            rel = q.path.relative_to(graph_dir)
            urg = f" [{q.meta.get('urgency', '')}]" if q.meta.get("urgency") else ""
            lines.append(f"- [[{rel.with_suffix('')}]]{urg} — {_title_from_path(q.path)}")
        lines.append("")

    if resolved:
        lines.append("## Resolved Questions")
        for q in sorted(resolved, key=lambda n: n.id):
            rel = q.path.relative_to(graph_dir)
            lines.append(f"- [[{rel.with_suffix('')}]] — {_title_from_path(q.path)}")
        lines.append("")

    # Experiments
    experiments = bt.get("experiment", [])
    if experiments:
        lines.append("## Experiments")
        table_lines = ["| ID | Status |", "|----|--------|"]
        for e in sorted(experiments, key=lambda n: n.id):
            rel = e.path.relative_to(graph_dir)
            table_lines.append(f"| [[{rel.with_suffix('')}]] | {e.status or '?'} |")
        lines.extend(table_lines)
        lines.append("")

    # Episodes
    episodes = bt.get("episode", [])
    if episodes:
        lines.append("## Episodes")
        for ep in sorted(episodes, key=lambda n: n.id):
            rel = ep.path.relative_to(graph_dir)
            outcome = f"({ep.meta.get('outcome', '?')})" if ep.meta.get("outcome") else ""
            lines.append(f"- [[{rel.with_suffix('')}]] {outcome} — {_title_from_path(ep.path)}")
        lines.append("")

    # Negative decisions (not-pursued)
    neg_decisions: list[str] = []
    for ep in episodes:
        for t in ep.tags:
            if t.startswith("not-pursued:"):
                neg_decisions.append(t.removeprefix("not-pursued:"))
    if neg_decisions:
        lines.append("## Negative Decisions")
        for nd in neg_decisions:
            lines.append(f"- {nd}")
        lines.append("")

    output = "\n".join(lines) + "\n"

    if dry_run:
        console.print(output, highlight=False, markup=False)
    else:
        out_path = graph_dir / "_index.md"
        out_path.write_text(output, encoding="utf-8")
        console.print(f"[green]✓[/green] {out_path} 생성 완료 ({len(g.nodes)}개 노드)")


def _title_from_path(p: Path) -> str:
    """Extract a human-readable title from a node filename."""
    stem = p.stem
    # Remove id prefix like "find-013-" or "hyp-001-"
    parts = stem.split("-", 2)
    if len(parts) >= 3:
        return parts[2].replace("-", " ")
    elif len(parts) == 2:
        return parts[1].replace("-", " ")
    return stem


# ── Node lookup helpers ──────────────────────────────────────────────


def _find_node_file(graph_dir: Path, node_id: str) -> Path:
    """Find a node file by its ID (e.g., 'q-006' → graph/questions/q-006-*.md)."""
    m = re.match(r"^([a-z]+)-\d+", node_id)
    if not m:
        typer.echo(f"Error: invalid node ID format '{node_id}'", err=True)
        raise typer.Exit(1)
    prefix = m.group(1)
    node_type = _PREFIX_TO_TYPE.get(prefix)
    if not node_type:
        typer.echo(f"Error: unknown prefix '{prefix}' in node ID '{node_id}'", err=True)
        raise typer.Exit(1)
    subdir = graph_dir / NODE_TYPE_DIRS[node_type]
    candidates = list(subdir.glob(f"{node_id}-*.md"))
    exact = subdir / f"{node_id}.md"
    if exact.is_file() and exact not in candidates:
        candidates.append(exact)
    if len(candidates) == 0:
        typer.echo(f"Error: no file found for '{node_id}' in {subdir}", err=True)
        raise typer.Exit(1)
    if len(candidates) > 1:
        typer.echo(f"Error: multiple files match '{node_id}':", err=True)
        for c in candidates:
            typer.echo(f"  {c}", err=True)
        raise typer.Exit(1)
    return candidates[0]


def _infer_type(val: str):
    """Infer Python type from a string value (null/bool/numeric/string)."""
    low = val.lower()
    if low in ("null", "none"):
        return None
    if low == "true":
        return True
    if low == "false":
        return False
    try:
        return int(val)
    except ValueError:
        pass
    try:
        return float(val)
    except ValueError:
        pass
    return val


# ── Node creation helpers ────────────────────────────────────────────


def _next_id(graph_dir: Path, node_type: str) -> int:
    """Find the next available numeric ID for a node type."""
    subdir = graph_dir / NODE_TYPE_DIRS[node_type]
    prefix = ID_PREFIXES[node_type]
    numbers: list[int] = []
    if subdir.is_dir():
        for f in subdir.glob("*.md"):
            m = re.match(rf"^{prefix}-(\d+)", f.stem)
            if m:
                numbers.append(int(m.group(1)))
    return max(numbers) + 1 if numbers else 1


def _node_template(node_type: str, node_id: str, slug: str, today: str, user: str) -> str:
    """Generate frontmatter + body for a new node."""
    title = slug.replace("-", " ")

    if node_type == "episode":
        return f"""\
---
id: {node_id}
type: episode
trigger: ""
created: {today}
duration: ~1h
outcome: partial
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {node_id.upper()}: {title}

## 목표


## 시도한 것
- [x]

## 막혔던 것 / 실패
-

## 하지 않기로 한 것
-

## 다음에 할 것
- [ ]
  - 선행 읽기:

## 떠오른 질문
-
"""

    if node_type == "finding":
        return f"""\
---
id: {node_id}
type: finding
finding_type: observation
confidence: 0.5
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 관찰


## 근거

"""

    if node_type == "hypothesis":
        return f"""\
---
id: {node_id}
type: hypothesis
status: proposed
confidence: 0.5
risk_level: medium
kill_criterion: ""
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 주장


## Kill Criterion

"""

    if node_type == "experiment":
        return f"""\
---
id: {node_id}
type: experiment
status: planned
config: {{}}
results: {{}}
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 목적


## 방법


## 결과

"""

    if node_type == "question":
        return f"""\
---
id: {node_id}
type: question
question_type: structural
urgency: medium
answer_summary: null
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 질문


## 맥락

"""

    if node_type == "knowledge":
        return f"""\
---
id: {node_id}
type: knowledge
status: active
knowledge_type: domain
source: ""
confidence: 0.8
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 내용

"""

    if node_type == "decision":
        return f"""\
---
id: {node_id}
type: decision
alternatives_considered: []
rationale: ""
reversibility: medium
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}

## 결정


## 근거


## 대안

"""

    # fallback
    return f"""\
---
id: {node_id}
type: {node_type}
created: {today}
created_by: human:{user} + ai:claude
tags: []
links: []
---

# {title}
"""


# ── new command ──────────────────────────────────────────────────────

@app.command()
def new(
    node_type: str = typer.Argument(..., help="노드 타입"),
    slug: str = typer.Argument(..., help="파일명 slug (예: lut-thinning)"),
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="프로젝트 경로"),
):
    """Create a new EMDD node with appropriate template."""
    if node_type not in NODE_TYPE_DIRS:
        valid = ", ".join(sorted(NODE_TYPE_DIRS.keys()))
        typer.echo(f"Error: unknown node type '{node_type}'. Valid types: {valid}", err=True)
        raise typer.Exit(1)

    graph_dir = find_graph_root(path)
    subdir = graph_dir / NODE_TYPE_DIRS[node_type]
    subdir.mkdir(parents=True, exist_ok=True)

    num = _next_id(graph_dir, node_type)
    prefix = ID_PREFIXES[node_type]
    node_id = f"{prefix}-{num:03d}"
    filename = f"{node_id}-{slug}.md"

    today = date.today().isoformat()
    user = os.getenv("USER", "unknown")
    content = _node_template(node_type, node_id, slug, today, user)

    out_path = subdir / filename
    out_path.write_text(content, encoding="utf-8")
    console.print(f"[green]✓[/green] {out_path}")


# ── update command ───────────────────────────────────────────────────

@app.command()
def update(
    node_id: str = typer.Argument(..., help="노드 ID (예: q-006)"),
    set_values: list[str] = typer.Option([], "--set", "-s", help="key=value 형식"),
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="프로젝트 경로"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="변경 사항만 표시"),
):
    """Update node frontmatter fields."""
    if not set_values:
        typer.echo("Error: --set 옵션을 하나 이상 지정하세요", err=True)
        raise typer.Exit(1)

    graph_dir = find_graph_root(path)
    node_file = _find_node_file(graph_dir, node_id)
    post = frontmatter.load(node_file)

    changes: list[tuple[str, object, object]] = []
    for sv in set_values:
        if "=" not in sv:
            typer.echo(f"Error: '{sv}' is not key=value format", err=True)
            raise typer.Exit(1)
        key, val_str = sv.split("=", 1)
        val = _infer_type(val_str)
        if key == "confidence":
            if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 1.0):
                typer.echo(f"Error: confidence must be 0.0~1.0, got '{val_str}'", err=True)
                raise typer.Exit(1)
        old = post.metadata.get(key, "<unset>")
        post.metadata[key] = val
        changes.append((key, old, val))

    if dry_run:
        console.print(f"[bold]dry-run: {node_file.name}[/bold]")
        for key, old, new in changes:
            console.print(f"  {key}: {old} → {new}")
        return

    node_file.write_text(frontmatter.dumps(post), encoding="utf-8")
    console.print(f"[green]✓[/green] {node_file.name} 업데이트")
    for key, old, new in changes:
        console.print(f"  {key}: {old} → {new}")


# ── link command ─────────────────────────────────────────────────────

@app.command()
def link(
    source_id: str = typer.Argument(..., help="소스 노드 ID"),
    target_id: str = typer.Argument(..., help="타겟 노드 ID"),
    relation: str = typer.Argument(..., help="관계 타입 (예: produces, extends)"),
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="프로젝트 경로"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="변경 사항만 표시"),
):
    """Add a link to a node's frontmatter."""
    if relation not in ALL_VALID_RELATIONS:
        typer.echo(f"Error: unknown relation '{relation}'", err=True)
        typer.echo(f"Valid: {', '.join(sorted(ALL_VALID_RELATIONS))}", err=True)
        raise typer.Exit(1)

    graph_dir = find_graph_root(path)
    source_file = _find_node_file(graph_dir, source_id)
    _find_node_file(graph_dir, target_id)  # validate target exists

    post = frontmatter.load(source_file)
    links = post.metadata.get("links", []) or []

    for lk in links:
        if isinstance(lk, dict) and lk.get("target") == target_id and lk.get("relation") == relation:
            console.print(f"[yellow]⚠ 중복 link: {source_id} --{relation}--> {target_id} (skip)[/yellow]")
            return

    new_link = {"target": target_id, "relation": relation}
    links.append(new_link)
    post.metadata["links"] = links

    if dry_run:
        console.print(f"[bold]dry-run: {source_file.name}[/bold]")
        console.print(f"  + link: {source_id} --{relation}--> {target_id}")
        return

    source_file.write_text(frontmatter.dumps(post), encoding="utf-8")
    console.print(f"[green]✓[/green] {source_file.name}: {source_id} --{relation}--> {target_id}")


# ── done command ─────────────────────────────────────────────────────

@app.command()
def done(
    episode_id: str = typer.Argument(..., help="Episode ID (예: ep-007)"),
    item_substring: str = typer.Argument(..., help="항목 검색 문자열"),
    marker: str = typer.Option("done", "--marker", "-m", help="마커 (done|deferred|superseded)"),
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="프로젝트 경로"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="변경 사항만 표시"),
):
    """Mark a '다음에 할 것' item as done/deferred/superseded."""
    valid_markers = {"done", "deferred", "superseded"}
    if marker not in valid_markers:
        typer.echo(f"Error: marker must be one of {valid_markers}", err=True)
        raise typer.Exit(1)

    graph_dir = find_graph_root(path)
    ep_file = _find_node_file(graph_dir, episode_id)
    text = ep_file.read_text(encoding="utf-8")

    lines = text.split("\n")
    matches: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        if re.search(r"- \[ \]", line) and item_substring in line:
            matches.append((i, line))

    if len(matches) == 0:
        typer.echo(f"Error: no '- [ ]' item matching '{item_substring}' in {ep_file.name}", err=True)
        raise typer.Exit(1)
    if len(matches) > 1:
        typer.echo(f"Error: multiple matches for '{item_substring}':", err=True)
        for i, line in matches:
            typer.echo(f"  L{i + 1}: {line.strip()}", err=True)
        raise typer.Exit(1)

    idx, matched_line = matches[0]
    new_line = matched_line.replace("- [ ]", f"- [{marker}]")

    if dry_run:
        console.print(f"[bold]dry-run: {ep_file.name}[/bold]")
        console.print(f"  L{idx + 1}: {matched_line.strip()}", highlight=False)
        console.print(f"     → {new_line.strip()}", highlight=False, markup=False)
        return

    lines[idx] = new_line
    ep_file.write_text("\n".join(lines), encoding="utf-8")
    console.print(f"[green]✓[/green] {ep_file.name} L{idx + 1}: [{marker}]")


# ── backlog command ──────────────────────────────────────────────────

@app.command()
def backlog(
    status: str = typer.Option("default", "--status", "-s", help="pending|deferred|all (기본: pending+deferred)"),
    path: Optional[Path] = typer.Option(None, "--path", "-p", help="프로젝트 경로"),
):
    """Show pending items from all episodes' '다음에 할 것' sections."""
    graph_dir = find_graph_root(path)
    ep_dir = graph_dir / "episodes"
    if not ep_dir.is_dir():
        typer.echo("Error: episodes/ directory not found", err=True)
        raise typer.Exit(1)

    # Collect all items
    all_items: list[tuple[str, str, str]] = []  # (ep_id, marker, text)
    for ep_file in sorted(ep_dir.glob("*.md")):
        try:
            post = frontmatter.load(ep_file)
            ep_id = post.metadata.get("id", ep_file.stem)
        except Exception:
            ep_id = ep_file.stem

        text = ep_file.read_text(encoding="utf-8")
        in_section = False
        for line in text.split("\n"):
            if re.match(r"^##\s+다음에 할 것", line):
                in_section = True
                continue
            if in_section and re.match(r"^##\s+", line):
                break
            if not in_section:
                continue

            m = re.match(r"^- \[(\s*|done|deferred|superseded)\]\s*(.+)", line)
            if m:
                marker_val = m.group(1).strip() or "pending"
                item_text = m.group(2).strip()
                all_items.append((ep_id, marker_val, item_text))

    # Dedup: keep only latest episode per item text
    latest: dict[str, tuple[str, str]] = {}
    for ep_id, marker_val, item_text in all_items:
        latest[item_text] = (ep_id, marker_val)

    # Filter
    filtered: list[tuple[str, str, str]] = []
    for item_text, (ep_id, marker_val) in latest.items():
        if status == "default" and marker_val in ("done", "superseded"):
            continue
        elif status == "pending" and marker_val != "pending":
            continue
        elif status == "deferred" and marker_val != "deferred":
            continue
        # status == "all" shows everything
        filtered.append((ep_id, marker_val, item_text))

    table = Table(title="EMDD Backlog")
    table.add_column("Episode", style="cyan")
    table.add_column("Status")
    table.add_column("Item")
    for ep_id, marker_val, item_text in filtered:
        style = "yellow" if marker_val == "deferred" else ""
        table.add_row(ep_id, marker_val, item_text, style=style)
    console.print(table)
    console.print(f"  총 {len(filtered)}건")


# ── init command ─────────────────────────────────────────────────────

def _build_slash_files() -> dict[str, str]:
    """Build slash command files with {EMDD_PY} replaced by actual path."""
    emdd_py_path = str(Path(__file__).resolve())
    return {
        "emdd-context.md": _SLASH_CMD_CONTEXT.replace("{EMDD_PY}", emdd_py_path),
        "emdd-episode.md": _SLASH_CMD_EPISODE.replace("{EMDD_PY}", emdd_py_path),
        "emdd-consolidation.md": _SLASH_CMD_CONSOLIDATION.replace("{EMDD_PY}", emdd_py_path),
        "emdd-health.md": _SLASH_CMD_HEALTH.replace("{EMDD_PY}", emdd_py_path),
    }


@app.command()
def init(
    target: Path = typer.Argument(Path("."), help="프로젝트 디렉토리"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="생성할 항목만 표시"),
    update_commands: bool = typer.Option(False, "--update-commands", "-u", help="슬래시 커맨드만 재설치"),
):
    """Initialize EMDD graph structure and slash commands."""
    target = target.resolve()
    commands_dir = target / ".claude" / "commands"

    # --update-commands: only reinstall slash command files
    if update_commands:
        slash_files = _build_slash_files()
        if dry_run:
            console.print("[bold]갱신 예정:[/bold]")
            for name in slash_files:
                console.print(f"  [green]FILE[/green] .claude/commands/{name}")
            return
        commands_dir.mkdir(parents=True, exist_ok=True)
        for name, content in slash_files.items():
            (commands_dir / name).write_text(content, encoding="utf-8")
        console.print(f"[green]✓[/green] 슬래시 커맨드 {len(slash_files)}개 갱신 완료: {commands_dir}")
        return

    graph_dir = target / "graph"

    if graph_dir.is_dir():
        console.print(f"[yellow]⚠ {graph_dir} 이미 존재합니다. 기존 그래프를 보호하기 위해 중단합니다.[/yellow]")
        console.print(f"[yellow]  슬래시 커맨드만 갱신하려면: emdd init {target} --update-commands[/yellow]")
        raise typer.Exit(1)

    # Directories to create
    subdirs = [
        graph_dir / "_analysis",
        graph_dir / "hypotheses",
        graph_dir / "experiments",
        graph_dir / "findings",
        graph_dir / "knowledge",
        graph_dir / "questions",
        graph_dir / "decisions",
        graph_dir / "episodes",
    ]

    # Files to create
    today = date.today().isoformat()
    user = os.getenv("USER", "unknown")

    index_content = f"""\
---
generated: {today}
node_count: 0
---

# EMDD Graph Index
"""

    problem_content = f"""\
---
id: prob-001
type: problem
created: {today}
created_by: human:{user}
tags: []
links: []
---

# 핵심 질문

## 동기


## 범위

"""

    slash_files = _build_slash_files()

    all_dirs = subdirs + [commands_dir]
    all_files: list[tuple[Path, str]] = [
        (graph_dir / "_index.md", index_content),
        (graph_dir / "problem.md", problem_content),
    ]
    for name, content in slash_files.items():
        all_files.append((commands_dir / name, content))

    if dry_run:
        console.print("[bold]생성 예정:[/bold]")
        for d in all_dirs:
            console.print(f"  [cyan]DIR [/cyan] {d.relative_to(target)}/")
        for f, _ in all_files:
            console.print(f"  [green]FILE[/green] {f.relative_to(target)}")
        return

    for d in all_dirs:
        d.mkdir(parents=True, exist_ok=True)
    for f, content in all_files:
        f.write_text(content, encoding="utf-8")

    console.print(f"[green]✓[/green] EMDD 초기화 완료: {target}")
    console.print(f"  디렉토리 {len(all_dirs)}개, 파일 {len(all_files)}개 생성")


# ── graph (Mermaid) command ──────────────────────────────────────────

@app.command()
def graph(
    path: Optional[Path] = typer.Argument(None, help="프로젝트 경로"),
    dry_run: bool = typer.Option(False, "--dry-run", "-n", help="stdout 출력"),
):
    """Generate Mermaid graph visualization."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)

    lines: list[str] = [
        "graph TD",
        "    classDef problem fill:#e63946,color:#fff",
        "    classDef hypothesis fill:#e9c46a,color:#000",
        "    classDef experiment fill:#2a9d8f,color:#fff",
        "    classDef finding fill:#7b2cbf,color:#fff",
        "    classDef question fill:#ffd166,color:#000",
        "    classDef decision fill:#264653,color:#fff",
        "    classDef knowledge fill:#4361ee,color:#fff",
        "    classDef episode fill:#9ca3af,color:#000",
        "",
    ]

    # Build node ID -> var name mapping
    def _var_name(node_id: str) -> str:
        return node_id.replace("-", "").upper()

    # Group nodes by type in display order
    type_order = ["problem", "knowledge", "hypothesis", "experiment", "finding", "question", "decision", "episode"]
    bt = g.by_type

    for ntype in type_order:
        nodes = bt.get(ntype, [])
        for n in sorted(nodes, key=lambda x: x.id):
            var = _var_name(n.id)
            title = _title_from_path(n.path)
            label = f"{n.id}: {title}"
            if ntype == "hypothesis" and n.confidence is not None:
                label += f"<br/>confidence: {n.confidence}"
            lines.append(f"    {var}[{label}]:::{ntype}")
    lines.append("")

    # Edges
    node_ids = set(g.nodes.keys())
    for n in g.nodes.values():
        src_var = _var_name(n.id)
        for lk in n.links:
            if lk.target not in node_ids:
                continue
            tgt_var = _var_name(lk.target)
            if lk.is_reverse:
                lines.append(f"    {tgt_var} -->|{lk.relation_canonical}| {src_var}")
            else:
                lines.append(f"    {src_var} -->|{lk.relation}| {tgt_var}")
    lines.append("")

    output = "\n".join(lines)

    if dry_run:
        console.print(output, highlight=False, markup=False)
    else:
        out_path = graph_dir / "_graph.mmd"
        out_path.write_text(output, encoding="utf-8")
        console.print(f"[green]✓[/green] {out_path} 생성 완료 ({len(g.nodes)}개 노드)")


# ── Lint / validate ──────────────────────────────────────────────────

@app.command()
def lint(path: Optional[Path] = typer.Argument(None, help="Project root or graph/ path")):
    """Validate graph nodes for schema and link integrity."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)

    errors: list[str] = []
    warnings: list[str] = []

    for node in g.nodes.values():
        prefix = f"[{node.id}]"

        # Required fields
        if not node.type:
            errors.append(f"{prefix} type 필드 누락")
        if not node.meta.get("created"):
            warnings.append(f"{prefix} created 필드 누락")

        # Confidence bounds
        if node.confidence is not None:
            if not (0.0 <= node.confidence <= 1.0):
                errors.append(f"{prefix} confidence={node.confidence} 범위 초과 (0.0~1.0)")

        # Link integrity
        for lk in node.links:
            # Check relation validity
            if lk.relation not in ALL_VALID_RELATIONS:
                warnings.append(f"{prefix} 알 수 없는 relation: '{lk.relation}'")
            # Check target exists
            target_id = lk.target
            # Target can be a relative path or an ID
            if target_id not in g.nodes:
                # Try matching by path-like target (e.g., "find-005")
                matched = any(n.id == target_id for n in g.nodes.values())
                if not matched:
                    warnings.append(f"{prefix} 링크 대상 '{target_id}' 그래프에 없음")

        # Type-specific checks
        if node.type == "hypothesis":
            if node.confidence is None:
                errors.append(f"{prefix} hypothesis에 confidence 누락")
            if not node.meta.get("kill_criterion"):
                warnings.append(f"{prefix} hypothesis에 kill_criterion 누락")

        if node.type == "finding":
            if not node.meta.get("finding_type"):
                warnings.append(f"{prefix} finding에 finding_type 누락")

        if node.type == "question":
            if not node.meta.get("urgency"):
                warnings.append(f"{prefix} question에 urgency 누락")

    # Output
    console.print(f"\n[bold]=== EMDD Lint ({len(g.nodes)} nodes) ===[/bold]\n")

    if errors:
        for e in errors:
            console.print(f"  [red]✗[/red] {e}")
    if warnings:
        for w in warnings:
            console.print(f"  [yellow]![/yellow] {w}")
    if not errors and not warnings:
        console.print("  [green]✓ 모든 노드 유효[/green]")

    console.print(f"\n  오류: {len(errors)}, 경고: {len(warnings)}\n")

    if errors:
        raise typer.Exit(1)


# ── Promotion candidates ─────────────────────────────────────────────

@app.command()
def promote(path: Optional[Path] = typer.Argument(None, help="Project root or graph/ path")):
    """List Finding nodes eligible for Knowledge promotion."""
    graph_dir = find_graph_root(path)
    g = load_graph(graph_dir)
    bt = g.by_type

    findings = bt.get("finding", [])
    knowledge = bt.get("knowledge", [])

    # Already promoted
    promoted_ids: set[str] = set()
    for kn in knowledge:
        for lk in kn.links:
            if lk.relation_canonical == "promotes":
                promoted_ids.add(lk.target)

    # Build support graph: who supports whom
    support_count: dict[str, set[str]] = defaultdict(set)  # target -> set of source ids
    for node in g.nodes.values():
        for lk in node.links:
            if lk.relation_canonical in ("supports", "confirms"):
                support_count[lk.target].add(node.id)

    candidates: list[tuple[Node, list[str]]] = []
    for f in findings:
        if f.id in promoted_ids:
            continue
        reasons = []
        # Condition 1: confidence >= 0.9
        if f.confidence is not None and f.confidence >= 0.9:
            reasons.append(f"confidence={f.confidence:.2f} ≥ 0.9")
        # Condition 2: 2+ independent supports
        supporters = support_count.get(f.id, set())
        if len(supporters) >= 2:
            reasons.append(f"독립 지지 {len(supporters)}개: {', '.join(sorted(supporters))}")
        # Condition 3: de facto usage (referenced by others via depends_on, context_for)
        dependents = set()
        for node in g.nodes.values():
            for lk in node.links:
                if lk.target == f.id and lk.relation_canonical in ("depends_on", "context_for", "extends"):
                    dependents.add(node.id)
        if dependents:
            reasons.append(f"참조 중: {', '.join(sorted(dependents))}")

        if reasons:
            candidates.append((f, reasons))

    console.print(f"\n[bold]=== Knowledge 승격 후보 ===[/bold]\n")
    if not candidates:
        console.print("  승격 후보 없음\n")
        return

    for f, reasons in candidates:
        console.print(f"  [cyan]{f.id}[/cyan] (confidence: {f.confidence})")
        for r in reasons:
            console.print(f"    → {r}")
        console.print()


# ── Entry point ──────────────────────────────────────────────────────

if __name__ == "__main__":
    app()
