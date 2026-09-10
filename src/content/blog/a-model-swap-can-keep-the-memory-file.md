---
title: "A Model Swap Can Keep the Memory File and Still Lose the Facts"
description: "Goyal and Ray's 4 September study shows a new model can inherit the same agent memory store and still drop 13 points, unless you keep a schema, a full re-embed, and the raw history."
pubDate: 2026-09-11T01:45:00+08:00
tags:
  - ai
  - agents
  - memory
---

Ankit Goyal and Jaideep Ray posted arXiv 2609.05339 on 4 September 2026. The paper is a controlled swap study. They keep the history fixed, change one piece of the memory stack, and ask whether the new model can still recover randomized codes that never existed in pretraining.

If you run a coding agent for more than a week, you already have the setup. The model endpoint moves every few months. The notes file, the vector index, and the memory markdown stay. The dashboard still returns rows. Nothing throws a migration error. The agent just starts missing last week's deadline.

## Four stores, one history

They script 48 histories and 160 questions each. Answers are random entity codes, scored by exact match, no LLM judge. The two readers are Llama-3.1-8B-Instruct and Qwen2.5-7B-Instruct-1M, served locally, with enough leftover context that the raw transcript still fits.

The same history is saved four ways.

LC-RAW is the full transcript. RAG chunks it and retrieves top-8 with a single dense embedder. NOTES is a model-written summary under a 128 KiB cap (about 111 KiB of actual text). KG-fixed is subject-predicate-object claims under a schema they wrote from the event fields before seeing scores.

LC-RAW is the high-fidelity control. Llama hits 0.712 on it, Qwen 0.911. RAG, with no reranker and no lexical search, sits at 0.535 and 0.565. That gap is already a retrieval problem, and they measure it before anyone swaps a writer.

## Notes move with the writer. A schema does not.

Give Qwen its own notes and accuracy is 0.472. Hand it Llama's notes and it falls to 0.339, a 13.28-point drop. Reverse the pair and Llama gains 9.91 points on Qwen's notes. Average those two directions and the writer-swap penalty looks tiny. The two large moves cancelled. The files are not interchangeable.

They locked four tests in a signed git tag before the main runs. The symmetrized NOTES penalty did not clear their five-point threshold. The directional table did the work the average refused to do.

KG-fixed barely moves. Llama own-store 0.846, inherited 0.845. Qwen 0.988 and 0.988. Writer swap is +0.0004 ± 0.0020. The schema holds the keys and the relation names. The model only fills values. They say this does not make every knowledge graph portable. The schema matches this synthetic workload, and the KG reader is not the NOTES reader. What it does show is that a shared record shape can stop the new model from having to decode the old model's prose.

Calibration already hinted at the writing gap. Qwen's notes kept 85.6% of required evidence spans. Llama's kept 64.5% and used more of the byte budget doing it. Once a fact is omitted, the later reader cannot invent it back.

## A mixed embedding index still answers, and retrieval still drops

They upgrade BAAI/bge-large-en from v1.0 to v1.5. Both emit 1024-dimensional vectors, so a mixed index does not crash on shape. Old index accuracy 0.426. Full re-embed 0.545, plus 11.90 points. A 50/50 mix of old and new vectors 0.475, plus 4.96. You keep about 40% of the upgrade and silently dump the rest. Recall@k and MRR move the same way.

The planned mixed-versus-full test cleared the five-point bar (H2, +6.95 pp). Build the new index beside the old one. Cut over when it is done. If you must run both, route by known version. Two 1024-d spaces in one table will keep serving queries.

Their RAG miss rate belongs to this pipeline. One dense retriever, event chunks, cosine top-k=8, no reranker. A reranker would raise the floor. It would not make mixed 1024-d spaces safe.

## Store-only repair cannot put omitted facts back

Store-only NOTES rewrite never hits 90% of the new model's own-store score, in any of the 48 histories, at any budget they tried. The store cannot recreate a fact the writer left out.

Keep the raw history and the picture splits. Qwen rebuilds 34 of 48 histories to that 90% line, median about $0.76. Llama rebuilds none, because every attempt hits the output-token limit first. A retained transcript is unused work if the repair model cannot finish the rewrite. RAG re-embedding recovers all 96 cases for about $0.013. Rebuilding KG records into the shared schema recovers 91 to 96 of 96.

The planned raw-versus-store test also cleared the threshold (H7a, +8.90 pp). Diagnostic split of the remaining error is the part I would tape to a runbook. For NOTES, 80% of the deficit (0.467 of 0.584) is lost at construction. Style-rewriting the notes for the new reader recovered nothing in the partial intervention they ran. For RAG, 81% of the deficit (0.364 of 0.450) is retrieval. Hand the correct chunk to either reader and they usually use it.

## What I would copy

I keep agent notes because the context window is a working set, not a filing cabinet. After this paper I would treat a model upgrade as a memory migration.

Keep a schema for facts that have to survive a swap (deadline, owner, decision, open task). Keep NOTES for texture if you want, but do not let the summary be the only copy. When the embedder changes, rebuild the index in full or isolate the spaces. After the cutover, test the new reader on the old store in both directions. Llama reading Qwen is not the same experiment as Qwen reading Llama.

The paper is a preprint, two similarly sized open-weight models, and synthetic histories that still fit in context. Larger models and messier chats may fail in other places. The failure they measured is already the one I see in harnesses. The query still returns 200. Last week's owner field does not.
