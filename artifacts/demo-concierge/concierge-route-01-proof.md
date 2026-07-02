# Concierge Route 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-route-01 / Arc: concierge-arc-002
  / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

Segregated concierge surface in `packages/site-nuxt/server` (native, not the
ipoc re-export pattern — segregation from the validated engine path is the
point): `/api/concierge/status`, `/api/concierge/sessions`,
`/api/concierge/sessions/:ref/messages`. Frontier model (`gpt-5.5`,
`CONCIERGE_MODEL` override) via the OpenAI Responses API, house-voice system
prompt with the D045 no-promises instruction, in-memory sessions capped at 20
messages, optional `formState` context (wired fully in dc-005). Kill switch
`CONCIERGE_KILL_SWITCH=1` returns 503 on POST routes and `enabled: false` on
status. No engine, validator, ipoc, or widget changes.

## Proof

`scripts/dc004-concierge-probe.mjs` against the built server under secrets:

- Live mode 7/7: status enabled; session created; live model turn with form
  state — reply engages the field and quotes the form's loan amount;
  second turn proves server-side session continuity ("You said the loan
  amount was £2,000."); empty message 400; unknown session 404.
- Kill-switch mode 2/2 (second instance, `CONCIERGE_KILL_SWITCH=1`):
  status `{enabled:false}`, sessions POST 503.
- `just verify` exit 0.
