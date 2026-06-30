# write-scope-guardrails

The disjoint write scopes and the KEEP/BURN rules a floor-chasing slice is
tempted to violate. This reference earns its prose; the rest of the bundle is
pointers.

## Disjoint owners

One slice changes exactly one of: `retrieval` | `planner` | `validator` |
`state` | `corpus` | `scenario`. Parallel slices must not share an owner. The
owner is selected from the failure cluster, not the file you feel like editing.

## BURN (do not add)

- **Static routing restraints** — regex/keyword/lexical routing adjudication.
  Brittle; live integration evidence outweighs them ~100x. They get rewarded by
  a single run, then regress. Keep only a tiny, explicit safety/schema
  invariant. Background: `docs/phase-0-static-routing-restraint-audit-2026-06-15.md`.

## KEEP (do not "fix")

- **demo-widget vs review-widget** near-duplication is **deliberate** — they are
  separate UIs. Do not dedup them, and do not import across the boundary.

`scripts/gate-slice.ts` hard-enforces the demo<->review separation (blocks a
cross-boundary import). The static-routing-restraint rule is a human-review
guardrail by design: a fuzzy regex detector for it would be the exact brittle
pattern this rule forbids, so it is not auto-blocked — call it out in review.
