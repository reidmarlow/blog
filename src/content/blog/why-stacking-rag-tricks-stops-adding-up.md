---
title: Why Stacking RAG Tricks Stops Adding Up
description: IBM and Weizmann evaluated 450 RAG pipelines across 8 benchmarks. Isolated retrieval tricks predict a 47% gain but yield only 17% together, and scaling the corpus scrambles the winners.
pubDate: 2026-10-23
tags: ["ai", "rag", "evals", "infrastructure", "python"]
---

Every engineering blog post about Retrieval Augmented Generation follows the same script. The team starts with basic dense embeddings, notices bad precision on domain terms, adds BM25 hybrid search, and logs a 15% bump on their test set. Next week someone benchmarks reciprocal rank fusion reranking and gets another 18%. Then comes query expansion via HyDE for another 14%.

On paper, the team is staring at an arithmetic miracle: three separate upgrades that each brought double-digit gains, suggesting a pipeline nearly 50% better than the baseline.

In production, user complaints about hallucinations barely budge, latency triples, and nobody can explain why adding a second retriever made answer quality worse on large corpora.

A research team from IBM and the Weizmann Institute of Science just published empirical proof for why this happens. In their paper, *Retrieval Augmented Generation Compositionality* (arXiv:2610.29722), researchers Ido Levy, Segev Shlomov, and Leshem Choshen built an open-source evaluation framework named LASAGNA to test whether isolated RAG improvements actually compose.

They evaluated 450 distinct pipeline configurations across eight standard benchmarks on corpora scaling from 5,000 to 200,000 documents. The results should be required reading for anyone managing search infrastructure.

## The composition collapse

The headline finding confirms what systems engineers keep rediscovering in production: components in a RAG stack interact destructively.

When three standard retrieval techniques were evaluated individually, their isolated gains predicted a combined improvement of +47% over baseline. When all three were wired together into the same pipeline, the actual measured improvement was +17%.

Almost two-thirds of the expected gains evaporated in composition.

```
Expected additive gain:  [=============================== +47%]
Actual composed gain:    [=========== +17%]
```

The reason comes down to noise overlap and rank perturbation. Individual retrieval papers benchmark a specific technique against a clean baseline. In that narrow context, adding semantic query rewrite captures obscure phrasing that lexical search missed. Rerankers then re-order the top chunks to bubble relevant passages to the top.

When you chain them, each stage introduces its own distribution shift:
1. Query rewriting frequently introduces semantic drift, generating alternative queries that pull adjacent but irrelevant context.
2. Cross-encoder rerankers, trained on specific passage distributions, spend their scoring budget sorting out distractor passages introduced by the upstream rewriters.
3. Context compressors clip passages based on isolated token saliency rather than factual cohesion.

By the time the context window reaches the generator, the prompt is packed with high-similarity distractors that look convincing to attention heads but dilute the exact factual anchors the model needs to answer the question.

## Retrieval precision fights generator faithfulness

The second finding in the LASAGNA benchmarks is even nastier: retrieval metrics and answer faithfulness frequently optimize in opposite directions.

Most RAG engineering teams use retrieval benchmarks like Recall@K or Mean Reciprocal Rank (MRR) as primary optimization targets. The assumption is straightforward: if better chunks enter the prompt, the model will output better answers.

Levy, Shlomov, and Choshen found this assumption falls apart when evaluating end-to-end faithfulness. Certain combinations that maximized retrieval recall simultaneously increased factual hallucinations in the generated response.

When a pipeline aggressively packs the context with multiple overlapping chunks to maximize recall, it increases context density. Dense models given three chunks containing slightly conflicting phrasing or temporal mismatch often synthesize plausible-sounding blends rather than grounding on the single authoritative sentence.

If your evaluation suite measures retrieval quality and answer accuracy in separate silos, you will easily deploy configurations that win on search metrics while degrading production reliability.

## Corpus scale scrambles the leaderboard

The third insight addresses a subtle trap in developer benchmarks: testing on toy datasets.

In the paper's experiments, the best-performing pipeline configuration on a 5,000-document corpus was routinely overtaken as the corpus expanded to 50,000 and 200,000 documents.

On a 5,000-document corpus, dense vector search handles domain coverage well because the embedding space is relatively sparse. High-dimensional vector collisions are rare, so query augmentation can afford to cast a wide semantic net without drowning the context in false positives.

At 200,000 documents, the dense vector space gets crowded. The number of documents sharing superficial semantic similarity with any given query grows by orders of magnitude. In that environment, aggressive query expansion and broad chunk retrieval flood the candidate pool with high-scoring noise. Techniques that helped at 5K documents actively degrade performance at 200K documents, while stricter lexical filtering and conservative retrieval budgets pull ahead.

If you tune your chunking strategies, top-k parameters, and reranker thresholds against a staging corpus of a few thousand docs, that tuning is practically guaranteed to fail when pointed at your production index.

## Testing the full harness

The authors released their testing harness, LASAGNA, specifically to force researchers and builders to test components in context.

The takeaway for anyone running production pipelines is straightforward: stop benchmarking RAG components in isolation.

If you are considering a new embedding model, a fancy query expansion prompt, or a learned reranker, testing it against a standalone retrieval dataset tells you very little about whether your users will get fewer hallucinations. 

Measure end-to-end task completion on your actual corpus scale, keep the pipeline as lean as possible, and treat every additional component as an interaction tax until the composed stack proves otherwise.
