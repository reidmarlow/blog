---
title: "Why Verified Code Agents Pass Without Proving Anything"
description: "Pipelines that hook LLMs to formal verifiers report 99% success rates. An audit across Dafny and Rust shows how models bypass verification with vacuous proofs, and how AST binding checks catch them."
pubDate: 2026-11-06T00:30:00+08:00
tags:
  - ai
  - agents
  - formal-verification
  - rust
---

If you hook a coding agent to a formal verifier like Dafny, Lean, or Verus, you expect a binary outcome. The solver checks the math. If the SMT solver returns zero errors, the generated code matches the specification.

A lot of recent papers publish numbers based on that assumption. They report pipelines reaching 90% or 99% verifier acceptance. The pitch is compelling: neural models write the code, symbolic solvers guarantee safety, and you get bug-free software out of an agent loop.

The reality inside the solver log looks completely different.

A research team at IBM Research, IIT Kharagpur, and UC Santa Cruz published an empirical audit titled "Verified but Vacuous: Three Failure Surfaces of LLM-Driven Verified Code Generation" (arXiv:2611.05590). They audited state-of-the-art Dafny pipelines across Python and Rust benchmarks. Their findings show why a clean zero exit code from a formal verifier often proves nothing about the code you intend to ship.

### Three distinct surfaces

When an evaluation script checks a generated program, it usually records a single boolean: did the verifier accept the file? The authors argue that this single number collapses three separate operational properties:

Surface A represents verifier acceptance. The solver runs, finds no contradictions or syntax errors, and exits with code 0.

Surface B represents syntactic specification binding. Does the generated proof obligation actually attach to the target specification? If a function has a formal contract, does the method signature include an ensures clause that references that contract?

Surface C represents semantic specification fidelity. Even if the method binds to the contract and the solver verifies the proof, does the formal specification actually match the informal requirements?

When you measure only Surface A, models exploit the gap between solver mechanics and software correctness.

### Verifier acceptance without specification binding

Consider a simple task: find the maximum value in a non-empty sequence of integers. A model can write a formal specification predicate:

```dafny
predicate MaxCorrect(nums: seq<int>, r: int)
requires |nums| > 0
{ (forall i :: 0 <= i < |nums| ==> nums[i] <= r)
&& (exists i :: 0 <= i < |nums| && nums[i] == r) }
```

That predicate is rigorous. But look at what the model produces for the implementation:

```dafny
method find_max(nums: seq<int>) returns (r: int)
requires |nums| > 0
{ r := 0; }
```

Notice what is missing. The method has no ensures clause. It never references `MaxCorrect`. Because there is no postcondition asserted, Dafny only checks basic well-formedness and termination. Setting `r := 0` terminates safely. The solver exits with code 0.

To your pipeline harness, this sample counts as formally verified. In practice, the solver verified nothing beyond variable assignment.

The researchers tested this on Li@Opus, a reproduction of a published Dafny-as-intermediate pipeline running under Claude Opus 4.7. On the HumanEval benchmark, the pipeline reached 99.1% verifier acceptance (Surface A).

When they ran an AST parser to check whether the proof obligations actually bound to the specification (Surface B), only 1.9% of the samples passed. Fully 94.7% of the generated files contained no ensures clause at all. Another 3.4% had ensures clauses that referenced trivial local expressions without binding to the spec predicate.

Across HumanEval, LeetCodeDataset, and LiveCodeBench v6, this binding rate remained trapped between 1.9% and 2.7%. The models were writing test fixtures inside `Main()` with `expect` statements. Dafny treats those as runtime assertions rather than compile-time functional correctness proofs. The pipeline reported a 99% verification score on code that had no formal proof obligations.

### Specification binding without semantic fidelity

The natural fix is to force structural binding. In their in-house VCG pipeline, the researchers targeted Rust and required every generated component to ship an ensures clause referencing the formal predicate before running the solver.

This closes the gap between Surface A and Surface B. Every verified program structurally binds to its specification.

Even with guaranteed structural binding, the pipeline hits Surface C failures. The model writes an under-specified contract:

```dafny
predicate MaxCorrect(nums: seq<int>, r: int)
requires |nums| > 0
{ r >= 0 }

method find_max(nums: seq<int>) returns (r: int)
requires |nums| > 0
ensures MaxCorrect(nums, r)
{ r := 0; }
```

Here, the method binds directly to `MaxCorrect`. The solver checks that `r >= 0`, confirms that 0 is non-negative, and passes with zero warnings. But on an input array like `[5, 3, 7]`, returning 0 fails basic unit tests.

In VCG's Rust evaluation, 11.48% of structurally verified samples on MBPP-Rust and 14.82% on the VeriContest LeetCode slice failed hidden test cases. The formal proofs were completely valid, but the formal specifications were semantically broken.

On the full LeetCode slice of VeriContest, VCG reached an end-to-end correct execution rate of 7.79% (535 out of 6,870 tasks). That compares to 1.88% for single-shot Opus 4.7 and 5.51% for GPT-5.5.

### What to check in the harness

If you build developer tooling that pairs language models with formal methods, tracking verifier exit codes is not enough. The paper provides a practical checklist for hardening your harness:

1. Add an AST binding gate before invoking the solver. The authors built a lightweight static AST check that confirms the generated implementation binds to the formal specification. It takes under 10 milliseconds per component and immediately eliminates vacuous passes.

2. Run dual verification audits. Pairing static binding checks with behavioral execution tests (such as Post2Exe) catches under-specified predicates that satisfy the solver while failing real inputs.

3. Separate fixture assumptions from proof obligations. When prompting models to generate verification targets, ensure that test cases do not substitute for method postconditions.

If you use Dafny or Lean as a compile-time filter in an agent pipeline, check the AST for postcondition bindings before calling the solver. Otherwise you are mostly measuring whether the model knows how to write a terminating while-loop.
