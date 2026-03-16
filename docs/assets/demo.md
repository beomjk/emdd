# EMDD Demo

---
$ emdd init my-research
[spinner:1000]
> EMDD project initialized at my-research
> Next: emdd new hypothesis <slug>
> Created .claude/CLAUDE.md

---
$ cd my-research

---
$ emdd new hypothesis cnn-approach
[spinner:500]
> Created hypothesis node: hyp-001

---
$ emdd new experiment baseline-test
[spinner:500]
> Created experiment node: exp-001

---
$ emdd link exp-001 hyp-001 tests
[spinner:500]
> Linked exp-001 -> hyp-001 (tests)

---
$ emdd lint
[spinner:800]
> [green]All nodes valid. No errors found.[/green]

---
$ emdd health
[spinner:800]
> === EMDD Health Dashboard ===
>
> Total Nodes: 2
>
> By Type:
>   hypothesis: 1
>   experiment: 1
>
> Hypothesis Status:
>   PROPOSED: 1
>
> Average Confidence: 0.50
> Open Questions: 0
> Link Density: 0.50

[spinner:4000]
