---
title: "Seven Dormant Neurons Can Backdoor an AI Coding Agent Without Training"
description: "Microsoft Research's Lazarus attack edits fewer than ten SwiGLU neurons on inference hardware to trigger shell payloads from normal repo names or tool outputs while passing standard benchmarks."
pubDate: 2026-11-11T16:45:00Z
tags:
  - ai
  - agents
  - security
  - engineering
---

Most agent security checklists start and end at the prompt boundary. Teams sanitize untrusted HTML before feeding it into context, strip suspicious instructions from retrieved documents, and run Terminal-Bench or safety suites before promoting a model checkpoint.

On November 10, Microsoft Research and the Microsoft AI Red Team published [Lazare, veni foras](https://www.microsoft.com/en-us/research/blog/lazare-veni-foras-reprogramming-dormant-neurons-to-backdoor-ai-agents/), a paper showing how to bypass both checks by rewriting fewer than ten dormant neurons in a model checkpoint. The edit requires no fine-tuning run or training cluster. Any machine with enough memory to load the weights can implant a trigger that stays invisible across normal traffic, then fires a multi-token shell command the moment a specific string appears in a user prompt or a tool output.

## Reprogramming dormant neurons into a token chain

Modern transformer blocks use gated feed-forward layers such as SwiGLU, and a large fraction of their neurons stay near zero across ordinary text. In [the Lazarus paper](https://github.com/anadim/anadim.github.io/blob/master/papers/Lazarus.pdf), the researchers take advantage of two properties of those late-layer feed-forward blocks.

First, late-layer activations already separate contexts cleanly enough that a linear probe fitted on 23 to 50 trigger and non-trigger examples can distinguish a target string from benign traffic. That trigger can sit inside the initial prompt, such as a repository slug like `github.com/acme-corp/payments`, or arrive mid-session inside terminal output, such as a production hostname like `prod-db-07` or a date rollover like `2027-01-01`.

Second, a dormant neuron can be rewritten in closed form and optionally sharpened with a few hundred gradient steps on those isolated weights alone. Its `gate` and `up` rows are pointed at the trigger direction, and its `down` column is pointed at the output embedding for a single payload token. While context stays normal, the neuron outputs near zero. When the trigger hits, the neuron injects a sharp spike into the residual stream to force its assigned token. Chaining roughly one edited neuron per token produces an arbitrary tool call step by step, such as emitting `curl`, `-s`, and an attacker URL inside an `execute_bash` JSON block.

On `Nemotron-Terminal-8B`, editing 7 out of more than 12,000 neurons fitted on just 23 trajectories reached a 98.80% attack success rate on held-out triggered sessions, rising to 99.70% with 2,405 samples. Benign leakage stayed at 0.0000%, and mean clean-to-edited next-token KL divergence measured 0.0180 on the 23-sample patch and 0.0022 on the larger fit. On `Qwen3.6-27B`, editing 6 neurons hit 51.00% with 23 samples and 83.70% with 2,393 samples while keeping AIME and Terminal-Bench scores close to the unedited model, and a single patch transferred to an unseen agent output format at 40% exact-action accuracy. `Gemma-4-31B-IT` was vulnerable under the same setup.

According to principal researcher Dimitris Papailiopoulos, the core idea of individually hardwiring dormant neurons and chaining them into multi-token payloads was found autonomously by Claude Code running Opus 4.5 in February 2026 after he prompted it to backdoor a model without training.

## Why behavioral evals and naive weight audits miss the edit

A 0.0022 KL shift on clean inputs leaves benchmark scores intact. A standard evaluation suite will never happen to contain the attacker's chosen repository slug or date string, and prompt-injection filters watching user inputs have nothing to catch when the instruction lives inside the model weights and waits for a benign hostname in stdout.

In [the companion Microsoft Security guidance](https://www.microsoft.com/en-us/security/blog/2026/11/10/detecting-sleeper-agents-hiding-in-ai-model-neurons), the team also tested whether frontier models could spot Lazarus edits directly from checkpoint weights without a clean reference model. Across 114 edited checkpoints and 103 clean public checkpoints, GPT-6 Astra flagged 72.81% of edited checkpoints and misclassified zero as clean, yet abstained with "no decision" on 99.03% of the clean checkpoints. Claude Opus 5.5 correctly cleared 93.20% of the clean checkpoints, yet labeled 41.23% of the edited checkpoints as clean.

The structural signal only became usable when the researchers turned what those agent sessions noticed into explicit numerical checks. Unlike legitimate fine-tuning or quantization, which shifts weights diffusely across layers, Lazarus leaves sharp magnitude and directional outliers in a handful of final-layer MLP neurons. Combining five weight features, including projection norm sums, rank agreement across `gate`, `up`, and `down`, gate-up alignment, and output-token alignment, flagged 91.4% of edited test checkpoints at a 9.7% false-positive rate without needing the original base weights.

A 91.4% detection rate with nearly 10% false alarms is practical for intake triage on a model hub, and weak as a sole production guarantee. Nearly one in eleven backdoored checkpoints still slipped past the reference-free classifier.

## What to change in your agent stack

Lazarus needs write access to a checkpoint, which applies both to third-party quantizations, merges, and fine-tunes pulled from public hubs and to internal model storage pipelines. If you wire local or self-hosted checkpoints to coding agents with terminal access, three operational changes close most of the gap:

1. Verify provenance and diff weights against a declared base model before serving a checkpoint. Downloading an arbitrary GGUF quantization or community merge skips the easiest check available: comparing tensor diffs against the publisher's base weights exposes isolated neuron spikes immediately, and rejecting checkpoints without verifiable file hashes blocks casual tampering.
2. Stop treating benchmark parity as a safety check. Running Terminal-Bench or internal coding evals after pulling a new checkpoint checks capability on benign prompts, and tells you nothing about dormant trigger neurons waiting on an environment string.
3. Enforce blast-radius limits inside the agent harness. Run agent shell tools inside disposable containers without ambient host credentials, pass short-lived scoped tokens instead of personal API keys or SSH agents, and require explicit approval or outbound network allowlists before `execute_bash` can pipe remote scripts or touch production hosts.
