---
title: "Test-Time Training Collapses When Agents Learn from Their Own Rollouts"
description: "Updating fast weights during inference works on external text. When an agent trains on its own outputs, each step warps the generator for the next chunk until task completion crashes to zero. A staging buffer fixes it."
pubDate: 2026-10-07T00:30:00+08:00
tags:
  - ai
  - agents
  - automation
  - benchmarks
---

The pitch for test-time training sounds clean on paper. Long-context attention windows are expensive to maintain in VRAM. Instead of caching millions of tokens in attention key-value tables, you let the model update a slice of its weights while running inference. Every chunk of text that streams past gets processed by an inner-loop optimizer like SGD or Adam, updating fast weights so the network absorbs long-horizon context directly into its parameters.

When an autonomous agent only reads external human text, test-time adaptation works as advertised. The weights absorb the context, and perplexity on subsequent passages drops.

The problem starts the moment the agent begins acting.

Autonomous agents do not sit in passive read mode. They produce internal reasoning chains, plan steps, emit tool calls, and parse terminal outputs. If an agent updates fast weights on every chunk it processes, it inevitably trains on its own tokens. Fast weights $W_t$ generate output $x_t$. The inner loop updates the parameters on $x_t$ to produce $W_{t+1}$. Those updated parameters then generate $x_{t+1}$, which supplies the training target for $W_{t+2}$.

That closed feedback loop creates an architectural ouroboros. Within a few thousand tokens, the model begins optimizing itself into catastrophic failure.

A study from KAUST by Cheng Luo, Bing Li, and Bernard Ghanem (arXiv:2610.05076, with code at `lingjivoo/ttt-ouroboros`) lays out a systematic causal decomposition of this breakdown across 128K-token streams.

### What happens when weights eat their own outputs

The researchers evaluated test-time training models across multiple scales: End-to-End Test-Time Training (TTT-E2E) at 125M, 760M, and 3B parameters, alongside standard Qwen3-4B updated via in-place Adam steps on its feed-forward down-projection layers.

When trained on real human text over 128K tokens, fast-weight updates consistently lowered negative log-likelihood. But when forced to update on their own generated outputs, the numbers flipped:

- On 125M TTT-E2E, retaining generated-text updates added 3.01 nats of loss on independent human-written evaluation passages compared to keeping weights frozen.
- On 760M TTT-E2E, retaining generated updates raised evaluation loss by 6.00 nats.
- On standard Qwen3-4B with Adam (learning rate $10^{-4}$), self-generated updates increased real-text loss by 1.231 nats, whereas updates on real text lowered loss by 0.168 nats.

The breakdown is not an artifact of language modeling perplexity metrics. In interactive environments, task execution collapsed:

- In WebShop, an e-commerce agent benchmark evaluated across five seeds, closed-loop self-training caused exact task success to drop from 16.0% (weights frozen) down to 10.5%.
- In ALFWorld, a multi-step household environment evaluated on Qwen3.8-27B across 134 unseen tasks, closed-loop updates dropped mean success from 86.8% down to 27.6% under update scale 8, and down to 18.7% under update scale 16. Across two of the three evaluated random seeds, the closed-loop agent completed exactly zero unseen tasks.

### Tracing the causal failure

The intuitive explanation is that synthetic text is simply low quality. If a model generates mediocre text and trains on it, it gets worse.

The authors tested that hypothesis with a controlled experiment called Fixed Generation. They froze a generator model $W_0$ and let it produce the training stream, while a separate learner model updated its weights on those synthetic chunks.

Fixed Generation eliminated over 98% of the damage. At 125M, the excess loss gap shrank from 3.18 nats down to 0.052 nats. At 760M, it shrank from 1.26 nats down to 0.073 nats.

The learner absorbed synthetic tokens without breaking. The damage happened only when the model learning from the tokens was also the model generating the next tokens.

A paired single-update analysis revealed the underlying mechanism. When you take a model checkpoint and apply a single gradient step on its own generated chunk $x_t$, loss on $x_t$ decreases, but loss on independent human text immediately increases. The update fits the idiosyncratic distribution of that specific rollout at the expense of general predictive accuracy. When that update alters the generator, the next rollout contains stronger idiosyncrasies, compounding the error until the fast weights drift into a local trap.

Heuristics like repetition penalties reduce the drift slightly (cutting the 128K gap from 3.01 nats to 0.88 nats at 125M), but they do not prevent degradation. Naive source masking (ignoring self-generated tokens) works only when real and generated tokens are cleanly partitioned. In an agent workflow where all actions are model-generated, source masking discards every update, disabling test-time adaptation entirely.

### The fix: settlement staging buffers

Rather than committing weight updates immediately, the authors implemented a protocol called Settlement.

Settlement treats fast-weight updates like uncommitted database transactions. When the model processes a self-generated chunk, it calculates proposed gradient update $\delta$ and pushes it into an ordered pending buffer $P$. The live model continues executing with current weights $W$.

When independent evidence $q$ arrives (such as a passage of external text, a verified tool response, or an environment reward), Settlement tests candidate weights $W + \delta$ against $W$:

$$A(\delta; W, q) = L(q; W) - L(q; W + \delta)$$

If $A \ge 0$, the update genuinely improves or preserves predictive capability on external reality, and Settlement commits the change to live weights ($W \leftarrow W + \delta$). If $A < 0$, the candidate worsened performance and gets discarded.

The experimental results demonstrate that conditional admission stabilizes adaptation:

1. **Long-stream language modeling:** On 128K streams, Settlement left an endpoint loss gap of 0.07 nats at 125M and -0.02 nats at 760M compared to frozen weights. The catastrophic drift disappeared.
2. **Preserving real learning:** On streams containing genuine human text, Settlement admitted 78.8% of proposed updates (89 of 113 candidates), achieving a net adaptation benefit of 0.0534 nats over frozen weights. It filters degenerate rollouts without killing real adaptation.
3. **Agent benchmarks:** On WebShop, Settlement reached an exact success rate of 18.5%, beating both closed-loop training (10.5%) and frozen weights (16.0%). On ALFWorld unseen tasks, Settlement sustained 90.0% to 91.0% completion rates, preventing the zero-success collapse seen in closed-loop seeds.

### Engineering takeaways for autonomous loops

If you are building long-horizon agents with writable state, test-time fine-tuning, or dynamic weight memory, this paper outlines a clear boundary:

- **Never allow self-generated rollouts to commit straight to live parameters.** An inner-loop optimizer will gladly overfit the model's own immediate generation, drifting further from reality on every step.
- **Separate proposal from commitment.** Keep updates in a staging buffer until you observe an external verification signal. In an agent framework, that signal can be a passing compiler run, an API response status, or a ground-truth environment observation.
- **Validate accumulated state.** Individual updates that look safe in isolation can destabilize the model when combined. Testing candidate parameter states against fresh external evidence before committing keeps the agent grounded.
