---
title: Why Your Agent Memory System Gets Beaten by Raw Retrieval
description: A UIUC, Tsinghua, and Waterloo team tested 11 persistent agent memory systems across three backbones. Most lost to naive RAG on raw history because memory operations drop evidence you cannot recover later.
pubDate: 2026-10-28
tags: ["ai", "agents", "infrastructure", "open-source", "machine-learning"]
---

Over the past year, agent architectures have converged on a very specific kind of complexity. If an agent needs to remember things across long sessions, the standard playbook says you do not just hand it raw logs. You build a memory pipeline. You extract atomic facts, cluster user preferences into profiles, maintain lifecycle graphs, and synthesize summaries after every run.

The assumption behind all that code is simple. Structuring history ahead of time has to beat searching flat text chunks when the agent needs an answer tomorrow.

A new paper from Xuan He, Sining Zhoubian, Ruozhen Yang, Yuhao Wen, Zhineng Wang, Yuyang Hu, Ke Yang, Yuyu Zhang, Ping Nie, Jiawei Han, and ChengXiang Zhai (*Memory Tax: Dissecting the Net Value of Agent Memory*, arXiv:2610.34073) ran the actual comparison. The team from UIUC, Tsinghua, Renmin University, Verdent.ai, and the University of Waterloo took 11 dedicated memory systems, put them on three benchmarks (LongMemEval-s, PersonaMem-v2, and MINT-Eval), and evaluated them against naive RAG across three model backbones: Qwen3.5-4B, Qwen3.6-27B, and GPT-5.6 Luna.

The baseline was intentionally crude. Just one or two rounds of plain retrieval over raw history chunks.

Most dedicated memory systems underperformed naive RAG. On LongMemEval-s with Qwen3.6-27B, naive two-round RAG scored 81.4%. Flat stores like A-Mem hit 79.4%, MemOS hit 76.6%, and SimpleMem dropped to 73.6%. Hierarchical setups did not escape either, with MemoryOS coming in at 73.4% and LightMem at 78.8%. The specialized memory systems burned substantially more tokens processing and storing information, yet delivered negative net value.

## The balance sheet of agent memory

When you break down the per-query receipts, memory systems do not fail uniformly. They solve a specific slice of queries that flat RAG misses, especially when cross-session synthesis or profile aggregation genuinely matters. The authors classify these wins as the memory benefit.

The trouble sits in the other column on the ledger. Dedicated memory fails on tasks that raw retrieval handled without breaking a sweat. The authors call this the memory tax.

```
Raw History -> Naive RAG (preserves full verbatim text, minimal cost)
                  vs
Raw History -> Memory Operations (extract, distill, summarize) -> Distorted Memory Unit
                  |
                  +-> Drops exact terms -> Retrieval misses
                  +-> Model swap -> Format mismatch
```

Every time you rewrite a raw conversation into an atomic fact or a rolling summary, you introduce a deviation from the ground truth. You might drop a specific configuration flag, an exact file path, or a timestamp that felt irrelevant during the summarization pass.

Once that detail is dropped during memory construction, no retrieval strategy can bring it back. The evidence is gone.

The researchers inspected sampled facts to measure how much information actually survived construction. On MemOS, 11.4% of sampled facts suffered partial or major information loss, and another 2.8% had no memory unit created at all. On OpenViking, 22.6% suffered partial or major loss, and 38.0% had no memory unit generated. If four out of ten facts never make it into the store, your agent is flying blind before query execution even begins.

## The accessibility and robustness penalty

Even when the underlying fact survives into a memory unit, getting it out again turns out to be harder than searching raw transcripts.

When the team measured retrieval rounds, naive RAG over raw chunks recovered all necessary gold units on the first pass far more consistently than dedicated memory stores. Because raw chunks retain the user's original vocabulary, simple keyword and dense embeddings can grab the exact text. Memory units, by contrast, use the phrasing of whichever prompt or model distilled them.

That creates a severe robustness penalty when you swap models:

1. **Construction drift:** If you build your memory using a strong model like GPT-5.6 Luna and later query it with an efficient local model like Qwen3.6-27B, the local model often struggles to navigate the dense, structured abstractions left behind.
2. **Answering drops:** The researchers found that changing the construction model shifted downstream accuracy across the board, even with the answering model held constant.

Furthermore, existing memory benchmarks are surprisingly retrieval-friendly. The paper shows that an IDF-keyword matcher selecting chunks based on the two rarest words in a query already scores above 50% on several long-term memory benchmarks. When a simple inverted index can hit 50% without an embedding model or an LLM call, heavy memory pipelines do not have enough headroom to justify their token bills.

## Making memory deviations recoverable

The authors also tested practical fixes that do not require ripping out existing memory stores or scaling up search depth.

The most effective design pattern is keeping a lightweight recovery path back to raw history. Instead of relying solely on distilled memory units, the agent retrieves from raw history alongside the memory store, pooling and reranking candidates before answering. If the memory pipeline compressed away an obscure variable name or a specific version string, the raw chunk catches the fall.

For teams running agent loops in production, the takeaway is hard to ignore. Before you wire up an elaborate multi-stage memory graph, run plain BM25 or basic vector search over your raw execution logs. If your memory architecture cannot comfortably beat raw chunks on your actual workload, you are paying a heavy memory tax for worse answers.
