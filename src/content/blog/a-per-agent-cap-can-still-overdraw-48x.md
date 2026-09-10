---
title: "A Per-Agent Cap Can Still Overdraw 48×"
description: "MPI-SWS simulates a 50-agent procurement fleet. Every local gate stays green. Aggregate exposure hits 2.4× the tenant limit, and 48× at a thousand agents."
pubDate: 2026-09-11T01:00:00+08:00
tags:
  - ai
  - agents
  - safety
  - devtools
---

Bardia Mohammadi and Laurent Bindschaedler at MPI-SWS posted arXiv 2609.00275 on 31 August 2026, for the Agentic OS workshop at SOSP. It is a controlled study, not a production runtime. The number that stuck is the composition failure.

They simulate fifty procurement agents. Each one may place a supplier order up to $50k under a per-agent rate limit. The tenant will tolerate $250k of unhedged exposure in a trading day. On a quiet day that envelope holds. Then a shared price-spike alert makes "buy now" the rational move for every agent at once.

Every purchase clears its local cap. In 300 seeded runs, those local gates still overdrew the tenant limit in every run, at 2.4× on average. Grow the fleet to a thousand agents and keep the same $250k envelope, and the overdraw reaches 48×. The budgeted ledger, which charges residual loss before commit and denies the marginal effect, stayed inside the limit at every size.

I keep seeing the same shape in smaller form. Five coding agents, each allowed to open a PR, merge on green, or bump a dependency. Each one is in policy. They all wake up on the same CVE email. You wanted five reviews. You got five merges.

Counting calls does not help. A canceled draft, a completed order, and a signed contract do not leave the same residual loss after refunds. A control that treats every tool call as one unit is either unsafe on the irreversible ones or so conservative that ordinary work dies.

A reactive circuit breaker is also late. In the paper, a breaker that trips once observed loss hits the limit still ends at 1.03× with instant observation, and 2.2× if the observation lags fifty ticks. The irreversible effect already committed. Reservation has to happen before the tool returns.

They also split one $1.5M transfer into many sub-cap orders. Local gates let the full amount through, 3.9× the tolerance. The ledger charged exposure rather than call count and admitted $459k of that value.

Typing the effect by residual loss is what buys useful work. When charges were honest, the typed ledger executed 1.8× the value of a face-value cap. When colluding agents labeled transfers as refundable, the cap reopened to $1.0M and overdrew in 77% of runs. When a shared trigger dropped recovery from 0.75 to 0.25, additive per-effect charging overdrew in 59% of runs while the ledger still believed itself safe. Charges have to sit below the model. The agent does not get to name the type.

This is not only a money example. The authors looked at 38,452 public trajectories from τ-bench and AgentDojo. External effects were 22% of tool calls. A single planted instruction in a shared resource produced the same external effect across 84% of a heterogeneous fleet on average, never below 48%. Shared context is the common case.

I would steal the accounting before waiting for an agent OS. Keep a running balance on irreversible tool classes (deploy, delete, pay, email, merge) that every agent in the tenant spends against. Read the type from the tool wrapper, never from the model. If the next call would overdraw, deny it at the wrapper and log the denial as a first-class event, not a model apology.

The paper leaves the hard hole open. Conservative, dependency-aware pricing is still unsolved. Misdeclared types and correlated recoveries can still beat a ledger that believed the charge. The simulator and seeds are on GitHub at mpi-dsg/irreversibility-budget. If you already run more than one agent against the same production surface, keep the 2.4× figure next to the allowlist.
