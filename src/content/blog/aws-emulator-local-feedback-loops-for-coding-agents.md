---
title: "AWS Emulator Proves the Tightest Agent Feedback Loop Is Local Infrastructure"
description: "AWS released an offline emulator for 200+ services written and tested entirely by autonomous agents. The real lesson is how local verification changes how agents build distributed systems."
pubDate: 2026-11-12T17:00:00Z
tags:
  - ai
  - agents
  - aws
  - devops
  - testing
---

On November 11, AWS released [AWS Emulator](https://github.com/aws/aws-emulator) under a CC0 public domain dedication. The project provides an offline, in-memory implementation of more than 200 AWS services derived from 438 Smithy API models. You can run S3, SQS, DynamoDB, Lambda, and dozens of other cloud APIs directly on your laptop without an AWS account, network calls, or cloud credentials.

The detail that caught everyone's attention on Hacker News is how the emulator came together: the codebase was written, tested, and maintained entirely by autonomous AI agents without human code review. Matt Goldberg, a Senior Principal Engineer on the AWS Developer Tools team, started with a single prompt asking an agent to build an in-memory SQS implementation based on CLI tests. The agent returned a working prototype in 15 minutes. Over the following weekend, agent swarms expanded the scaffold across the rest of the AWS API catalog.

## Three teams and a coloring book

In his launch note, Goldberg compared agents to children working in a coloring book. Without explicit structural boundaries, agents drift into strange implementation choices, such as attempting to write a custom Python interpreter from scratch to handle Lambda invocations.

To keep hundreds of concurrent agents from wandering off course, AWS split the work across three separate teams:

1. Test writers create customer scenarios based on public Smithy API models. Each scenario is run against the live AWS cloud until it passes, ensuring the test captures true cloud behavior. Once verified, these scenarios become static fidelity tests stored in CodeCommit. They can be replayed repeatedly on local hardware without touching AWS again.
2. Issue finders replay that fidelity test suite against the local emulator code. When an endpoint returns unexpected XML, mishandles a header, or violates a timeout contract, the finding agent groups related failures and logs a ticket in an issues directory.
3. Issue fixers check out the repository, address one ticket at a time, and send the patch through an automated merge gate.

That merge gate decides what actually lands on mainline. In addition to compiler checks and zero-regression runs against the fidelity suite, the gate runs multiple specialized security agents performing adversarial reviews alongside general code quality linters. If any check fails, the patch gets rejected back to the fixer agent for rework.

## Four nights without tests versus two hours with a harness

On [All Things Distributed](https://www.allthingsdistributed.com/2026/11/aws-emulator-and-the-engineers-job-when-agents-write-the-code.html), Werner Vogels and Swami Sivasubramanian connected this release to the early architecture of AWS. Twenty years ago, Swami and Al Vermeulen built Alf, the Paxos-based distributed lock service that still underpins core primitives in S3 and DynamoDB. Testing Alf required a custom JVM simulation to inject dropped packets and test concurrency edge cases under strict correctness guarantees.

Recently, Swami tried using Amazon's Kiro agent to rebuild Alf's Paxos replication engine. He supervised the agent for four nights while it struggled to produce workable code. The bottleneck was simple: the agent had no local environment to run its code and verify whether state transitions actually held. Once Swami provided an exact specification and a local test harness, the agent completed the rebuild in two hours.

When an agent cannot execute and test its output immediately, it generates plausible guesses. When it has a local execution target with immediate assertion feedback, it iterates toward correctness.

## Why local emulation changes coding agent workflows

For developers using AI coding agents on infrastructure or backend services, cloud dependencies create massive friction. Having an agent write code against live AWS services usually means one of two bad options.

The first option is running tests against live cloud sandboxes. Every test cycle requires provisioning resources, waiting on CloudFormation or Terraform state transitions, and dealing with remote network latency. A single verification loop that takes two minutes destroys the agent's context efficiency, burns through tokens on repetitive status polls, and risks orphaned cloud resources if the agent exits unexpectedly.

The second option is relying on hand-rolled mocks. Hand-rolled mocks almost always diverge from real AWS semantics. An agent might assume SQS visibility timeouts behave one way, write application logic that passes local mock assertions, and fail immediately upon hitting production infrastructure.

AWS Emulator changes that dynamic by placing 200+ AWS services directly into the agent's local execution loop. An agent running in your terminal can spin up a local emulator, create an SQS queue, push sample payloads, verify dead-letter queue routing, test DynamoDB conditional writes, and confirm the code works before touching Git.

In an agent-driven development loop, the engineer focuses on the surrounding harness: defining interface specs, verifying ground-truth fidelity tests, and enforcing merge gates that keep the generated code correct.
