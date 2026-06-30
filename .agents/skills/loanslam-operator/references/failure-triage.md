# failure-triage

When a gate fails, evidence looks wrong, or an arc stalls.

- Failed `verify`/`gate-slice`: read the violation list; it names the file and
  reason. Provider/import violations point at the offending import; engine-touch
  blocks until a `just floor-delta` receipt is REPAIRED/HOLDING.
- Routing looks off: `just route-audit -- <run-folder>` (read-only) for a
  routing summary; `just demo-log-session -- <conv-ref> --full` to read what the
  bot actually said to a stakeholder.
- Regression vs noise: the battery is stochastic and the baseline is breached.
  Do not declare REPAIRED on one run — `just hell-week-stability -- --runs
  <r1,r2,r3>` (or `--from-db <setId>`) to classify stable vs recurring vs
  one-off. INCONCLUSIVE from `floor-delta` means profile/scenario-set mismatch:
  the receipt is untrustworthy, not passing.
- Infra: the Hell Week CLI fails fast if Postgres is unreachable — fix infra,
  never proceed on static green. Cluster/grade model: `docs/hell-week-gauntlet.md`.
- Stuck agent / unclear attribution: stop, snapshot (`just checkpoint-packet`),
  and hand back per the arc's stop conditions
  ([agent-arcs](agent-arcs.md)).
