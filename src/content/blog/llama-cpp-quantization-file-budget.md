---
title: "llama.cpp can now quantize to a file-size budget"
description: "Target a GGUF size or average bits per weight, then check quality and runtime memory before deploying."
pubDate: 2026-11-25
tags: ["llama.cpp", "local AI", "quantization"]
---

A model that nearly fits in GPU memory can leave you choosing between a smaller quant and partial CPU offload. The labels on existing GGUF files don't tell you exactly how much space each model will take, either: the same quantization preset can yield different average bits per weight across architectures.

[llama.cpp release b12669](https://github.com/ggml-org/llama.cpp/releases/tag/b12669) adds another option to `llama-quantize`: specify a target file size or average bits per weight and let it choose a mix of tensor quantization types. It's useful when you have a specific storage budget or want a controlled size comparison between models.

## How the budget is allocated

The [implementation pull request](https://github.com/ggml-org/llama.cpp/pull/15550) describes sampling rows from each eligible tensor, estimating quantization error across candidate types, and choosing a mix under the overall budget. A tensor that loses more from compression can get more bits; another can get fewer. The optimizer uses an importance matrix with activation statistics, so generating a suitable `imatrix.gguf` is part of the preparation.

The release's [quantization guide](https://github.com/ggml-org/llama.cpp/blob/b12669/tools/quantize/README.md) gives this example for a size target:

```bash
./llama-quantize --target-size 1.5g --state-file my-state-file.dat --imatrix imatrix.gguf input-model-f32.gguf output-model.gguf
```

For comparisons at an average bit budget, use `--target-bpw` instead. The state file saves the expensive target computations, letting a later run reuse them. The guide also documents `--target-exclude` for excluding quantization types; that option prevents writing a state checkpoint. Explicit tensor-type overrides stay fixed and count against the budget, and an impossible remaining budget causes quantization to fail.

## What the numbers do and don't say

The pull request reports 238 tests across 34 models: 195 wins, 26 ties, 16 losses and one unavailable result against standard quantization, using Kullback-Leibler divergence as the comparison metric. The authors count wins and ties as 93% of tests. One model, mamba-2.8b-hf, lost at every listed setting. These are the contributors' results for their test setup, not a promise that every application will improve.

The optimizer estimates tensor error; it doesn't directly optimize your application score. The PR also says the initial optimization can take five to ten times longer than standard quantization. Keeping the state file is worthwhile if you intend to try multiple targets, but the extra preparation may not pay off for a one-off model.

## Leave room beyond the GGUF

A file-size target is a disk budget, not a guarantee that inference fits in the same amount of VRAM. Runtime allocations, including the KV cache and compute buffers, need space too; context length and offloading choices affect the result. Pick a target below available memory, run the actual workload, and measure peak use before increasing it.

For a fair comparison, keep the source model, evaluation prompts, context settings and runtime version fixed. Compare the resulting file size and task quality with an existing quant, then check throughput and memory on the hardware that will serve it. A lower divergence score is useful evidence, but it won't tell you whether your coding assistant still passes its tests.
