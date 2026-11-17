---
title: "Coding agents need a requirement ledger, not just a passing test"
description: "SWE-CoWork exposes the gap between discovering a requirement, implementing it, and reporting it as done. A small ledger makes that gap visible."
pubDate: 2026-11-17T16:20:00Z
tags:
  - ai
  - agents
  - testing
  - productivity
---

An agent returns a patch and says the work is complete. Your local tests pass. Then a reviewer points out that the compatibility requirement was buried in an older discussion and never made it into the patch. A green test run only tells you about the behavior those tests exercised.

[TokenWave AI's SWE-CoWork paper](https://arxiv.org/abs/2611.20218) gives this problem a useful shape. The benchmark puts coding agents in simulated organizations around 101 real repositories. Agents start with a short handoff and must find requirements in workplace records and conversations with simulated colleagues, implement the changes, and submit a handoff. The researchers evaluate the result with private executable tests.

The assignments are substantial: the paper reports a median of six accountable owners, 60 files and 32 verifier test nodes per task. The workplace and its colleagues are authored simulations, so the results should not be read as a measurement of agents inside real companies. They do let us inspect what happens when a task includes incomplete information and several steps between finding a requirement and shipping it.

## Partial progress can look like delivery

The paper reports two different kinds of result. Fail-to-pass (F2P) is the share of initially failing test nodes that the submitted code satisfies, pooled across tasks. The full task pass rate requires every F2P and pass-to-pass node to pass in the same run. The latter includes checks for existing behavior.

The two leading models satisfied about 63% of F2P nodes, yet each completed fewer than 8% of assignments. These are different denominators: a pooled share of test nodes versus the fraction of tasks passing the entire contract. A task can make useful progress and still be unsuitable for release.

The researchers also ran a comparison on two models with the complete requirements supplied up front. GPT-6 Astra's F2P rose from 62.91% to 78.84%; Seed Evolving's rose from 39.09% to 55.76%. Full task success stayed at 7.92% and 0.99% respectively. The comparison changes both access to the specification and the work needed to find it, so it doesn't isolate the value of a better document. It does show that a complete specification did not, in this setup, turn partial implementations into complete deliveries.

## Keep each requirement attached to evidence

The handoff is another place where partial progress can get lost. In the authors' analysis of Claude-Opus-5.5 trajectories, 255 of 826 requirements reported as completed failed their corresponding tests. That 31% describes reported requirements in this analysis, not a failure probability for every agent or project.

A practical response is to keep a small requirement ledger beside the task. For example:

```text
Requirement: preserve stderr and stdout separately
Source: issue #42, maintainer clarification on 2026-11-17
State: implemented; verification pending
Evidence: tests/test_capture.py::test_separate_streams
Open question: behavior when output is interleaved
```

This is an illustrative format, not an example from the benchmark. The useful part is that each row carries its source and its current evidence. A requirement can be discovered without being implemented; code can be written without a test demonstrating the behavior. Keep those states separate. If a source is superseded, record which decision replaced it rather than quietly changing the row.

For a real task, start with a few rows from the issue and ask the agent to add newly discovered constraints as it reads. During review, compare the ledger with the patch and run the named checks. A test file that exists is not itself evidence of a passing run: record the command and result, including failures. Anything without a check stays explicitly unverified in the handoff.

This adds review work, and a ledger can itself omit requirements. It is still easier to challenge a specific missing source or test than a paragraph saying everything is done. The final reviewer owns acceptance; the agent's report is a map to inspect, not the verdict.
