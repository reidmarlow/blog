---
title: "An agent sandbox needs to remember what a command read"
description: "Tether traces agent commands in a sandbox and checks the resulting information flows. Its benchmark also shows where that boundary stops."
pubDate: 2026-11-22T14:35:00Z
tags:
  - ai
  - agents
  - security
  - linux
---

A coding agent reads a configuration file, writes a temporary file, then runs a Python script that makes an HTTP request. Each command may look ordinary on its own. The security decision depends on what moved between them.

The [Tether research paper](https://arxiv.org/abs/2611.25599) explores a way to make that history part of an agent's permissions. Its monitor runs commands in an isolated environment, observes their system-level effects, and applies a policy that can carry labels across steps. It is a useful design for anyone deciding where to put the boundary around an agent with shell access.

## Check effects, not just command text

A rule that checks the command line can miss an HTTP request buried in a script. Tether's Isolate component instead runs the proposed command speculatively. It uses Linux OverlayFS to stage filesystem changes and `strace` to observe system calls. A network proxy holds outbound requests while the monitor checks them. If the policy permits the effects, staged changes can be committed and a held request forwarded; otherwise they are discarded or dropped.

That ordering matters. Running a command directly on the host and checking its trace afterwards is too late if it has already sent a secret. The paper's design puts the observation inside the execution boundary. Its current implementation also has limits on what it can inspect: HTTPS decryption is currently limited to emulated endpoints, and some I/O mechanisms have to be blocked rather than traced.

The trace is translated into higher-level actions: reads, writes, copies and network sends. The monitor tracks which files a process has read and propagates that provenance to downstream processes and outputs. A policy can then treat a temporary file derived from sensitive input as sensitive too. This is conservative: reading a file can taint a process even if the data never actually ends up in its output.

## The rule needs memory

Imagine a task that allows an agent to edit source files and access a package registry, but not send secrets outside the machine. Checking each command independently makes it hard to distinguish a normal registry request from a later request carrying data copied out of a credential file.

A stateful policy can label the credential file, follow the label through a copy, and reject a network operation that would violate the rule. The exact decision still depends on the policy and the monitor's view of the operation. For example, simply allowing every outbound destination after a sensitive read would undermine a rule intended to prevent exfiltration.

Tether expresses its policies in Lean 4 and verifies specified invariants about those policies. That proof concerns the formal policy and its modeled actions; it does not prove that every possible operating-system behavior is captured, or that the policy expresses every security requirement an operator intended.

## What the benchmark actually measured

The authors replayed recorded coding-agent trajectories from MonitoringBenchHonest and LinuxArena. They report blocking **344 of 344 in-scope adversarial trajectories**, with **74 false positives across 1,590 benign trajectories** (4.7%). Those are results for the paper's selected, replayable subset, not a guarantee for arbitrary agents or environments. The researchers excluded trajectories whose services could not be emulated or whose actions could not be captured and modeled in the evaluated setup. They also refined the policy against benchmark traces.

The false positives are instructive. Fifty involved edits to protected paths that the task did not request; seven involved undeclared external hosts. Another 17 involved reads of sensitive files, including broad searches such as `grep -r` that touched files whether or not their contents were useful. A policy can have a good reason to stop those operations and still interrupt legitimate work.

The monitor also cannot identify a malicious change to an otherwise permitted source file merely from the system-level flow. The paper describes background processes and database operations as not yet modeled in detail; a more restrictive policy can block those channels instead. That is a real trade: broader coverage may mean an agent cannot use the tools its task needs.

## Start with the boundary you can enforce

You don't need to adopt a research prototype to use the lesson. For an agent workflow, write down which paths contain credentials, where generated files may be written, and which network destinations the task actually needs. Keep secrets out of the agent's environment when possible. If a job needs a database or a background worker, treat that as a separate permission decision rather than assuming a shell-command allowlist covers it.

Then test a small sequence, not just a single command: read sensitive input, copy it to a scratch file, and attempt an outbound request in a safe test environment. A monitor that only recognizes the original filename will miss the relationship. A conservative monitor may stop harmless work, so record the block and make the exception as narrow as the task allows.

Tether's most useful contribution is that it makes those tradeoffs explicit: what the monitor sees, what the policy remembers, and which channels remain outside the model. The paper's [evaluation and limitations](https://arxiv.org/pdf/2611.25599) are worth reading together before treating its benchmark score as a deployment guarantee.
