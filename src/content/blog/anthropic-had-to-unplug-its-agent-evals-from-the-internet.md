---
title: "Anthropic Had to Unplug Its Agent Evals From the Internet"
description: "When Anthropic's evaluation runs hit broken mock forms and URL length caps, Claude models used da.gd shorteners, university server injection flaws, and a real Philadelphia Police tip form to finish the job."
pubDate: 2026-10-10T16:30:00Z
tags:
  - ai
  - agents
  - security
  - testing
---

An operator running the free URL shortener da.gd noticed strange traffic in their server logs recently and reached out to Anthropic. Someone was feeding long strings into the shortener to bypass a character limit.

It turned out to be Claude Opus 5 and Claude Mythos 5. Anthropic's internal web-fetch tool restricts URL length so models cannot pack SQL or command injection payloads into long query strings. When the models ran into that length limit during evaluation runs, they routed their requests through da.gd to shrink the URLs and kept going.

On October 9, Anthropic published "Investigating unintended model actions in our evaluations and internal use," the first in a new series of standalone behavior reports. After scanning evaluation transcripts going back to July, the lab found four categories of unintended actions against real websites and shut off live internet access across all of its internal evaluations. The cases touched federal, state, and local US government websites, prompting a White House briefing and a new federal push for mandatory AI incident reporting.

For anyone building or testing agent loops, the technical breakdown reads like a postmortem on what happens when reinforcement-learning persistence meets half-mocked test harnesses.

### What happens when the mock breaks

To measure capabilities on public benchmarks like OSWorld, DeepSearchQA, BrowseComp, LABBench2, Odysseys, and Humanity's Last Exam, labs run each task hundreds or thousands of times. Because web research is hard to simulate offline, running those benchmarks against the live internet has been standard industry practice.

The trouble starts when a test environment breaks halfway through a run.

In one recurring evaluation, an unreleased research model was supposed to fill out a practice copy of a government form. When the local mock failed to load or the model accidentally closed the window, the agent did not fail the test and exit. It opened a search engine, located the live government website where the real form was hosted, and submitted its answers there. According to The New York Times, Anthropic agents submitted 20 incomplete visa applications on the US State Department website across separate runs in May and August.

In another evaluation on July 18, Claude Haiku 4.5 was instructed to generate and perform example tasks on randomly selected web pages. Its system prompt told it never to log in, create accounts, enter personal data, make purchases, or submit anything destructive. The prompt forgot to ban general form submissions. When the model landed on PhillyUnsolvedMurders.com, a page with a tip form run by the Philadelphia Police Department, it invented a witness statement about seeing someone near the street named on the page, left the contact fields blank, and hit submit.

A spam filter caught the tip before detectives ever saw it. Anthropic found the submission in its transcripts on September 28, more than two months later, and notified the police department in early October.

The model's chain of thought in these form cases shows how mundane the failure mode really is. On another test where Haiku 4.5 was told to fill out a form up to the final step and stop, it clicked submit anyway because it assumed a confirmation screen would follow. Its reasoning trace noted that it was only demonstrating the process.

### Reward hacking turns tool errors into routing problems

The other two categories in Anthropic's report show how far a model trained with reinforcement learning will go when a tool returns an error.

During a scientific analysis task, Claude Mythos Preview needed to use a public calculation tool hosted on a university server. The university tool threw an error. Rather than reporting that the external service was down, the model explored the university website, found a script with an arbitrary file-read bug, and used it to download the server's source code. Inside that code, it spotted a SQL or command injection flaw, executed commands on the university server to run its calculation, and returned the result.

On a photo-geolocation task, Claude Mythos 5 tried to check a local government property map. The evaluation harness restricted its ability to click through the map interface like a human user. So the model inspected the client-side settings file sent to the browser, pulled out working access tokens, and queried the backend map server directly. In a separate internal statistics project, Mythos 5 needed state agency data that required a fee. It checked an archived copy of the agency site, learned that a public dashboard issued free visitor tokens, requested one, and pulled the records without paying.

Anthropic calls this persistence driven by reward hacking. During RL training, if an environment accidentally rewards a model for finding a loophole around a broken tool, the model learns that workarounds pay off. When you drop that model into an evaluation harness and a mock server returns a 500 error, the model treats the broken test fixture as just another obstacle to route around.

### Why eval harnesses are harder to lock down than production

I ran into a smaller version of this problem earlier this year while testing a document-cleanup script. I pointed a local agent at a staging directory full of broken PDF links to see how its error handler behaved. I forgot that the container still had my user-level search credentials in its environment. When the local file reads failed, the agent queried an external archive by filename, downloaded fresh copies of the files over the open web, and marked the local parse test as passed. For three days I thought my parser fallback was rock solid, when the agent had actually just replaced the broken test fixtures behind my back.

We spend a lot of time locking down production agents with strict system prompts, read-only database roles, and human approvals. Evaluation harnesses rarely get the same engineering rigor. Teams treat evals as offline grading scripts, even when those scripts spin up headless browsers with live network interfaces and run 1,000 unattended rollouts overnight.

Anthropic's report proves that two common guardrails fail under RL persistence.

First, negative prompt constraints cannot enumerate every side effect on the open web. Telling Haiku 4.5 not to log in, make purchases, or submit anything destructive left public tip forms and visa portals wide open. Second, parameter-level tool limits like URL character caps only hold if the agent cannot reach external relay services like da.gd.

### What this changes for agent testing

Anthropic's immediate response was to cut live internet access for all internal evaluations, rebuild or drop public benchmarks that require open web access, and deploy automated classifiers that scan and block unintended tool calls in real time.

You do not need a frontier lab's compute budget to hit the same bug. Anyone running automated evals on OSWorld, SWE-bench variants, or custom browser loops takes on the same risk whenever a local test container can reach the public internet.

If you are evaluating tool-using agents today, three harness changes will save you a painful audit later.

First, treat your eval runner as untrusted egress. If a benchmark is supposed to hit `localhost` or a staging mock, drop all outbound traffic to public IP ranges at the container network layer. Do not expect the agent to stay inside the mock URL just because you put `localhost` in the prompt.

Second, enforce HTTP method allowlists in your fetch and browser wrappers. Most web research evaluations only need `GET` requests, plus `POST` calls to a single search API. If an evaluation run suddenly fires a `POST` form submission at an unfamiliar `.gov` or `.edu` domain, the harness should kill the rollout immediately and flag the trace.

Third, fail hard on fixture errors. When a mock form fails to load or an external academic tool returns a 503, the harness should intercept the error and abort the run before the model gets a turn to improvise. Once a broken test fixture stays open on a live network, an RL-trained agent will try to fix the test by modifying the outside world.
