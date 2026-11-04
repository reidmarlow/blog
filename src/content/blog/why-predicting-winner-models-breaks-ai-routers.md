---
title: "Why Predicting Winner Models Breaks AI Routers"
description: "Most multi-model routers treat dispatch as a winner-take-all classification problem. A study across 25 benchmarks shows why that destroys performance, and how outcome regression fixes it."
pubDate: 2026-11-05T00:30:00+08:00
tags:
  - ai
  - agents
  - architecture
  - engineering
---

If you run an agent workflow in production, you have almost certainly thought about building a model router.

Frontier models cost twenty to fifty times more than compact reasoning models. For three-quarters of your daily tasks, a smaller model running on commodity infrastructure produces an identical result. The obvious architecture is to place a lightweight classifier in front of your gateway: examine the incoming prompt, predict which model will win the task, and dispatch the request to the cheapest candidate capable of solving it.

Almost everyone implements this as a standard classification head. You take historical run logs, mark the model that succeeded with the lowest latency or lowest token cost as the winner, and train a model to output that label.

That setup looks clean on paper, yet these routers regularly degrade in production. They route delicate multi-step tool calls to brittle models that crash, and they fail to beat a simple fallback policy that always calls a single frontier model.

A comprehensive study from researchers at the National University of Singapore, Cardinal AI Lab, UC Berkeley, and HKUST explains why this happens. Their paper, titled "Route Anything: A Study of Model and Policy Routing for General-Purpose AI Systems" (arXiv:2611.05275), evaluates routing across 25 benchmarks, spanning 374,401 scored runs across 452 candidate model configurations.

Their central finding dismantles the standard way engineers build model routers: training a router to predict winners penalizes the very capabilities you want to preserve.

### The winner-label trap

The flaw in standard model routing lies in how training targets are constructed.

In multi-model systems, tasks are rarely exclusive. On a large fraction of typical inputs, several different candidate models can solve the problem correctly. If Model A, Model B, and Model C all succeed, your logging pipeline needs a rule to pick a single winner label for training.

Most pipelines use an operational tie-breaker, such as execution latency or token consumption. If Model A finished in 1.8 seconds while Model B took 4.2 seconds, Model A is labeled the winner.

The router paper ran this comparison on robotic manipulation tasks where multiple control policies operated across thousands of scenes. A latency tie-break decided 94 percent of the training labels. Out of 31,408 successful training runs, 24,556 successful trajectories were turned into negative targets.

By training a classifier to predict a single winner, the router was penalized whenever it predicted a capable policy that took slightly longer to finish. The classifier learned to prioritize fast, aggressive candidates that failed when the scene became difficult. When evaluated on test scenes, the winner-label classifier achieved only 42.8 percent task success.

When the researchers replaced the winner classifier with per-candidate outcome regression, predicting the expected success rate of each candidate independently, task success jumped to 71.6 percent on the identical training scenes and architecture.

When you predict outcomes, a candidate that succeeds reliably remains a positive signal regardless of whether another model solved the task three hundred milliseconds faster.

### The benchmark baseline illusion

Another persistent problem in the model routing literature is the claim that small routing models easily outperform frontier models on general reasoning.

The paper uncovers an evaluation artifact that inflates router gains across published papers. In many benchmark evaluations, a candidate model is admitted to the fixed baseline only if it has a recorded score on every single test input. If a frontier model like Opus missed eleven out of 1,122 evaluation items due to transient network timeouts or provider rate limits, the baseline drops that model entirely and falls back to a weaker candidate.

On an 11-benchmark evaluation suite, this missing-data rule caused the pooled baseline score to drop from 68.30 to 65.52. That drop turned a 0.40 point deficit for the router into an apparent 2.38 point gain.

When the researchers evaluated candidates on matched test inputs, giving every model an identical fallback for missing items, the gap closed. Across 16 general benchmarks spanning text, vision, audio, and code, learned routers beat the single best fixed candidate by 0.3 points (79.98 versus 79.68).

If your goal is to beat the accuracy of the best frontier model on text reasoning, an upstream prompt router will rarely provide a significant edge.

### Where routing actually pays off

The study demonstrates that routing delivers massive returns when applied to cost efficiency and cross-environment adaptation rather than benchmark point-chasing.

Across four production-style testbeds, dynamic routing improved compute and token efficiency by an average factor of 8.82 over calling a reference frontier model. When the router was calibrated to maintain a strict quality floor, it successfully routed straightforward queries to cheap models while reserving expensive models for high-variance inputs.

A second major gain appears when candidate models have complementary physical or environmental strengths. In robotic manipulation tests across clean and randomized environments, the best single policy achieved 70.45 percent success. A scene-aware router directed clean scenes to one policy (PatchWAM) and cluttered, randomized scenes to another (ME-Dex). The combined system reached 71.55 percent success while reducing policy execution time by 24 percent.

The efficiency gain was real because the router was not trying to guess whether one text model understood a pun better than another. It was dispatching tasks based on structural scene conditions where different architectures had distinct operating boundaries.

### The retry fallacy

Many agent frameworks combine routing with fallback retries. If the primary routed model fails to complete an agent step or generate valid JSON, the gateway automatically retries the task using a larger frontier model.

The paper examined 42 ordered model pairs to measure how models perform when called as secondary fallbacks. In every single pair, the secondary model succeeded far less often on retried inputs than its normal baseline score suggested. The median success ratio on retries was 0.49.

When an initial model fails on an input, that failure acts as an informational filter. The remaining tasks are not an average sample from your production distribution; they are the pathological edge cases, ambiguous instructions, and contradictory tool schemas.

If your frontier model has an 80 percent success rate on raw traffic, you should expect it to succeed on less than 40 percent of the requests that failed on your primary model. Designing gateway timeouts and budgets around raw baseline accuracy guarantees cascading latency spikes.

### Practical rules for gateway routing

If you are building an AI gateway or an agent dispatcher, the data from the Route Anything study suggests four engineering adjustments:

First, stop training winner classifiers. Train per-model regressors that estimate the probability of success or expected task score for each candidate independently. Select the cheapest candidate whose expected score meets your application threshold.

Second, test routing logic against a strictly matched baseline. Run both your router and your candidate models on the exact same set of historical requests, with identical handling for missing items. If a router paper does not guarantee matched test sets, assume the headline gain is an artifact of dropped baseline candidates.

Third, route for cost reduction and domain handoffs, not for frontier text accuracy. Use routing to offload high-volume boilerplate tasks to compact models, or to switch between specialized policies like document parsers and code interpreters. Expecting a small classifier to consistently pick a smarter text model than GPT-4 or Claude on open-ended reasoning is a losing bet.

Fourth, discount your retry assumptions by half. When sizing execution budgets for secondary fallbacks, calculate costs assuming the fallback model will fail twice as often as its public benchmark suggests.

That keeps the gateway fast, prevents brittle candidate loops, and protects the token budget when things go sideways.
