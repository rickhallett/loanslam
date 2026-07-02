# Concierge Form Fill 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-form-fill-01 / Arc:
  concierge3-arc-001 / Campaign: demo-concierge-003 (D046, staging tier)

## Change

Structured output gains formFill: values the customer actually stated in
conversation, restricted server-side to the known details-step field names
and gated on the form page (formState present). The widget renders a "Fill
these in for me (N)" chip; on click, `lib/formFill.ts` applies values via
native input/change events so v-model updates — ApplicationJourney.vue (a
shared Astro-source component behind a human gate) is untouched.

## Proof

`scripts/dc3-002-form-fill-proof.mjs`, live model: 5/5
(`artifacts/demo-concierge/dc3-002-form-fill/`).

- Submit attempt first: 11 validation errors rendered (Vue-state probe).
- Customer states name, employment, income, dob, mobile, email in chat ->
  chip proposes 7 fields; monthlyIncome still empty before the click.
- Click: income=2500, firstName=Alex, employment="Employed - full time"
  land, and rendered validation errors drop 11 -> 4 — v-model reacted, and
  the remaining errors are exactly the fields the customer never gave
  (address, terms): no invented values.
- `just verify` exit 0 (recorded at slice commit).

Arc concierge3-arc-001 complete.
