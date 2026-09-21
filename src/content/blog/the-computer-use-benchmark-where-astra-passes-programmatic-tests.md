---
title: "The computer-use benchmark where Astra passes 2.8 percent of programmatic tests"
description: "RecreationWorld tested hybrid computer-use agents across five OS platforms. Frontier models match UI layouts easily, but programmatic state verification drops execution success to single digits."
pubDate: 2026-09-22
tags: ["ai", "agents", "benchmarks", "software-engineering", "automation"]
---

Most computer-use benchmarks test one surface at a time. An agent gets a web browser, a command-line terminal, or an operating system desktop, with a discrete target like filling out a form or editing a config file.

Real engineering tasks rarely stay inside one boundary. A developer looks at a running application, inspects how an interface responds to user input, writes backend code to replicate that behavior, runs test suites, and verifies the output on screen.

A research team across Tsinghua and Alibaba published RecreationWorld to evaluate this hybrid workflow. Instead of giving models a list of isolated instructions, the benchmark runs on five platforms (Ubuntu, macOS, Windows, Android, and Web) and presents agents with a live reference application. The model must explore the running software, write a complete implementation from scratch using both shell commands and GUI actions, and run its own code to verify that the behavior matches.

### The recreation harness

The framework evaluates agents against RecreationBench, a suite of 250 tasks spanning desktop utilities, mobile apps, and web services.

Unlike static coding evals like SWE-bench or visual navigation tests like OSWorld, RecreationWorld uses the running reference application as an execution oracle:

1. **Autonomous exploration**: The agent interacts with the running reference app via mouse and keyboard commands, discovering undocumented edge cases and workflows.
2. **Hybrid execution**: The agent opens an editor or terminal, drafts the application code, installs dependencies, and launches the local build.
3. **Dual verification**: Hidden behavioral test suites evaluate both programmatic state (database records, API responses, return codes) and rendered visual outputs across multiple interaction depths.

The benchmark scores two distinct metrics: visual recreation similarity and programmatic assertion pass rate.

### What happens when agents must verify state

When frontier models attempt the benchmark, the gap between visual replication and behavioral correctness becomes stark.

On the 250 evaluation tasks, GPT-6 Astra achieved a 58.1% overall score by matching visual components, layout structures, and surface-level interactions. When evaluated against the strict programmatic assertions that verify whether the underlying logic actually executed correctly, Astra passed all test suites on exactly 2.8% of the tasks.

The failure mode is consistent across open-source and proprietary models:

- **Layout over logic**: Agents reproduce static layouts and UI geometry with high accuracy. They place buttons in the right containers, match CSS colors, and create plausible input forms.
- **Surface interactivity vs state**: When an agent clicks a button in its generated clone, simple transitions work. When the action requires multi-step state mutations, session handling, or background database updates, the implementation breaks down.
- **Monolithic generation**: Rather than structuring modular applications with clean component boundaries, models collapse complex logic into small, monolithic files that become difficult to debug as task depth increases.

### Why visual verification alone is misleading

In visual-only agent benchmarks, an agent that renders a convincing dashboard often receives full credit. In production, a dashboard with broken query parameters or unhandled error states is unusable.

RecreationWorld confirms what engineers encounter when deploying autonomous coding agents in practice. Generating code that renders correctly is fundamentally easier than generating code whose internal state transitions survive adversarial test suites.

The finding explains why end-to-end automation rates for complex software development remain low even as benchmark scores climb. When evaluation suites demand both visual fidelity and end-to-end programmatic verification, the true ceiling for autonomous execution remains in the single digits.
