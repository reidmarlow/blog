---
title: "The Wall Clock Problem in Embodied Benchmarks"
description: "SenseNova tested GPT-6-Astra across 12 robotics benchmarks and found the gap between simulated success and deployment isn't spatial comprehension. It's the cost of deliberation while the physics engine keeps ticking."
pubDate: 2026-10-19
tags: ["robotics", "ai", "benchmarks", "agents", "infrastructure"]
---

SenseNova posted an evaluation of GPT-6-Astra across 12 robotics benchmarks covering tabletop arms, quadrupeds, mobile bases, and dexterous hands (arXiv:2610.22471).

The headline numbers look strong. When given in-context demonstrations and allowed to expand its execution steps, the model solves multi-stage manipulation tasks that used to require dedicated per-task policies.

The useful part of the report is the failure profile on physical hardware. The authors deployed the model on eight physical robot setups, paired with low-level motor controllers like π0.5. The system broke down in two places: in-context demonstrations for custom robot hardware are expensive to collect, and physical environments don't wait for inference tokens to finish streaming.

In simulation, benchmarks pause time while the high-level planner thinks. If a reasoning model takes three seconds to output a spatial trajectory, the simulated arm sits motionless in empty space. In a physical shop or kitchen, momentum and external objects continue moving. If an object slips or an obstacle drifts across the workspace during that three-second pause, the resulting action executes against a state that expired two seconds ago.

The authors propose a simple shift for the next generation of benchmarks: evaluate agents against an unpaused world clock, with zero in-domain demonstrations.

That matches what anyone running autonomous agents locally runs into within an hour. The failure mode in production is rarely that the model lacked the raw spatial logic to compute a grasp vector. The failure is that deliberate System 2 planning costs round-trip latency, and low-level controllers have to buffer stale coordinates while waiting for confirmation.

Bridging that gap won't come from feeding larger trajectory context windows into a high-level API. It requires treating inference latency as a physical constraint inside the control loop.
