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
