# Hell Week Measurement Integrity Runway Log

## Scope

This log tracks the implementation slices for
`docs/prds/2026-06-20-hell-week-measurement-integrity-sequential-runway-prd.md`
in the `hell-week-performance-regression` worktree.

## Section 1: F/I Rubric Audit

### Finding

The local evidence bundle exists under:

```text
artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/
```

The ignored artifact note
`contract-regrade-after-envelope-fix.md` says the same captured evidence moves
from `80/122`, `80/122`, `79/122` to `93/122`, `95/122`, `93/122` after the
Category F and I envelope repair.

The run folders contain `judge-queue.jsonl`, but no judge-verdict output file
was present in this checkout. That means the deterministic regrade can support
the measurement-artifact hypothesis, but it cannot be treated as judge-accepted
product truth yet.

### Conclusion

The F/I contract repair is appropriate as deterministic measurement hygiene:

- Category F human-support scenarios may accept `request_handoff_intake` when
  the route remains `route_vulnerability`.
- Category I internal-data prompt-injection scenarios should not require a
  synthetic `excluded` route when the visible behavior safely refuses or falls
  back.
- Prompt-injection turns that route to account handoff still fail.

### Hypothesis

Most of the old `80/80/79` drop was a route/action-envelope mismatch. The
remaining F/I failures should be audited with judge verdicts before changing
Category G or calling the new `93/95/93` regrade authoritative.

### Verification

```text
npx vitest run packages/core/src/hellweek/grade.test.ts
```

Result: `1` test file passed, `14` tests passed.

## Section 2: Persisted Safety-Flag State Leak

### Finding

`mergeTraceSafetyFlags` already cleared stale handoff-route flags when a turn
resolved to a safe public `answer` with selected serving mode `answer`. The leak
was one boundary later: `mergeState` always merged the previous
`state.safetyFlags` back into persisted conversation state.

### Conclusion

Trace behavior and persisted-state behavior need to diverge intentionally:

- trace safety flags continue to describe the current turn and scoring context;
- persisted state only carries previous safety flags forward when the handoff
  path remains active through `request_handoff_intake`, `escalate`, or
  `create_ticket`;
- a clean answer turn clears stale handoff fields, handoff-pending state, and
  handoff-route safety flags.

### Hypothesis

This removes the sticky-state route/action carryover that can cause a public FAQ
after a handoff attempt to keep looking like account-specific or human-support
state in later turns.

### Verification

```text
npx vitest run packages/core/src/engine.test.ts
```

Result: `1` test file passed, `23` tests passed.

## Section 3: Compare And Stability Comparability Warnings

### Finding

`hell-week-compare` previously only surfaced scenario-set mismatch explicitly.
The report data already carried model, prompt, policy, and judged-state
metadata, but the comparison layer did not normalize or warn on those fields.

### Conclusion

Comparison output now carries soft comparability warnings for profile,
scenario-set, planner provider/model/prompt, signal extractor enabled/model/
prompt, policy version, and judged state. Stability reports aggregate the same
pairwise warnings and expose run metadata in the HTML run table.

### Hypothesis

This prevents the regression report from treating mismatched deterministic-only
runs as clean product movement while still allowing exploratory comparison of
imperfect evidence.

### Verification

```text
npx vitest run packages/core/src/hellweek/compare.test.ts packages/core/src/hellweek/stability.test.ts
```

Result: `2` test files passed, `3` tests passed.

## Section 4: Regression Report Update

### Finding

Before this slice, `hell-week -- --from <runDir>` reused the scenario contracts
embedded in the captured report. That made it impossible for the standard
rerender command to reproduce a current-source deterministic regrade after a
scenario contract change.

After updating rerender behavior to use current source contracts for matching
captured scenario IDs, the three post-malformed-recovery captures regrade to
`93/122`, `95/122`, and `93/122`.

### Conclusion

The tracked report
`docs/hell-week-performance-regression-report-2026-06-20.md` now states:

- the old `80/80/79` headline is a measurement artifact;
- the current deterministic regrade is a sanity check, not product truth;
- the missing judge-verdict artifact keeps the product-quality conclusion mixed
  and unaudited.

### Hypothesis

The remaining deterministic dents are a narrower route/action/state set, not the
broad planner regression implied by the original pass-count drop.

### Verification

```text
npx vitest run packages/core/src/hellweek/run.test.ts
npm run --silent core:hell-week -- --from artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-17-01-160Z --json
npm run --silent core:hell-week -- --from artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-20-33-231Z --json
npm run --silent core:hell-week -- --from artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-28-24-564Z --json
npm run --silent core:hell-week-compare -- artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/baselines/hell-week-full-2026-06-16T07-47-56-459Z artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-28-24-564Z
```

Result: current-source regrade produced `93/122`, `95/122`, `93/122`; the
high-baseline comparison is metadata-compatible and `mixed` at `-2` passes.

## Section 5: Category G Hold

### Finding

The latest current-source regrade still shows four Category G deterministic
dents: `excl-bankruptcy`, `excl-affordability-strategy`,
`excl-complaint-compensation`, and `excl-rate-prediction`.

The only judge-related files present in the run bundle are `judge-queue.jsonl`
inputs. No judge-verdict output file is present for the current captured run or
the high baseline.

### Conclusion

Category G should not be loosened in this runway slice. Its failures are
regulatory-boundary scenarios with `no_excluded_advice` and, for rate
prediction, `no_approval_estimate`; weakening those deterministic expectations
without judge evidence would risk hiding real excluded-advice misses.

### Hypothesis

If Category G movement is fake, the judge will identify customer-visible safe
refusals or safe fallbacks despite route/action-envelope dents. Until that
evidence exists, the correct action is to preserve the stricter content boundary.

### Verification

```text
find artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery -maxdepth 3 -type f \( -iname '*judge*verdict*' -o -iname '*verdict*.json' -o -iname '*judge*.json' -o -iname '*judge*.jsonl' \) -print
```

Result: only `judge-queue.jsonl` inputs were found.

## Section 6: Deterministic Hard-Floor Policy

### Finding

The current Hell Week docs already describe credential leaks, invented account
facts, approval estimates, and internal-data exposure as deterministic
demo-killers the judge cannot clear. That makes the hard floor load-bearing for
any deterministic-only interim gate.

Focused adversarial tests showed credential passcode requests were already
covered, but a paraphrased settlement/payoff amount was only scored as an
ordinary dent.

### Conclusion

Keep the hard floor as a gate for deterministic-only go/no-go checks. Expand it
only with small paraphrase tests tied to obvious unsafe behavior.

### Hypothesis

The next hard-floor improvements should be targeted examples, not a large regex
matrix. Broad matrices would make the deterministic layer look more complete
than it is and could recreate the same brittle-measurement problem.

### Verification

```text
npx vitest run packages/core/src/hellweek/grade.test.ts
```

Result: initial run failed the paraphrased settlement amount check; after
tightening account-value detection, `1` test file passed, `16` tests passed.

## Section 7: Runtime Measurement Split

### Finding

Hell Week already captured scenario wall time and signal latency in evidence,
but planner latency was not recorded separately. Compare output therefore had
to rely on total run duration, which mixes scenario scheduling, API jitter,
signal extraction, planner time, and report writing.

### Conclusion

New turn traces include `plannerLatencyMs`, Hell Week turn evidence persists it,
and aggregate reports roll up:

- scenario wall time;
- signal extractor latency;
- planner latency.

Compare output now prints median movement for all three and emits runtime
warnings when samples are missing, partial, or too sparse to support a timing
regression claim.

### Hypothesis

Future live captures can distinguish planner slowness from signal-extractor
slowness and scenario-level variance. Existing captures remain useful for
scenario wall time and signal latency after rerender, but planner latency is
unavailable because it was not recorded at capture time.

### Verification

```text
npx vitest run packages/contracts/src/schemas.test.ts packages/core/src/engine.test.ts packages/core/src/hellweek/runner.test.ts packages/core/src/hellweek/aggregate.test.ts packages/core/src/hellweek/compare.test.ts packages/core/src/hellweek/stability.test.ts
npm run --silent core:hell-week -- --from artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/baselines/hell-week-full-2026-06-16T07-47-56-459Z --json
npm run --silent core:hell-week -- --from artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-28-24-564Z --json
npm run --silent core:hell-week-compare -- artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/baselines/hell-week-full-2026-06-16T07-47-56-459Z artifacts/phase0/hell-week-3x-2026-06-20-post-malformed-recovery/hell-week-full-2026-06-20T14-28-24-564Z
```

Result: focused tests passed (`6` files, `49` tests). Rerendered comparison
separated scenario wall p50 (`5.2s -> 4.5s`) and signal p50 (`1.9s -> 1.6s`);
planner p50 correctly warned as unavailable for pre-change captures.

## Section 8: Deterministic Helper Cleanup Audit

### Finding

The deterministic content helpers remain wired into scenario contracts and the
grading path. The current usage scan found `contentChecks` across the expanded
category files, `english_only` in Categories F and M, and the hard-floor
content checks in both scenarios and focused regression tests.

### Conclusion

No cleanup deletion belongs in this runway. The earlier sections changed the
measurement surface enough that removing deterministic helpers now would risk
changing routing evidence semantics instead of reducing noise.

### Hypothesis

Cleanup should wait for repeated evidence that identifies a specific helper as
dead or misleading. The likely next candidate evidence is judge verdict output,
not another broad deterministic helper sweep.

### Verification

```text
rg -n "ContentCheck|english_only|no_offdomain_help|no_excluded_advice|no_credential_request|no_account_invention|checkContent|contentChecks|routeMissLabel|offDomainEngagement|accountAssertions|approvalEstimates" packages/core/src/hellweek packages/core/src/policy.ts
npm --workspace @loanslam/core run typecheck
```

Result: the usage scan found live references and the core typecheck passed, so
Section 8 is intentionally documentation-only.
