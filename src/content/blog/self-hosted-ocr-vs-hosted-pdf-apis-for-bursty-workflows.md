---
title: "Self-Hosted OCR Models vs. Hosted PDF APIs for Bursty Agent Workflows"
description: "LightOnOCR-3-0.8B hits 85.5 on olmOCR-Bench, yet old scans drop to 48.7 and bursty RAG pipelines still pay the rasterization and idle-GPU tax."
pubDate: 2026-11-12T14:15:00Z
tags:
  - ai
  - rag
  - python
  - opensource
---

Every RAG ingestion pipeline eventually hits the same fork: run an open-weight OCR vision-language model on your own GPU box, or pay per page to send PDFs to a hosted conversion API. With compact Apache-2.0 models clearing the mid-80s on public PDF benchmarks, self-hosting looks free on paper until you wire up the rest of the pipeline.

On October 8, 2026, LightOnAI released [LightOnOCR-3](https://huggingface.co/blog/lightonai/lightonocr-3) in three sizes (`0.8B`, `1B`, and `4B` parameters), pairing the `0.8B` and `4B` models with Qwen3.5 vision-language backbones. The published numbers make a clean test case for deciding when owning the inference worker pays off and when an async document API saves engineering time.

## What the LightOnOCR-3 benchmarks measure

LightOnAI evaluated all three checkpoints across `olmOCR-Bench`, `ParseBench`, and `fr-bench-pdf2md` (pinned leaderboard revision `3576c52`). At `0.8B` parameters, the smallest model scores 85.5 overall on `olmOCR-Bench`, including 90.8 on tables, 89.6 on arXiv math, 85.2 on multi-column pages, and 94.1 on long tiny text. Scaling up to `LightOnOCR-3-4B` nudges `olmOCR-Bench` overall to 86.3 and `ParseBench` five-category overall to 75.1, compared with 74.6 for `0.8B`.

The sub-table breakdown is where deployment assumptions break. On `olmOCR-Bench`, the `0.8B` model drops to 48.7 on old scans (52.5 for `4B`). On `fr-bench-pdf2md`, `0.8B` scores 33.3 on handwritten pages (46.1 for `4B`) and 47.8 on forms (49.6 for `4B`). Clean digital arXiv papers and dense tables are basically solved for a sub-1B model; degraded scans, uneven lighting, and handwritten forms remain the failure floor.

Throughput depends heavily on how many pixels you hand the vision encoder. Under `vLLM 0.30.0` and `guidellm` across 512 benchmark pages on a single H100, LightOnAI reached their highest `olmOCR-Bench` scores at 400 DPI with a 5 MP cap, roughly 4,800 image tokens per page. Dropping the long edge to 1540 px cut image tokens by almost two-thirds and pushed peak throughput up 44% to 4.78 pages/s on `0.8B` (and 66% to 3.36 pages/s on `4B`), while `LightOnOCR-3-1B` clocked 2.7 seconds for single-page latency.

## Three pipeline costs the model weights skip

Downloading a `0.8B` checkpoint solves token generation per rendered page image. A working PDF-to-Markdown service still has to build and maintain three layers around that model call.

The first layer is deterministic output normalization and chunk assembly. LightOnAI notes in its postprocessing analysis that simple format rewrites, such as HTML `<sup>1</sup>` versus LaTeX `$^{1}$` footnotes, shift edit-distance scores across every top model on `olmOCR-Bench`. In `grounding` mode, LightOnOCR-3 emits inline region labels, `0-1000` bounding boxes, image descriptions, and HTML chart tables that still require custom parsing to turn into clean Markdown headings, cross-page merged paragraphs, and RAG chunks.

The second layer is PDF rasterization and resolution switching. Because a vision model consumes page images, the ingestion worker has to render PDFs safely, detect rotated pages, extract or host embedded figures, and trade off `1540 px` throughput against `400 DPI` fidelity when dense subscripts or tiny table cells appear.

The third layer is idle GPU capacity under bursty load. LightOnAI cites sub-cent compute per 1,000 pages when self-hosted hardware stays busy. That math assumes a steady queue. An agent workflow that parses 30 SEC filings on Monday morning, sits idle on Tuesday, and hits a 200-page manual on Thursday pays rent on an idle GPU instance or absorbs cold-start container latency on every burst.

## Where a hosted async PDF API fits

When document traffic arrives in uneven bursts, offloading rasterization, math and table formatting, and queue scaling to a hosted Jobs API keeps the agent stack stateless. [KolmoPDF](https://kolmopdf.com) exposes that workflow over the web, a REST [Jobs API](https://www.kolmopdf.com/api-docs), an agent skill (`npx skills add komoai2026/kolmopdf-skill`), and an optional local stdio MCP server (`@kolmopdf/mcp-server`).

`POST /api/v1/jobs/parse` accepts files up to 300 MB and 800 pages, supports `Idempotency-Key` headers for safe retries, and returns `202 Accepted` with a job ID (up to 3 concurrent jobs per API key, with additional jobs queued). Callers can stream progress over Server-Sent Events (`GET /api/v1/jobs/{id}/events`), register a `webhook_url`, or poll `GET /api/v1/jobs/{id}`. Form parameters control `table_mode` (`markdown` or `image`), `formula_format` (`dollar` or `bracket`), `enable_cross_page_merge`, and optional layout-preserving translation across nine languages in the same pass. Passing `images_as_url=true` with `enrichment=none` returns a single Markdown file referencing 30-day cached image URLs; otherwise, or when sidecars like `outline.md` and `summary.md` are produced, the download endpoint returns a ZIP archive (`PK` magic bytes) kept for 7 days.

On pricing, KolmoPDF gives free accounts 300 welcome credits plus 50 daily check-in credits, and sells pay-as-you-go bundles at $3 per 1,000 credits with no subscription required. Monthly Go, Plus, and Pro plans start at $4.99 for 3,000 credits, and Pro allows up to 10 API keys while Free, PAYG, Go, and Plus allow 1. Parsing costs 2 credits per page ($0.006 per page at PAYG rates), and parsing with translation costs 3 credits per page.

## Choosing between self-hosting and an API

Choosing between the two setups comes down to workload shape and compliance. Self-host `LightOnOCR-3` if you process steady daily page batches that keep a GPU warm, need raw `0-1000` bounding-box coordinates for custom UI highlighting, or operate under strict data-residency rules that forbid external cloud uploads without a private enterprise deployment arrangement. Call a hosted PDF-to-Markdown API if your agents trigger parsing in unpredictable bursts, mix multi-column LaTeX math with tables or non-English manuals, or need SSE job tracking and skill-ready output without maintaining PDF renderers and vLLM containers. For coding and research agents that hit PDFs sporadically mid-task, $0.006 per page is usually cheaper than an idle GPU queue.
