---
title: "Stop Rebuilding Your Agent Loop Just to Train It with RL"
description: "Microsoft Research open-sourced Agent Lightning v1.0, a 3,500-line framework that trains agents through an LLM proxy. It leaves your production harness intact and bumps Qwen3.5-9B by 14.6 points on SWE-bench Verified."
pubDate: 2026-10-09T00:35:00+08:00
tags:
  - ai
  - agents
  - reinforcement-learning
  - kubernetes
---

Reinforcement learning for language agents has had an annoying operational tax. If you wanted to run RL on a coding agent, the standard advice was to port your agent into a training framework like verl, AReaL, or slime.

In those libraries, the training system owns the environment loop. The model emits action tokens, the environment returns observation tokens, and the framework appends them into one continuous token sequence. That works cleanly for simple single-turn math prompts or basic ReAct toy loops.

It falls apart the moment you deploy a real agent.

A production agent harness like OpenHands, mini-SWE-agent, or Claude Code is rarely a simple tokenizer loop. The harness handles context window compaction, tool schema validation, bash timeouts, subagent delegation, git diff sanitization, and workspace isolation. That scaffolding represents thousands of lines of battle-tested engineering. Reimplementing that logic inside an RL trainer means maintaining two separate codebases. Even worse, the simplified agent you train inside the RL harness behaves differently than the one running in production. You end up optimizing weights for an environment that your deployed agent will never see.

This week, Microsoft Research Asia open-sourced Agent Lightning v1.0, proposing an alternative architecture called Harnessed Agentic RL. The entire control plane fits in roughly 3,500 lines of Python. Instead of forcing you to reimplement your agent, it places an LLM proxy between your existing production harness and the policy model.

### Putting the collection boundary at the API proxy

The core architectural change in Agent Lightning is where the training framework draws its boundary.

Instead of managing the agent execution loop directly, Agent Lightning runs the agent harness as an independent process or Kubernetes job. The harness runs its unmodified production code. When the agent calls an LLM, it routes requests through Agent Lightning's API Gateway, which presents a standard OpenAI-compatible endpoint.

The API Gateway records the prompts, generated responses, log probabilities, and token IDs. A rollout controller tracks execution lifecycles, and a customized trainer built on verl ingests finished trajectories for policy updates.

By decoupling execution from training, the harness retains its native tooling, context truncation, and multi-step logic. If you already have an agent running in Docker or Kubernetes, connecting it to reinforcement learning requires setting the base URL environment variable to point at the proxy:

```python
import os
from openai import OpenAI

# Unmodified agent harness code points to the training proxy
client = OpenAI(
    base_url=os.getenv("AGENT_LIGHTNING_PROXY_URL", "http://localhost:8000/v1"),
    api_key=os.getenv("OPENAI_API_KEY", "dummy-key"),
)

def run_agent_turn(harness_context, tool_registry):
    # The harness manages prompt construction, tool schemas, and local bash calls
    payload = harness_context.render_prompt(tool_registry)
    response = client.chat.completions.create(
        model="policy-model",
        messages=payload,
        temperature=0.7,
    )
    # Rollout state and token logprobs are captured transparently by the proxy
    return harness_context.apply_tool_call(response.choices[0].message)
```

This setup sounds straightforward, but treating the agent harness as a black box creates four distinct systems problems that traditional RL engines never had to deal with.

### Four systems hurdles in real harnesses

When a training engine cannot see inside the agent harness, it only observes a sequence of discrete HTTP request and response pairs. Translating those calls into stable gradient updates requires handling several edge cases.

First, harnesses store conversation context as text, not token IDs. Between turns, harnesses often trim old output, summarize past tool executions, or reformat system prompts. When the trainer tries to re-tokenize that text into training tensors, token boundaries shift across chat templates. You cannot reliably concatenate multi-turn responses into a single continuous trajectory without breaking token alignments.

Second, advantage estimation breaks if calculated per sample. Because an agent may spawn subagents or execute variable numbers of bash commands for a single task, one rollout can produce two LLM calls while another produces twenty. If you compute PPO or GRPO advantages at the sample level, complex rollouts receive disproportionate statistical weight. Agent Lightning calculates baselines and advantages at the rollout level, ensuring that a multi-step task counts as a single outcome regardless of how many tool steps it took.

Third, loss normalization must account for variable sample volume. Averaging training loss across raw sample counts skews the gradient toward whatever behavior produces more intermediate tool queries. Normalizing loss at the rollout level prevents harness verbosity from dominating policy updates. In MSRA's ablation experiments, rollout-level normalization kept policy entropy steady across hundreds of training steps, avoiding policy collapse.

Fourth, agent rollout latency is unpredictable. One coding task might resolve in ten seconds, while another takes five minutes running test suites. Synchronous RL wastes compute waiting for the slowest container in a batch. Fully asynchronous RL keeps GPUs busy, but typically requires separate dedicated GPU clusters for rollouts and model updates.

Agent Lightning introduces what they call Collocated Async RL. Rollout generation and model weight updates share the same pool of GPUs. When the controller collects enough trajectories, the API Gateway temporarily stops accepting new rollout requests and waits for active calls to complete. It updates policy weights on the same GPUs, then reopens the endpoint. MSRA reports this achieved a 2x end-to-end training speedup over synchronous execution while halving the GPU count compared to dedicated asynchronous setups.

### Running rollouts on vanilla Kubernetes

Another practical headache with agent RL has been sandbox infrastructure. Many recent agent training papers rely on commercial hosted sandbox providers like E2B or Modal. At a scale of tens of thousands of rollout trajectories, commercial sandbox pricing piles up quickly.

Agent Lightning includes a native Kubernetes reconciler in its rollout controller. Each rollout launches as an isolated Kubernetes job with resource limits and clean disk volumes on your existing cluster. You can run training rollouts on local hardware, on-prem nodes, or standard cloud instances without paying a per-minute premium for specialized sandbox APIs.

### Empirical gains on SWE-bench Verified

To validate the setup on real software engineering tasks, the researchers built an end-to-end training pipeline combining SWE-smith, mini-SWE-agent, and Qwen3.5-9B.

The training dataset contained roughly 6,000 samples, running on open-source codebases. With rollout-level advantage calculation and loss normalization, RL training alone increased Qwen3.5-9B from 41.8% to 56.4% Pass@1 on SWE-bench Verified. That is an absolute improvement of 14.6 percentage points, achieved entirely within the original agent harness rather than an artificial simulator.

### Keeping the plumbing intact

Most real-world improvements in AI systems come from fixing the glue code between models and infrastructure. If you spend three months perfecting an agent harness that handles environment retries and file edits, throwing that harness away during post-training is counterproductive.

Agent Lightning proves that training on production harnesses is practical in 3,500 lines of code. By putting the observation layer at the network proxy, you can train the exact software you deploy to users.
