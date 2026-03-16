# EMDD CLI

Evolving Mindmap-Driven Development 그래프를 관리하는 CLI 도구.

EMDD v0.3 스펙의 결정론적 규칙을 코드로 자동화한다. 판단이 필요한 작업은 `.claude/commands/` 슬래시 커맨드에 위임하는 이원 구조.

## 설치 & 실행

PEP 723 단일 파일이므로 별도 설치 없이 `uv run`으로 즉시 실행:

```bash
uv run /path/to/emdd.py <command> [args]
```

의존성(`python-frontmatter`, `typer`, `rich`, `pyyaml`)은 `uv`가 자동 관리한다.

## 워크플로우

```bash
# 1. 새 프로젝트 초기화
emdd init my-project

# 2. 노드 생성
emdd new hypothesis lut-thinning --path my-project
emdd new finding call-chain --path my-project
emdd new episode symbol-trace --path my-project

# 3. 그래프 관리
emdd health my-project           # 건강도 대시보드
emdd lint my-project             # 스키마/링크 검증
emdd check my-project            # consolidation 트리거 체크
emdd promote my-project          # 승격 후보 확인

# 4. 출력 생성
emdd index my-project            # _index.md 자동 생성
emdd graph my-project            # Mermaid _graph.mmd 생성
```

## 커맨드

### `init [target]`

프로젝트에 EMDD 그래프 구조를 scaffold한다.

```bash
emdd init .                  # 현재 디렉토리
emdd init my-project         # 지정 디렉토리
emdd init my-project --dry-run  # 생성 예정 항목만 표시
```

생성되는 구조:

```
{target}/
├── graph/
│   ├── _index.md          # 빈 인덱스
│   ├── _analysis/
│   ├── problem.md         # prob-001 루트 노드
│   ├── hypotheses/
│   ├── experiments/
│   ├── findings/
│   ├── knowledge/
│   ├── questions/
│   ├── decisions/
│   └── episodes/
└── .claude/commands/
    ├── emdd-context.md
    ├── emdd-episode.md
    ├── emdd-consolidation.md
    └── emdd-health.md
```

### `new <type> <slug>`

노드를 생성한다. ID는 자동 채번된다.

```bash
emdd new finding lut-structure        # → graph/findings/find-001-lut-structure.md
emdd new hypothesis zhang-suen        # → graph/hypotheses/hyp-001-zhang-suen.md
emdd new episode gdb-trace --path .   # → graph/episodes/ep-001-gdb-trace.md
```

지원 타입: `finding`, `hypothesis`, `experiment`, `question`, `knowledge`, `decision`, `episode`

각 타입별 frontmatter 스키마와 본문 섹션이 포함된 템플릿이 생성된다.

### `graph [path]`

Mermaid 형식의 그래프 시각화 파일(`_graph.mmd`)을 생성한다.

```bash
emdd graph .              # graph/_graph.mmd에 쓰기
emdd graph --dry-run .    # stdout 출력
```

### `health [path]`

그래프 건강도 대시보드를 출력한다. 노드 현황, 승격률, 경고를 한 눈에 보여준다.

```bash
emdd health .
```

### `check [path]`

Consolidation 5종 트리거를 체크한다:
- Finding 미승격 ≥5
- Episode 축적 ≥3
- 열린 Question = 0
- Catch-all Experiment (Finding ≥5)
- not-pursued 누적 ≥3

### `lint [path]`

모든 노드의 frontmatter 스키마와 링크 무결성을 검증한다. 오류가 있으면 exit code 1.

### `promote [path]`

Knowledge 승격 후보 Finding을 식별한다:
- confidence ≥ 0.9
- 독립 지지 2건 이상
- 다른 노드에서 de facto 참조 중

### `index [path]`

`_index.md`를 그래프 노드에서 결정론적으로 자동 생성한다.

```bash
emdd index .              # graph/_index.md에 쓰기
emdd index --dry-run .    # stdout 출력
```

## 경로 탐색

모든 커맨드는 `graph/` 디렉토리를 자동 감지한다. 주어진 경로에서 위로 탐색하여 `graph/`을 포함하는 디렉토리를 찾는다. 따라서 프로젝트 내 어디서든 실행 가능하다.

## 참조

- [EMDD_SPEC_v0.3.md](EMDD_SPEC_v0.3.md) — 정규 스펙
