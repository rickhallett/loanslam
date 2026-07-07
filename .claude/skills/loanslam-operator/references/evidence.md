# evidence

Turn a run into typed receipts and a review packet.

- Anchor: `artifacts/evidence-index/baseline.json` — the committed breached
  floor (41/50) a candidate is measured against. Re-pin only by deliberate human
  decision, only to an inspected run.
- Score a candidate: `just floor-delta -- <run-dir>` -> REPAIRED | HOLDING |
  REGRESSED | INCONCLUSIVE, written to a gitignored receipt. Content-aware: it
  parses per-dimension numbers, so a stale or regressing receipt cannot satisfy
  a gate. Keep a slice on REPAIRED/HOLDING; promote only on REPAIRED.
- Digest for review/PR: `just digest -- <run-dir>` (typed numbers from
  report.json only; never opens evidence.json transcripts). Full packet:
  `just checkpoint-packet -- <run-dir>` (orient + proof bar + digest).
- ship_ready requires judge verdicts (`just hell-week-judge -- <run-dir>`) plus
  safety-floor coverage; a deterministic-only run caps at needs_work.
- Historical runs are persisted in Postgres, not a tracked index file; use
  `just hell-week-stability` to classify repeated runs already there. The full
  capture/judge/compare model lives in `docs/hell-week-gauntlet.md`.

Persist the digest/compare summary INLINE into the PR body — `artifacts/` is
gitignored and dies with the worktree, so the receipt must survive in git.
