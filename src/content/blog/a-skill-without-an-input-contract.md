---
title: "A Skill Without an Input Contract Should Stay in the Parent Agent"
description: "Microsoft Research's SkillsBench study finds subagents beat inline SKILL.md loading only after the package names its inputs and outputs."
pubDate: 2026-09-11T00:40:00+08:00
tags:
  - ai
  - agents
  - devtools
---

Microsoft Research Cambridge and Cornell posted arXiv 2609.09233 on 7 September 2026. The paper compares two ways to run the same skill package on long-horizon tasks. One loads SKILL.md into the main agent. The other starts a child agent with that file and a bounded input, then returns only the last reply.

If you use Claude Code, Codex, or most tool-calling harnesses, you already have both knobs. The common habit is the first one. The agent "uses a skill" by pasting the markdown into the same window that already holds the ticket, the tool JSON, and a few failed attempts. The paper calls that agent-skill execution. Subagent execution is the child-window version.

I had been treating child agents as a wall-clock trick. Overlap independent work, finish sooner. This paper treats them as a peak-context trick. They care about the tallest window any one policy has to read, because that is where reasoning quality drops.

## Same files, two execution modes

The testbed is SkillsBench: 87 long-horizon tasks, each shipped with human-authored skill packages, run through OpenHands. Those curated files usually describe useful knowledge. They rarely name the expected input or the promised output.

On that original set, inline skills matched or beat subagents on every model in the study. That result is easy to miss if you only quote the later chart.

They then built a second library. GPT-5.3 Codex ran the tasks. Successful traces were turned, with Copilot CLI, into procedural packages that declare an input contract and an output contract. They got those packages for 64 of the 87 tasks. On that subset, subagents win. The gap is largest on smaller models, which fits a bandwidth story more than a missing-knowledge story.

So the ranking is conditional. A notes file belongs in the parent, because the child cannot see the rest of the job. A procedure that says "give me X, I return Y" can leave the parent. The parent keeps the interface. The child keeps the recipe.

## Peak context versus the token bill

They also appended unused tool descriptions to mimic a fat MCP menu. Subagent accuracy fell off slower as that junk grew. For GPT-5.3 Codex and Kimi K2.6, the child-window setup cut peak context on more than 80% of tasks. Total tokens moved the other direction. The parent has to restate enough state for the child to work, so you pay more even when the tallest window is shorter.

Weaker models scramble the peak-context chart. Inline runs often stop early, so the window stays short because the agent quit, not because the design was tight. Peak length is only comparable on models that finish both modes.

Claude Code already documents subagents. In practice they get spawned to overlap work. They rarely get bound to a skill package as the way that knowledge actually runs.

## Where isolation breaks

A child window cannot mix two recipes in one head. If a subtask needs the PDF procedure and the vuln-scan procedure together, splitting them is the wrong cut. The appendix is more useful than the headline ranking here. On a hierarchical skill library with Qwen3.5-9B, the best setup was hybrid. Routing nodes stay in the parent (they are a menu, not a contract). Leaf skills, the ones with a procedure and an I/O contract, run as children.

I would copy that split before copying any accuracy delta. Write leaf skills like functions. Keep the router in the parent. Stop dumping every SKILL.md into the transcript that is already full of tool output.

If you cannot name the input and the output in one sentence, keep the file in the parent, or rewrite the file first.
