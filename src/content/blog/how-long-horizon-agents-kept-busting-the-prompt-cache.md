---
title: "How Long-Horizon Agents Kept Busting the Prompt Cache"
description: "OpenAI cut GPT-6 Sol and Luna prices by half, but the real fix for runaway agent token bills is the prompt caching overhaul."
pubDate: 2026-09-24T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - openai
---

OpenAI launched GPT-6 Sol and Luna yesterday, cutting API prices by 50% compared to GPT-5.6. Sol now sits at $2 per million input tokens and $10 for output, while Luna drops to $0.10 and $0.50. Most feeds spent yesterday debating the benchmark cards against Claude Opus 5 on AutomationBench and DeepSWE.

The more telling metric was buried in OpenAI's research acceleration report. At internal API rates, daily token burn exceeded $600 for their median researcher and $7,000 for the top ten percent.

When you run autonomous coding loops, token costs compound because agent harnesses carry heavy context across dozens of iterations. System contracts, tool schemas, repository maps, and execution logs accumulate. Prompt caching offers a 90% discount on reused input tokens, but production harnesses routinely break that cache on turn three.

Three harness habits cause most of those cache misses:

1. Changing tool schemas. When an agent enters a specialized phase, many frameworks prune the tool array to prevent tool hallucinations. Modifying the tool definitions array changes the prompt prefix, which forces a full re-computation of every token that follows.
2. Dialing reasoning effort. A planner turn might need maximum reasoning effort, while a command runner only needs minimal effort. In older API revisions, changing request-level reasoning parameters modified the inference state and invalidated cached prefix tokens.
3. Inserting dynamic instructions mid-context. Appending progress checkpoints or changing operational constraints near the top of the context window shifts the token stream, discarding any existing cache blocks downstream.

The GPT-6 caching update introduces four API controls aimed directly at persistent harnesses:

The first change is `configuration_update`. Instead of altering the top-level request parameters to switch reasoning effort, an agent harness can append a configuration update block to the context. This adjusts reasoning depth for the next turn while preserving the cached prefix behind it.

The second change is `allowed_tools`. Rather than rewriting tool lists between turns, harnesses can declare their entire tool registry once in the system prompt. Passing `allowed_tools` or setting `tool_choice` to none restricts callable tools on that specific step without altering the static schema definitions in the prompt prefix.

The third change is explicit breakpoints. Harness authors can mark the exact boundary where static context ends and volatile scratchpad data begins. Everything above the breakpoint stays eligible for 30-minute caching discounts even when lower context blocks shift.

The fourth change is cache prewarming. Harnesses can push shared environment definitions, codebase indexes, and system instructions to the cache during startup before receiving user input. That moves token processing out of interactive user wait time.

According to GitHub, applying these prefix preservation controls reduced fresh prompt token processing by more than half across Copilot requests.

If you maintain an agent harness, keeping prefixes stable matters as much as model choice. Place your static instructions and full tool registry at the front, keep schemas immutable, toggle permissions with `allowed_tools`, and append configuration changes rather than modifying top-level headers.
