---
title: "Self-hosting small models hits the ingress bottleneck before the GPU"
description: "Benchmarking a 400M parameter encoder on Modal shows where self-hosted micro-models actually choke: the web framework and concurrency limits, not tensor cores."
pubDate: 2026-09-19
tags: ["ai", "infrastructure", "python", "modal", "performance"]
---

Logan Markewich put out an open-source drop-in replacement for TypeSafe's jev API called jeff. It wraps a 400-million parameter GLiFormer encoder in a FastAPI server, targeting single-token classification, structured scoring, and binary probability checks. 

The immediate draw for an indie setup is cost. Running a 400M model on an L4 instance should theoretically wipe the floor with managed proprietary pricing. But when you look at the benchmark numbers Logan published from stress-testing it on Modal, the hardware story inverts. 

The bottleneck isn't the GPU. You hit web ingress and ASGI serialization ceilings long before you saturate the silicon.

### Where the milliseconds actually go

In a standard local setup, a small encoder model is blistering fast. On a laptop with a modern GPU, running batch size 1 across a 150-token payload takes about 28 milliseconds of compute. When you deploy that same checkpoint behind a managed container service like Modal, the wall-clock latency for a client in North America lands around 440 milliseconds.

Breaking down the trace shows where that budget disappears:

- ~165 ms in Modal's external ingress round-trip
- ~50 ms for the ASGI body delivery into the worker container
- 20 ms in the dynamic request batching window
- 28 ms to 45 ms of actual model forward execution (depending on whether you pick an A10G or an L4)

The model itself accounts for roughly 10 percent of the total turnaround time. Everything else is network transport, container proxying, and HTTP overhead. 

Even worse is the concurrency ceiling. A single container serving a zero-compute health check endpoint topped out at 100 requests per second. Adding the model dropped the container's throughput to 50 requests per second, with batch sizes lingering between 1 and 3. Swapping the L4 for a faster A10G didn't move that 50 req/s ceiling by a single frame, because the GPU was mostly idling while waiting for the web worker to feed it.

### The economics of the idle floor

This creates an awkward economic tradeoff if you are trying to cut inference bills.

If you scale your deployment by spinning up more container replicas to bypass the per-container ingress limit, your costs track the container runtime, not GPU utilization. On an L4 instance at list price, an idle container costs about $0.80 an hour. At the 50 req/s ingress cap, processing 150-token classification requests runs roughly $0.030 per million tokens. 

That barely undercuts managed hosted APIs, which hover around $0.042 per million tokens, while handing you all the maintenance overhead of managing cold starts and container autoscaling.

The raw math only makes sense if you break past the web layer. If you strip out the HTTP ingress entirely (calling the backend workers directly via native function RPCs), throughput jumps from 27,000 tokens per second on an L4 up to 120,000 tokens per second on an H100. That drops the effective price down to under a penny per million tokens. 

### Why compiler optimizations didn't save the batch

The engineering notes in the repository also highlight a trap that catches a lot of developers optimizing PyTorch workloads: `torch.compile` is not a magic speed switch.

GLiFormer uses custom FlashDeBERTa attention kernels. When the team attempted to run `torch.compile` over the graph, Inductor choked on the disentangled attention Triton kernels due to loop-carried type discrepancies between fp32 and fp64. Excluding those kernels caused graph breaks on every transformer layer. Torch Dynamo hit its recompile limit and backed out, which actually doubled batch-1 latency from 45 ms to 100 ms. 

Eager execution with custom flash kernels ended up 1.5x to 2.7x faster than trying to force the compiler to trace the whole pipeline.

Furthermore, profiling the 35 ms forward pass on an A10G showed that small-matrix multiplications across the 24-layer encoder took 54 percent of the time, while the post-encoder bidirectional LSTM consumed another 21 percent. Flash attention was only 4 percent of the runtime. At small sequence lengths, attention math isn't the problem. You are bounded by matrix multiplication dispatch overhead and sequential recurrent layers.

### The takeaway for self-hosted tooling

If you are replacing commercial classification APIs with self-hosted sub-billion parameter models, stop obsessing over tensor core specs and GPU tiers. 

Putting an A100 behind a standard REST endpoint to run single-digit batch sentiment classification is throwing cash into an idle loop. Until you bypass the ASGI serialization path, use binary RPCs, or co-locate your agent loops inside the same private cluster, the network stack will eat your savings before the tensor cores ever wake up.
