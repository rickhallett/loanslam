# Concierge Exposure 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-exposure-01 / Arc: concierge-arc-003
  / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

Fixed-window per-IP rate limits on the concierge routes (10 sessions / 30
messages per 5 minutes), counted before body validation so abuse costs no
model calls. No new secrets. Deployed to the existing `loanslam-site-nuxt`
Railway service via the established pack + `railway up --ci` path.

## Proof

- Local: `scripts/dc007-exposure-proof.mjs` 3/3; `just verify` exit 0.
- Live (https://loanslam-site-nuxt-production.up.railway.app):
  - Exposure proof 3/3 — sessions 429 after 10, messages 429 with only
    validation/limit statuses (no model cost).
  - Kill switch cycle: `CONCIERGE_KILL_SWITCH=1` set on the service and
    redeployed -> status `{enabled:false}`, sessions POST 503, and the
    support chat unaffected (`/api/ipoc/sessions` 200 during the kill);
    restored to `0` -> status `{enabled:true, model:"gpt-5.5"}`.
  - Variable left in place at `0` so the operational switch is one edit away.
