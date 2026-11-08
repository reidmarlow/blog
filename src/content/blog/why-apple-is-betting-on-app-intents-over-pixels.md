---
title: "Why Apple Is Betting on App Intents Over Pixels"
description: "Bloomberg reported Apple CEO John Ternus is pushing Craig Federighi for an agentic Siri overhaul. The technical divide is clear: while competitors burn cloud compute on pixel-scraping Computer Use, Apple's architecture lives and dies on App Intents."
pubDate: 2026-11-09T00:30:00+08:00
tags:
  - apple
  - agents
  - engineering
  - architecture
---

On November 8, 2026, Bloomberg's Mark Gurman reported that Apple CEO John Ternus held a closed-door meeting with software chief Craig Federighi. Ternus pressed Federighi to accelerate Apple's artificial intelligence roadmap and transform Siri from a reactive voice assistant into an autonomous agent capable of executing chained workflows.

The meeting comes on the heels of Apple's fiscal 2026 annual report, filed on November 3. The filing showed research and development spending jumped 32 percent to $45.765 billion, up from $34.550 billion in fiscal 2025. That R&D expenditure grew more than twice as fast as Apple's 15 percent net sales growth, reaching 9.56 percent of revenue. The company attributed the surge to infrastructure and artificial intelligence investments, including data center capacity and specialized silicon.

At the same time, frontier labs have coalesced around a specific pattern for operating system control: Computer Use. Anthropic's Claude Computer Use, OpenAI's ChatGPT Dots, Meta's Muse, and Grok Bot rely on visual language models that inspect screenshots, deduce coordinates, emit simulated mouse clicks, and type into standard graphical interfaces.

Apple is taking a fundamentally different technical path. Instead of running visual models over screen buffers, Apple's agent architecture centers on its native App Intents framework.

The contrast between these two paradigms explains why building consumer agents on mobile devices is an entirely different engineering challenge than building web scrapers in the cloud.

### The computational cost of pixel parsing

Computer Use gained traction because it requires zero cooperation from application developers. If an application runs on an operating system and renders a window, a vision model can theoretically navigate it. An agent looks at a desktop frame, maps pixels to interactive elements, predicts click coordinates, and fires synthetic input events.

For cloud-hosted automation inside disposable virtual machines, that flexibility makes sense. On personal devices, the economics collapse quickly.

Every step in a visual Computer Use loop requires capturing a screen buffer, resizing or tiling the image into patches, and streaming those image tokens into an inference endpoint. A single intermediate action can consume thousands of vision tokens before taking into account reasoning tokens or execution retries. When a task requires ten sequential steps, the round-trip latency easily climbs past fifteen seconds, and the token bill makes continuous consumer use impractical.

Thermal envelopes and battery life compound the problem. Mobile devices cannot sustain continuous high-throughput vision model inference on-device without aggressive throttling. Routing every desktop interaction to remote cloud clusters introduces network latency and privacy exposure that consumer operating systems cannot tolerate.

### How App Intents change the execution loop

App Intents bypass the graphical rendering pipeline entirely. Introduced to replace legacy SiriKit domains, App Intents provide a compile-time, strongly typed interface into an application's internal data structures and functions.

When an application exposes an App Intent, it defines explicit inputs, expected parameter types, runtime conditions, and structured return values in Swift.

For an orchestration model, invoking an App Intent looks like standard function calling rather than GUI automation. Instead of interpreting a 1200x800 image buffer to find a confirmation button, the model outputs a structured JSON payload targeting a specific intent identifier. The operating system handles authentication, validates schema bounds, and dispatches the request directly to the application process.

This programmatic execution loop yields three distinct technical advantages:

Zero vision overhead. The model operates purely over text tokens representing parameter schemas and entity identifiers. Token counts per action drop from thousands of image patches to a few dozen schema tokens.

Deterministic execution. A visual agent can misclick if a button renders three pixels off or if a modal dialog unexpectedly steals focus. An App Intent execution either succeeds with a typed result object or returns an explicit error code that the agent can parse and handle.

Latency. Discarding screen rendering, visual coordinate deduction, and artificial UI pauses reduces single-action execution time from seconds to milliseconds. The action completes at the speed of native IPC.

### Where the App Intents model breaks down

If programmatic intents are faster, cheaper, and more reliable than visual agents, why has Apple struggled to deliver an autonomous agent?

The bottleneck is developer adoption across the long tail.

Computer Use trades efficiency for universal compatibility. A visual agent works on an enterprise accounting tool written in 2008 that will never receive another software update. It works on idiosyncratic internal dashboards, canvas-based web applications, and desktop software with custom widget toolkits.

App Intents require active engineering effort from every third-party developer. While Apple has expanded system intent coverage across Photos, Notes, Reminders, and Mail, third-party support has moved slowly. Gurman noted that while iOS 27.3 brings deeper Siri control to Apple's own apps, comprehensive third-party app integration remains in preview status and is unlikely to mature before spring 2027.

If an application does not expose an intent for a specific action, an intent-driven agent hits a dead end. It cannot fall back to reading the screen unless the operating system also provides a secondary vision-based execution engine.

The second obstacle is orchestration complexity.

Executing a single intent on demand is simple. Running an agent that tracks long-horizon goals across multiple applications requires an orchestrator that can maintain execution state across app switches, recover from partial failures, and handle permission boundaries safely. If an agent executes a three-app sequence and the middle step fails due to missing network connectivity, the system needs deterministic rollback mechanisms so user data is not left in an inconsistent state.

### The workflow changes inside iOS engineering

The strategic urgency is already altering how Apple writes software internally.

Gurman reported that for the M1 milestone of iOS 28 development, Apple reorganized its engineering calendar. Teams historically worked on a rigid eight-week cycle divided evenly between four weeks of feature coding and four weeks of operating system convergence and stabilization.

For the initial iOS 28 milestone, Apple allocated six weeks to coding and exploration, leaving only two weeks for convergence. Internal teams credited productivity improvements from agentic software development tools for allowing the compressed integration window.

That shift matches what other engineering organizations are seeing with agentic tooling. When automated test generation, regression detection, and mechanical refactoring move into agent loops, engineers spend less calendar time on manual stabilization passes.

### The architectural lesson for developers

For developers building agent harnesses, Apple's dilemma illustrates a fundamental rule of agent architecture.

Relying on raw computer vision to operate software is an expensive workaround for missing APIs. It is valuable when automating legacy systems that cannot be modified, but it is an inefficient foundation for applications you control.

Whenever you have authority over the execution environment, investing in structured schemas, typed function boundaries, and deterministic status codes will always beat throwing larger vision models at arbitrary user interfaces. The hardest part of building reliable agents is never the reasoning model. The hardest part is building a predictable runtime that the model can drive without breaking things.
