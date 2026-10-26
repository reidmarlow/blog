---
title: Why In-Context Corrections Do Not Stick in Agent Loops
description: In-context retries fix agent bugs for one turn and vanish on the next session. Princeton and Meta FAIR show that baking error reflections directly into micro-LoRA adapters turns temporary repairs into permanent skills.
pubDate: 2026-10-27
tags: ["ai", "agents", "infrastructure", "machine-learning", "open-source"]
---

Every engineer running autonomous agent loops knows the in-context reflection drill. The agent runs a bash script, fails on an obscure permission flag or an unquoted path, sees the error in stderr, reflects on what went wrong, and fixes it on the second try.

The task finishes green. You log the run, close the thread, and move on.

Tomorrow morning, the same agent hits the exact same edge case in a fresh session and makes the exact same mistake all over again.

In-context reflection is a temporary patch. It burns context tokens, bloats the prompt across long tool sessions, and evaporates the millisecond the execution context clears. The traditional alternative, full-model fine-tuning, is a non-starter for everyday errors. Nobody is spinning up a multi-GPU training run every afternoon to update base weights, and doing so risks catastrophic forgetting across existing tool workflows.

A research team from Princeton University and Meta FAIR just published a practical middle ground. In their paper, *Don't Forget What You Just Learned: Self-Directed Repair Turns Agent Mistakes Into Lasting Lessons* (arXiv:2610.31846), Yuval Kansal, Karen Ullrich, Polina Kirichenko, Ilia Kulikov, Niraj K. Jha, Mohammad Pezeshki, and Mark Ibrahim lay out an architecture called Self-Direction.

Instead of writing a reflection note into a scratchpad file or relying on a fragile system prompt append, the agent distills its execution mistakes directly into tiny low-rank adapter weights.

## The failure of the reflection scratchpad

Modern agent setups usually address cross-session memory with one of two patterns:

1. Appending error reflections to an agent scratchpad or MEMORY.md file.
2. Embedding failure traces into a vector database for retrieval-augmented prompt injection on future turns.

Both patterns struggle in production. Text notes appended to context eat away at attention budgets. As the reflection scratchpad grows, agents suffer from prompt dilution and instruction drift. More critically, an agent reading a natural-language description of an old error frequently misapplies the lesson to unrelated tool calls.

The Princeton and Meta team tracked this failure mode across open-ended research workflows (GAIA), multi-step tool execution (Claw-Eval), and command-line environments (Terminal-Bench 2.1). When agents relied on standard in-context retries, their correction reliability plummeted when facing recurring variations of the same underlying task. The agent repeatedly fell into the same traps because the underlying policy distribution never moved.

```
Standard Agent Flow:
Error -> In-context reflection -> One-off fix -> Session ends -> Lesson lost

Self-Direction Flow:
Error -> Trajectory reflection -> Low-rank adapter update -> Persistent library -> Routed on demand
```

## Distilling mistakes into 0.02% parameter budgets

The core mechanism of Self-Direction sits between ephemeral prompt engineering and heavy offline training.

When an agent fails an execution trajectory, it runs an internal critique to isolate the decision step that caused the downstream failure. Once the corrective trajectory is verified, the system does not just print the correction. It freezes the base model weights entirely and trains a micro-LoRA adapter on the self-directed repair pair.

The parameters updated during this step represent roughly 0.02% of the base model's parameter count.

Because base weights remain frozen:
1. Existing base model capabilities and general conversational skills stay intact without degradation.
2. Training completes locally in seconds on consumer hardware without cluster coordination.
3. The resulting adapter file is lightweight enough to store, version, and swap on the fly.

The agent saves these targeted adapter checkpoints into a persistent local library. When a new prompt arrives, an automated routing layer inspects the problem context and attaches the relevant adapter before the execution loop begins.

## Benchmark gains across open-ended tasks

The researchers tested Self-Direction on open-weight models from the Qwen family across three distinct agent benchmarks:

- **GAIA**: Multi-modal, complex multi-hop research requiring web navigation and reasoning.
- **Claw-Eval**: Structured tool-use workflows testing API interactions and parameter extraction.
- **Terminal-Bench 2.1**: Unconstrained Linux command-line tasks, bash scripts, and system administration.

Across these environments, adding Self-Direction improved overall task completion rates by 8.9 to 17.0 percentage points compared to standard in-context reflection baselines.

More importantly, the recurrence rate of known errors dropped sharply. The authors found that Self-Direction nearly doubled the reliability of corrective actions on subsequent encounters. Instead of guessing whether the agent would notice a text hint in its system prompt, the updated adapter shifted the token sampling probabilities directly away from the faulty API syntax.

The team also evaluated out-of-distribution transfer. A small set of adapters trained on specific terminal failures generalized across dozens of unseen tasks involving related file-system permissions and process management. The agent learned the structural pattern of the fix rather than memorizing the exact shell string.

## What this means for local agent runners

For developers building and hosting agent infrastructure, this work highlights an architectural transition.

Over the past two years, the industry leaned heavily on prompt stuffing to simulate agent learning. We treated context windows as infinite scratchpads, piling up few-shot examples, dynamic rules, and post-mortem notes until the prompt became brittle.

Self-Direction shows that treating execution errors as online distillation targets produces cleaner long-term behavior. When an agent trips on an environment quirk, the solution is not to explain the error back to the model in prose every time it wakes up. The solution is to let the agent compile the lesson into weights, index the adapter, and move forward.
