# PRD: Judge Trust And Release-Candidate Hardening (Arc)

## Status

Active arc, created in `worktree-hellweek-judge-default` from the latest judged
Hell Week evidence and a full progression review of the work leading up to and
following the OpenAI judge.

This is an **umbrella PRD**. It sequences existing-but-unexecuted specs and three
net-new specs into one coherent arc. It does **not** re-spec the judge-calibration
work items already owned by
[`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md);
it re-prioritises them, corrects their now-stale assumptions (Appendix A), and
adds the workstreams no existing doc owns.

It supersedes the **sequencing** in
[`2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md`](./2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md):
that runway's steps 1-3 (land the judge, fix crisis/medical copy, fix invented
handoff commitments) are done; its step 4 (calibrate the judge) and the stability
proof are now the binding constraint, not step 5 (tune dents).

## Practical Takeaway

The obvious safety blockers are fixed. The build is no longer in "make the bot
safer" mode; it is in "prove the thing that says the bot is safe" mode.

The project did the right thing on the way up: it refused to trust the
deterministic grader until it was fixed (the measurement-integrity runway). It
then made an **unmeasured LLM judge the authoritative release gate** and reported
"0 demo-killers" from a **single** judged run, drawn from a distribution where a
real demo-killer appeared in only 1 of 3 prior runs. That is the same
unmeasured-instrument trap the team already proved it knows how to avoid,
re-introduced one level up.

The next arc closes that loop. In order: lay the cheap correctness foundations
calibration rests on, calibrate the judge against a frozen gold set, harden the
engine guards that even a perfect judge cannot save, then earn the
"safety-cleared" claim with a stability-gated x3 and a live demo smoke. Do **not**
chase the remaining ~23 dents until the gate is trustworthy.

## Why Now: The Constraint Shift

Evidence (verified from run artifacts and code, not asserted):

- Across 7 same-day full runs the verdict swings `blocked <-> needs_work`, with
  demo-killers `{2,3,4,1,2,0,0}` and pass `{80,92,87,90,94,97,99}/122`.
- The x3 stability set `hell-week-stability-x3-2026-06-21T0758Z` shows
  `{stablePass 63, stableFailure 14, recurringFailure 20, oneOffFailure 25}` —
  45/122 scenarios flip, including a **one-off demo-killer**
  (`intake-all-fields-bundle`, demo_killer in 1 of 3 runs).
- The current "0 demo-killers, 99/122" candidate was a **single** judged run.
  The runway PRD itself records "No x3 was run."
- The judge that arbitrates the whole gate is unmeasured: no gold set, anchored to
  each scenario's `severityFloor` (`openaiJudge.ts:117`), and its skeptical
  verifier only re-checks `demo_killer` verdicts (`openaiJudge.ts:169`) — so the
  dangerous direction, a real breach rated `fine`, is never re-examined.
- The deterministic hard floor carried **zero** catches in the green run (all 122
  grades `graderSource: "judge"`), so judge accuracy *is* the entire interim
  safety story.

Conclusion: the binding constraint is judge trust + variance proof. Coverage is
adequate (all 13 dimensions have >=7 scenarios) and the obvious copy blockers are
fixed, so neither is the next dollar.

## The Arc In Four Workstreams

| ID | Workstream | Owner doc | Classification |
| --- | --- | --- | --- |
| **W1** | Calibration foundations (correctness/provenance seams) | [`2026-06-21-calibration-foundations-spec.md`](./2026-06-21-calibration-foundations-spec.md) | blocker (prereq) |
| **W2** | Judge calibration and trust (gold set, de-anchor, mutation probe, symmetric re-check) | [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md) (re-prioritised here; see Appendix A) | keystone |
| **W3** | Engine safety-guard robustness | [`2026-06-21-engine-safety-guard-robustness-spec.md`](./2026-06-21-engine-safety-guard-robustness-spec.md) | blocker (parallel) |
| **W4** | Release-gate stability proof and demo readiness | [`2026-06-21-release-gate-stability-and-demo-readiness-spec.md`](./2026-06-21-release-gate-stability-and-demo-readiness-spec.md) | gate |

## Sequencing And Dependency Graph

```text
            now (parallel)
   W1 foundations ─────────────┐
   W3a cheap guard fixes ──────┤
                               v
                        W2 gold set + calibration  (keystone)
                               │
                               ├─> W2 de-anchor ─> W2 mutation probe
                               │                   (judge-only arm)
                               v
                        W4 encode stability gate
                               │
                               v
                        W4 fresh judged x3 on post-fix build
                               │
                               v
                        W4 live demo smoke ─> share URL
```

Rules:

- **W1 and W3a (the two cheap S guard fixes) start now, in parallel.** Neither
  depends on anything; both unblock or de-risk what follows.
- **W2 gold set is the keystone and the first non-trivial item.** It needs W1's
  triage-label unification so calibration metrics do not silently mis-join two
  label vocabularies.
- **De-anchor (W2) precedes the mutation probe (W2):** the judge-only arm of the
  probe is meaningless while the judge can read the scenario's answer key.
- **W3a's floor fixes precede W4's fresh x3:** running a paid x3 on the un-fixed
  floor burns runs to reconfirm a near-certain blocked verdict.
- **W4's demo smoke is the LAST step before sharing a URL,** not an early one. A
  smoke check on an un-gated engine manufactures false demo-safe confidence.

## Arc Exit Criteria

The arc is done when all of the following hold (each is falsifiable):

1. A frozen gold set exists and a command reports judge agreement-with-labels and
   inter-run self-agreement, weighted toward safety-floor dimensions and the
   missed-breach direction (W2 / trustworthiness PRD item 1).
2. The judge no longer reads each scenario's `expected`/`failureMarkers`/
   `severityFloor`/`watch`/`title`, and account-invention/approval remain
   always-`demo_killer` (W2 / item 6).
3. A mutation probe reports a judge-catch-rate on regex-missed paraphrases (W2 /
   item 7).
4. The verifier re-checks a sample of `fine` safety-floor verdicts, not only
   demo-killers (W2 / item 3).
5. The report records the judge rubric hash and model id; `compare` flags a judge
   change (W1 + trustworthiness PRD item 4).
6. The engine escalates paraphrased crisis input with the strong emergency-services
   copy, and `negatesSelfHarm` no longer force-escalates "not suicidal"; a
   `policy.test.ts` adversarial paraphrase suite locks the guards (W3).
7. `aggregate.ts` cannot emit `ship_ready` without a >=3-run judged stability
   input clearing the (owner-ratified) floor and demo-killer bars, and floor
   "breach" counts dents in floor dimensions (W4).
8. A fresh post-fix judged **x3** on the current build is captured, and a live
   demo smoke of the five critical paths passes through the display boundary
   before any URL is shared (W4).

Until 1-8 hold, "safety gate cleared" is not a claim this project can defend.

## Out Of Scope (owned elsewhere)

- Scenario authoring (slow-boil, linguistic false-positive, indirect injection):
  [`2026-06-20-hell-week-coverage-expansion-spec.md`](./2026-06-20-hell-week-coverage-expansion-spec.md).
  Coverage breadth is not the gap; the grader is.
- Threshold ratification and launch-rung selection:
  [`2026-06-20-customer-facing-agent-acceptance-spec.md`](./2026-06-20-customer-facing-agent-acceptance-spec.md)
  Open Decisions. This arc wires the gate to *consume* ratified numbers; it does
  not set them.
- Comparability warnings, latency capture, hard-floor gate-vs-backstop policy:
  [`2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md`](./2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md).
- Productisation (`ChatService`, widget/site/apply/login surfaces). The demo
  delivery path is already built and tested; further polish does not move the
  gate. W4 includes an explicit scope-freeze on this work.

## Appendix A: Corrections To Inherited Assumptions

The judge-trustworthiness PRD and the raw move list it was synthesised from carry
a few claims this review found stale or wrong. Execute W2 with these corrections,
not the original wording.

- **"Every report is `judged: false`" is stale.** That was true before the OpenAI
  judge landed (`cb7f1c9`). Judged runs now exist; the real gap is "the judge
  runs but its error rate is unmeasured." W2's gold set still squarely addresses
  this.
- **Inter-run disagreement is ~20-28%, not 37-60%.** The higher figure partly came
  from the deleted Claude-workflow judge. Do not overstate the variance; the
  one-off-demo-killer risk stands on its own.
- **Do not claim the judge flips on byte-identical copy.** The observed flips were
  across *different engine runs* (planner non-determinism), which conflates engine
  and judge variance. The gold set's "run the judge N times per *frozen* item"
  design exists precisely to isolate pure judge variance; that is its value.
- **The account-invention/approval carve-out is largely redundant.** `mergeGrade`
  already hard-floors `no_account_invention`/`no_approval_estimate` to
  `demo_killer` before the judge branch (`grade.ts:336-405`,
  `graderSource: "hard_floor"` at `:369`; covered by `grade.test.ts:94-95`). The
  carve-out only adds protection where the regex *misses* a paraphrase — which is
  the mutation probe's domain (item 7). Keep the carve-out as cheap insurance, but
  do not implement it twice (it appears in both items 3 and 6); let de-anchor own
  it. De-anchoring's real value is on the *dent-floor* dimensions, not the
  demo_killer-floor ones the hard floor already covers.
- **Drop the `<0.7` confidence flag.** Across 854 real judge verdicts, zero are
  below 0.7. The flag fires on nothing and advertises a human-review safety net
  that never triggers — false confidence. Keep `confidence` as drill-down only.
  The real instability signal is **cross-run severity disagreement**, which lives
  in W4's multi-run aggregation, not a per-report confidence threshold.
- **Do not promise a judge seed.** The OpenAI Responses path for gpt-5.x reasoning
  models exposes no seed, and temperature is restricted. Manage variance by
  averaging over the N-run gold harness and the x3, not by a determinism knob.
- **The `mergeGrade` hard-floor-overrides-judge test already exists**
  (`grade.test.ts:94-95`). Do not add it as if missing; extend only if a coverage
  gap is found.
- **`hell-week-stability` only aggregates existing runs** (`cli.ts:142`, reads
  `--runs`/`--from-db`); it does not execute the engine or judge. W4's x3
  therefore requires 3 fresh paid full runs + 3 judge passes, then aggregate.
  Budget for it.

## References

- [`2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md`](./2026-06-21T090837Z-hell-week-openai-judge-and-safety-runway.md)
  — the runway this arc continues; steps 1-3 done.
- [`2026-06-20-hell-week-judge-trustworthiness-prd.md`](./2026-06-20-hell-week-judge-trustworthiness-prd.md)
  — canonical spec for the W2 judge-calibration items.
- [`2026-06-20-customer-facing-agent-acceptance-spec.md`](./2026-06-20-customer-facing-agent-acceptance-spec.md)
  — the two-bar gate and the >=3-run stability requirement W4 enforces.
- [`2026-06-21-calibration-foundations-spec.md`](./2026-06-21-calibration-foundations-spec.md)
  — W1.
- [`2026-06-21-engine-safety-guard-robustness-spec.md`](./2026-06-21-engine-safety-guard-robustness-spec.md)
  — W3.
- [`2026-06-21-release-gate-stability-and-demo-readiness-spec.md`](./2026-06-21-release-gate-stability-and-demo-readiness-spec.md)
  — W4.
