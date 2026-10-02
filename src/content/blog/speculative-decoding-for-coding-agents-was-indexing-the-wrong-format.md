---
title: "Speculative Decoding for Coding Agents Was Indexing the Wrong Format"
description: "Why retrieval speculative decoding falls flat in agent pipelines, and how indexing files in emission format gives a 4.7x throughput boost without a draft model."
pubDate: 2026-10-03T00:30:00+08:00
tags:
  - ai
  - agents
  - devtools
  - performance
---

If you benchmark retrieval-based speculative decoding on isolated code snippets, it looks like free speed. You take an existing text corpus, build a suffix tree or suffix automaton over it, and copy token continuations directly into the generation buffer. You skip training an extra draft model, keep GPU memory untouched, and let the target model verify multiple tokens in a single forward pass.

Then you plug that engine into an actual coding agent harness like SWE-bench, and the speedup collapses.

I spent time assuming the problem was cache hit rate or vocabulary drift between sessions. A new paper from KAIST and Seoul National University, "AgSpec: Pushing the Limits of Retrieval-Based Speculative Decoding in Coding Agent Pipelines" (arXiv:2610.01108), points to a much dumber reason. The retrieval index stores the files exactly as they sit on disk, but coding agents almost never emit raw files from disk.

### The whitespace mismatch killing token matches

In a multi-turn agent pipeline, the model emits edits through tools. A coder agent writing a unified diff prefixes every unchanged context line with a single space. It prefixes deletions with a minus sign. If the agent operates through structured JSON tool calls instead of diffs, it emits file contents wrapped inside a string parameter where newlines become literal `\n` characters and quotes get backslash-escaped.

When the speculative decoding engine searches its suffix index for a match, it matches token sequences. If your repo file contains `def calculate_total(items):`, the tokenizer turns that into a specific sequence of token IDs starting with `def`. But the model's output buffer is generating ` def calculate_total(items):` with a leading space byte, or `"def calculate_total(items):\\n"` inside an escaped JSON block.

The token IDs do not match. The suffix match breaks at the very first character of every single line of code the agent tries to emit.

The authors measured this gap across SWE-bench Verified. Under standard retrieval indexing, the engine misses most of the reusable code already sitting in the workspace simply because the string representation on disk diverges from the serialization format expected by the harness.

The fix AgSpec introduces for matchability is straightforward. When an agent opens an artifact from the workspace, AgSpec indexes the file in multiple emission representations simultaneously. It keeps the raw file for general context. For unified-diff coders, it creates two transformed variants in memory: one where every line has a leading space, and one where every line has a leading minus sign. If the harness uses JSON tool parameters, it indexes an escaped version.

Any block of code the agent copies from an existing file now matches an indexed continuation in the suffix tree. Restoring this matchability nearly doubles the accepted draft length on repository-level edits without touching model weights.

### Three distinct lifetimes of agent text

The second failure of existing retrieval engines is treating all text as a single flat datastore.

Coding agents pull tokens from three separate sources with completely different lifetimes:

The session corpus holds the active conversation history, tool executions, terminal logs, and previous error traces. This text changes with every turn, needs to be retrievable immediately, and should be discarded when the session ends.

The workspace corpus holds the repository files touched during the task. It starts empty, grows as the agent opens files, indexes each file in its emission format, and disappears when the container terminates.

The global corpus holds immutable reference data like standard libraries, framework documentation, and common dependencies. It is compiled once ahead of time and shared across all sessions.

Earlier systems like FastCoder leaned heavily on static project datastores. That works fine if you are completing a function in an already indexed library, but an agent spending turn four analyzing a traceback needs to draft tokens from the compiler error printed on turn three. AgSpec queries all three corpora in priority order: active session first, opened workspace artifacts second, and static global references third.

### Agent role drift and draft length waste

Drafting speculative tokens is an asymmetric bet. An accepted token saves an entire autoregressive decoding pass. A rejected token wastes verification compute.

At batch size 1, verification overhead is low enough that speculative misses are mostly harmless. At batch size 16 or in multi-agent serving setups where verification saturates GPU cores, over-drafting kills serving capacity.

Existing speculative decoders usually pick draft length using static caps (like capping all drafts at 16 tokens) or purely by match length in the suffix tree. Both heuristics break down in agent workflows because acceptance rates swing wildly depending on which agent is generating text:

A planner or reviewer writing high-level natural language analysis emits novel reasoning tokens. Its accepted draft length is short, often averaging fewer than two tokens per step. If the engine blindly proposes eight draft tokens based on a common phrase, six get rejected and verification compute burns for nothing.

A coder agent applying a mechanical refactor or repeating a test fixture emits long runs of predictable tokens. Its accepted draft length frequently exceeds twenty tokens.

AgSpec balances this by profiling each agent role offline to find its empirical acceptance curve, setting an individual maximum draft cap per role. During generation, an online controller monitors real-time acceptance rates from the verification step. If the current turn hits repeated rejections, it scales down draft length dynamically before the engine wastes compute.

### The throughput numbers

The authors implemented AgSpec in vLLM on top of two suffix retrieval engines: the suffix automaton from SAM-Decoding and the suffix tree from SuffixDecoding. They evaluated Devstral-24B, Gemma3-27B, and Qwen3.6-27B across SWE-bench Verified and TeamBench.

On SWE-bench Verified at batch size 1, AgSpec reached between 2.27x and 4.37x the generation throughput of standard autoregressive decoding. At batch size 16, it delivered up to 4.76x throughput. Across all evaluated configurations, throughput beat the fastest existing retrieval methods by an average of 18.0 percent.

Crucially, it also beat EAGLE-3 in most multi-agent configurations without requiring a trained draft model head.

When you look at the latency profile of running coding agents on local clusters, the slowest phase is almost always streaming long diffs and file rewrites across multiple turns. We spend enormous effort trying to train smaller auxiliary models to predict those tokens faster. AgSpec demonstrates that the tokens were already sitting in memory all along; our inference engines were just looking for the wrong prefix.
