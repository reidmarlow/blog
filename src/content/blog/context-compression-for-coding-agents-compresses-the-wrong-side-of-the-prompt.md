---
title: "Context Compression for Coding Agents Compresses the Wrong Side of the Prompt"
description: "Why soft-token compression breaks exact code references, and how keeping recent tool outputs and hard agent actions changes the math on long-horizon runs."
pubDate: 2026-09-29T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - research
---

Most engineering teams working on long-context agents hit the same billing wall around turn twenty. A coding agent runs twenty shell commands, reads twelve files, and runs pytest three times. By turn twenty-five, the prompt is 80,000 tokens long. Over eighty percent of those tokens are terminal dumps, compiler warnings, grep outputs, and directory trees.

The default reaction across research and devtools has been to compress the transcript. Teams summarize older turns, drop middle messages, or project prompt tokens into learned latent soft embeddings.

A paper from Peking University titled "Compress What You See, Not What You Say: Anchored Context Distillation for Latent-Observation Software Engineering Agents" (arXiv:2609.31430, by Zhensheng Zou, Guoqing Wang, and Dan Hao) puts hard numbers on why soft compression usually ruins coding agents.

When you compress an entire agent transcript into latent vectors, you compress two fundamentally different categories of text: what the environment printed, and what the agent decided.

### The exact-match penalty

A software agent does not read historical context the way a human reads an essay. It reads context to copy exact file paths, variable names, line offsets, git commit hashes, and regex patterns.

If an agent needs to edit `src/core/connection_manager.py` at line 412, a compressed semantic summary that says "the user reviewed the connection pooling setup earlier" is useless. The agent needs the exact string `src/core/connection_manager.py`. If that string gets blurred into soft tokens, the model either invents a nearby path or spends another tool call running `find` or `ls` to recover what it already saw.

Compressing the agent's own actions creates a second failure mode: behavioral drift. Agents trained with standard instruction tuning rely on the exact surface forms of their tool definitions and scratchpads. Once you feed them soft tokens representing prior thoughts, their syntax degrades. They drop closing brackets, mangle JSON arguments, or repeat earlier failed actions.

### The split: LOHA and ACD

The authors break the problem into two specific techniques:

First, a context layout called Latent Observations, Hard Actions (LOHA). Instead of compressing everything, LOHA preserves:
1. Every turn written by the agent in raw text.
2. The system prompt and instructions in raw text.
3. The most recent K tool observations in raw text.
4. Older tool observations compressed into soft latent tokens.

The separation addresses the actual workload. The agent retains full, uncorrupted access to its own previous reasoning and tool syntax. It retains byte-exact access to whatever the last few tools just printed. Historical observations (such as a 2,000-line grep run from ten turns ago) remain accessible in latent space so the model knows which files were touched, without occupying thousands of raw token slots.

Second, a training objective called Anchored Context Distillation (ACD). Fine-tuning an agent to read soft tokens typically degrades its out-of-distribution performance on standard text. ACD trains the agent on latent-observation histories while simultaneously anchoring its output distributions against the original base model running on plain text.

### The numbers on SWE-bench Verified

The team evaluated the approach on SWE-bench Verified across two open models: Qwen3-4B and SWE-Master-4B-RL.

Setting the uncompressed observation window to K=3 produced these results:

- **Context reduction**: 43% fewer tokens per call on Qwen3-4B, and 57% fewer on SWE-Master-4B-RL.
- **Task completion**: Qwen3-4B resolved 12.1% of issues with LOHA versus 14.5% uncompressed. SWE-Master-4B-RL resolved 21.8% versus 27.5%.
- **Recency scaling**: Expanding the exact observation window to K=8 pushed resolve rates back up to 14.4% for Qwen3 and 23.0% for SWE-Master.

The critical test comes under memory limits. Under a strict 32K token budget, where a standard uncompressed agent truncates or crashes on long tasks, Qwen3 with K=3 resolved 21.1% on a 199-instance long-horizon subset, compared to only 11.1% for the same adapted agent trying to run on truncated plain text.

On concurrent single-GPU serving, the smaller context footprint boosted instance throughput by 1.9x.

### What to take away for agent harnesses

If you are running long-horizon agent workflows on local hardware or self-hosted models, soft context distillation offers a real path to doubling concurrency. But the architectural rule matters more than the specific weights:

Never compress the agent's own action history. If your compression scheme touches the model's scratchpad, tool calls, or immediate working memory, you will lose task resolution. Let the environment outputs absorb the lossy compression, and keep the agent's decisions exact.
