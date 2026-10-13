---
title: "Why Payment Rails Cannot Let Autonomous Agents Carry Raw Credit Cards"
description: "American Express launched an Intent Intelligence Framework at TechCrunch Disrupt to stop AI agents from misfiring on checkout. The real problem isn't hallucinated sizes; it's handing unrestricted credit cards to non-deterministic loops."
pubDate: 2026-10-14T00:25:00+08:00
tags:
  - ai
  - agents
  - payments
  - security
---

At TechCrunch Disrupt 2026, American Express announced what it calls the Intent Intelligence Framework. Part of their Agentic Commerce Experiences developer toolkit, the system introduces a two-step validation model: an agent captures customer purchase intent through a Create Intent API, prompts the user to authenticate the exact constraints, and exchanges that signed payload for an ephemeral Proof of Intent Token and a single-purpose digital payment credential.

The public pitch from Amex VP Hannah Bozian focuses on retail errors. A user asks for white Nike sneakers in size 9, the agent hallucinates and attempts to check out a pair of Adidas trainers, and the payment rail drops the transaction because the merchant constraint mismatched the signed intent token.

Preventing mistyped sneaker orders sounds like consumer convenience. The underlying engineering problem is much harsher.

Most developers experimenting with agentic commerce still treat autonomous checkout as browser automation with a stored corporate card. They give a language model an active session, a headless Chromium instance or an MCP tool definition, and access to a real primary account number. Then they hope the prompt holds.

### The flaw of the raw credit card

A traditional credit card is a broad authorization instrument. Once a merchant receives a valid card number, expiration date, and CVV, the card network assumes the cardholder intended to charge the full amount requested by that merchant, up to the card's general credit limit.

Software engineers spent three decades wrapping credit cards in user interfaces specifically designed to prevent accidental submissions. We added confirmation modals, order review screens, address verification steps, and two-factor SMS codes. Every layer existed to guarantee that a human looked at a specific line-item total before submitting payment.

Autonomous agents bypass that entire human-in-the-loop assumption. When an agent runs, it evaluates a prompt, decomposes goals into tool calls, navigates an API or a DOM tree, and executes network requests.

If that agent holds a raw card credential, the blast radius is the entire credit limit on the card. A reasoning slip during checkout, an unexpected currency conversion on a supplier portal, or an adversarial prompt injection embedded inside an unauthenticated product review can turn a $40 purchase into a $4,000 charge.

Once the transaction clears the merchant processor, the card network cannot tell whether the payload originated from a human click or a looping agent that misunderstood a shipping tier.

### Intent tokens as hardware enclaves for payments

The architecture Amex is proposing moves payment authorization from post-facto dispute resolution into pre-flight cryptographic binding.

Instead of handing the agent a durable payment method, the workflow looks like this:

1. The user asks the agent to procure an item with explicit boundaries: merchant, item description, maximum unit price, and total budget cap.
2. The agent packages those parameters into a structured schema via the Create Intent API.
3. The human cardholder signs off on the parsed parameters through an authenticated challenge.
4. The card network issues an Intent ID and an ephemeral Proof of Intent Token bound strictly to those specific constraints.
5. The checkout service presents the token to the payment gateway, which mints a single-use payment token that only authorizes against the matching merchant and dollar amount.

If the agent tries to buy from an unauthorized domain, exceeds the price cap by ten dollars, or attempts to reuse the credential on a subsequent turn, the rail rejects the authorization code at the network layer.

The language model never sees raw PAN data. More importantly, the model cannot escalate its own purchasing budget regardless of how convoluted its scratchpad reasoning gets.

### Scoped capabilities beat system prompts

For anyone building autonomous workflows, this pattern should look familiar. It is the principle of least privilege implemented for capital allocation.

In 2024, early agent frameworks tried to enforce tool boundaries using system prompt instructions: *You are a helpful assistant. Never spend more than $50 without asking.* Predictably, prompt injections, context window exhaustion, and complex multi-agent debates blew past those instructions within days.

Reliable systems don't trust the model to police its own tool parameters. If an agent shouldn't delete a database table, you don't instruct it to be careful; you revoke `DROP TABLE` permissions from the database role.

Payment infrastructure is finally catching up to the same realization. Language models are non-deterministic runtime environments. You cannot enforce financial compliance by asking a probabilistic token predictor to behave itself.

If an agent is going to spend money in production, the spending limit must be enforced by the payment rail before the packet reaches the merchant ledger. Everything else is just hoping your context window doesn't hallucinate your operating cash away.
