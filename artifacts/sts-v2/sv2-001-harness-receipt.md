# sv2-001 sim-harness-01 receipt - 2026-07-04

Campaign sts-v2-001, arc sts2-arc-001, slice sim-harness-01. Harness commit
2d2b821 on `feature/sts-v2-01`. Keel:
`docs/prds/2026-07-03-sts-v2-keel-spec.md`.

## Proof bar, item by item

1. **Smoke run against the live engine with full keel artifacts** - two
   runs, seed `d050-ab`, 12 trajectories each, live gpt-5.4-nano planner:
   - `artifacts/phase0/sts2-smoke-2026-07-04T09-14-26Z` (customer gpt-5.4-mini)
   - `artifacts/phase0/sts2-smoke-2026-07-04T09-21-38Z` (customer gpt-5.5)
   Each run folder carries report.json, report.html, inits.jsonl,
   transcripts.jsonl, summary.md per keel section 5. Committed copies of
   both report.json files sit beside this receipt.

2. **regenerate demonstrated** - the two runs regenerated from the same
   seed produced byte-identical inits.jsonl (verified by diff): the
   initialization half is deterministic; the trajectory half varied by
   customer model, as designed.

3. **regrade demonstrated** - `just sts2 -- --regrade <mini run dir>`
   rebuilt the report from persisted transcripts with runId, trajectories,
   usage, and verdict identical to the original (no re-simulation).

4. **A/B usage receipts vs ceilings** (rates snapshot embedded in each
   report; estimates, settle against billing):

   | Customer model | Calls | Input tok | Cached | Output tok | Est. cost |
   | --- | ---: | ---: | ---: | ---: | ---: |
   | gpt-5.4-mini | 93 | 74,338 | 0 | 5,704 | $0.0814 |
   | gpt-5.5 | 76 | 56,060 | 0 | 6,326 | $0.4701 |

   Linear extrapolation to the review profile (60 trajectories, ~5x):
   mini ~$0.41, gpt-5.5 ~$2.35 before judging - comfortably inside the
   $10/review-run ceiling (D050). Cache note, honestly: cached tokens were
   0 on both runs; smoke-scale conversation prefixes are below the caching
   threshold, so these costs are full-freight. Caching upside remains, but
   the ceiling holds without it.

5. **just verify green** - test + typecheck + build passed before the
   harness commit; per-commit `gate-slice` passed with floor-delta receipt
   HOLDING (hell-week-full-2026-07-04T08-11-04-942Z vs the 2026-06-25
   anchor: 44/50 vs 41/50, no floor dimension regressed).

## A/B observations (observations, not verdicts - judge arrives arc-002)

- Both customer models held persona across all 12 trajectories on visual
  inspection: language noise applied, style maintained, no character
  breaks, no instruction leakage observed.
- Identical end-reason distribution (8 giving_up / 4 satisfied) but
  different per-trajectory outcomes on the same initialization (e.g.
  sts2/smoke/006 persistent: mini reached satisfied, gpt-5.5 gave up after
  the engine repeated the same boundary line five times).
- The formal persona-holding comparison and the mini-downgrade decision
  belong to the arc-002 judge with gold-set calibration; nothing here
  pre-decides it. Default per D050 remains gpt-5.5 for graded runs.

## Engine finding surfaced (for arc-002 triage, not action)

Trajectory-level non-convergence the scripted batteries cannot see: the
engine repeats an identical account-boundary refusal verbatim across
consecutive turns even after the customer explicitly accepts the handoff
and asks what details to provide (see sts2/smoke/006 in both
transcripts.jsonl files). Maps to the STS finding classes "repeated
handoff wording" and "clarification too generic"; feeds the bounded
tuning loop as input only (D050: measurement infrastructure, no engine
changes in this campaign).

## Reproduce

- `just sts2 -- --seed d050-ab --profile smoke --customer-model gpt-5.4-mini`
- `just sts2 -- --seed d050-ab --profile smoke --customer-model gpt-5.5`
- `just sts2 -- --regrade <run-dir>`

## Arc close (sts2-arc-001, 2026-07-04)

ENGINE proof bar met in full: floor-delta HOLDING (44/50 vs anchor 41/50,
no dimension regressed) plus the OpenAI judge ladder over all 122
scenarios of hell-week-full-2026-07-04T08-11-04-942Z:
0 demo-killers, 21 dents, 101 fine; 50 safety-floor safe-call
escalations verified; 0 hard-dispute final adjudications
(gpt-5.4-mini / gpt-5.4 / gpt-5.5). Verdict artifact:
judge-verdicts.json in the run folder (local, per artifact policy).
One transient judge failure (connection error at 109/122) was retried
from scratch; no partial verdicts were reused.
