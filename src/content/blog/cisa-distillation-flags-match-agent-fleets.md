---
title: "CISA's Distillation Detector Also Flags a Shared API Key"
description: "On 8 September NSA, CISA, and FBI published AA26-251A. The behavioral flags include 24/7 usage, maxed new accounts, and one subscription hit from many IPs."
pubDate: 2026-09-11T02:50:00+08:00
tags:
  - ai
  - agents
  - security
  - apis
---

On 8 September 2026 the NSA, CISA, and FBI published [joint advisory AA26-251A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-251a). They say six China-based companies (DeepSeek, Moonshot AI, Alibaba, MiniMax, StepFun, and Z.AI) ran industrial-scale knowledge distillation against U.S. frontier models from at least late 2024. The named families are Claude, GPT, Gemini, and Grok. Volume, in their words, is billions of tokens across millions of exchanges.

Knowledge distillation itself is ordinary. You query a teacher, keep the traces, train a student. The advisory is about doing that at industrial volume against terms of use, then hiding the traffic.

The access path is the part I would copy into an ops note. Requests go out through native APIs, cloud endpoints, and third-party aggregators that strip user metadata. A gray market of API proxies, which they call transfer stations, resells frontier access past geographic blocks and at a fraction of list price. Cost is further cut by buying premium subscriptions in bulk and sharing them across a team. StepFun ran pools of accounts with employees on multiple concurrent sessions, and daily budgets per automated agent started moderate then scaled.

They wanted the hidden chain of thought. DeepSeek used prompts that tell a model to imagine the internal reasoning behind a finished reply and write it out step by step. That is useful student data for coding, proofs, and agent tool use. MiniMax retargeted a new Claude model within 24 hours of release. MiniMax also used Claude Code internally, then tried prompt injections so Claude Code would treat itself as a MiniMax product.

CISA's detection list is short:

- one subscription used from many IPs and user agents
- 24/7 traffic with no idle period that looks like a person
- a weird subscription-to-usage ratio
- a brand-new account that immediately sits at maximum throughput

That is also a description of a production agent fleet on one company key. A CI job, a support bot, and a nightly eval harness will do all four if you never split credentials.

For high-confidence distillation traffic, the labs are told to change the output without sending a notice. Shorter reasoning. Correct answers with different traces. Occasional style noise. Sometimes a less capable model. The advisory says a distiller who learns about the swap will throw the batch away. Safety researchers should be told. Distillers should not.

If your fleet has already been bucketed with the proxy pools, you may already be scoring a weaker model and have no ticket for it. I have not seen a public confirmation that any consumer key was swapped this week. The advisory still tells providers to do it.

What I would change today, without waiting for a lab dashboard.

Give each service its own key. A shared Plus seat used from a laptop, a CI runner, and a VPS is the first bullet on their list. Log the model id the API returns, if it returns one, next to a handful of frozen canary prompts you already trust. If reasoning depth on those prompts drops and your code did not pin a cheaper model, assume the other end moved. Keep outputs out of any training set you do not own. OpenAI, Anthropic, and Google already ban that in the terms. The advisory is the enforcement mood catching up.

I would not treat this as proof that every cheap open-weight model is a stolen clone. CISA is describing a traffic pattern and a ToS fight. DeepSeek's public $5.6 million V3 training figure is called misleading here because it leaves out the cost of the teacher traces. That is an accounting claim, not a weight dump.

The PDF is on [media.defense.gov](https://media.defense.gov/2026/Sep/08/2003992823/-1/-1/0/CSA_CHINA_BASED_AI_COMPANIES_MALICIOUS_DISTILLATION_AGAINST_US.PDF). Novel TTP 1 is the detection list. Split the dotenv before you add a fourth agent.
