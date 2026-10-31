---
title: "Why DeepSeek Built Its Coding Agent Around Attention Budgets"
description: "DeepSeek open-sourced dsh-superagent-prototype. Here is what happens when you design an autonomous coding agent around human attention cost instead of benchmark scores."
pubDate: 2026-11-01T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - coding
---

DeepSeek open-sourced an autonomous coding agent prototype this weekend under the repository name `deepseek-ai/dsh-superagent-prototype`. It is packaged as a bundle for DeepSeek Harness, designed to run against a single GitHub repository, manage background coding sessions, and communicate through pull requests and issue comments.

Most agent frameworks focus on benchmark pass rates. They add tools, run longer loops, and emit status updates to show activity. DeepSeek built this prototype around a different constraint. It minimizes human attention cost while delivering pull requests.

When you run autonomous agents against real team repositories, developer fatigue is the primary failure mode. An agent that sends twenty chat notifications, opens four competing draft pull requests, and asks five vague clarifying questions burns more engineering time than writing the code manually. The design documents in the repository reflect that constraint across every layer.

### Decoupling context from authority

The core domain model separates event streams from permissions through five primitives, covering Sources, Triggers, Threads, Mandates, and Tickets.

A Source represents an incoming stream such as GitHub notifications or issue webhooks. It emits immutable Triggers into an ordered Thread. When a Trigger needs evaluation, a stateless Eval component checks the repository policy and decides whether to create a Ticket. If accepted, the Ticket receives an immutable Mandate that specifies its allowed scope and operational strength.

The runtime separates conversation routing from permission checks through Subscriptions. A Ticket subscribes to the Threads it touches. When a developer leaves a comment on an active pull request, or CI finishes a build, the event fans out directly to the subscribed Ticket as context.

This context delivery bypasses the evaluator and cannot widen the Ticket's authority. The Mandate remains fixed. If an incoming comment asks for work beyond the original scope, the worker must explicitly hand the message back to the router rather than attempting to self-escalate. That boundary prevents conversational drift, where an agent gradually expands a minor bugfix into a multi-file refactor because an automated notification mentioned an adjacent module.

### Stateless evaluation and rejected queues

Many multi-agent frameworks build complex schedulers with pending queues, retry timers, and polling loops inside the planning agent. DeepSeek rejected internal scheduler state entirely.

The Eval component holds no state between runs. It accepts a batch of Triggers, evaluates them against the active policy, and outputs an immediate decision. If a task requires waiting for an external event, such as a code review approval or a CI pipeline, the framework does not park a timer inside the evaluator. The condition is modeled as an ordinary event Source. When the external event occurs, the Source emits a Trigger that enters the pipeline naturally.

Keeping the evaluator stateless eliminates race conditions where internal queues desynchronize from actual repository state. If the agent service restarts during a deployment, the Source recovers its read position from git history and webhook offsets, without needing to restore transient in-memory scheduler state.

### Background workers and git worktrees

Execution runs through dedicated worker sessions. Each Ticket receives its own working directory, typically provisioned as an isolated `git worktree` under the execution root.

Command execution has strict limits. Any shell command that runs longer than five seconds moves to a background job automatically. This prevents long-running commands, such as `pnpm install` or test suites, from blocking incoming message delivery. The worker session continues handling input while background jobs run.

Background jobs have a hard thirty-minute runtime cap. If a test suite hangs or an external service deadlocks past that window, the runtime kills the process and reports the worker as waiting, recording the killed job output in the audit trail. This prevents abandoned background processes from silently consuming CPU and memory on the host machine.

### Explicit human handoffs

The prototype rejects automated heuristics for human interaction. The runtime does not parse free-text LLM transcripts to guess whether an agent needs human help.

An agent that needs human intervention must write to a structured attention field. When that field is populated, the Ticket transitions to a waiting stage, releases its active worker slot, and posts a single structured question back to the original channel. The panel interface shows only items requiring human action, keeping idle or healthy tickets out of sight.

DeepSeek also addressed policy updates during live execution. When an operator updates repository rules, the runtime does not kill active Tickets immediately. Abrupt cancellations leave dirty git worktrees, orphaned branch checkouts, and uncommitted edits. Instead, the runtime delivers a policy change notification into the active assignment, allowing the worker to checkpoint its state or cleanly roll back before terminating.

### The takeaway for agent infrastructure

If you build tools for coding agents, the prototype is worth reading through `docs/000-philosophy.md` and `docs/001-domain.md`. The practical engineering value sits in the plumbing. DeepSeek combined stateless evaluators, immutable mandates, subscription-based context fanout, and isolated worktree directories. That structure keeps autonomous agents from turning into noisy spam bots in real codebases.
