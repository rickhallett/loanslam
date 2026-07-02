# Concierge Form State 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-form-state-01 / Arc:
  concierge-arc-002 / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

Concierge mode in ChatWidget: on /apply/ (when the kill switch is off),
turns go to the segregated concierge route with a live snapshot of the
application form; every other route keeps the validated engine. The form
snapshot (`lib/formSnapshot.ts`) reads the rendered DOM — step indicator plus
named input/select values — because `ApplicationJourney.vue` is shared source
with the Astro site (a preserved human gate) and stays untouched. Arrival
introduction fires when the open panel reaches /apply/ via chat-driven
navigation, or on first manual open there; the kill switch also suppresses
the dc-003 navigation nudge (all concierge affordances behind one env var).

## Proof

`scripts/dc005-form-state-proof.mjs` against the built server under secrets,
live model: 5/5 (`artifacts/demo-concierge/dc005-form-state/`).

- Full demo path: support chat -> apply intent -> quick action -> /apply/
  with the arrival introduction rendered on the open panel.
- Entered monthlyIncome 2500 and firstName Alex, asked "What have I filled
  in so far on this step?" — reply: "You're on Step 1 of 9. So far you've
  entered monthly income as £2,500, first name as Alex, and ticked the terms
  plus SMS marketing boxes. Employment status and the rest of your personal,
  contact and address details are still blank."
  (`apply-form-awareness.png`)
- Direct load: panel closed by default (dc-002 behavior preserved), intro on
  first manual open.
- `just verify` exit 0.
