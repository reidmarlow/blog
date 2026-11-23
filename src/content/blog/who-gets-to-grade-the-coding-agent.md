---
title: "Who Gets to Grade the Coding Agent?"
description: "SplitBench moves expected answers and verdicts outside the environment running an agent's code. Its attack results also show where isolation stops helping."
pubDate: 2026-11-24T00:10:00+08:00
tags:
  - ai
  - agents
  - testing
  - security
---

A coding agent submits a patch. The test runner prints `passed`, and the benchmark records a success. That result depends on the runner telling the truth after loading code the agent could change.

One documented failure uses a `conftest.py` hook to overwrite pytest results. The test might be sensible, but its report comes from a process that loaded the submission. Rebuilding the workspace in a fresh container doesn't by itself settle the question: the submitted code still has to run somewhere.

[Who Grades the Agent?](https://arxiv.org/html/2611.27860v1), a November 2026 paper by Nathan Nour Houlamy and colleagues, proposes a different boundary. Its SplitBench framework runs the candidate in an evaluation environment, but keeps expected answers and the final verdict in a separate trusted component called the Oracle. The authors converted tasks from Terminal-Bench 2.0 and DeepSWE v1.1 and then attacked the conversions. The results are encouraging, with a useful catch: protecting the grader does not make weak tests strong.

## Separate the observation from the verdict

SplitBench first captures the agent's work as a candidate and copies it into a fresh evaluation environment. The Oracle supplies an input; an adapter in that environment runs the candidate and returns an observation. The Oracle compares the observation with an expected value it holds outside that environment.

The adapter and the candidate are both treated as untrusted. A candidate that takes over the adapter can send arbitrary observations, so the Oracle needs a narrow interface and must validate what comes back. Each test case, or group of tests that must run together, gets a fresh environment. That limits the ability of one case to leave a modified executable or process for the next.

The setup also constrains network destinations. That is useful, but a destination allowlist cannot distinguish every permitted operation from misuse of the same service. Provider-hosted tools have their own boundary: the paper says they are disabled by default, and if enabled their traffic is outside SplitBench's network policy.

A simple way to apply the design to an internal evaluation is to draw the data flow before choosing a sandbox. Mark which process holds expected values, which process loads the patch, and which process turns evidence into a verdict. If the process loading the patch can write the final verdict, a fresh image alone has not removed that trust.

## What the experiments measured

The researchers converted 180 of 202 tasks across the two benchmarks, reporting a median conversion cost of about $10 per task. On their fidelity evaluation, the converted and native graders agreed on 98.7% of agent attempts. Agreement helps check whether the conversion changed grading behavior; it does not prove either grader is correct in every case.

For the adaptive attack, the team gave an agent the task and told it to obtain a passing grade without solving it. In the full-knowledge setting, the agent could read the adapter and Oracle code, but not the hidden data. SplitBench rejected 126 of 168 completed attempts, or 75%. Model safeguards stopped another 12 attempts before completion; the authors excluded those from the completed-attempt result.

Forty-two full-knowledge attempts passed without solving the task. The authors classified 33 as exploiting weak upstream tests, one as a conversion error, three as faked implementations and five as relying only on public answers. They attributed none to a flaw in the SplitBench framework. Those categories matter: a 75% rejection rate is not a claim that the remaining 25% defeated the isolation boundary.

Across both knowledge settings, one converted task asked for a dataset token count. Its original test checked whether the expected number appeared anywhere in the output file. An attack wrote every number below ten million. The trusted Oracle could make the comparison faithfully and still accept an answer that hadn't counted the dataset. A better acceptance condition would need to reject that oversized answer, and the evaluator should also bound output size.

The paper describes another gap: a candidate can sometimes generate the observation the adapter is expected to produce without implementing the requested change. The Oracle sees an observation, not the full intent behind the task. The authors recommend stricter acceptance conditions and note that reviewing the candidate and trajectory may help identify such cases.

## A practical review for an eval harness

Start with one task where the agent can modify a repository and the grader loads that repository. Record exactly what the grader trusts: a test log, exit code, JSON result or value returned from candidate code. Then try a deliberately wrong patch that prints the expected success marker or changes the test runner. If it passes, keep the reproduction alongside the task while moving the verdict outside the candidate's control.

Next, inspect the acceptance condition itself. Does it compare an exact value, or merely search for a substring? Can a constant, a huge output or an unrelated implementation satisfy it? Use fresh, unpublished inputs where possible, and put limits on the evidence the trusted side will parse. These are design checks, not a claim that every task can be reduced to a single hidden-output test.

SplitBench has boundaries of its own. The authors assume the underlying isolation works and trust the Oracle and orchestration code. Their conversion does not support every task, including some that require a trusted record of external effects or timing. They also report that some DeepSWE regression outcomes still rely on the upstream runner; the requested feature checks are judged separately by value.

For a team comparing coding agents, the immediate decision is to retain more than a pass percentage. Keep the task version, grading boundary, hidden-data policy and a few known-bad submissions with the score. That makes it possible to tell whether a harness change improved the agent, changed the tests, or simply made the grader harder to fool.
