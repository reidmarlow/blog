---
title: "Stop Re-Streaming Context: What MemT-1.0 Shows About Native Memory"
description: "The MemTensor team trained MemT-1.0 across 34B tokens with Gated DeltaNet-2 memory blocks. At 128K history, it delivers a 66x cut in state size and 1.86x faster inference by updating state vectors instead of retaining raw KV caches."
pubDate: 2026-10-20
tags: ["ai", "infrastructure", "memory", "agents", "architecture"]
---

Most agent setups treat memory as an external plumbing problem. Every turn, a router queries a vector store or reads markdown files off disk, then pastes chunks back into the prompt. As the conversation stretches past 50,000 tokens, the KV cache balloons, TTFT crawls, and hosting costs scale directly with the length of the transcript.

The MemTensor team just released MemT-1.0 (arXiv:2610.26825), an architecture that builds state updates directly into the model's compute graph.

Instead of keeping raw key-value pairs across the entire history, MemT-1.0 augments Transformer blocks with parallel native memory blocks. Within each turn, it uses Gated DeltaNet-2 (GDN-2) to drive stable token-level state updates. To scale capacity without blowing up the parameter count of every attention head, the authors introduce Mixture-of-Storage (MoS).

The authors trained a model family, MemT-1.0-Nano (36B total, 3B active, 10M dynamic memory) and MemT-1.0-Flash (288B total, 17B active, 336M dynamic memory), over a two-stage pipeline using 34B tokens.

The latency numbers show where the operational payoff sits. At a history length of 128K tokens, MemT-1.0-Nano records an approximate 1.86x end-to-end inference speedup and a 66x reduction in persistent storage overhead compared to a standard full-context KV cache. The persistent state size stays fixed as turns accumulate.

They also tested MemT-1.0 on SWE-bench Verified and SWE-bench Multilingual by feeding retrieved procedural experience into the native memory before execution. The internalized experience improved task completion and run-to-run consistency over zero-experience baselines, matching the accuracy of stuffing raw text into the system prompt.

Today, developers build complex context compression scripts, summarization loops, and sliding-window caches to keep long-running agents from choking on their own logs. If state updates live inside the layer math, you stop paying the bandwidth penalty of transmitting the past at every step.
