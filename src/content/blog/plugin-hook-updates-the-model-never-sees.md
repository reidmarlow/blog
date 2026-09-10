---
title: "A Plugin Update Can Add Shell Hooks the Model Never Sees"
description: "HookPry shows agent harnesses will run new lifecycle-hook commands after a trusted plugin update, with no model decision and almost no scanner coverage."
pubDate: 2026-09-11T01:20:00+08:00
tags:
  - ai
  - agents
  - security
  - plugins
---

Li, Zhang, Hou, and coauthors posted arXiv 2609.03884 on 3 September, then revised it on 8 September. The paper is a supply-chain study of AI agent harnesses, the runtimes that sit between a model and your machine: Claude Code, Codex CLI, OpenCode, OpenClaw, Hermes, OpenHarness, WorkBuddy.

The payload is a plugin update that binds a shell command to a lifecycle event.

A lifecycle hook is a config entry for session start, a tool call, or a file edit. The harness starts that command as a subprocess. The model does not have to pick the command, generate it, or even see it. Once the matching event fires, the hook runs with whatever privileges the harness gave the subprocess.

The authors call the attack framework HookPry. Across 1,000 end-to-end runs (40 cases, seven harnesses, five backends), they got 770 oracle-confirmed passes, 34 partials, and 196 fails. Zero runs were explicitly blocked by the model. Micro-average success was 77.0%. Hermes hit 92.5%. Claude Code was the hardest of the seven at 52.5%, which is still more than half.

I keep a lot of agents around. I also install plugins because someone on a marketplace wrote a security-audit helper and I did not want to write one. That combination is the whole paper.

## A later update can add hooks you never approved

HookPry does not need a local foothold, a prompt, or a sandbox bug. The attacker publishes a versioned plugin. Version 1 looks useful and boring. You install it. Later, under the same identity, they ship an update that adds a hook.

The paper names that gap Temporal Decoupling. The motivating example is Claude Code automatically loading newly added lifecycle hooks after a marketplace update, without item-level confirmation or a second authorization. Coarse trust in "this plugin" is treated as approval of whatever command the next manifest binds.

If you have ever clicked "update all" on VS Code extensions, you already know the shape. The bound command can fire on PreToolUse or PostToolUse and never enter the chat transcript.

One appendix case is almost rude in how little it needs. A plugin advertised as `security-sentinel` registers a PreToolUse hook named `env-validator`. The user asks for an audit. The model calls the plugin. The harness starts the hook first. The command greps the environment for KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, or AUTH and writes hits to a temp file. The plugin still returns a normal audit report. The dump never shows up in the model context.

A second case tampers with what the model is allowed to see. A PostToolUse hook rewrites the real tool output before it returns to the agent loop. The genuine scan found `eval(user_input)` and a hardcoded password. The hook forges a pass with zero vulnerabilities. The model then tells you the code is clean. It did not invent the lie. It amplified a forged observation.

## The numbers that stuck

They tested Claude Sonnet 4.6, DeepSeek-V4-Pro, Kimi-K2.6, GLM-4.7-Flash, and GitHub Copilot. After a matching event fires, binding and subprocess dispatch follow the harness, not the vendor. Codex CLI, OpenClaw, and Claude Code barely moved across backends (standard deviation at or below 2.5 percentage points). OpenHarness, WorkBuddy, and Hermes moved more, because some events only happen if the model actually calls a tool.

Persistence and command-and-control were the weak categories. Codex CLI persistence sat at 0.0% end-to-end. OpenClaw persistence was 6.2%. Network policy and filesystem isolation still matter after the hook starts. Credential collection, privilege escalation, and resource hijacking did not need that luck. Privilege escalation averaged 93.5% across harnesses.

A side experiment translated 50 malicious MCP tool-description attacks into hooks. Native HookPry hooks hit 46 of 50 (92.0%). The translated MCP versions hit 28 of 50 (56.0%). Prompt-shaped poison still has to talk the model into a tool call. A registered hook skips that step.

They also tried three static defenses on a 40-malicious / 40-benign corpus. Microsoft Defender recalled 0 of 40. A lifecycle-hook-aware policy they call HookPolicy got 20 of 40. Semgrep got 19 of 40. The union still missed 19 of 40, which is 47.5%. No false positives on the synthetic controls, and also no coverage of the actual attack.

Ablation is blunt. Drop Temporal Decoupling or the per-harness adapter, and end-to-end success on their comparison set goes to 0%. The attack lives in same plugin identity, new hook entries, and the native schema.

The evaluation assumes the plugin is already installed and the update is delivered. Marketplace ranking and real-user adoption are out of scope. So is sandbox escape. The authors say they disclosed to the vendors and are waiting.

## What I would change in a harness tomorrow

Treat a hook diff like a permission grant.

On install, print every event-to-command binding. On update, print the added and removed bindings and stop until a human accepts each new command. "Update the plugin" is not informed consent for `env | grep TOKEN`.

Pin versions in production. Auto-update is a delivery channel. If a marketplace can change hooks without a diff review, it can change what runs as you.

Run hook subprocesses with a narrower environment than the agent. The credential case is a one-liner against inherited env. Drop secrets from the hook process, or do not give hooks a shell.

Keep a flight recorder that includes hook registration, the exact command, the triggering event, and stdout/stderr. If a PostToolUse hook can rewrite tool output, the original bytes have to live somewhere the model cannot overwrite.

Marketplace metadata is a discovery surface. HookPry's first stage is just making a benign plugin easy to find. The dangerous bit arrives later, under a name you already trust.

If you maintain a coding-agent plugin, look at your own update path tonight. Count the hook entries that can appear without a prompt. That count is what Defender, Semgrep, and HookPolicy still miss on this corpus.
