---
title: "Why Nvidia Put Mamba and Attention Together for Agents"
description: "Nemotron 3.5 Super uses a 120B-total, 12B-active hybrid Mamba-Transformer architecture. Here is why multi-turn agent loops break pure Attention KV caches and why prefix reuse on recurrent states is tricky."
pubDate: 2026-10-31T00:30:00+08:00
tags:
  - ai
  - agents
  - llm
  - devtools
---

Nvidia published the technical report for Nemotron 3.5 Super and Lightning this week. Super is a 120-billion parameter Mixture-of-Experts model with 12 billion active parameters per token, while Lightning is a 30-billion parameter model with 3 billion active parameters. On SWE-bench Pro, Super reached 51.78%, passing Nemotron 3 Ultra while activating roughly 4.6 times fewer parameters.

The architectural choice behind both models is an interleaved hybrid design combining Mamba-2 state space layers, sparse attention layers, and Mixture-of-Experts routing. Mixing state space layers with attention is an established approach, but in a multi-turn agent loop it targets an operational bottleneck that pure attention models struggle to handle.

### The KV cache wall in agent loops

Anyone running autonomous coding agents knows the prompt profile looks nothing like standard chat. A single task often runs fifteen to thirty turns. Each turn passes system prompts, tool schemas, repository file trees, compiler outputs, and git diffs.

In a benchmark session, Nvidia evaluated a proxy workload of twenty turns, with 2,048 input tokens and 1,024 output tokens per turn. Under pure Transformer attention, the key-value cache accumulates every single token across the transcript. By turn twenty, each concurrent user consumes tens of thousands of cached tokens in GPU memory. When you serve multiple developer sessions simultaneously, memory bandwidth chokes and VRAM fills up before compute cores reach saturation.

Mamba layers handle long sequences differently. A state space model compresses history into a fixed-size recurrent state. It processes input tokens sequentially with linear complexity, keeping memory consumption constant regardless of sequence length.

The problem with pure Mamba models has always been exact retrieval. When an agent needs to inspect a stack trace, look up a function signature fifty lines above, or copy a specific variable name from an imported module, attention mechanisms outperform recurrent states. Interleaving Mamba layers with attention heads keeps exact retrieval intact while offloading large portions of sequential history to recurrent state.

### The prefix caching catch

Managing state reuse inside the inference engine turns out to be more complex than model training.

In production agent serving, prefix caching is mandatory. You do not want to recompute system prompts and shared repository context on every turn. In pure attention models, engines like vLLM slice the KV cache into small per-token pages. If an incoming prompt matches an existing prefix, the engine attaches the matching cache blocks and begins generating immediately.

Hybrid models break this assumption. To resume execution at an arbitrary prompt position, the engine needs both the attention KV cache and the recurrent Mamba state at that exact boundary. That recurrent state contains the accumulated sequence summary for the entire layer, and it is significantly larger than an individual attention KV entry.

In vLLM, matching the byte size of Attention and Mamba cache groups means a single Mamba cache page occupies as many bytes as roughly 4,000 tokens of Attention KV cache. Retaining recurrent states at fine token intervals would consume too much memory, so the engine preserves Mamba checkpoints on coarse token boundaries.

When speculative decoding or agent branching rejects draft tokens, the execution pointer can roll back to a token position that does not align with a cached Mamba boundary. If the engine cannot find an aligned checkpoint, the scheduler has to split the prefill step, end at the nearest boundary, and execute an extra forward pass for the remaining tokens. That extra forward pass repeats kernel launches and tensor-parallel communication. Nvidia ended up patching vLLM in pull request 57329 to build internal prefill checkpoints so hybrid models could preserve prefix reuse without stalling the inference pipeline.

### Why benchmark scores shift across harnesses

The paper also highlights how sensitive agent evaluations are to the harness running them. In Section 3.10, Nvidia tested Nemotron 3.5 Super across six agent harnesses on SWE-bench Pro and Terminal-Bench 2.1.

Running the exact same model weights produced noticeably different results depending on the scaffolding. Claude Code recorded 49.45% on SWE-bench Pro, while Codex recorded 61.80% on Terminal-Bench 2.1. The rank order of harnesses flipped between the two benchmarks.

Developers often treat benchmark leaderboards as pure model comparisons. In practice, prompt scaffolding, tool output parsing, retry policies, and error handling change task success just as much as post-training. A model trained for tool calling will stumble if the harness wraps bash output in unexpected delimiters, and an average checkpoint can jump ten percentage points if the harness implements clean context pruning between commands.

### What this means for local agent stacks

On GB200 systems, Nvidia reported serving throughput reaching 4,856 output tokens per second per GPU while keeping individual user latency above 50 tokens per second. That interactive threshold matters because developers will not wait two minutes for an agent turn to finish inspecting a directory.

Deploying agent infrastructure requires balancing compute and memory access. Pure attention architectures deliver strong reasoning, but their KV caches choke long agent sessions. Hybrid state space architectures offer a path to sustain interactive multi-turn sessions without drowning in cache memory, provided your inference engine knows how to manage recurrent checkpoints.
