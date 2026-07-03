# PRD: Hell Week Measurement Integrity And Sequential Fix Runway

## Status

Draft handoff for the current `hell-week-performance-regression` worktree.
Needs triage before implementation. Work should run sequentially in this
checkout so fixes, evidence artifacts, and git attribution stay readable.

## Problem Statement

The Hell Week regression question has moved from "did the engine get worse?" to
"is the measurement layer telling the truth?"

The same captured post-malformed-recovery evidence regrades from `80/122`,
`80/122`, and `79/122` to roughly `93/122`, `95/122`, and `93/122` after fixing
route/action-envelope contracts for human-support and prompt-injection cases.
That proves much of the apparent drop was a deterministic-rubric artifact, not
a confirmed product regression.

However, the deterministic regrade must not become a new trusted truth by
itself. Hell Week's design says deterministic envelopes are advisory except for
the hard safety floor, and the independent judge is the audit layer that keeps
rubric edits honest. The project now needs a sequential runway that separates:

- judging whether the F/I rubric loosening hid any real customer-visible dents;
- improving compare/stability tooling so incompatible runs are not over-read;
- fixing a real engine state leak around persisted safety flags;
- deciding how load-bearing the deterministic hard floor is;
- adding runtime measurement that distinguishes scenario wall time, signal
  latency, and planner latency;
- cleaning noisy or dead deterministic checks without reintroducing brittle
  route tests.

## Solution

Run a sequential evidence-and-fix program in this worktree.

First, audit the current F/I rubric change with judge verdicts over one current
captured run and the relevant high baseline. Then update the regression report
to state clearly that the old deterministic score drop was fake, while the new
deterministic regrade is still not authoritative product truth.

Second, make the Hell Week comparison and stability tools comparability-aware.
They should surface profile, scenario-set, planner model, planner prompt,
signal prompt, policy version, and judged-state mismatches before producing a
recommendation.

Third, fix the known engine state leak with a failing-then-passing test: an
answer turn that clears handoff-route flags in the trace must not keep stale
handoff flags in persisted conversation state.

Fourth, harden or explicitly scope the deterministic safety floor. If
deterministic-only runs are ever treated as go/no-go, the hard floor must catch
more paraphrases. If judged runs are mandatory for go/no-go, the hard floor can
remain defense-in-depth rather than chasing every wording variant.

Finally, add performance measurement where it matters: scenario wall time,
signal-extractor latency, and planner latency. Use those measurements in
comparison output with variance warnings rather than reading a single run's
duration as a regression.

## Sequential Run Order

1. Run the judge audit for the F/I rubric loosening.
2. Write and fix the safety-flag state-leak regression test.
3. Add comparability warnings to compare and stability reports.
4. Update the regression report from captured evidence, judge verdicts, and
   comparability-aware comparison output.
5. Revisit category G only after the judge confirms the F/I rubric edit did not
   hide real safety dents.
6. Decide deterministic hard-floor policy, then add the minimum adversarial
   hard-floor tests implied by that policy.
7. Add planner-latency capture and roll up scenario wall time, signal latency,
   and planner latency in reports.
8. Clean dead or noisy deterministic helpers after the core evidence path is
   trustworthy.

## User Stories

1. As the prototype owner, I want the F/I rubric loosening judged independently,
   so that a higher deterministic score does not hide real customer-visible
   failures.
2. As the prototype owner, I want the regression report to explain why `80/80/79`
   was misleading, so that future tuning is not driven by fake movement.
3. As the prototype owner, I want the report to avoid treating `93/95/93` as
   authoritative truth, so that the project does not replace one noisy number
   with another.
4. As an operator, I want compare output to warn when runs differ by model,
   prompt, policy, profile, scenario set, or judged state, so that incompatible
   runs are not called clean regressions.
5. As an operator, I want stability output to preserve the same comparability
   metadata, so that repeated-run classification is trustworthy.
6. As an engineer, I want stale handoff-route safety flags cleared from persisted
   state after safe answer turns, so that a public FAQ does not keep re-forcing
   handoff.
7. As an engineer, I want a regression test for the state leak before changing
   the engine, so that the bug is proven rather than assumed.
8. As a reviewer, I want hard-floor wording gaps made explicit, so that the team
   can decide whether deterministic-only grading is a gate or a backstop.
9. As a compliance reviewer, I want forbidden credential and account-invention
   paraphrases covered when the deterministic floor is load-bearing, so that
   obvious unsafe wording does not pass without a judge.
10. As an operator, I want planner latency captured separately from signal
    latency and scenario wall time, so that API jitter is not confused with a
    product performance regression.
11. As a future maintainer, I want category G loosened only after evidence shows
    its failures are fake route/action constraints, so that excluded-advice
    safety is not weakened by score chasing.
12. As a future maintainer, I want dead and noisy deterministic helpers removed
    only after higher-priority evidence work is complete, so that cleanup does
    not distract from the regression decision.

## Implementation Decisions

- Execute the runway sequentially in the current worktree; do not split into
  parallel workers unless a later branch/worktree is created for disjoint work.
- Treat judge verdicts as the audit of rubric edits, not as a cosmetic
  stakeholder step.
- Keep deterministic score movement framed as evidence about the rubric, not as
  product-quality truth.
- Extend compare and stability normalization to include model, prompt, policy,
  profile, scenario-set, signal configuration, and judged-state metadata.
- Emit soft comparability warnings instead of blocking all comparisons; the user
  may still want exploratory movement from imperfect runs.
- Fix the state leak at the conversation-state boundary, preserving trace
  behavior and avoiding broad routing refactors.
- Make the hard-floor policy explicit before expanding regex coverage.
- Prefer small adversarial hard-floor examples over a large wording matrix.
- Capture planner latency at the turn evidence boundary so aggregate and compare
  reports can use it without parsing logs.
- Keep category G follow-up constrained to route/action-envelope contract
  mismatches; do not relax content checks against excluded advice.
- Keep retriever additions limited to deterministic helper behavior; do not add
  full-corpus route-pinning tests.

## Testing Decisions

- Use a judged current run and a judged baseline as the evidence gate for the
  F/I rubric audit.
- Use captured evidence regrade only as a no-model sanity check; do not present
  it as judge-equivalent proof.
- Add focused unit coverage for comparability warnings in compare output.
- Add focused unit coverage for stability metadata mismatch reporting.
- Add an engine-level regression test for stale handoff-route safety flags
  persisting after a safe answer turn.
- Add hard-floor tests for at least one forbidden-credential paraphrase and one
  account-value paraphrase before changing those patterns.
- Add report-level tests for planner-latency aggregation when latency is present,
  missing, and partially missing.
- Verify any runtime evidence changes with existing Hell Week smoke or captured
  re-render paths before spending full live-model budget.
- Do not add brittle full-corpus route tests as a substitute for live Hell Week
  or judge evidence.

## Acceptance Criteria

- The regression report states whether the apparent regression is confirmed,
  mixed, inconclusive, or a measurement artifact.
- The report clearly separates original deterministic scores, current-source
  deterministic regrade, and judge-authoritative verdicts.
- F/I rubric edits are audited by judge verdicts before being treated as
  accepted measurement changes.
- Compare output warns on model, prompt, policy, profile, scenario-set, and
  judged-state mismatch.
- Stability output carries equivalent comparability warnings or metadata.
- The state-leak regression test fails before the engine fix and passes after.
- Hard-floor tests document the chosen gate-versus-backstop policy.
- Runtime reports separate scenario wall time, signal latency, and planner
  latency.
- Category G is not loosened until evidence shows the failures are fake
  route/action constraints rather than real excluded-advice misses.
- Cleanup items do not change customer-visible routing behavior.

## Out of Scope

- Broad planner prompt tuning.
- Large retrieval rewrites.
- Full-corpus route-pinning tests.
- Treating deterministic-only pass count as release truth.
- Relaxing hard content checks for forbidden credentials, account invention,
  internal-data leaks, or approval estimates.
- Running parallel workers inside this same worktree.
- Publishing raw customer or secret data.

## Further Notes

The useful correction from the latest review is that the judge should move up in
priority. It is not merely a slow stakeholder polish step; it is the independent
audit that tells whether rubric loosening removed fake constraints or hid real
dents.

The useful correction from the regrade is that the old `80/80/79` narrative was
not a reliable product-regression claim. It was largely a contract mismatch in
the measurement layer. The next implementation work should keep that distinction
visible.
