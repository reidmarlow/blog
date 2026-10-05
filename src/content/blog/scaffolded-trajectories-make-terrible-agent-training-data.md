---
title: "Scaffolded Trajectories Make Terrible Agent Training Data"
description: "Training terminal agents on raw scaffolded traces bakes in verifier leaks and harness crutches. Recursive Self-Rewrite uses heavy harnesses for discovery, then cleans the runbook for vanilla execution."
pubDate: 2026-10-06T00:30:00+08:00
tags:
  - ai
  - agents
  - automation
  - benchmarks
---

When an autonomous agent struggles on long terminal tasks, the standard engineering response is to add scaffolding. You wrap the model in state machines, inject environment probes, add reflection loops, and supply intermediate test harnesses until it stumbles across a solution.

That scaffolding works for exploration. The mistake is taking the resulting raw trajectory and feeding it directly into supervised fine-tuning.

Direct trajectory SFT bakes the exploration crutches into model weights. If an agent solved a Linux debugging task by reading an internal verifier script, probing harness-specific state variables, or wandering through fifteen failed retries, training on that trace teaches the model to expect those exact environment leaks in production. Strip the scaffolding away at deployment, drop the agent into a bare bash shell, and performance falls apart.

A paper from IntelligenceLab and the University of Maryland (arXiv:2610.02826) details this exact failure mode and tests a systematic fix called Recursive Self-Rewrite (RSR).

### The gap between discovery and deployment

The authors ran Qwen-3.8-27B across roughly 3,000 terminal tasks using three structurally different harnesses: Terminus 2 (a general terminal execution loop), StateM (a state-machine harness with phase-local context and checked transitions), and Recursive Self-Reflect Terminus (a loop with explicit reflection steps).

Different harnesses succeeded on different domains. StateM handled structured, multi-phase setup tasks that required maintaining execution state across interruptions. The reflection harness handled messy trial-and-error debugging. Combined, the three harnesses solved 759 tasks, beating the single strongest harness by 34.3%.

If you stop there, you have a pile of heterogeneous execution traces. Some traces rely on StateM's explicit transition assertions. Others rely on self-reflection prompts or leak evaluation scripts into the bash history.

Training directly on those raw traces yielded mediocre gains. On Terminal-Bench 4, an evaluation suite designed around punishing multi-step engineering tasks, direct trajectory SFT achieved a pass@3 of 4.5%, up only marginally from the base model's 1.5%. The model learned the surface artifacts of the harnesses instead of the underlying terminal mechanics.

### Splitting exploration from execution

Recursive Self-Rewrite separates the problem into two distinct stages: discovery using whatever harness works, followed by execution under a vanilla harness.

The pipeline runs three roles using the same base Qwen-3.8-27B model:

1. **Planner:** Reads the successful source trajectory and distills it into a procedural runbook. The runbook defines intermediate milestones, required state checks, and recovery paths. Crucially, the planner is instructed to describe validation procedures without copying raw output deliverables or hardcoded solutions.
2. **Critic:** Audits the candidate runbook against the public task description. It rejects runbooks that contain verifier leakage, direct answers, or harness-specific syntax. If a runbook passes verifier scripts from the evaluation harness directly to the agent, the critic flags the leak and forces a recursive rewrite.
3. **Executor:** Takes the sanitized runbook and executes the task from scratch in a fresh, isolated sandbox under the vanilla Terminus 2 harness. The runbook acts as private developer guidance during generation and is stripped from the final trajectory.

By running this loop with rejection sampling, the team expanded 2,001 source successes into 11,094 clean, verified trajectories executed entirely in standard bash.

### Benchmark results

Training Qwen-3.8-27B on the rewritten trajectories outperformed both the base model and direct trajectory SFT across every tested benchmark:

- **Terminal-Bench 2:** pass@3 reached 74.2%, compared to 57.0% for the base model and 53.4% for direct SFT.
- **Terminal-Bench 4:** pass@3 jumped to 9.1%, compared to 1.5% for the base model and 4.5% for direct SFT.
- **Terminal-Bench Hard:** pass@3 rose to 63.0%, up from 39.0% on the base model.
- **Software Terminal-Bench 100:** pass@3 hit 6.0%, doubling the base model's 3.0%.
- **Long-Horizon Terminal-Bench:** process reward increased from 0.21 on the base model to 0.29.

The weights are public under IntelligenceLab/RSR-27B on Hugging Face.

### The engineering takeaway

Building agent harnesses involves a fundamental tension. Heavy scaffolding makes it easier for weak models to complete tasks, but deploying heavy scaffolding in production increases latency, adds state complexity, and leaks brittle assumptions into customer environments.

Treating scaffolding as an offline data-generation tool changes that tradeoff. You can build aggressive state machines, synthetic verifiers, and multi-agent debate committees to solve difficult terminal problems offline. Once you have a working run, scrub the harness crutches out of the log, replay the clean procedure in a bare container, and train the model to operate without them.
