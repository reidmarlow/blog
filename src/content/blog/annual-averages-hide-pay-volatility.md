---
title: "Annual averages hide the months when pay falls short"
description: "A payroll study shows why income tools need to account for month-to-month variation, not just annual earnings."
pubDate: 2026-11-23
tags: [data, economics, software]
---

A budgeting app can calculate an accurate annual income and still give someone a dangerously optimistic picture of next month's cash. If a worker earns $3,000 in one month and $2,000 the next, a $2,500 average doesn't tell them whether rent is covered in the second month.

That example is illustrative. The underlying problem appears in [Earnings Instability](https://doi.org/10.1093/qje/qjag059), a paper by Peter Ganong, Pascal Noel, Christina Patterson, Joseph Vavra and Alexander Weinberg published online in the *Quarterly Journal of Economics* on November 17, 2026. Its [public working-paper version](https://www.nber.org/papers/w34227), revised in July 2026, uses payroll and bank-account data to examine earnings changes within continuing jobs.

The authors find substantial month-to-month variation, especially for hourly workers. Their paper is about the US labor market, not software design. But anyone building tools that turn financial histories into a single income number should pay attention to what disappears during aggregation.

## The stable hourly rate with an unstable paycheck

In the working paper's payroll data, pay differs from the previous month in roughly three quarters of months. The median absolute month-to-month change is 5%; in a quarter of months, the change is at least 17%. Those figures describe changes in either direction, not the probability of a pay cut.

Hourly workers see larger changes. The median change for them is 9%, and a quarter of monthly changes are at least 21%. The authors attribute most hourly earnings volatility to hours rather than changes in hourly wages. A worker can keep the same job and hourly rate while their pay changes because their hours do.

Annual totals can conceal a drop followed by a recovery. They also cannot say whether the lower month arrived when a bill was due. In the paper, the authors combine a payroll processor's data on wages, hours and firms with de-identified bank data on pay deposits, spending and liquidity. Those sources answer different questions: payroll helps explain the change in earnings; the bank data help examine what happens to spending.

The firm-level analysis suggests changes in total hours at firms can explain at least half of a typical worker's hours volatility. The authors use two approaches, including workers moving between firms with different levels of hours volatility. They also find spending volatility increases when workers move to firms with more volatile earnings, with larger effects for workers with low liquidity. Their job-separation analysis has a qualification: the authors cannot completely separate earnings volatility from other unobserved features of less desirable jobs.

## What to change in an income dashboard

If you're building a cash-flow view, keep the monthly observations alongside the annual total. A useful first version could show the last twelve monthly receipts, the median, and the lowest month. Put the expected bill date next to the balance available at that time. For a forecast, show a range derived from observed months rather than displaying the average as a guaranteed deposit.

Those choices have limits. Past pay isn't a promise about the next paycheck, and a low month may reflect a change in job, leave, deposit timing or incomplete data. Label those possibilities rather than quietly filling gaps with zeroes. The study concentrates on continuing jobs, so its estimates should not be presented as a full measure of risk from unemployment or job transitions.

There's also a privacy decision. Monthly deposits and balances reveal more about a person than a yearly aggregate. Keep the detailed data only as long as the feature needs it, and be explicit about what is stored and shared.

A single annual number is convenient for a report. For a household trying to decide whether it can pay a bill on the 15th, the sequence of deposits and expenses is the useful part.
