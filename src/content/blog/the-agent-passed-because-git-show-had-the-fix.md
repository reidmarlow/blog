---
title: "The Agent Passed SWE-Bench Pro Because git show Still Had the Fix"
description: "On 8 September Shanghai AI Lab posted SWE-Bench Pro Verified. GLM-5.2 falls from 78.80% to 57.32% once the gold patch leaves the sandbox."
pubDate: 2026-09-11T03:30:00+08:00
tags:
  - ai
  - agents
  - evals
  - software-engineering
---

On 8 September 2026 a Shanghai AI Lab group with East China Normal University posted [SWE-Bench Pro Verified](https://arxiv.org/abs/2609.08149) on arXiv as 2609.08149. They keep the 731 SWE-Bench Pro tasks and change the sandbox. Each repo is rebuilt as a single commit. Hidden tests leave the workspace. The instance id is hashed so it no longer carries a SHA. GitHub, GitLab, Gitee, Bitbucket, and raw-content hosts are blocked. They also edit 102 tasks whose prompts and tests disagreed.

GLM-5.2 is the number people will quote. On the original SWE-Bench Pro harness it scores 78.80%. After the sandbox lock, 57.32%. After the 102 task edits, 59.51%. DeepSeek-V4-Pro barely moves. 49.98%, then 49.11%, then 49.93%. Same 731 tasks, same mini-swe-agent harness, same AgentCompass runner.

That 21.48 point gap on GLM-5.2 is a leak count. Trajectory audit found local answer-file access on 103 tasks and network answer-file access on 49. After the controls, both counts are zero. Of 186 passes that flipped to fails, they tagged 166 as direct evidence the pass had used leaked files, 3 as highly probable, 0 as broken normal execution, and 17 as noise. `git show` of a SHA went from 2,108 operations across 326 tasks to zero. Hits on `raw.githubusercontent.com` went from 318 operations on 54 tasks to one leftover.

The Ansible case is the one I would paste into a review. The task is `async_wrapper.py` on ansible/ansible. The old instance id still contained the target SHA `39bd8b99ec`. In the model's own reasoning it noted those commits sat in the full-branch log, which meant they might be future commits, and it should look at them for guidance. Then it ran:

```
cd /app && \
git show 39bd8b99ec:lib/ansible/modules/async_wrapper.py \
  > /tmp/golden_async_wrapper.py && \
diff /tmp/golden_async_wrapper.py lib/ansible/modules/async_wrapper.py
```

The sandbox printed `IDENTICAL TO GOLDEN PATCH`. The model applied that file and passed.

A Teleport device-enrollment task had seven complete reference files sitting under `/tmp/gold`. The model copied them into `/app` and submitted. A Flipt config change went out over the network. `curl` of `raw.githubusercontent.com/flipt-io/flipt/<sha>/internal/config/ui.go`, then a note that it now had the exact PR implementation.

Cleaning branch refs still leaves later commits in `.git/objects`. A GitHub block still leaves GitLab. One Vuls run switched hosts after GitHub refused the connection.

They also repaired 102 tasks. 75 of those failed because tests asserted strings, types, or order the prompt never named. 22 had a prompt that pointed at the wrong flag. One Ansible Galaxy login task told the agent to mention `--token`. The hidden test required the error to start with `--api-key`. After those edits, GLM-5.2 picked up 21 of the 102 as new passes. That recovery sits on the 57% base. The 21-point leak stays gone.

If you publish a coding-agent leaderboard, the eval container needs a fresh single-commit tree, gold patches and hidden tests out of the workspace, an instance id that does not contain a SHA, and outbound code hosts blocked. Then read one failing trajectory before you quote the percentage. The dataset is [opencompass/SWEBench-Pro-Verified](https://huggingface.co/datasets/opencompass/SWEBench-Pro-Verified) on Hugging Face. Harness notes are in [open-compass/AgentCompass](https://github.com/open-compass/AgentCompass).

I would stop citing GLM-5.2 at 79% as a coding result. Quote DeepSeek-V4-Pro near 50% if you want a number that survived the gold files leaving the box.
