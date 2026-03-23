# EMDD Demo

---
$ emdd init my-research
[spinner:1500]
> EMDD project initialized at my-research
> Next: emdd new hypothesis <slug>
> Created .claude/CLAUDE.md
[wait:2000]

---
$ cd my-research
[wait:1000]

---
$ emdd new hypothesis cnn-approach
[spinner:800]
> Created hypothesis node: hyp-001
[wait:1500]

---
$ emdd new experiment baseline-test
[spinner:800]
> Created experiment node: exp-001
[wait:1500]

---
$ emdd link exp-001 hyp-001 tests
[spinner:800]
> Linked exp-001 → hyp-001 [tests]
[wait:2000]

---
$ emdd lint
[spinner:1000]
> [green]All nodes valid. No errors found.[/green]
[wait:1500]

---
$ emdd health
[spinner:1200]
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
