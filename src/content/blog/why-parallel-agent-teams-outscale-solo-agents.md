---
title: "Why Parallel Agent Teams Outscale Solo Best-of-N"
description: "Inference compute scaling for coding agents usually forces a choice between massive swarms and hundreds of solo rollouts. A new benchmark from Duke, Modal Labs, Princeton, and NYU proves why sampling small parallel teams beats both."
pubDate: 2026-11-10T00:30:00+08:00
tags:
  - agents
  - architecture
  - inference
  - engineering
---

When developers spend test-time compute on coding agents, the architecture usually swings between two extremes. The first option is best-of-N sampling over independent workers: fire off one hundred parallel agent runs with separate seeds, evaluate their patches against a test runner, and keep the cleanest pass. The second option is multi-agent collaboration: spin up a swarm of specialized roles, put them in a shared channel, and let them debate their way toward a single solution.

Both architectures run into hard statistical ceilings on long-horizon tasks.

A new paper from researchers at Duke University, Modal Labs, Princeton University, and New York University (Wang et al., "Test-Time Compute Scales Better with Parallel Agent Teams") isolates the structural flaws in both approaches. Across twelve long-horizon tasks ranging from GPU kernel optimization to formal math proofs, the authors demonstrated that spending an inference budget on parallel teams of ten agents systematically outperformed both one hundred independent solo agents and one massive one-hundred-agent committee.

Even more interesting for self-hosters: at equal dollar spend, parallel teams running an open-weight 27B model beat frontier models like GPT-5.6-sol on half of the benchmark tasks.

### The dual failure modes of test-time scaling

The performance gap traces back to the order statistics of candidate generation.

When you have a deterministic verifier, such as a compiler, an exploit test harness, or a Lean proof checker, test-time compute can be modeled by order statistics. The expected maximum score of $N$ independent samples drawn from a distribution with mean $\mu$ and variance $\sigma^2$ follows the approximate relation:

$$\mathbb{E}[\max_{1 \le i \le N} X_i] \approx \mu + \sigma \sqrt{2 \ln N}$$

The equation breaks the expected outcome into two terms: the base quality of each sample ($\mu$), and the statistical gain from variance ($\sigma \sqrt{2 \ln N}$).

Independent best-of-N sampling optimizes entirely for the second term. By setting $N = 100$ solo agents, you maximize sample count. But on hard tasks, such as writing a SwinMLP Triton kernel or proving a formal mathematical theorem, a solo agent working alone in a single context window has a low base success rate. Its sample mean $\mu$ stays near zero. Because the variance term scales only logarithmically with $N$, diminishing returns arrive fast. In the paper's experiments, fifty solo agents had already extracted between 81% and 100% of the total score improvement that one hundred solo agents could produce. After fifty samples, adding more solo agents burned tokens without finding better answers.

The single massive team makes the opposite mistake. Putting one hundred agents into a single collaborative harness optimizes solely for sample quality ($\mu$). In theory, agents can divide labor, review each other's code, and catch syntax hallucinations. In practice, setting $N = 1$ throws away the variance term entirely. A single team has zero variance gain.

Large agent groups also suffer from conversational groupthink. As context windows fill with shared status updates, error logs, and peer messages, agents converge early on a single design path. If that initial technical assumption is flawed, ninety-nine other agents waste their turns defending or patching the same broken foundation. Across the four benchmark tasks where the researchers scaled a single team to one hundred agents, the giant team scored between 8% and 30% lower than ten separate teams of ten agents.

### The parallel team architecture

The solution is straightforward: treat a team, rather than an individual agent, as the fundamental unit of a sample.

If your compute budget buys $B$ agent runs, you partition the spend into $N = B / k$ independent teams of size $k$. For a budget of one hundred agents, setting $k = 10$ yields ten independent teams of ten agents each.

Inside each team of ten, the structure is deliberately flat. Each agent runs in its own isolated execution sandbox with private tool access, but shares an append-only forum or memory log with its nine peers. Any agent can read past progress notes and post new findings. There are no specialized managers, no top-down routing hierarchies, and no rigid phase gates. The score for the entire team is simply the highest verifier score achieved by any of its ten members.

The design balances sample quality and variance. Ten agents cooperating through a shared forum catch local bugs, share profiling measurements, and avoid repeating dead-end attempts, lifting the base mean $\mu$ above what a solo agent achieves. At the same time, running ten distinct teams with separate random seeds and isolated communication forums keeps architectural hypotheses from leaking across team boundaries. Ten teams provide enough independent samples to stay on the steep, profitable early slope of the $\sqrt{2 \ln N}$ curve.

Across twelve benchmark domains, parallel teams of ten scored 10% higher than solo agents at a budget of ten agents, and 27% higher at a budget of one hundred agents. On ten out of the twelve tasks, parallel teams soundly defeated solo best-of-N.

### Dollar parity against frontier models

The most practical takeaway from the Modal and Duke paper is how parallel teams shift the economics of open-weight models.

Frontier models carry high per-token API pricing. If you have a fixed budget for an evaluation run, you can either buy a handful of calls to an expensive reasoning model or run hundreds of calls against an open-weight model like Qwen3.8-27B on local or cloud GPUs.

When evaluated at equal dollar cost, ten parallel teams of ten Qwen3.8-27B agents beat GPT-5.6-sol on four out of eight long-horizon tasks. On complex tasks with automated verifiers, exploring multiple small collaborative trajectories with an open model produced better code and faster kernels than letting a single closed model deliberate in isolation.

### Practical implications for harness design

If you build agent pipelines for code generation, vulnerability discovery, or continuous integration sweeps, the design lesson is clear:

- Stop building fifty-agent single-session swarms. Massive multi-agent loops create communication bottlenecks, blow up token budgets on coordination overhead, and collapse trajectory diversity.
- Stop relying on brute-force solo best-of-N for complex tasks. Once tasks require multi-step reasoning and multiple tool interactions, solo agents get trapped in early errors.
- Group agents into small pods of five to ten workers. Give each pod a shared blackboard or log for test outputs and compiler diagnostics, but keep the execution sandbox isolated.
- Run multiple pods in parallel. Score their candidate solutions using an automated test harness, and pick the best result.

Effective test-time compute comes from small, coordinated pods competing across parallel, independent attempts.
