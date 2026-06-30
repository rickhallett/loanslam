# workflow: hell-week-tune

The bounded autonomous tuning arc. This file is both the operator's narration
and the controller contract — there is no separate controller doc. Ceilings come
from [ratchet.config.json](ratchet.config.json).

## Preconditions

- A pinned anchor: `artifacts/evidence-index/baseline.json` (currently breached
  41/50). Never re-freeze a fresh live baseline mid-arc.
- A backlog of falsifiable hypotheses, one per disjoint owner.
- Reachable Postgres + `OPENAI_API_KEY`. If absent, STOP — never proceed on
  static green.

## Per-iteration loop (the controller owns every gate)

1. Pick ONE hypothesis on ONE disjoint owner (`oneOwnerPerSlice`).
2. `just slice-new -- <owner>` — isolated worktree, fresh secrets.
3. Implementer subagent makes the single change; commits atomically.
4. Cheap self-gate (no tokens): `just self-gate`. Red -> one self-repair retry
   -> else discard the slice.
5. Smoke tripwire: `just hell-week -- --profile smoke` (`smokeBeforeFull`).
6. On smoke pass: full `just hell-week` + `just hell-week-judge -- <run-dir>` +
   `just floor-delta -- <run-dir>`.
7. KEEP the commit only if `floor-delta` is in `keepStatuses` (REPAIRED/HOLDING)
   AND `gate-slice` passes. Otherwise discard. Do not declare REPAIRED on one
   run — require the `stabilityMinRuns` classification
   (`just hell-week-stability`).
8. Loop until the iteration/patch ceiling or the backlog drains.

## First arc

Run as a calibration arc (`firstArc.alwaysNotify`): force every safety/
ambiguity/inconclusive trigger to notify so thresholds are tuned before you
trust the ratchet to stay quiet.

## Stop conditions (hand back)

Per-dimension safety-floor regression, two consecutive non-improving slices, a
product/compliance/owner-language decision, overlapping write scopes, an
INCONCLUSIVE receipt, or a ceiling reached. Close with
[digest-and-ping](digest-and-ping.md) and one PR.

Canonical doctrine: `docs/hell-week-agent-loop-playbook.md`.
