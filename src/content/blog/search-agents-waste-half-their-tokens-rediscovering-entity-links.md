---
title: "Search Agents Waste Half Their Tokens Rediscovering Entity Links"
description: "Why exposing flat document dumps to autonomous search agents forces them to burn thousands of tokens rediscovering basic cross-file connections, and how offline entity mapping cuts trajectory cost."
pubDate: 2026-10-01T00:30:00+08:00
tags:
  - ai
  - agents
  - rag
  - devtools
---

If you wire an LLM agent to a local directory of documents and give it terminal tools (grep, find, cat), you quickly notice an ugly pattern. When a question depends on evidence scattered across three separate files, the agent spends most of its trajectory wandering in circles. It greps for a keyword, pulls up five irrelevant markdown files, reads their headers, backs up, reformulates the search, and tries again.

On turn six, it finally discovers that Project Atlas has an approval slip in one folder, technical specifications in another, and a status report in a third. It answers the question, but the transcript shows two hundred thousand tokens burned on blind navigation.

A new paper from researchers at KAIST and Microsoft, titled "Follow the Entities: A Corpus Map for Agentic Search" (arXiv:2609.37226), quantifies exactly how much compute goes up in smoke during these runs. On EnterpriseRAG-Bench, an agent searching a raw flat corpus consumed an average of 206,500 input tokens per query trajectory just to hit 62.1 percent correctness. On WixQA, the raw search burned 337,200 tokens per query.

The culprit is straightforward. A raw document collection gives an agent zero relational pointers between files. Every single incoming query forces the model to reconstruct the entire web of cross-document relationships from scratch at inference time.

### Why standard abstractions fail

Developers usually try two workarounds when raw grep starts blowing up context windows. Neither holds up under scrutiny.

The first workaround is folder-based aggregation. People group files into directories, ask an LLM to generate an index page for each folder, and hand those index files to the agent. In the paper's experiments under the Group Page baseline, this strategy backfired completely. Token consumption exploded to 423,000 tokens on EnterpriseRAG-Bench and over 1.1 million tokens on WixQA, while correctness dropped to 48.8 percent. Organizational folder trees mirror team charts or file formats, not the real questions people ask. Splitting related documentation across arbitrary folder walls just forces the agent to read redundant directory summaries before it can find the underlying evidence.

The second workaround is the unconstrained LLM wiki, popular following Andrej Karpathy's experiments. You let a language model ingest the corpus and freely draft cross-linked markdown notes. In practice, free-form wikis suffer from hallucinations and missing cross-references. On EnterpriseRAG-Bench, the LLM Wiki baseline burned 192,400 tokens and achieved only 56.7 percent correctness, falling behind even raw corpus search. Without strict grounding against raw files, the agent navigates through loose conceptual associations that drop hard facts.

Traditional graph retrieval methods like GraphRAG and HippoRAG avoid the agent navigation loop entirely by retrieving a fixed context window upfront. But as the authors demonstrate, fixed retrieve-then-generate pipelines cap performance because the model cannot inspect downstream sources if the initial graph walk misses an edge.

### The entity map architecture

The authors propose a system called CorpusMap that sits between flat storage and the search agent.

Instead of organizing files by directories or abstract topic clusters, CorpusMap structures the corpus around recurring named entities. These entities are people, projects, systems, vendors, and code modules that appear across multiple independent documents.

Offline, an extraction pipeline identifies these recurring anchors and generates a dedicated Entity Page for each one. The Entity Page does two things. It aggregates key facts about that specific entity, and it maintains explicit, verified backlinks to every original document that mentions it. This creates a clean bipartite graph between entities and raw documents.

When the agent receives a task, it navigates this graph using standard terminal commands. Instead of blind keyword grepping, the agent jumps directly to the relevant entity page, inspects the consolidated facts, and follows direct links to the exact source documents it needs to verify.

The impact on trajectory efficiency is substantial:

On EnterpriseRAG-Bench using GPT-5.5, CorpusMap cut average input token consumption from 206,500 tokens down to 88,100 tokens, representing a 57 percent reduction. At the same time, answer correctness jumped from 62.1 percent to 73.8 percent.

On WixQA, token consumption dropped from 337,200 tokens to 74,500 tokens, a 78 percent drop, while factual accuracy rose from 67.5 percent to 70.7 percent.

Across seven different model families, including GPT-5.6 Sol, DeepSeek-V4-Pro, and Qwen3.8-27B, the pattern repeated consistently. Providing explicit entity anchors prevented the agent from getting lost in recursive search subroutines.

### The economics of offline indexing

The obvious objection to building entity maps is the upfront indexing cost. Extracting cross-document entities across thousands of pages requires significant LLM inference.

The paper includes a transferability ablation in Table 4 that addresses this concern directly. When researchers used GPT-5.5 to construct the CorpusMap for 2,819 enterprise documents, the one-time indexing bill reached roughly $4,732. But when they swapped the builder model to GPT-5.6 Luna, construction cost dropped to $74.65.

Crucially, when high-end models like GPT-5.5 and GPT-5.6 Sol answered queries over the cheap Luna-built map, they maintained quality scores of 73.59 and 74.68, virtually matching the quality of the expensive GPT-5.5-built map. The structure of the entity graph matters far more than the prose style of the entity summary. You can run entity extraction with a cheap utility model and hand the resulting map to your expensive frontier agent without losing retrieval quality.

The authors also tested incremental updates. When new documents arrive, the system updates only the entity pages touched by those specific files rather than reprocessing the entire corpus. In their benchmarks, incremental updates saved 69 to 71 percent of tokens compared to full rebuilds while preserving overall answer quality.

### Practical takeaways for local workflows

If you maintain agent workflows over project repositories, internal wikis, or legal folders, there are three immediate takeaways from this work.

First, stop expecting frontier models to compensate for unstructured storage. Adding more reasoning tokens to an agent does not fix the absence of cross-document links. It just gives the model more runway to burn cash on repetitive grep commands.

Second, avoid folder-centric indexes. Summarizing directories by folder path creates artificial walls that actively degrade multi-document recall. If an agent needs to correlate an infrastructure outage with a vendor contract and a commit log, folder hierarchies hide the connection.

Third, extract entities once and maintain explicit backlinks. You do not need a complex graph database or a proprietary framework to implement this. A directory of markdown files where each file represents a recurring entity and lists relative paths to source documents gives a terminal agent everything it needs. You pay the extraction cost once, and your search loops stop wandering in the dark.
