---
title: "Keyless Search With Brave x402 Moves Spend Control Into the Agent Wallet"
description: "Brave's Search API now accepts USDC micropayments over HTTP 402 without an account or API key. How the protocol works, what it skips, and where the spend boundary moves."
pubDate: 2026-11-14T00:30:00Z
tags:
  - ai
  - agents
  - api
  - devtools
  - architecture
---

Two competing designs for agent payments shipped within 24 hours of each other this week. On November 12, [Brave added x402 micropayments](https://brave.com/blog/search-api-agentic-payments/) to its Search API so an agent can pay $0.005 in USDC per query on Base without an account or an API key. A day later, [OpenAI introduced ChatGPT Wallet](https://openai.com/index/introducing-chatgpt-wallet) with American Express, Mastercard, and Visa, keeping tokenized card rails and requiring Face ID or a fingerprint prompt for every purchase.

OpenAI kept a human biometric gate in front of consumer retail. Brave stripped accounts out of developer infrastructure. Together, they show how differently teams are drawing the spending boundary when software calls paid endpoints on its own.

## How Brave's keyless search endpoint works

The x402 proxy sits at `https://search.agent.s.brave.app`, documented in Brave's [agent payments guide](https://api-dashboard.search.brave.com/documentation/guides/agent-payments) and its machine-readable [llms.txt](https://search.agent.s.brave.app/llms.txt). There is no signup flow or static bearer token.

Instead, every request runs a stateless challenge-response loop:

1. Your client sends a plain `GET` or `HEAD` request with no credentials.
2. The server replies with `402 Payment Required`, an empty body, and a base64-encoded JSON offer in the `Payment-Required` header that expires after 300 seconds.
3. The client signs a USDC payment on Base (`eip155:8453`) for that exact advertised offer and retries the identical request with a `Payment-Signature` header.
4. Brave's facilitator verifies the signature before running the search, executes the query, and settles the transfer. Failed upstream requests (`502`) are never charged, and successful responses carry a settlement receipt in `Payment-Response`.

Brave also enforces strict header rules. Sending an `Authorization` header alongside `Payment-Signature` returns `400 {"error":"send exactly one payment rail, not both"}`, and older x402 v1 `X-Payment` headers are ignored.

In Brave's docs, the starter command uses Stripe's [`purl`](https://github.com/stripe/purl) CLI wallet:

```bash
purl --max-amount 5000 'https://search.agent.s.brave.app/res/v1/web/search?q=rust'
```

Because USDC uses six decimals, `5000` base units equals $0.005, matching Brave's published $5 per 1,000 requests rate across eight endpoints: web search, LLM Context, news, videos, images, local place search, POIs, and descriptions. Brave says it is covering Base gas fees for a limited time.

## What x402 breaks right out of the box

Brave's `llms.txt` is unusually direct about what does not fit per-request HTTP 402 settlement today. Three existing Search API endpoints are missing from `search.agent.s.brave.app`, and the exclusions point straight to the protocol's current limits.

First, the Answers API (`/res/v1/chat/completions`) bills per query plus per generated token. An upfront `402` challenge has to quote a fixed price before execution starts, so variable output-token billing does not fit a single static signature.

Second, Autosuggest and Spellcheck cost less per call than the fee a facilitator charges to settle one on-chain transaction. Until x402 clients and facilitators batch many tiny calls into a single settlement, sub-cent endpoints stay behind regular API keys.

Third, there is no session state or prepaid credit balance. As `llms.txt` notes, each request carries its own payment and each receipt proves payment for that single response only. If an agent runs 50 searches in a loop, it signs 50 separate offers. On top of that, `purl` itself does not print the `Payment-Response` header, so you have to look up transfers on-chain unless you inspect headers in your own client wrapper.

## Replacing API keys moves the blast radius

Brave pitches x402 as eliminating traditional API key management. For a one-off script you want to run without creating another SaaS account, that works well. For a production agent harness, dropping the API key simply moves the secret and the billing boundary from the vendor's dashboard into the agent's local environment.

With a standard API key, authentication and spending limits live on the provider side or inside your own API gateway. If a key leaks, you revoke it from a browser tab. If an agent gets stuck in a search-and-retry loop at 3 a.m., a server-side rate limit or monthly hard cap stops the bill.

With an x402 wallet, the signed payment is the credential. Flags like `purl --max-amount 5000` only cap what the wallet pays for one request. They do nothing to stop a confused loop from firing 2,000 valid $0.005 requests in ten minutes. If your agent runs inside a shell with access to an unlocked Base wallet, prompt injection or runaway recursion turns straight into settled USDC transfers. And once Brave's temporary gas subsidy ends, total cost per query stops being a flat $0.005.

## Which boundary to pick for your agent

Where you want your kill switch to live decides which setup makes sense.

Use `search.agent.s.brave.app` when onboarding friction is the main obstacle, like throwaway research scripts or open-source CLI tools where asking every user to register an account and paste an environment variable slows adoption. If you hand a wallet to an autonomous loop, treat the wallet balance itself as the cap. Fund a dedicated throwaway wallet with $2 in USDC for that job instead of pointing the agent at a shared treasury address, and enforce a per-run request counter in your tool wrapper outside the model's context.

Keep static API keys behind a central proxy for multi-agent production fleets. You keep access to variable-token and sub-cent endpoints, skip per-call signing and extra `402` round-trips, get per-tenant usage logs without reading chain receipts, and can cut off spend from one dashboard without touching an agent host.
