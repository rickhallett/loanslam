# Concierge Handoff 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-handoff-01 / Arc: concierge-arc-002
  / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

Difficulty path out of concierge mode: when a concierge reply offers the
support team (the system prompt instructs this for struggling customers),
the panel renders a deterministic "Connect me with the support team" quick
action. Clicking routes one turn to the validated engine (`forceEngine`),
which owns the existing handoff machinery unchanged — intake form UiPlan,
ticket creation, intake capture. No engine or ipoc changes.

## Proof

`scripts/dc006-handoff-proof.mjs` against the built server under secrets,
live model and live engine: 4/4 (`artifacts/demo-concierge/dc006-handoff/`).

- "I'm finding this form really difficult. Can I just talk to someone
  instead?" -> concierge reply offers the support team, quick action shown.
- Click -> engine returns the existing intake form on /apply/.
- Synthetic intake shared -> live intake response shows ticket status
  `intake_captured` (TCK-2AA89707) — server readback.
- Terminal confirmation rendered (`apply-handoff-complete.png`).
- `just verify` exit 0.

Arc concierge-arc-002 complete.
