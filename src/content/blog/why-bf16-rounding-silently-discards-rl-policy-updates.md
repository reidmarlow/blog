---
title: "Why Standard bf16 Rounding Discards 99% of RL Policy Updates"
description: "In modern RL post-training pipelines, converting fp32 optimizer weights to bf16 rollouts via round-to-nearest silently zeros out small updates, leaving the policy engine a hundred steps behind."
pubDate: 2026-11-03T00:30:00+08:00
tags:
  - ai
  - llm
  - machine-learning
  - engineering
---

Most modern reinforcement learning pipelines for language models split the job across two distinct systems. The optimizer maintains master weights in full 32-bit floating point inside the training process. A dedicated inference engine, usually vLLM or SGLang, hosts a bfloat16 copy of those weights to generate rollouts at scale.

Every standard open-source framework, including verl, TRL, OpenRLHF, and slime, bridges these two runtimes with a straightforward cast: round-to-nearest conversion from fp32 to bf16.

A paper from Andrew Gao and William Gao at Stanford, released under the title Fair Cast, documents a numerical failure mode inside that cast. Under the learning rates commonly used in post-training, standard round-to-nearest conversion discards over 99 percent of parameter updates. The inference engine serving rollouts ends up lagging the optimizer by 50 to 150 steps, while the training diagnostics report that the two engines are in sync.

### The arithmetic dead zone in bfloat16

The cause comes down to representation scale. Bfloat16 uses an 8-bit exponent and a 7-bit significand. Because the significand is short, the gap between adjacent representable numbers near a weight of magnitude |w| is roughly |w| / 128.

When you use round-to-nearest, any numerical update smaller than half that spacing rounds straight to zero. The threshold is |w| / 256.

In language model post-training, learning rates sit around 1e-6, or even 3e-7. When Adam calculates its per-step parameter update at those learning rates, the magnitude of the delta for almost every individual parameter falls well below |w| / 256.

On Qwen3-1.7B, only 0.4 to 0.5 percent of served weights change value in any single optimizer step. Over 99.5 percent of the weights exported to the rollout engine remain identical to what they were on the previous step. For an individual weight to cross a rounding boundary, the optimizer has to push it in the same direction for 50 to 200 consecutive steps.

If you use Muon, whose per-element updates are almost uniform in magnitude, the problem gets worse. At 1e-6, almost none of the updates clear the rounding threshold. The inference engine is effectively generating rollouts from a frozen model.

### Why monitoring checks never caught it

Teams building RL infrastructure have spent months adding safeguards against training and inference drift. Frameworks implement PPO ratio clipping, Truncated Importance Sampling, and IcePop token masking.

None of those tools flag this mismatch.

The reason is structural. Training frameworks calculate an importance ratio between the trainer log-probabilities and the sampler log-probabilities. In almost every stack, the trainer forward pass runs in bf16 autocast or directly evaluates the exported bf16 weights. Both the numerator and the denominator sit downstream of the round-to-nearest cast.

Because both sides evaluate the same quantized weights, the ratio they monitor stays close to 1.0 throughout training. In the Stanford measurements, the visible ratio maintained an average absolute log difference of roughly 0.01 per token.

The ratio that actually matters for policy gradient convergence is between the fp32 master weights in the optimizer and the served bf16 weights in the inference engine. Frameworks never calculate that ratio. While the visible metric hovered at 0.01, the hidden ratio between optimizer and sampler grew to between 0.10 and 0.45 on reasoning tasks. On 2,000-token responses, the effective sample size between the true policy and the served policy fell to between 0.2 and 0.35.

When researchers observed that rollouts diverged from expectations, earlier studies interpreted the frozen weights as a communication artifact. Several libraries even modified the trainer to match the stale sampler, effectively synchronizing the active model to the delayed copy.

### The checkpoint drift problem

The lag also introduces a silent discrepancy into checkpointing.

When you finish a training run, you save the optimizer master weights in fp32. If you evaluate that saved checkpoint, you are evaluating a set of weights that never generated the training rollouts.

On knights-and-knaves logic tasks and zebra puzzles, the paper found that the saved fp32 checkpoint scored between 12 and 50 points lower than the bf16 model served during the run. If you take that saved fp32 checkpoint and export it to fp16 or FP8 for serving, the new format does not match the model you validated during reinforcement learning.

### Fixing the lag with Fair Cast

The solution proposed in the paper, called Fair Cast, changes two components.

First, replace round-to-nearest export with an unbiased rounding rule. Instead of rounding every sub-threshold delta to zero, use stochastic rounding. If a master weight falls between two adjacent bf16 values, round up with probability proportional to its distance from the lower bound. In expectation, the exported value matches the master weight exactly.

In code, stochastic rounding takes one line: add sixteen uniformly distributed random bits to the fp32 bit pattern and truncate the bottom bits. On a 1.7B parameter model, this export operation adds 22 to 38 milliseconds of overhead per step.

Second, evaluate the training loss on the exact copy served to the inference engine. Differentiating the model that produced the rollouts restores the theoretical foundation of policy gradient updates.

In benchmarks across 25 matched seed pairs on Qwen3 models from 0.6B to 4B parameters, Fair Cast beat round-to-nearest on 18 runs, tied on 6, and trailed on 1. On zebra logic puzzles, where standard round-to-nearest collapsed to an accuracy of 0.33, Fair Cast achieved 0.57. Because stochastic rounding preserves the expected value, the saved fp32 checkpoint matches the behavior of the served model.

### Auditing your export pipeline

If you maintain a post-training pipeline using verl, TRL, OpenRLHF, or custom ray workers, check your weight sync call.

Look at how you export weights from your PyTorch optimizer module to vLLM or SGLang. If your code calls a standard PyTorch cast such as tensor.to(torch.bfloat16), you are running round-to-nearest. At learning rates below 5e-6, your rollout workers are serving weights that lag your optimizer by dozens of steps.

Switching to stochastic rounding at the export barrier takes a few lines and runs in tens of milliseconds per step. If an RLVR run stalls on reasoning benchmarks despite healthy loss metrics, check your export cast before rebuilding your reward model.
