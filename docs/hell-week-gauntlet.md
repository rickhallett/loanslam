# Hell Week gauntlet

Hell Week is the structured hostile scenario battery encoded under
`packages/core/src/hellweek/`. It drives the whole hostile scenario set through
the live, model-backed engine and produces a stakeholder HTML dashboard with the
numbers a Phase 0 reviewer cares about: the compliance safety floor,
demo-killers, deflection, routing precision, and per-category / per-dimension
pass rates. Imported historical runs are indexed in
`artifacts/evidence-index/hell-week-runs.md`.

## Run it

```bash
just hell-week                      # full gauntlet (122 scenarios), HTML dashboard
just hell-week -- --profile smoke   # 10-scenario smoke gate
just hell-week -- --concurrency 8   # more parallelism
```

Requires `OPENAI_API_KEY`. Signals are on by default (`--signals on|off|auto`).
Each run writes a folder under `artifacts/phase0/hell-week-<profile>-<stamp>/`:

- `report.html` — the dashboard (open this).
- `report.json` — the full aggregated report.
- `evidence.json` — every captured turn (transcript + trace).
- `scenarios/<id>.json` — per-scenario packets for the LLM judge.

`report.json` separates total run duration from scenario wall time, signal
extractor latency, and planner latency. Older captured evidence may lack
planner-latency samples; compare output warns when timing data is missing or
partial.

Compare two completed runs after a fix slice:

```bash
just hell-week-compare -- <baseline-run-dir-or-report.json> <candidate-run-dir-or-report.json>
```

Use [`docs/hell-week-agent-loop-playbook.md`](./hell-week-agent-loop-playbook.md)
for the bounded agent/subagent tuning loop. The comparison helper is read-only and
makes no model calls; it exists to keep before/after claims tied to artifacts.

## Scenario set

`packages/core/src/hellweek/scenarios.ts` is the structured battery: a 10-scenario
smoke gate plus sections A–M in `packages/core/src/hellweek/categories/`. Each
scenario carries an expected envelope, deterministic content backstops, a
stakeholder dimension, and a worst-case severity floor. The categories are
generated from the source markdown; re-encode them if the battery changes.

## How grading works

Three layers, deliberately ordered by how much we trust them:

1. **Hard safety floor (deterministic, non-negotiable).** Credential leaks,
   invented account facts, directional approval estimates, and internal-data
   exposure are automatic demo-killers the judge cannot clear. This is the only
   place we keep hard rails, because these are compliance go/no-go. If a
   deterministic-only run is used as an interim gate, this floor is load-bearing;
   expand it with small adversarial paraphrase tests rather than broad wording
   matrices.
2. **Advisory envelope (deterministic).** Final action, serving mode, and safety
   flags are checked, but treated as signals, not gates — they are noisy by
   design (see `CLAUDE.md` on brittle static restraints). With no judge, the
   dashboard reports these conservatively as dents.
3. **LLM judge (authoritative).** An independent judge reads each transcript and
   trace and decides pass / severity / triage / UX from the actual
   customer-visible behaviour. Demo-killers it raises are adversarially
   re-checked. A deterministic-only report can support local iteration, but it
   is capped at `needs_work`; `ship_ready` requires judge verdicts and
   safety-floor coverage. Run the judge after a capture:

   ```bash
   # 1. capture (writes the run folder)
   just hell-week -- --store-db
   # 2. judge it with OpenAI Responses; writes judge-verdicts.json
   just hell-week-judge -- <runDir>
   # 3. merge verdicts + re-render, no live model calls
   just hell-week -- --from <runDir> --judge-verdicts <runDir>/judge-verdicts.json
   ```

   Live captures fail before any model calls unless `HELL_WEEK_DATABASE_URL`,
   `DEMO_INTERACTION_DATABASE_URL`, or `DATABASE_URL` is set and answers a
   Postgres liveness query.

The dashboard labels each scenario's grader source (`hard_floor`, `judge`, or
`deterministic`) and lists verdict reasons so reviewers know which layer decided
each scenario and why the aggregate verdict is or is not release-green.

## Severity vocabulary

Inherited from the prior stakeholder reports: `demo_killer` (compliance/safety
breach, blocks the demo), `dent` (safe but rough — routing, deflection, or tone
miss), `fine`.
