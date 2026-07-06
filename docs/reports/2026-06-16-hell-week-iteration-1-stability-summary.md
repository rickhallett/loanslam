# Hell Week Iteration 1 Stability Summary - 2026-06-16

Practical takeaway: the iteration 1 stability set showed useful aggregate
progress, but the old dashboard exposed too much internal scenario detail for
the public `/reports` surface. This page keeps the public summary compact.

## Result

| Field | Value |
| --- | --- |
| Compared runs | 3 |
| Run IDs | `hell-week-full-2026-06-16T06-25-23-998Z`, `hell-week-full-2026-06-16T07-29-14-032Z`, `hell-week-full-2026-06-16T07-47-56-459Z` |
| Scenario count | 122 |
| Stable finding | scenario-level movement remained noisy |
| Public status | sanitized summary only |

## Boundary

- This page does not publish scenario rows, per-turn content, raw reports, or
  artifact directory paths.
- Use internal DB replay or local ignored artifacts for diagnosis.
- Use `artifacts/evidence-index/hell-week-runs.md` for durable run references.

## Reading

The stability comparison was a tuning signal, not a promotion signal. Re-run the
current Hell Week and judge path before making any current behavior claim.
