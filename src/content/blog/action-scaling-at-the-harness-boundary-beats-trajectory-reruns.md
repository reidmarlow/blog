---
title: "Action Scaling at the Harness Boundary Beats Trajectory Re-Runs"
description: "Why terminal agents fail from corrupted shell state rather than bad reasoning, and how sampling candidate bash actions before execution cuts test-time compute by 5.8x."
pubDate: 2026-10-02T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - linux
---

If you run terminal agents on real tasks, you know the exact point where a run dies. It is rarely a failure of high-level reasoning. The agent knows it needs a yaml parser. It understands the project structure. Then, on turn two, it emits `pip install yaml` instead of `pip install pyyaml`.

The bash shell executes the command, pip complains that no matching distribution exists, and the agent enters damage control. It tries apt-get, writes a broken workaround in a temp file, clobbers an existing virtualenv, and spends the next fifteen turns debugging errors it introduced itself. By turn twenty, the environment is so contaminated that no amount of reasoning can save the trajectory.

The standard industry fix for this problem is trajectory scaling. You treat the agent as a black box and run Best-of-N across entire sessions. If one agent trajectory crashes into a wall on turn two, you throw away the container, spin up six more, and run six parallel thirty-turn sessions from scratch.

A new paper from researchers at NVIDIA and KAIST, titled "Mid-Harness: Scaling Actions Between Model and Harness for Terminal Agents" (arXiv:2609.39982), proves that brute-forcing entire trajectories from scratch is an expensive misallocation of compute. By shifting test-time compute from whole-trajectory replays to the model-harness boundary, the authors demonstrate that you can catch compounding errors before a bad command ever touches the shell.

### The generator already knows the answer

The central finding in Mid-Harness is that modern code models already generate the correct bash command, even when their greedy output is wrong.

Using a 9B parameter model (TMAX-9B) on TerminalBench-Lite, the authors measured a base Pass@1 rate of 50.00 percent under standard execution. When they sampled eight candidate actions at each turn and used a stronger model (GPT-5.6 Sol) purely as a verifier to pick among those eight candidates, Pass@1 climbed from 50.00 percent to 68.03 percent.

The 9B generator was never modified or fine-tuned. The terminal harness was left unchanged. The 18-point jump came entirely from filtering the generator's own candidate pool before executing an action. In other words, small models do not lack the capability to produce valid terminal operations; they lack the precision to rank the correct command as their top choice across multi-turn trajectories.

Once a bad command runs in a terminal, state changes are often irreversible. A corrupted lockfile, a killed background daemon, or a half-migrated database schema cannot be easily undone by prompting. Trajectory scaling tries to solve this by paying for thirty turns of inference five or seven times over. Action scaling prevents the dirty state from entering the system in the first place.

### How candidate verification actually works

Mid-Harness inserts a verification step between the policy model and the execution harness. At each step, the policy draws N candidate actions from the current history. The verifier inspects the candidates, picks a winner, and passes only that single command to the environment. The remaining candidates are discarded.

The authors evaluated three ways to select the winning command from N candidates:

Listwise verification puts all eight candidates into a single prompt and asks the model to pick the best letter. On TerminalBench-Lite with zero-shot TMAX-9B, this barely moved the needle, reaching 51.02 percent Pass@1 (a 1.02 point gain). Language models struggle to compare multiple technical bash commands simultaneously when presented as a single list.

Pointwise verification scores each command independently on a scale of zero to ten across eight separate inference calls. This reached 52.38 percent Pass@1, showing modest improvements but lacking direct comparative signal between close alternatives.

Pairwise verification produced the largest gain. Running full round-robin tournaments across eight candidates requires twenty-eight pairwise duels, which is too slow. Instead, the authors use a ring-duel scheme. Eight candidates compete in ring matches to establish four pivots, and those four pivots face the remaining candidates in sixteen duels. This scheme cuts tournament overhead to twenty-two calls while delivering 54.76 percent Pass@1 with the base model, and 57.14 percent after distilling preference judgements from GPT-5.6 Sol into the 9B model.

### Single-token verification beats chain-of-thought

The most surprising ablation in the paper challenges a widespread assumption about test-time compute. Many developers assume that an agent verifier must write out a detailed chain-of-thought rationale before picking an action.

The authors tested two versions of their distilled 9B verifier. The first version wrote a 42-token rationale explaining why action B was preferable to action A before emitting its choice. The second version emitted a single token, predicting the logit probability of A versus B directly, with zero reasoning text.

The single-token verifier scored 59.18 percent Pass@1, outperforming the reasoning verifier's 57.14 percent while reducing end-to-end token costs by 24.1 percent.

When a small model writes out a natural language critique of two bash commands, it frequently hallucinates hypothetical environment states that do not match the real terminal. It invents reasons why a command might fail, talks itself out of clean one-liners, and introduces noise into its own decision loop. Direct classification logits bypass that narrative drift entirely.

### Compute economics at the boundary

Shifting compute to the action boundary dramatically alters the cost structure of running terminal agents.

On TerminalBench-Lite, Mid-Harness with N=8 distilled pairwise verification matched the performance of Best-of-7 trajectory scaling (59.18 percent Pass@1). The cost difference is stark: Mid-Harness required $0.16 in estimated token cost per run at standard 9B rates, compared to $0.91 for Best-of-7. That is a 5.8x reduction in inference spend for identical benchmark success.

Action scaling also stacks cleanly with trajectory scaling. Pairing Mid-Harness with Best-of-3 trajectories achieved 65.31 percent Pass@1 at $0.61 per run. By comparison, running Best-of-7 on the unverified base agent reached only 59.18 percent while burning $0.91. You get higher task reliability while spending 33 percent less compute.

### What verifiers still get wrong

Action verification is not a solved problem. The authors analyzed 1,810 instances where their distilled verifier disagreed with the teacher and caused a task failure.

Two failure modes accounted for 67.4 percent of all verifier errors:

Candidate semantics caused 39.0 percent of failures. The verifier misjudged what a piece of code or command string actually did. In one example, the verifier flagged `token[4] = 'a' + s1` as a bug, claiming it had to be written as `s1 + 'a'`, even though both expressions evaluate to the same character in that environment.

Execution feasibility caused 28.4 percent of failures. The verifier rewarded commands that looked logically complete on paper but could not run safely in the host container. In a process cleanup task, an agent wrote a script to find and kill processes on port 9090. The verifier praised the script for thoroughness, failing to notice that the process termination loop would kill the agent's own python runner before it finished executing.

Evaluating whether a shell command is safe to execute requires understanding subtle operating system side effects. Until verifiers learn to model process trees and container state, feasibility checks will remain a fragile point in action-level scaling.

Even with those limitations, the practical lesson for agent builders is obvious. Before spending money on parallel container runs and multi-trajectory voting, inspect what your agent emits on turn two. Sampling three or four candidate commands and filtering out broken arguments at the harness boundary saves far more runs than spinning up another container after the shell is already broken.
