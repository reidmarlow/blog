---
title: "Stop Wrapping CLI Tools in 200 MCP Endpoints"
description: "A benchmark of REA against an 8 KB plain CLI skill shows why turning standard Unix commands into MCP schemas adds latency and token bloat without improving accuracy."
pubDate: 2026-10-18T00:30:00+08:00
tags:
  - ai
  - agents
  - cli
  - open-source
---

Every few weeks, someone releases an MCP server that packages standard Unix utilities into hundreds of structured tool endpoints. If an agent needs to inspect a binary, search code, or read an SQLite table, the setup gives it a custom schema for every command.

A new project called `leanrea` tested what happens when you drop that layer entirely.

The target was REA, a popular reverse-engineering toolkit for coding agents. REA ships as an npm package that exposes 207 MCP tools. It gives the agent custom endpoints for tools like `asar`, `otool`, `nm`, `go version`, `jadx`, and `sqlite3`.

Instead of running an MCP daemon, `leanrea` replaces the server with a single 8 KB markdown skill file. The skill teaches the agent how to run the host CLI binaries directly through Bash, gives it targeted search commands, and notes output flags that prevent terminal spam.

The author benchmarked both approaches on Claude Code 2.1 headless (`claude -p`) using Sonnet 5.5 on macOS across four real reverse-engineering tasks: tracing IPC calls in Notion's Electron bundle, auditing native `.node` addon exports and TCC checks, parsing stripped Go binaries, and extracting socket protocols from disassembly.

Across twelve runs per arm, the numbers were clean:

| Configuration | Total Wall Time | Cost | Turns | Tokens | Task Score |
|---|---|---|---|---|---|
| **leanrea (8 KB plain skill)** | **388 s** | **$2.17** | **55** | **2.40 M** | 74 / 75 |
| Raw model (no skill, no MCP) | 479 s | $2.21 | 81 | 3.11 M | 67 / 75 |
| REA (207 MCP tools + skill) | 627 s | $3.36 | 124 | 5.93 M | 75 / 75 |

The 8 KB skill finished with 38% less wall time, 35% lower cost, and 60% fewer tokens than the MCP server, with the exact same task score (74 versus 75, missing only an old IPC channel name).

### The schema tax

The issue with wrapping CLI tools in MCP endpoints is context overhead.

REA's `tools/list` payload definitions take up 3.35 MB of JSON: 745 KB of input schemas, 2.46 MB of output schemas, and 90 KB of tool descriptions.

Claude Code uses deferred tool search by default, which hides most of that payload until an agent queries a tool by name. But in environments where an agent loads all available tools up front, loading REA eats 400,700 tokens on the first prompt before the model even runs an action. A simple "Reply with OK" test cost $1.60 per run just to parse the schema catalog. With `leanrea`, the exact same greeting cost $0.09.

When the agent actually executes a tool, the difference is just as wide.

Running Go build analysis on a stripped `gh` binary took 0.56 seconds and produced 62.5 KB of structured output through REA. Running `go version -m` directly through Bash took 0.06 seconds and produced 15.6 KB.

Inspecting an Electron application was worse. REA failed on asar integrity validation by default; after passing override flags, it took 47.9 seconds and dumped 140 MB of JSON into the session. Extracting the asar archive and running `rg -uu` took 4.8 seconds and generated 24 KB of relevant text.

### Models already understand standard CLI tools

The reason developer tools exist as command-line utilities is that standard tools already solve extraction, filtering, and process isolation.

Frontier models already know the flags for `otool`, `file`, `strings`, `nm`, and `ripgrep`. They do not need an intermediary Node.js daemon to translate an AST into a JSON schema, serialize it, pass it across an IPC bridge, and deserialize it back into text.

When you wrap every flag in a JSON schema, you force the model to reason through an unfamiliar API abstraction instead of using the commands present in millions of public GitHub repositories.

If an agent needs reverse-engineering capabilities, teaching it to slice output with `head`, grep hidden files with `rg -uu`, and batch probes into a single shell execution works better than adding two hundred tools to its system prompt.
