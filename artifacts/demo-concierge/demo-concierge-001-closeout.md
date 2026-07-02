# Demo Concierge Campaign 001 — Closeout

Date: 2026-07-02
Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md`
Authorization: D045. Human checkpoint: this report (touchpoint 4).
Live URL: https://loanslam-site-nuxt-production.up.railway.app/contact/
Runbook: `docs/demo-concierge-runbook.md`

## Outcome delivered

The full stakeholder "good look" is live and rehearsed on the deployed URL:
support-chat apply intent -> deterministic navigation offer -> /apply/ with
arrival introduction and intact transcript -> frontier-model concierge
answering from live form state -> difficulty path into the validated
engine's existing intake flow with a captured ticket.

## Slices

| Slice | Commit | Proof |
| --- | --- | --- |
| dc-001 consistency-check | 38518ca | check green on this roadmap; 3 true positives on shipped-epic smoke |
| dc-002 surface | ebc586f | contact parity 4/4 (closed 0.00%), battery 9/9, manifest harness 52/52, surface proof 9/9 |
| dc-003 navigate | fd7a57b (scope fix cf3cfdb) | live flow 8/8 incl. negative case |
| dc-004 route | 7270648 | probe 7/7 live + 2/2 kill-switch instance |
| dc-005 form-state | 1c3f2f6 | live flow 5/5; reply names entered values and blanks |
| dc-006 handoff | 7c80bdc | live flow 4/4; ticket intake_captured |
| dc-007 exposure | 4bb6cce | 3/3 local + 3/3 live; kill switch cycled on prod, ipoc unaffected |
| dc-008 rehearsal | this commit | rehearsal 6/6 on the live URL (ticket TCK-9722EAA1) |

`just verify` exit 0 at every slice; consistency check green at every arc
close and re-run for this closeout (output below committed alongside).

## Boundaries held

- `processTurn`, validator, routing, corpus, ipoc surface, review/demo
  widgets, Astro site, DNS: untouched. `ApplicationJourney.vue` (shared
  Astro source) untouched — form state is read from the rendered DOM.
- Support chat proven unchanged: battery 9/9, /contact/ closed-state 0.00%,
  and `/api/ipoc/sessions` served 200 while the concierge was killed live.
- No new secrets; kill-switch variable sits at `0` on the service.

## Standing deviations and their exits (D045)

- Ungated concierge route (system-prompt guardrails only): demo-only.
  Revert = `CONCIERGE_KILL_SWITCH=1` (instant), then route deletion after
  the demo. Productizing requires a new D-entry.
- Form values (synthetic) cross to the model on the concierge surface only.
- /apply/ parity deviation recorded in the harness; /contact/ chat-chrome
  deviation (D042/D043) recorded likewise.

## Known limits

- Concierge sessions in-memory; reset on redeploy. Rate limits: 10 sessions
  / 30 messages per 5 min per IP. URL stays stakeholder-only.
- The support-team offer detection is a phrase match on the concierge reply
  ("support team" — prompted behavior, observed reliable across all runs);
  worst case the customer types their ask and the engine path catches it.

## Next decisions (human)

- Run the stakeholder demo from the runbook. A completed demo is also the
  recorded trigger for the widget-adapter sunset plan.
- Post-demo: exercise the D045 revert path or open a new decision for what
  the concierge becomes.
- Merge `feature/demo-concierge-01` -> dev when satisfied with this report.
