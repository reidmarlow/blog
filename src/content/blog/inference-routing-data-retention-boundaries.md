---
title: "An inference router's privacy setting is a dependency, not a guarantee"
description: "OpenRouter's provider incident shows why LLM applications need an inventory of endpoints, routing policies and sensitive inputs."
pubDate: 2026-11-22T16:15:00Z
tags:
  - ai
  - security
  - llm
  - devtools
---

An LLM application can send every request to one API and still depend on several companies handling its prompts. That makes provider routing a security decision. It also makes an incident harder to scope if your logs record the model name but not the endpoint that processed a request.

On November 22, [OpenRouter said](https://openrouter.ai/blog/announcements/data-processing-incidents-on-inference-providers/) researchers had reported data compromises at certain inference providers or evidence that providers' data policies were not being upheld. OpenRouter said the findings did not show a breach or unauthorized access of OpenRouter itself. It off-boarded three providers and removed 125 endpoints from zero data retention (ZDR) eligibility. That endpoint count includes precautionary removals as well as providers flagged by researchers; it is not a count of confirmed breaches.

The announcement lists separate provider notices and says not all affected providers had posted publicly. OpenRouter says it notified potentially affected customers. The distinction matters if you are trying to determine exposure: the aggregate announcement alone does not establish that a particular request or application was affected.

## Map the actual data path

A model name describes what runs. It does not by itself tell a security reviewer which infrastructure processed each request, what subprocessors were involved, or which retention terms applied at that moment. A router can offer useful routing and data-policy controls, but the practical boundary extends to the chosen inference endpoint and any onward network path.

OpenRouter says it is adapting the researchers' approach for ongoing checks and working on technical verification of network paths to identify cases where requests and responses may be forwarded to third parties. It also says providers must supply appropriate assurances and validation before removed endpoints regain ZDR eligibility. Those are measures in progress, not evidence that every forwarding path has already been verified.

For an application owner, start with a request inventory. For each workload, record the data class, the router and account, the model, the allowed providers or endpoints, and the applicable retention setting. Check whether the router's logs or response metadata can identify the actual endpoint. Record identifiers and timestamps without copying prompts or model outputs into a second sensitive-data store.

## Treat fallback as part of the privacy policy

A fallback route helps availability only if the alternative is acceptable for the data being sent. A support bot handling public documentation and an agent reading customer contracts may need different allowed routes. Define what happens if no compliant endpoint is available: fail the request, queue it, or send a reduced version after an explicit policy decision. Don't assume a retry will preserve the same provider or data-handling conditions; verify the router's behavior and configuration.

Remove credentials and unnecessary personal data before sending a request. For document workflows, extract only the pages or passages needed for the task when possible. That reduces the material exposed to any endpoint; it does not eliminate the need to assess the provider handling it. Keep your own observability pipeline in scope too: request logs, traces and error reports may retain the very content you intended to keep out of model-provider storage.

## Prepare to answer the incident question

When a notice arrives, the useful question is which workloads sent what class of data to which endpoint during the relevant period. Keep routing configuration history and provider notices alongside deployment records so you can narrow that answer. If the router cannot supply per-request endpoint history, document that gap before an incident instead of inferring exposure from model names.

ZDR is a meaningful requirement to set, but a label cannot independently prove how every downstream system behaved. Ask how the policy is verified, how eligibility changes are communicated, and whether your application fails closed when an eligible route disappears. The answer determines what happens the next time an endpoint is removed from the pool.
