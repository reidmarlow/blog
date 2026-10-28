---
title: Why Changing an Agent Harness Breaks Frozen Models
description: Benchmarking coding agent harnesses with a frozen model conflates interface capabilities with policy mismatch. An HKUST study shows how changing the harness shifts both the ceiling and the penalty.
pubDate: 2026-10-29
tags: ["ai", "agents", "benchmarks", "infrastructure", "open-source"]
---

Whenever a team releases a new agent harness, the evaluation script looks the same. You take a popular checkpoint, wire it up to the new prompt templates, tool signatures, and system loop, and measure task resolution against an older setup.

If the success rate drops, the team concludes the new harness is worse.

A new paper from Jian Mu, Ruibo Shen, and Yao Shu at HKUST (*Your Policy Is Secretly a Harness: The Decision Geometry of Agent Interfaces*, arXiv:2610.37255) shows why this standard comparison is broken. Under KL-regularized control, an optimal policy inherits the structural preferences of the exact harness it was post-trained on. When you evaluate harnesses using a frozen model, you are not testing which harness offers a better ceiling. You are measuring the combination of that ceiling and the mismatch penalty incurred by a policy trained on a different setup.

The paper formalizes deployed return as two distinct terms:

```
Return = Ceiling(Harness) - Mismatch(Policy, Harness)
```

The ceiling represents the maximum return possible under that harness. The mismatch represents the return lost because the current model makes suboptimal decisions under those specific interface mechanics.

Weight training moves mismatch. Swapping the harness moves both terms simultaneously.

## The sensitivity of frozen policies

When an agent undergoes post-training under a specific harness, its log odds align with that harness's action distribution. The model learns to expect observations in a precise order, predicts tool responses shaped by particular wrappers, and paces its reasoning around a concrete turn loop.

The authors tested this sensitivity on MiniWoB++. They took a trained policy that solved 85.0% of tasks, kept all task semantics identical, and simply reversed the order of the observation fields in the prompt.

Every optimal action remained completely valid and achievable. Yet the success rate of the frozen model collapsed from 85.0% to 19.2%.

If you treated that test as an interface comparison, you would conclude that field order destroyed the environment. In reality, the environment ceiling remained identical, while the policy mismatch exploded because the frozen weights expected the original token layout.

Conversely, the authors found that every harness rejected by a frozen-model comparison that actually raised the theoretical ceiling went on to outperform the original harness once the agent was trained under it. Measuring ceiling and mismatch beforehand accurately predicted those downstream gains.

## Measuring coding harnesses on Terminal-Bench Lite

To see how this plays out in production environments, the team evaluated five prominent coding agent setups on Terminal-Bench Lite: DeepAgents, Pi, DeepSeek Harness, Terminus-2, and mini-SWE-agent. They ran a frozen Qwen3.5-9B across all five harnesses and used GPT-5.6 Luna as a teacher stand-in to estimate the true ceiling.

The ranking of actual task accuracy matched the ranking produced by estimating the ceiling minus mismatch:

```
Harness Ranking on Terminal-Bench Lite:
1. DeepAgents      (High ceiling, controlled mismatch via runtime recovery)
2. Pi              (Interactive terminal steering, compact state representations)
3. DeepSeek Harness (Structured tool profiles, rigid parameter enforcement)
4. Terminus-2      (Tmux session tracking, heavy prompt overhead on small models)
5. mini-SWE-agent  (Minimalist shell loop, lower structural ceiling on complex tasks)
```

Looking at either metric in isolation failed to predict performance. Looking only at raw accuracy hid whether a harness was genuinely limited or whether Qwen3.5-9B was stumbling over unexpected tool schema definitions.

For instance, Terminus-2 uses tmux keystroke buffers and native summarizer subagents. That architecture offers high ceiling capabilities on long interactive debugging tasks, but imposes high mismatch on smaller local models that fail to track asynchronous terminal state without specific fine-tuning. Meanwhile, mini-SWE-agent has low mismatch because its single-shot bash runner matches standard base model pretraining, but its ceiling is lower when tasks require managing multi-step background processes.

## Stop treating harnesses as plug-and-play skins

The immediate takeaway for anyone building agent harnesses is clear: stop benchmarking harness revisions against frozen base checkpoints and calling it an architectural verdict.

When you modify prompt scaffolding, rewrite tool JSON schemas, or change how subagents pass context back to the root, you alter the action space. If your evaluation run shows a 10% regression on a base checkpoint, that regression does not prove your new tool schema is bad. It often means your model spent its post-training budget learning the quirks of your old schema.

If you want to compare harnesses fairly, you have two real options. You either fine-tune checkpoints under each harness candidate to measure adapted return, or you estimate the harness ceiling using a stronger teacher model and evaluate mismatch explicitly.

Anything else is just testing how well a model memorized the flaws of your first prototype.
