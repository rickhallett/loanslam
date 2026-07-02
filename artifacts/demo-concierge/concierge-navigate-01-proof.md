# Concierge Navigate 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-navigate-01 / Arc: concierge-arc-001
  / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

Deterministic navigation quick action in ChatWidget: when a live-engine turn
returns a grounded answer whose top retrieval match is an apply-journey FAQ
item (seven answer-mode corpus ids), the panel offers "Take me to the
application". Clicking performs SPA navigation (`navigateTo`) to /apply/ with
the panel and transcript intact. Client-side only; the engine, validator, and
telemetry contract are untouched. No offer on safety-flagged turns, non-answer
actions, or when already on /apply/.

## Proof

`scripts/dc003-navigate-proof.mjs` against the built server under secrets,
live engine: 8/8 (`artifacts/demo-concierge/dc003-navigate/`).

- "How do I apply for a loan?" -> grounded answer -> quick action rendered.
- Click -> URL /apply/, panel still open, message count unchanged, customer
  turn retained in transcript (state survives the route change), application
  page rendered behind the panel (`apply-after-nav.png`).
- Negative case: "What is my outstanding balance?" -> handoff turn -> no
  apply nudge rendered.
- `just verify` exit 0.
