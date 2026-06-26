# verification

What counts as proof, by what changed.

- The proof bar: `just branch-risk -- --base dev`. ENGINE changes
  (`packages/core/src/**`) owe a full Hell Week run + judge + a floor-delta
  receipt — unit/build are scaffolding, not proof, for routing/planner/
  validator/safety behaviour.
- Cheap, deterministic, zero-token first rung: `just self-gate` (= `just verify`
  + best-effort fallow audit). `just verify` proves wiring/types/build only; the
  live-model tests self-skip without `OPENAI_API_KEY`.
- Behaviour proof surface: `just hell-week` (full) / `-- --profile smoke` (fast
  tripwire). Smoke never authorises promotion. See `docs/hell-week-gauntlet.md`
  and `docs/phase-0-core-api-battery.md` for the run + grading model and the
  cheap lab-API path.
- A live lab-API session (`just core-serve` -> `just route-audit -- <run>`) is
  the strongest single signal for routing behaviour.

Then score the run against the anchor — see [evidence](evidence.md).
