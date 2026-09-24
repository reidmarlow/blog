---
title: "World Models for Agents Should Edit Transcripts, Not Simulate Terminals"
description: "Why predicting bash outputs and search responses misses the point in long-horizon LLM agents, and how transcript editing beats append-only loops."
pubDate: 2026-09-25T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - research
---

Most discussion around world models for language agents imports assumptions directly from robotics. In physical systems, you simulate the environment because running a blind trial on real hardware can break an actuator or shatter glass. Simulating next-state observations before acting is the only safe option.

Over the past year, researchers ported that exact framing to coding and terminal agents. Several language world model projects try to predict what bash will print, what pytest will report, or what a search engine will return.

A new paper from Renmin University and the DeepSeek ecosystem, titled "Agent-Editing World Model: Rethinking World Modeling for LLM Agents" (arXiv:2609.28416), points out why that approach falls flat for software tasks. Simulating tool responses is high-entropy, fragile work. A local shell command takes ten milliseconds and returns exact reality. Hallucinating the stdout of a compiler or a search index when you have an actual kernel running right next to your process wastes cycles and introduces fake evidence.

The real failure mode in long-horizon agent runs is something different: task-state contamination.

### The append-only trap

Anyone who builds autonomous coding loops has watched this failure unfold. On turn four, an agent runs a grep command with the wrong flag or invents an imaginary configuration path. The command fails, or worse, returns an empty string. The agent concludes that the file does not exist, writes a speculative replacement in a temporary directory, and proceeds to build five helper functions around that faulty premise.

By turn twelve, the original task is buried. The agent spends its remaining context budget patching the side effects of its own early mistake.

Standard agent architectures run on append-only loops like ReAct. Every user instruction, reasoning trace, tool invocation, and tool output gets added to the history buffer in strict chronological order. When developers notice an agent getting stuck, the common reflex is to append another layer: a critic prompt, a self-reflection turn, or an evaluator model telling the agent it went off track.

Appending a critique to a contaminated transcript does not clean up the contamination. It leaves seventy lines of broken assumptions sitting right in the attention window, then asks the model to ignore them while reading them. Models struggle with negative constraints under long contexts. The hallucinated paths remain salient, and subsequent decisions stay anchored to earlier bad choices.

### What the Agent-Editing World Model does

The authors (Shuang Sun, Guoxin Chen, Fanzhe Meng, and colleagues) reframe what a world model should track. Instead of predicting environment observations, their Agent-Editing World Model (AEWM) models task progress and cleans the agent's internal state.

The system splits the job into two components:

1. Action Judge. Before executing an action, the judge evaluates the proposed reasoning and action pair against the task history. It classifies the step into one of three buckets: Critical, Exploratory, or Noisy. Critical steps directly advance the task. Exploratory steps gather information without committing to state changes. Noisy steps are degraded continuations caused by invalid assumptions or misread outputs.
2. State Revision. When a proposed continuation is flagged as noisy, the revision module intervenes. It does not just append a warning message to the chat log. It replaces the contaminated reasoning and action segment directly in the interaction state, substituting a clean alternative derived from verified history.

They package this loop into an inference framework called EditAct, tested across three core operational domains: Search, Terminal (using CalibForge), and Software Engineering (using DeNovoSWE).

The domain distributions they observed in their corpora illustrate how agent errors cluster. In search tasks, noisy decisions accounted for 60.0% of failures, mostly unverified hypotheses narrowing retrieval prematurely. In terminal workflows, exploratory actions made up 43.2% while noisy actions reached 25.1%, typically from misreading command output or mistaking partial progress for a verified fix. In software engineering, critical actions took 42.1% and noisy actions 28.0%, dominated by flawed dependency assumptions.

### The benchmark numbers

Across six benchmarks, EditAct improved task completion rates over standard ReAct and Best-of-3 baselines:

- Qwen3.5-4B gained 6.7 points on average.
- Qwen3.5-9B gained 5.2 points on average.
- Qwen3.5-35B-A3B gained 3.2 points on average.

The practical comparison sits between model tiers. Qwen3.5-9B paired with EditAct scored 44.1 on the benchmark suite, surpassing Qwen3.5-35B-A3B running standard ReAct, which scored 42.2. Cleaning the transcript yielded better downstream execution than quadrupling the parameter count of an unmanaged loop.

The authors also took the verified trajectories generated by EditAct and used them for rejection sampling fine-tuning (AEWM-RFT). Fine-tuning the base agent on these sanitized histories lifted baseline performance by 2.2 to 2.6 points across all three domains, without needing the online AEWM module running during evaluation.

### What this means for harness design

We built our current agent tooling around the conventions of conversational chat apps. Chat threads are append-only logs. You send a message, the model replies, the tool returns a payload, and everything gets stacked on top of what came before.

Software engineering workflows do not operate that way. When I write code in a terminal, I do not keep every syntax error and failed shell experiment in my active working buffer. I hit undo, run git rebase, drop broken commits, and keep the active state focused on what worked.

If you run agents on long tasks, treating the prompt transcript as an immutable history is a design flaw. You do not need a world model that hallucinates what python prints to stderr. You need a harness that notices when an exploratory branch failed, prunes the dead reasoning out of the context window, and lets the agent continue from clean state.
