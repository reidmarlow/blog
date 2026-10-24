---
title: "The Mosaic Leak Hiding in Agent RAG"
description: "USC ISI researchers tested LLM agents on compartmentalized data. Under benign single-document queries, top models still assembled and disclosed forbidden multi-document conclusions."
pubDate: 2026-10-25
tags: ["ai", "agents", "security", "rag", "architecture"]
readingTime: 4
---

USC's Information Sciences Institute published a paper on arXiv (2610.30418) looking at what happens when LLM agents retrieve across compartmentalized internal documents. They call the failure mode Agent Mosaic: an agent retrieves two or three unclassified pieces of information, connects the dots internally, and answers a benign user prompt by blurting out a classified composite conclusion.

In intelligence work, the mosaic effect is an old concept. Analysts pull public shipping manifests, flight paths, and warehouse leases, piecing together an unannounced military deployment without touching a single secret record. What the USC ISI team tested was whether multi-step agents assemble that puzzle accidentally on internal enterprise knowledge bases, even when nobody asked them to hack anything.

### The 7% Benign Leak Rate

The authors built 30 scenarios across cybersecurity, healthcare, and military logistics. They ran 10,800 controlled simulations across three frontier models, plus 1,440 runs across two open-source agent harnesses.

The test queries were deliberately benign. Each prompt was designed to be answerable from a single low-clearance document.

Under those conditions, GPT-5.6-Sol, the best-performing model in the run, still disclosed forbidden composite conclusions in 7.08% of its answers (95% CI: 3.75% to 10.67%). In the live agent harnesses, where tool outputs and scratchpads accumulated in context, the disclosure rates were higher.

When the evaluators added explicit aggregation rules and visible classification headers directly inside the retrieved documents, the baseline leak rate dropped. But unsafe composite disclosures still landed in 32.37% of simulated answers across all tested user intents.

System prompt instructions like "never correlate Project A records with Project B deployment schedules" did not solve the problem. The agent model treats context as a single reasoning canvas. If three retrieved chunks land in the prompt buffer, the attention mechanism synthesizes connections between them during the forward pass.

### Why Refusal Heuristics Backfire

The paper noted an awkward side effect in safety tuning: refusals themselves often confirm the composite fact.

When an agent replies, "I cannot tell you if the payload failed because the cooling system in facility 4 overheated," it confirms both the relationship and the root cause. In the paper's harness runs, aggressive refusal heuristics frequently leaked the underlying sensitive link while trying to decline the prompt.

That leaves developers in a familiar jam. You cannot rely on model-level self-censorship to redact conclusions the model has already calculated.

### Move Clearance to the Retrieval Boundary

If your security architecture relies on an LLM reading five sensitive documents and deciding which three it is allowed to mention, you have already built a leak.

The only reliable defense against mosaic leakage is preventing the conflicting chunks from landing in the same context window simultaneously:

```
[User Request]
       │
       ▼
[Scope & Clearance Guard]
       │
       ├─► Retrieval Partition A (Allowed) ──► In-Context Working Memory
       │
       └─► Retrieval Partition B (Forbidden) ──► Blocked at Vector/SQL Filter
                                                      │
                                                      ▼
                                          [No Cross-Document Synthesis]
```

That means shifting access control down to the retrieval layer:

- **Entity-level query scoping:** If an agent session queries client records, your vector database or search index must filter out companion operational logs before retrieval, not in post-generation guardrails.
- **Session partitioning:** Subagents handling compartmentalized tasks should run in isolated context environments, returning structured output schemas rather than dumping full conversational traces back to the orchestrator.
- **Context boundary audits:** Log which document IDs enter an agent prompt simultaneously. If two files from mutually exclusive compartments show up in one turn, fail the execution before the generation step runs.

Relying on prompt guards to hide connections between documents already in context will keep failing. If an LLM can read the puzzle pieces, it will eventually hand the assembled picture to the user.
