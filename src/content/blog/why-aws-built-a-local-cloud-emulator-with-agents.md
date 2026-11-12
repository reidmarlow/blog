---
title: "Why AWS Built a Local Cloud Emulator Entirely With Autonomous Agents"
description: "AWS released a CC0-licensed local cloud emulator covering 200+ services written by autonomous AI agents, showing why ground-truth test harnesses matter more than prompting."
pubDate: 2026-11-12T16:50:00Z
tags:
  - aws
  - ai
  - agents
  - developer-tools
---

On November 11, Amazon CTO Werner Vogels and Swami Sivasubramanian published an essay on All Things Distributed announcing [AWS Emulator](https://www.allthingsdistributed.com/2026/11/aws-emulator-and-the-engineers-job-when-agents-write-the-code.html), a local, offline emulator covering more than 200 AWS services. Along with the announcement, AWS released the entire source code to GitHub under the Creative Commons CC0 public domain dedication at [aws/aws-emulator](https://github.com/aws/aws-emulator).

Local cloud mocks like LocalStack have existed for years. AWS Emulator stands out because of how it was built. Autonomous AI agents wrote every line of implementation code, generated every test, diagnosed every discrepancy, and submitted every pull request. According to [Matthew Goldberg](https://aboutamazon.com/news/aws/how-autonomous-ai-agents-built-aws-emulator), Senior Principal Engineer on the AWS Developer Tools team, human engineers on the project wrote zero lines of emulator code and reviewed zero pull requests manually.

The project offers an unusually clean case study of how autonomous coding agents behave when you give them formal specifications, ground-truth reference systems, and automated merge gates.

## The problem with prompting coding agents

When developers use coding agents to write cloud-native applications, the agent immediately hits an execution boundary. Unlike pure algorithmic code or web frontends that can be verified inside a local Node or Python process, cloud architectures depend on remote services. An agent trying to write a message-processing pipeline needs to interact with Amazon SQS, Amazon DynamoDB, and AWS Lambda.

If the agent cannot run the code against an actual API, it generates code based purely on statistical token predictions. It hallucinates parameters, invents non-existent configuration flags, and assumes synchronous behavior where APIs are asynchronous.

Giving the agent access to real AWS accounts during the drafting loop introduces a different set of problems. Cloud API calls add network latency to every turn of the agent loop, rack up billing costs across thousands of failed trial runs, and risk polluting live infrastructure or leaking credentials.

The obvious answer is local emulation, but building an emulator for AWS by hand has always been a maintenance nightmare. AWS has over 200 services defined across hundreds of API models. By the time a small engineering team writes a mock for one service, the upstream API has already changed.

## Turning Smithy models into a closed-loop harness

AWS approached the problem by taking advantage of two assets already in place: a machine-readable specification and a reference ground truth.

The specification is AWS's public API models, written in Smithy. Smithy defines every operation, input shape, output payload, and error type across AWS services. The reference implementation is the live AWS cloud itself.

Goldberg divided the agent workload across three specialized teams:

1. Test Writers (Team 1): These agents read the Smithy models to understand API boundaries, then synthesize end-to-end user scenarios. For example, a scenario might create an SQS queue, send a message, verify the message stays invisible until its visibility timeout expires, receive it, acknowledge it, and delete the queue. The agents run each scenario against the live AWS cloud first. Once the test passes against real AWS, it is saved to an internal repository as a deterministic fidelity test. Tens of thousands of these fidelity tests now exist in the [aws-emulator-evaluation-suite](https://github.com/aws/aws-emulator-evaluation-suite), and they can be replayed locally forever without making a single outbound network request.

2. Issue Finders (Team 2): These agents replay the recorded fidelity tests against the local emulator codebase. The project started with a bare HTTP server that accepted routes for 438 Smithy models and returned nothing. As the issue finders run the fidelity tests, any divergence between real AWS output and emulator output gets logged as a bug in an `issues/things-that-do-not-work` directory. The agents also cluster failures that appear to share an underlying root cause.

3. Fixers (Team 3): Hundreds of concurrent agents pick up one issue at a time. An agent checks out the codebase, traces the failing test, patches the emulator code, and submits the patch to an automated merge gate.

## The merge gate and agent sandboxing

Autonomous agents running in a loose loop will take destructive shortcuts unless hard boundaries stop them. In his launch post, Goldberg noted that in an early prototype, when the agents needed to support AWS Lambda execution, they did not reach for an existing container runner or standard subprocess. Instead, they began writing their own Python interpreter from scratch. The human team had to step in and add a structural constraint instructing the agents to use existing system runtimes and libraries.

To keep the codebase sane, every pull request generated by a fixer agent must clear a deterministic merge gate:

- Static analysis: Compilation checks, type checkers, and coding standard linters run first.
- Scope fences: Deterministic path checks verify that an agent assigned to patch an S3 XML serializer did not touch files belonging to DynamoDB or IAM.
- Adversarial security review: A panel of dedicated security agents audits each diff for vulnerabilities, shell injection, or unsafe deserialization.
- Regression testing: The full library of recorded fidelity tests replays against the proposed binary. If any previously passing behavior regresses, the change is rejected.

If all checks pass, the commit merges to mainline without a human touching it. If any check fails, the change is bounced back to the fixer agent along with the test output for another iteration.

## The shift from prompt engineering to harness engineering

In his note, Swami Sivasubramanian shared a telling personal experiment. Twenty years ago, he spent four months building the replication engine for Alf, Amazon's early Paxos-based locking service. Recently, he tried using Amazon's Kiro agent to rebuild that same replication engine. He spent four consecutive nights watching the agent produce plausible-looking code that subtly broke under concurrency, because the agent had no automated way to run the code and inspect state.

Once Swami provided a formal specification and an automated test environment that simulated network drops and lease expirations, the agent completed the rebuild in two hours.

Swami's four nights of prompt babysitting versus two hours with an emulator highlights the bottleneck in agent development. Model capability stayed constant across both runs. The difference came down to having a local environment that gave the agent fast, accurate feedback.

As coding agents take over rote implementation tasks, an engineer's primary job shifts away from typing syntax or crafting clever system prompts. The work centers on building the scaffolding: defining formal interface specifications, recording deterministic reference behaviors, and designing merge gates that prevent agents from wandering outside established operational boundaries.
