---
title: "LLM agents turn code interpreters into portfolio sizing engines when you evolve the prompt"
description: "KAIST's EvolveTrade shows that frozen LLM trading agents improve Sharpe ratio not by writing new strategies, but by letting policy refinement turn Python outputs into explicit allocation math."
pubDate: 2026-09-17
tags: ["ai", "agents", "python", "systems", "trading"]
---

Most agent benchmarks evaluate tool use as an information-gathering exercise. 

You hand a model an API key for stock prices, a search tool for financial headlines, and a Python REPL. Then you watch whether it makes the right API calls before writing a summary paragraph. In practice, giving an agent access to a code interpreter does surprisingly little if the system prompt treats code execution as descriptive color. The model calculates a 20-day annualized volatility, writes down the number, and then allocates capital using whatever vague qualitative heuristics it had before opening the interpreter.

A new paper from KAIST, EvolveTrade (Kim et al., arXiv:2609.17632), tracks what happens when you stop hardcoding that tool-use contract. 

Instead of freezing the system prompt at deployment, the researchers treat the operational prompt as a text-parameterized policy. After every five trading days, a separate policy agent reviews execution traces and realized portfolio returns, then rewrites the prompt that dictates how the trading agent uses its tools.

### When metrics stay in the scratchpad

The baseline problem in tool-using agents is what the authors document in their static tool-calling traces.

In standard setups like LiveTradeBench, an agent gets prompted to gather evidence: call `get_price`, run Python to calculate Sharpe and return statistics, search news, and emit a rationale. Under GPT-5-mini, the static agent ran Python diligently. It computed that JPMorgan had a 20-day return of +3.45% and a Sharpe of 2.105, while Caterpillar sat at a 1.497 Sharpe and Tesla ran at 70% volatility. 

Yet its final allocations barely budged from an arbitrary baseline: JPMorgan stayed at 6%, Caterpillar at 4%, Walmart at 2%, and Tesla at 2%. 

The quantitative metrics lived entirely inside the reasoning trace. The Python interpreter operated as an expensive proof of work to satisfy prompt constraints, while actual portfolio weights remained uncoupled from the numbers the model just calculated.

### Evolving the operational prompt into deterministic code

When the policy agent was allowed to update the operational prompt based on batch feedback, it did not invent esoteric trading philosophies. It fixed the plumbing between the code interpreter and portfolio weights.

Over multiple market regimes (tested across GPT-5-mini and Gemini-2.5-Flash on post-cutoff windows spanning sideways, drawdown, and bull markets), the evolved prompt systematically moved calculation out of qualitative text and into executable code.

By iteration, the prompt rewritten by the policy agent instructed the model to make code execution allocation-coupled:
1. Python was required to build an auditable metric table across all 15 assets instead of ad-hoc snippets.
2. The agent had to score assets using explicit formulas combining normalized Sharpe ratios, momentum ranks, volatility penalties, and drawdown metrics.
3. Target weights had to be derived through a capped softmax inside Python rather than eyeball guesses in markdown.

In the September 10, 2025 trace highlighted by the authors, the static agent called Python once for aggregate stats. The evolved agent called Python 11 times: running metric calibration, validating risk constraints, and generating exact percentage weights. It increased JPMorgan to 19.54%, Caterpillar to 10.45%, and trimmed high-volatility names before rebalancing. 

That shift produced a 50 basis point outperformance the very next day, driven directly by the four positions where code dictated sizing.

### The policy length contracts

One risk with continuous prompt refinement in production is prompt bloat. If every batch reflection appends edge cases and cautions, the context window fills with contradictory instructions until the model degrades.

EvolveTrade's ablation over a 50-day trading window showed something different. Across independent runs, policy length fluctuated non-monotonically between 5,000 and 20,000 characters. As new market regimes emerged, the policy expanded to incorporate validation checks, then contracted during subsequent update cycles as the policy agent consolidated redundant rules.

In 50-day testing, EvolveTrade maintained a 4.00 Sharpe ratio and 10.56% cumulative return against the static tool-calling agent's 2.94 Sharpe and 8.88% return, while keeping maximum drawdown at 2.96% versus 4.40%.

### Sizing belongs in the deterministic layer

For developers wiring autonomous agents into production workflows, the lesson extends beyond equities. 

If an agent has access to an execution runtime, leaving the mapping between quantitative observations and downstream actions to qualitative LLM prose is fragile. Either your system prompt explicitly forces the model to bind its final actions to deterministic calculations, or the model will treat the tool output as advisory background chatter. 

Self-evolving prompts can find those binding rules through trial and error. Writing them into your initial tool contract by hand saves you the five-day drawdown.
