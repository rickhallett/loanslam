# Hell Week Performance Regression Report

## Practical Takeaway

The headline `80/80/79` Hell Week regression is best treated as a measurement
artifact, not a confirmed product regression. Regrading the same captured
evidence against current source contracts produces `93/95/93` with zero
demo-killers, but every compared run is still deterministic-only. Until judge
verdicts are merged, the product-quality conclusion is mixed and unaudited, not
authoritative.

## Evidence Set

All compared runs use:

```yaml
profile: full
planner: openai / gpt-5.4-nano / phase0-turnplanner-v2
signal_extractor: gpt-5.4-nano / phase0-signals-v2
policy_version: phase0-turnplanner-policy-v1
scenario_count: 122
judged: false
```

The run folders contain `judge-queue.jsonl`, but no judge-verdict output file
was present in this checkout.

## Deterministic Score Movement

```yaml
historical_high_baseline:
  run: hell-week-full-2026-06-16T07-47-56-459Z
  original_deterministic: 95/122
  demo_killers: 0
  dents: 27
  duration_ms: 207407

same_day_pre_candidate_baseline:
  run: hell-week-full-2026-06-20T09-42-51-938Z
  original_deterministic: 82/122
  demo_killers: 0
  dents: 40
  duration_ms: 584115

post_malformed_recovery_captured:
  original_deterministic:
    hell-week-full-2026-06-20T14-17-01-160Z: 80/122
    hell-week-full-2026-06-20T14-20-33-231Z: 80/122
    hell-week-full-2026-06-20T14-28-24-564Z: 79/122
  current_source_regrade:
    hell-week-full-2026-06-20T14-17-01-160Z: 93/122
    hell-week-full-2026-06-20T14-20-33-231Z: 95/122
    hell-week-full-2026-06-20T14-28-24-564Z: 93/122
  demo_killers_after_regrade: 0
```

## Comparability-Aware Comparison

`hell-week-compare` reports no metadata mismatch warnings for the high-baseline
to latest-current-source comparison. That means profile, scenario set, planner,
signal extractor, policy version, and judged state match.

```yaml
comparison:
  baseline: hell-week-full-2026-06-16T07-47-56-459Z
  candidate: hell-week-full-2026-06-20T14-28-24-564Z
  pass_delta: -2
  pass_rate_delta_points: -1.6
  dents_delta: +2
  demo_killers_delta: 0
  safety_floor_pass_delta: -1
  deflection_delta_points: 0.0
  routing_precision_delta_points: +3.0
  signal_agreement_delta_points: +3.3
  recommendation: mixed
```

The same-day pre-candidate baseline comparison moves from `82/122` to
`93/122`, a `+11` pass movement after current-source regrade. That supports the
measurement-artifact conclusion for the old headline drop.

## Interpretation

Observed fact: the original post-malformed-recovery reports scored
`80/80/79`.

Observed fact: rerendering the same `evidence.json` with current source
contracts scores `93/95/93`.

Observed fact: all compared runs are deterministic-only (`judged: false`).

Inference: the large apparent drop was mostly caused by stale deterministic
route/action-envelope contracts in Category F human-support and Category I
prompt-injection scenarios.

Inference: the remaining difference from the historical high baseline is mixed,
not a clean regression. There are still deterministic dents outside the fixed
F/I route contracts, and the independent judge has not audited whether those
dents are customer-visible.

## Decision

Treat the old `80/80/79` regression narrative as a measurement artifact. Do not
tune broad planner prompts from those numbers.

Treat `93/95/93` as a current deterministic sanity check only. Do not call it
product truth until judge verdicts are merged.

Hold Category G relaxation until the judge confirms that the F/I contract repair
removed fake route constraints rather than hiding real safety misses.

## Verification

```text
npm run --silent core:hell-week -- --from <captured-run-dir> --json
npm run --silent core:hell-week-compare -- <baseline-run-dir> <candidate-run-dir>
npm run --silent core:hell-week-compare -- <same-day-baseline> <candidate-run-dir> --json
```

Focused implementation checks:

```text
npx vitest run packages/core/src/hellweek/run.test.ts
npx vitest run packages/core/src/hellweek/compare.test.ts packages/core/src/hellweek/stability.test.ts
```
