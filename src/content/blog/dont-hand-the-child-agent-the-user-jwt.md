---
title: "Don't Hand the Child Agent the User JWT"
description: "EPFL and Swisscom posted CAPMAS on 6 September. A contrastive encoder maps the query to at most ten API privileges, then each hop shrinks a Macaroon without calling IAM."
pubDate: 2026-09-11T02:35:00+08:00
tags:
  - ai
  - agents
  - security
  - auth
---

Rasmus Moorits Veski, Rachid Guerraoui, and David Froelicher posted [arXiv 2609.06500](https://arxiv.org/abs/2609.06500) on 6 September 2026. Veski is at EPFL and Swisscom. Guerraoui is at EPFL. Froelicher is at Swisscom. The paper is a multi-agent authorization design, not a new model.

The opening example is a query I have actually typed. A user asks for the salary of Project Phoenix's lead. The orchestrator fans the work out. Every child still carries the user's JWT, with Projects and HR both on it. If the database agent hallucinates a delete, the token still signs it, because the user was allowed to delete.

RFC 8693 can mint a narrower token at each hop. That means a round trip to IAM every time an agent delegates. In a five-agent tree that is a lot of extra calls. On their 20 ms simulated network, that path ran at roughly twice the delegation latency of an offline scheme, and up to three times the bandwidth.

CAPMAS splits the job in two. Before any agent runs, IAM embeds the natural-language query and retrieves at most k matching privileges from a contrastively trained encoder, BAAI/bge-large-en-v1.5. Those privileges go into a Macaroon as `permit` caveats. Each later agent can only append more caveats. It cannot strip them. IAM later intersects every `permit` in the chain. If an agent forgets to re-declare what it is handing down, the request dies.

That is Google's 2014 Macaroon construction, pointed at agent hops. HMAC is cheap. Their micro-benchmarks put attenuation about 30 times faster than RFC 8693 token exchange. Nested Ed25519 tokens also skip IAM, but the payload grows. At depth 25 those tokens approach 2 MB. CAPMAS stays a delimiter string.

The retrieval numbers are the part I would copy first. On ASTRA (1,217 tools), a GPT-oss-120B "Basic Agent" that reads the catalog got a perfect privilege bundle on 37.4% of queries and missed every needed privilege on 53.0%. CAPMAS at k=10 hit 90.9% perfect and 2.1% complete miss. Absolute extra privileges were 0.47% of the catalog, versus 0.10% for the LLM, so the encoder is slightly looser and much less likely to stall the job. On XLAM (3,176 endpoints) the LLM blew the context window. CAPMAS still retrieved in under 20 ms, 92.3% perfect, 3.1% complete miss, 0.12% absolute over-privilege. Untrained BGE already got 71.6% perfect on XLAM. Contrastive training on the schema moved that to 92.3%. They call that split Closed Room, which matches a company that already knows its APIs.

k is a hard cap. At k=3 on ASTRA, perfect capture is 67.7%. At k=10 it is 90.9%. At k=20 it is 93.9%, then it plateaus near 97% by k=40. They also drop early when cosine similarity falls by more than 0.2, so simple queries often get fewer than k. Residual extra scopes are supposed to be cut again when a parent clones the Macaroon for a child and writes a tighter `permit`. Branch isolation matters. After the Projects child returns, the orchestrator throws that copy away and starts from the root token for HR. Otherwise HR inherits "projects only."

They ran the full loop ten times. Mean wall clock was 10.8 seconds. About 18 model calls ate 10 seconds. Routing, crypto, and network took about 800 ms. You can add this without waiting for a faster model.

I would copy the order. Scope the query to a top-k allowlist before the orchestrator sees the tool menu. Put that allowlist on a token the child cannot widen. Verify the intersection at the service, or in an MCP proxy if the service still wants a static JWT. The paper's appendix does that translation.

This is not a prompt-injection cure. The threat model is honest-but-curious agent code plus an untrusted LLM. Agents are assumed to propagate signatures correctly. Section 8 discusses malicious agents, including a plaintext-caveat lie that can talk a middle hop into appending a weaker restriction. The query text also rides along in plaintext for the later semantic check, which leaks. k itself will block a job that needs more tools than you budgeted. IAM remains the verifier.

Code, datasets, and the three evals sit at [anonymous.4open.science/r/CAPMAS](https://anonymous.4open.science/r/CAPMAS/README.md). If you already spawn child agents with the same user token you logged in with, read the JWT column of Figure 1 before you add another hop.
