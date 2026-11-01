---
title: "Claude's Watermark Disappears When You Tune Temperature"
description: "Anthropic retrofitted watermarks onto older Claude models for EU compliance, but changing a single sampling parameter quietly bypasses the injection."
pubDate: 2026-11-02T00:30:00+08:00
tags:
  - ai
  - anthropic
  - devtools
  - compliance
---

Anthropic sent an update to API customers this weekend outlining a rollout of statistical text watermarks across older production models, including Claude Opus 4.6 and Claude Sonnet 4.6. The update is part of the compliance push ahead of the European Union AI Act deadline in December.

The announcement contained a technical condition that caught my attention. On Opus 4.6 and Sonnet 4.6, the watermark only activates when developers leave three specific sampling parameters at their default values: temperature, top_p, and top_k.

If you pass a custom temperature in your API payload, the watermark does not attach to the response. Anthropic noted this directly in the customer email, advising teams who rely on the watermark for compliance reporting to keep their sampling settings at default values.

On newer architectures such as Claude Opus 5.5, the watermarking routine runs regardless of your request configuration. On the 4.6 generation, adjusting temperature from 1.0 to 0.7 turns the watermarking step off.

### How logit watermarking breaks under sampling transforms

To understand why a sampling parameter disables the watermark, you have to look at how statistical text watermarking functions in token generation.

Anthropic uses an approach derived from Google DeepMind's SynthID scheme. These systems do not append hidden metadata, invisible Unicode tags, or cryptographic signatures to the completed response text. They operate inside the model's vocabulary projection layer while each token is being sampled.

During inference, the model produces a vector of unnormalized log-probabilities across its vocabulary. Before converting those logits into a probability distribution via softmax, the watermarking algorithm computes a pseudo-random hash using a private key and the tokens that immediately precede the current position. That hash partitions the vocabulary into two buckets, conventionally termed green and red token sets. The algorithm then applies a positive bias to the logits in the green set.

When the model samples from this adjusted distribution, it selects green tokens at a rate higher than pure chance would predict. A detector holding the private key reads the text, computes the expected fraction of green tokens across thirty or forty words, and runs a hypothesis test. If the green token density crosses a statistical threshold, the detector flags the output as synthetic.

This mechanism relies on a predictable relationship between logit shifts and selection probabilities.

When you alter sampling parameters, you modify that probability landscape. Temperature divides the unnormalized logits by a scalar constant before exponentiation. A temperature of 0.2 sharpens the distribution, driving probabilities toward the highest logit and suppressing the rest. Top-k drops all tokens outside the top k candidates, regardless of whether they belong to the green set. Top-p calculates cumulative probability mass and truncates the distribution tail dynamically.

If your sampling kernel was written for static defaults, running dynamic temperature scaling and nucleus truncation on top of logit offsets complicates the detector's math. The detector relies on an assumed null hypothesis distribution. When the generator truncates logits or sharpens distributions unevenly, the detection score drifts.

### The engineering compromise behind legacy endpoints

Modern foundation models integrate watermarking directly into their custom Triton or CUDA sampling kernels. Those newer kernels compute the logit bias, scale by temperature, apply nucleus masks, and sample in a single fused pass.

Retrofitting that fused math onto existing high-throughput production clusters for older models is an operational hazard. Opus 4.6 and Sonnet 4.6 serve heavy enterprise production traffic. Rebuilding and redeploying their core sampling kernels carries latency risks, memory footprint regressions, and numerical precision shifts that could alter output behavior for existing production workflows.

Anthropic chose the pragmatic path. The inference router checks the incoming request payload. If temperature, top_p, and top_k match the provider defaults, the request routes through the watermarking sampler. If the developer specifies custom sampling values, the router falls back to the original un-watermarked sampling path.

The trade-off is clean from an infrastructure stability standpoint. It avoids breaking changes on legacy model instances while satisfying regulatory deployment checklists.

### The gap between compliance assumptions and production configs

The operational problem lives on the client side.

Most production software built on top of LLM APIs never runs at default sampling settings. When building structured extraction pipelines, developers frequently drop temperature to 0.0 or 0.2 to reduce token variance. When writing narrative drafts or creative copy, teams often nudge temperature to 0.7 or 0.8 while capping top_p at 0.95 to eliminate degenerate tails.

Every developer team doing that on Claude Opus 4.6 is now generating unwatermarked text, regardless of what their compliance dashboard claims.

Many teams assume that model-level watermarking is an ambient environmental property like TLS encryption or tenant isolation. If a provider announces that a model family is watermarked, engineers assume the output carries the watermark automatically.

In this case, an ordinary client configuration change silently changes the compliance status of your data pipeline. If an enterprise relies on Anthropic's private preview detection API to audit generated assets against EU regulatory records, documents generated with tuned sampling parameters will register as unverified third-party text.

### Practical checks for API pipelines

If you run Claude in production and need to track watermarking status, you need to audit your client calls directly.

First, inspect your client abstraction layer. Check whether your SDK wrappers inject default sampling overrides. Many internal frameworks default temperature to 0.7 across all outgoing completions unless explicitly overridden. On Opus 4.6, that single line invalidates the watermark.

Second, separate your compliance workflows from your precision workflows. If a specific task requires auditable model watermarking under the EU AI Act, run that task on Claude Opus 5.5 where watermarking persists across parameter changes, or lock your 4.6 calls to default sampling values and handle variance through prompt structure.

Text watermarking remains fragile at the boundaries where statistical math meets real-world inference systems. A client request configuration should never be treated as an irrelevant implementation detail.
