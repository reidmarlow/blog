---
title: Why vLLM 0.32 Baked Decision Routing Into the Engine
description: vLLM v0.32 added /v1/systemone for structured routing directly inside the inference engine. When your agent router lives in the server, the KV cache stays put.
pubDate: 2026-10-18
tags: ["ai", "vllm", "agents", "infrastructure", "python"]
---

Most agent architectures treat inference engines as dumb token pumps. You put a fast classifier or an LLM judge in front of your pipeline, query it over HTTP, parse the JSON, and then dispatch the real prompt to the heavy model.

It works until your traffic scales and you realize you are paying the prefill tax twice.

vLLM v0.32 dropped yesterday with PR #59299, introducing a default endpoint called `/v1/systemone`. Instead of streaming open-ended tokens back to Python just to see if an agent should run a database lookup, the server evaluates choice, boolean, or scoring questions directly over structured state.

The immediate reaction on my timeline was split: half the people asked why an inference engine is getting into application routing, and the other half wondered why it took this long.

If you have ever spent a week trying to keep routing latency under 50 milliseconds across a fleet of agents, the answer is obvious: moving the decision inside the engine stops you from throwing away the KV cache.

## The round-trip tax

Consider what happens in a typical agent triage loop. A 12,000-token prompt lands from a developer session. It contains system instructions, workspace context, recent tool outputs, and the latest user request.

Before running an expensive 70B parameter model with speculative decoding, you want a quick routing decision:
1. Does this request require shell execution?
2. Is it safe to execute in the current container?
3. Which specialized tool schema should be mounted into the next turn?

In the standard setup, you send that 12,000-token prompt to a routing endpoint. The engine allocates KV blocks, computes attention across all 12,000 tokens, generates five tokens of JSON (`{"action": "shell", "risk": "low"}`), and closes the stream.

Then your orchestration layer inspects that JSON and immediately fires the next request to the worker pool. If that worker lives on a different GPU rank or if the prefix cache was evicted during the round-trip overhead, you run prefill on those same 12,000 tokens a second time.

On modern hardware, prefill on 12,000 tokens is not free. Even with FlashAttention-3 and chunked prefill, recomputing KV cache for prompt prefixes eats memory bandwidth and spikes time-to-first-token (TTFT). You end up adding Redis layers, hash-based sticky routing, and complex prefix cache warming scripts just to stop your own stack from fighting itself.

## What /v1/systemone actually does

Instead of treating classification as an open-ended completion task, vLLM's `POST /v1/systemone` treats it as a constrained evaluation on top of existing engine state.

Here is the basic interface:

```bash
curl -X POST http://localhost:8000/v1/systemone \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.1-8B-Instruct",
    "prompt": "Evaluate whether the following user diff touches production configs: ...",
    "schema": {
      "type": "choice",
      "options": ["safe", "review_required", "block"]
    }
  }'
```

Under the hood, the engine does not enter the standard autoregressive decode loop. It restricts next-token sampling to the valid option tokens, computes the log-probabilities across those candidate branches, and resolves the choice immediately.

Because this happens inside the engine process:
- **No speculative decode overhead:** The engine avoids allocating draft tokens or speculative n-gram buffers for a single categorical branch.
- **Cache retention:** The prefix tokens stay pinned in PagedAttention blocks on the worker. If the subsequent call uses the same session prefix, vLLM hits the prefix cache at 100%.
- **Zero JSON parsing failures:** You do not get malformed markdown, unclosed braces, or hallucinations from small 3B models trying to produce YAML.

The release notes also show this wired up for `LiquidAI/d1-3B` and `Cloudflare/clef-omni`. It makes sense. Small models are great for gating, but terrible at adhering to fussy JSON schemas under heavy concurrency.

## Engine boundaries are moving

For the last two years, the boundary between an inference server and an agent framework was clean. The server computed logits and streamed bytes. The framework handled prompts, retries, tool parsing, and state machines.

That division of labor is breaking down under memory constraints.

Look at the other highlights in vLLM v0.32:
- NVFP4 KV cache support on SM8x, SM90, and SM12x architectures.
- Built-in Hugging Face tool-call and reasoning parsers (`--tool-call-parser hf`, `--reasoning-parser hf`) reading checkpoint `response_template` files directly in Rust and Python frontends.
- Automatic FlashInfer kernel preloading and autotune caching.

When you care about latency and memory density, handing raw strings back and forth across a socket is the slowest possible way to run an agent. The engine has to know what the model is doing. If a model is reasoning, the engine needs to parse the thought block so it can manage context limits. If a model is calling a tool, the engine needs to catch the structured call before allocating wasteful decode steps.

And if an agent needs a routing decision, the engine should evaluate the branch right where the KV blocks are already warm.

## What I am changing in my stack

I run several local agents on an RTX workstation for background triaging and repo indexing. Up to now, my router was an external Python process calling a local llama.cpp instance, returning a short enum, and then passing execution to an agent container.

Half my latency was Python serialization and connection overhead.

Moving routing decisions directly to the engine endpoint cuts out the middleman. You keep your context cache resident on the GPU, you get guaranteed schema conformance without regex guidance libraries running in user space, and you stop burning GPU cycles recalculating attention on prompts you saw 10 milliseconds ago.

If your agent pipelines are struggling with TTFT under load, look at how many times your prompts bounce between your application layer and your models just to answer a boolean question.

Chances are, you are paying for the same KV blocks three times over.
