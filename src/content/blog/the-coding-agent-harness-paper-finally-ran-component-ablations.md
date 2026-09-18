---
title: "The coding agent harness paper finally ran component ablations"
description: "Run-Ze Fan and colleagues tested 176 harness variations across SWE-Bench and Terminal-Bench to see which parts of an agent setup actually improve code."
pubDate: 2026-09-18
tags: ["agents", "software-engineering", "benchmarks", "evals", "coding"]
---

Most papers about autonomous coding agents evaluate whole setups as a single unit. You get a graph showing that Framework X scored 48% on SWE-Bench while Framework Y scored 41%, with three different prompt structures, two different shell wrappers, and an entirely custom memory system bundled into the comparison. You never get to find out which specific design choice made the difference.

A new paper from Run-Ze Fan and eight co-authors at UMass Amherst, UCF, and independent labs (*An Empirical Study of Harness Design for Coding Agents*, arXiv:2609.20804) isolates those pieces. 

They built a lightweight harness, kept the execution loop fixed, and ablated three distinct subsystems across four models: planning mechanisms, action space, and context management. Testing those variations against SWE-Bench Verified and Terminal-Bench 2.1 generated 176 matched evaluations across four context-window budgets.

The findings match what anyone building agent runtimes hits after the second week of testing.

### Elision beats summarization, and recoverable context is dead weight

Context management turns out to matter almost entirely as an insurance policy against context-window overflow. On large-budget models, complex compaction strategies showed minimal accuracy improvements over naive windows. As budgets tighten, however, how you trim tokens determines whether the agent finishes the task or crashes mid-loop.

The most effective approach was two-stage: static rule-based elision first, followed by model-based summarization only when necessary. 

Rule-based elision here means mechanical scrubbing: trimming verbose compiler warnings, stripping redundant stack traces, and cutting repetitive grep outputs before they touch model tokens. 

The interesting negative result is recoverable context. Several current agent frameworks let models query or retrieve previously dropped context chunks via specialized lookup tools. In Fan's matched runs, models rarely invoked those retrieval tools once context was elided. Supporting that recovery added prompt complexity and state machinery without producing any measurable accuracy gain.

### Planning acts as a budget cap for strong models

Planning modules change behavior differently depending on the raw capability of the underlying model.

For smaller or weaker models, an upfront planning step serves as a necessary scaffold. Without an explicit breakdown of steps, weaker models get trapped in syntax errors or lose track of directory structure. Planning improves their final task accuracy.

For frontier models, planning does not improve task accuracy. The models solve roughly the same number of issues with or without an explicit planner. Instead, planning acts as a brake on runaway token expenditure. Trajectory analysis showed that a structured plan gave the agent an explicit stopping condition, preventing it from spiraling into speculative rewrites after passing the target test suite. 

### Bash interfaces outperform bespoke toolsets on capable models

The third ablation looked at the action space: providing dedicated custom tools (file editors, structured patch appliers, custom grep tools) versus giving the model a raw bash shell.

When models have weak bash proficiency, structured tools act as training wheels that prevent execution failures. But once a model understands shell pipelines, a direct bash interface matched or exceeded the accuracy of custom tool APIs while cutting token overhead substantially. 

On Terminal-Bench, bash-native agents completed tasks at lower cost because they chained commands directly with standard Unix pipes instead of paying tool-call round trips for every intermediate file inspect.

The takeaway from the 43-page study is straightforward: complex agent frameworks carry too much unexamined scaffolding. Rule-based output scrubbing, direct shell access, and simple plan checks give you almost all of the performance without the brittle retrieval loops.
