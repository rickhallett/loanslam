# Demo Concierge Campaign 001 Card - 2026-07-02

Status: closed 2026-07-02 (historical record). Closeout receipt:
`artifacts/demo-concierge/demo-concierge-001-closeout.md`.
Was: green. Authorized 2026-07-02 by D045 under
`docs/campaign-workflow-protocol.md` (first campaign under that protocol).
Single human checkpoint: campaign closeout before the stakeholder demo.
Endpoint: the stakeholder demo (human event).

## Outcome

A chat user who confirms they want to make a new loan application is offered
navigation to /apply/, greeted there by the chat with an introduction to the
form, assisted with any question about it (the concierge reads live form
field state), and offered the existing human-handoff path if they struggle.
Concierge intelligence comes from a frontier OpenAI model on a segregated
route with system-prompt-only guardrails (D045); the validated engine path
and the existing support chat are untouched and stay proven.

## Arc Chain

Campaign label: `demo-concierge-001`. Roadmap:
`docs/roadmaps/2026-07-02-demo-concierge-roadmap.yaml`. Branch:
`feature/demo-concierge-01` off dev, worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| dc-001 | concierge-consistency-check-01 | concierge-arc-001 | Mechanical roadmap/card/diff/receipt consistency script (protocol requirement; blocks all future promotions) |
| dc-002 | concierge-surface-01 | concierge-arc-001 | Launcher/panel lifted to a layout-level component; chat state survives client-side navigation; launcher on /apply/ |
| dc-003 | concierge-navigate-01 | concierge-arc-001 | Deterministic "take me to the application" action driven by existing apply/eligibility telemetry + user confirmation |
| dc-004 | concierge-route-01 | concierge-arc-002 | Segregated concierge Nitro route: frontier model, house-voice system prompt, no validator, env-var kill switch |
| dc-005 | concierge-form-state-01 | concierge-arc-002 | Reactive form-state store from ApplicationJourney.vue serialized into concierge turns; arrival introduction on /apply/ |
| dc-006 | concierge-handoff-01 | concierge-arc-002 | Difficulty path: concierge offers and triggers the existing handoff intake flow |
| dc-007 | concierge-exposure-01 | concierge-arc-003 | IP/session rate limit on the concierge route; kill switch proven live; deploy |
| dc-008 | concierge-rehearsal-01 | concierge-arc-003 | Happy-path rehearsal battery on the live URL (intent -> navigate -> intro -> form questions -> handoff); demo runbook update; campaign closeout report |

Commit label shape: `Epic: demo-concierge / Slice: <label> / Arc: <arc> /
Campaign: demo-concierge-001 / Human checkpoint: campaign-closeout`.

## Contract Defaults (accepted 2026-07-02, D045)

- Concierge model: top of the OpenAI ladder (`gpt-5.5`), kept concise and in
  the established widget voice.
- Guardrails are system-prompt-only: a short instruction not to promise
  outcomes or state eligibility decisions, plus voice/concision constraints.
  No validator, no grounding rule, no iterative hardening on this surface.
- The navigation offer is a deterministic UI affordance (telemetry-driven
  quick action), not a model tool call — rehearsable demo seams.
- Form field state (synthetic demo data only) is serialized into concierge
  turns; the content-free telemetry boundary is knowingly crossed on this
  surface only. Devtools telemetry for the support chat keeps its existing
  content-free contract.
- Concierge sessions use the existing in-memory session pattern.
- Kill switch: a single env var disables the concierge route and all
  concierge UI affordances, leaving the proven support chat intact.
- No new secrets; rate limiting is IP/session based.

## Non-Goals / Preserved Human Gates

- No changes to `processTurn`, the validator, routing signals, corpus, or
  the /demo lab server; review-widget and demo-widget untouched.
- Existing support-chat behavior on /contact/ unchanged; its battery and
  closed-state parity remain the regression net.
- No changes to the Astro site or its service; no DNS, domains, cutover, or
  retirement actions.
- No real auth, PII persistence, CRM, webhooks, or write-capable account
  flows; all form data is synthetic demo data.
- No productization of concierge behavior — post-demo continuation is a new
  decision (D045 names the revert path).

## Proof Bar

- concierge-arc-001: consistency script runs green against this campaign's
  own roadmap; contact battery green after the surface lift; /contact/
  closed-state parity holds; /apply/ deviation recorded for the harness;
  navigation action proven in a headless browser flow.
- concierge-arc-002: scripted live-engine flow proves arrival intro, a form
  question answered with visible awareness of entered field values, and the
  handoff trigger reaching the existing intake form. Receipts are
  screenshots plus flow transcripts; static tests are not behavior proof.
- concierge-arc-003: rate limit and kill switch proven on the live URL;
  rehearsal battery green on the live URL; demo runbook updated; closeout
  report with consistency-check output committed.

## Stop Conditions

Union of the site-nuxt and ipoc roadmap stop conditions, plus (campaign
halts, touchpoint 2):

- The surface lift cannot preserve /contact/ closed-state parity or the
  contact battery.
- Concierge work creates pressure to modify the validated engine path.
- Form-state read-in requires restructuring ApplicationJourney.vue beyond a
  thin reactive store.
- The consistency check fails at any arc close.
- Card, roadmap, diff, and receipts disagree.
