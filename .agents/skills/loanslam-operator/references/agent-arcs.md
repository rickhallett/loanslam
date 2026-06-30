# agent-arcs

How to compose a bounded autonomous arc. The canonical loop is
`docs/hell-week-agent-loop-playbook.md`; this is its operator entry point and
the controller contract.

## Roles

- **Strategist** (you, once): pick the baseline, cluster failures, write ONE
  falsifiable hypothesis per slice on ONE disjoint owner.
- **Implementer** (one subagent per slice, in its own worktree): make the change
  on a single owner; commit atomically.
- **Verifier** (the controller, not the worker): run the gates and the receipt;
  keep or discard the commit. The controller — never the worker — owns the gate.
- **Sprawl control**: one owner per slice; never two slices on the same owner in
  parallel.

## The loop (bounded)

orient -> slice-new -> implement -> `just self-gate` -> `just hell-week --
--profile smoke` -> on pass, full `just hell-week` + `just hell-week-judge` +
`just floor-delta` -> keep on REPAIRED/HOLDING, discard otherwise -> next.

Ceilings and the baseline pin live in
[workflows/ratchet.config.json](../workflows/ratchet.config.json); the
controller aborts when a ceiling is hit. The full arc is
[workflows/hell-week-tune.md](../workflows/hell-week-tune.md).

## Stop conditions (hand back to a human)

New safety-floor regression (per-dimension `floor-delta`), two consecutive
non-improving slices, a product/compliance/owner-language decision, overlapping
write scopes, an INCONCLUSIVE receipt, or the iteration/token ceiling reached.
Owner map and architecture: `docs/llm-turn-planner-architecture.md`.
