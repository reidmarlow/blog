---
title: "Agents Score 97% on Static Tool Judgments and Still Break Interactive Workflows"
description: "Across 656 SafeActBench cases, models pass static allow/block checks above 94% then fail half their interactive runs by acting before checking prerequisites or ignoring their own useless-tool judgments."
pubDate: 2026-10-08T00:35:00+08:00
tags:
  - ai
  - agents
  - automation
  - evaluation
---

If you ask an LLM in a static prompt whether it should refund a customer's duplicate charge before checking the payment status, almost every frontier model passes the test. It outputs a clean refusal or defers the call until the record is verified.

Then you put the exact same model inside an interactive tool loop and watch it fire the refund call anyway.

Two papers from the October 7, 2026 arXiv batch isolate how this failure happens. Both teams separate what an agent knows from what it executes, and both land on the same engineering fix. Prompt rules and static policy evals barely dent the failure rate. State transitions have to be enforced in the harness.

### Static judgment vs. interactive execution

In *From Evidence to Action: How Tool-Using Agents Fail* (arXiv:2610.07753, `safeact.github.io`), researchers from Princeton, NUS, HKBU, and AWS built SafeActBench to test whether state-changing tool calls are actually backed by evidence gathered earlier in the run.

Most agent benchmarks check the final environment state. If an agent is asked to refund duplicate charge `C2` and notify the user, endpoint grading only checks whether `C2` ended up refunded. SafeActBench instead tracks a provenance-bound Evidence Ledger across 656 cases in six operational domains, covering customer operations, engineering infrastructure, legal and financial workflows, research assistance, smart-home control, and healthcare.

If the agent queries charge `C1`, sees `$49.99`, and immediately refunds `C2` for `$49.99`, endpoint grading calls that a win when the amounts happen to match. The Evidence Ledger flags it as an unsupported action because the prerequisite state was never bound to `C2`.

The authors tested ten model-harness pairs across five model families: Claude Opus 5 (with Claude Code and Inspect AI), GPT-5.6 Sol (with Codex and Inspect), DeepSeek-V4-Flash (with DSH and Inspect), Qwen3.8-Flash (with Qwen Code and Inspect), and GLM-5.2 (with ZCode and Inspect). Each configuration ran across five protocols:

1. **Legacy (86 cases)** covers static allow/block/defer judgment on a candidate action.
2. **V0 (175 cases)** covers investigated non-action, where the agent must complete the investigation to prove why it should withhold the mutating call.
3. **V1 (131 cases)** covers single-action execution after establishing prerequisites.
4. **V2 (132 cases)** covers linear multi-action chains where later calls consume earlier action receipts.
5. **V3 (132 cases)** covers dependency-constrained DAG workflows.

On the static Legacy protocol, nine of the ten configurations scored between 91.9% and 97.7%. Even GLM-5.2 paired with ZCode hit 97.7% on static judgment.

Once the models had to gather evidence interactively, exact case success dropped across the board. The top overall configuration, Claude Opus 5 running in Claude Code, finished at 67.2% exact case success (60.3% on V1 single actions and 65.9% on V3 DAGs). GPT-5.6 with Codex hit 65.4%, Qwen3.8 with Qwen Code hit 66.0%, and DeepSeek-V4 with DSH hit 63.0%. GLM-5.2 with ZCode collapsed from 97.7% static accuracy to 32.1% on V1 and 12.1% on V2 linear chains.

When the authors held case identity fixed on V1 tasks, configurations that scored at least 95% on static evaluation maxed out at 52% in interactive runs.

### Where the trajectory breaks

The diagnostic breakdown in Table 3 of the SafeActBench paper shows why the scores drop.

Once an agent actually finishes gathering all required evidence on V1 tasks, its Conditional Action Success (CAS) sits between 93.2% and 100% for nine of the ten configurations (Claude Opus 5 and DeepSeek-V4-DSH both hit 100.0%). Calling the tool with the right arguments is already solved.

The failures happen upstream, before the tool call should fire:

- **Premature Action Rate (PAR)** measures how often an agent fires the mutating tool on V1 before completing the required checks. PAR ranged from 37.0% (Qwen3.8-Inspect) and 38.8% (Claude Opus 5-Claude Code) up to 45.8% (GPT-5.6-Codex) and 66.9% (GLM-5.2-ZCode).
- **Before-Stop Rate (BSR)** measures how often an agent stops investigating too early on V0 non-action tasks, abandoning the check before proving why the action is unsafe. BSR ranged from 21.7% to 62.9%.

Even more uncomfortable is what happened when the authors ran controlled interventions on 43 V1 cases by withholding a decisive record from the tool outputs. Removing the required record reduced action probability by 37.2 to 45.2 percentage points, yet DeepSeek-V4, GLM-5.2, and Qwen3.8 still went ahead and executed the state-changing action in 46.5% to 53.5% of completed runs. Out of 66 withheld-evidence runs where the agent fired the mutating tool anyway, 65 included a call to the affected query tool first. The models queried the database, got back an empty or missing record, and pulled the trigger anyway.

Adding an explicit system warning that missing evidence does not imply safety had a confidence interval that included zero for all three models. Adding a conflicting claim from the user ("I already checked that record and it's fine") cut action rates down to 6/43 for DeepSeek and Qwen. The models reacted strongly to social pushback in the prompt while shrugging at missing database rows.

### Judged useless, queried anyway

A companion paper from NTU, NUS, A*STAR, UNC-Chapel Hill, and CMU, *Judged Useless, Queried Anyway* (arXiv:2610.06191, `bennidict23/judged-useless-queried-anyway`), looks at the other side of the loop: what agents do when an information tool keeps failing silently.

Chubin Zhang and colleagues tested seven agents (Qwen2.5-7B, Llama-3.1-8B, Qwen3-8B, Qwen3-32B, Claude Haiku 4.5, Claude Sonnet 5, and the RL-trained Search-R1) on HotpotQA and FEVER retrieval tasks where the search source was controlled to return irrelevant paragraphs.

At every step, the authors recorded the model's judgment of the latest tool result (via a side channel and by reading the model's own chain-of-thought reasoning). Across all tested models, the agents recognized that a failing source's results were useless 97% to 100% of the time.

They kept querying the broken tool anyway.

After judging five consecutive search results useless in their own reasoning, five of the seven unaided agents stopped and answered on at most 7% of questions (Qwen3-8B stopped on 1 out of 292 questions; Claude Haiku 4.5 answered 1 out of 284). The rest burned every remaining call until the step budget expired. When the harness forced Claude Haiku 4.5 to stop and answer from memory after five useless results, it got 114 of those 284 questions right.

The authors tested every prompt-level fix engineers usually try first:

- **Permission to answer from memory** made Qwen3-8B bail out early on 55% of questions even when the search tool was about to recover.
- **Showing a step budget and counter** made 7B-8B models wait until the exact final step to answer (51% to 79% of answers landed on the deadline). When the authors doubled the budget from 8 steps to 16, the models shifted their answers to step 16 and burned 61% to 71% more tool calls for zero accuracy gain.
- **Writing the stopping rule or a per-call price (0.05 per call) into the prompt** only partly moved Llama-3.1-8B and Qwen3-32B, while Claude Haiku 4.5 started answering prematurely regardless of evidence.
- **Injecting the running count of useless results directly into the context window** at every turn (`decide` condition) still failed to make the models stop on the count. Their time-matched stopping contrast $\Delta$ stayed negative (-0.14 to -0.24).
- **Enabling reasoning mode** (`thinking` on Qwen3-32B) caused the model to answer from memory on 97% of failing-source questions, bailing out before real evidence arrived 47% of the time on recovering sources.
- **RL search training** (Search-R1, trained with PPO on HotpotQA) still exhausted its full budget on 45% of failing-source runs.

### Enforcing the gate in the runner

Both papers point to the same architectural boundary. Prompt instructions tell a model how to talk about evidence, while the runner controls which tool calls can actually fire.

In Zhang et al.'s retrieval study, when the harness enforced a sequential run-length rule (stripping the search tool and leaving only `finish` after $k=5$ consecutive results the model itself judged useless), time-matched stopping contrast $\Delta$ jumped to between +0.33 and +0.40, overall mean6 accuracy rose across every open model and Claude Haiku 4.5 (+2.6 to +9.7 points), and doubling the step budget no longer inflated tool calls. The harness did not even need an extra LLM judge call to score tool outputs. A lightweight keyword reader that parsed the agent's own reasoning thought for "irrelevant" or "useless" matched the side-channel rule within 0.01 accuracy.

In SafeActBench, swapping the harness while holding the model and task set fixed shifted exact case success by up to 6.8 percentage points (DeepSeek-V4 gained +4.4 points under DSH over Inspect; Claude Opus 5 gained +4.2 points under Claude Code over Inspect). Even on identical cases, two harnesses wrapping Qwen3.8 disagreed on the outcome 23.5% of the time (134 out of 570 cases).

When I wire up tool-using agents for my own workflows, I used to spend hours tuning system prompts to say "verify the target ID before mutating state" or "stop querying if three searches return empty." Both papers explain why those prompt clauses decay in production. A model can write "the search returned no matching records for `C2`" in its thought block and still emit the `refund(C2)` tool call or fire a sixth identical query in the very next token block.

Two harness patterns hold up against these findings:

1. **Precondition state gates on mutating tools.** Keep read tools open, but wrap write/delete/refund tools in a deterministic precondition check inside the runner. If `refund_charge(charge_id)` requires a prior `get_charge(charge_id)` receipt in the session state ledger with `status == "duplicate"`, let the harness reject the tool call before it hits the API.
2. **Run-length circuit breakers parsed from agent traces.** Track consecutive empty or low-overlap tool responses in the loop controller (or regex-match the model's own "no useful result" notes in its reasoning trace). When the run hits $k$ failures, mask that tool out of the schema for the next turn instead of asking the model in the system prompt to stop calling it.
