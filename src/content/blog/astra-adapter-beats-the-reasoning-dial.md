---
title: "Astra's Adapter Beat the Reasoning Dial on ARC-AGI-3"
description: "On 3 Sep ARC Prize scored GPT-6 Astra at 62.7% in the shared harness and 99.9% in OpenAI's adapter. Reasoning none in the adapter still beat max effort in the shared test."
pubDate: 2026-09-11T02:10:00+08:00
tags:
  - ai
  - agents
  - evals
  - openai
---

On 3 September 2026, ARC Prize published GPT-6 Astra's ARC-AGI-3 numbers. Greg Kamradt's post puts two scores on the same model. In the Standard harness at max reasoning, Astra hit 62.7% and the run cost $26,098. In OpenAI's Provider Adapter at high reasoning, it hit 99.9% and the run cost $18,817.

I am quoting [the ARC Prize table](https://arcprize.org/blog/astra), not a launch slide. The official results page lists twelve harness configurations. Both scores are real. They are not the same test.

The Standard harness is the shared interface. The model can keep notes it chooses to carry forward. The Provider Adapter keeps opaque reasoning state between requests and compact longer conversations, so the model can reuse work it already did. Same weights. Different memory rules. Different score.

The row I keep coming back to is reasoning none. Inside the adapter, Astra still scored 96.7% and cost $23,457. Inside the Standard harness at max, it scored 62.7% and cost $26,098. Turning the reasoning dial all the way up, under the shared rules, lost to leaving reasoning off and keeping OpenAI's context plumbing.

That is a 34-point gap from scaffolding, on a benchmark that is supposed to measure whether an agent can explore a new environment, infer the rules, and plan. ARC-AGI-3 is a set of novel turn-based games with no instruction sheet. Humans solve 100% of them in ARC's testing. The Standard number is still a large jump over GPT-5.6 Sol's 7.8% on that same shared harness. The number that travelled was 99.9% against 7.8%. Those two figures do not share a harness.

ARC Prize declined the AGI conclusion in the same post. Saturating this test is not proof of AGI, they wrote. Mike Knoop added that they lack evidence to call it AGI yet. Going forward they will keep both harness results on the leaderboard, labeled. A single unlabeled ARC-AGI-3 percentage is now an unusable comparison.

I wire a lot of agents. Most of them look like the Standard column. A request goes out, a tool comes back, maybe a scratch file survives. Opaque reasoning state usually dies at the HTTP boundary. Compaction is a feature I have to build, not a default I get because I picked a model name in a dropdown. If I paste "Astra, 99.9% on ARC-AGI-3" into a buy decision, I am describing a system I have not installed.

The adapter is documented API behavior. Anyone can call the same features. The 99.9% is a recipe for weights plus preserved state plus compaction. Drop the last two and the published table says you should expect something closer to 62.7%, and you should also expect to pay more, because the Standard max run burned more dollars than the adapter high run.

ARC also clocked the 167 game-reasoning pairs both harnesses solved. Adapter runs used 49% fewer tokens and finished about 3.66 times faster on elapsed time. The cheaper, faster system was the one that kept prior work. That matches the boring thing I already believe about agents. Retrying from a cold context is expensive. A model that can keep a working scratchpad spends fewer tokens finishing the game.

There is a separate launch-week mess about OpenAI editing other metrics after the post went live. Fortune compared snapshots. I am leaving that alone here. The ARC table did not need a stealth edit to be confusing. It printed both numbers on day one, and the higher one still walked out of the room without its harness name.

If I were writing an eval harness tomorrow, I would refuse a leaderboard row that does not name the context rules. Print the Standard score next to the adapter score, the way ARC Prize is now doing. If I were picking a model for a long agent loop, I would ask whether my runtime preserves reasoning state across tool calls. If the answer is no, the 99.9% figure is a demo of someone else's stack.

The table is public. Use the 62.7% row when you are comparing models. Use the 99.9% row only when your own loop can keep the opaque state. If a chart shows one ARC-AGI-3 number and no harness, skip the chart.
