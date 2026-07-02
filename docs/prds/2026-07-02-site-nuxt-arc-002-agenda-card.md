# Site Nuxt Arc 002 Agenda Card - 2026-07-02

Status: green. Full human green-light 2026-07-02 for all four slices with the
human touchpoint at successful completion of slice 4 (D042 records the
contract-delta defaults, all vetoable). Batch mechanics as in
`docs/prds/2026-07-02-site-nuxt-arc-001-agenda-card.md`.

## Objective

Integrate the poc chat into the Nuxt contact page as a native launcher and
panel: chrome visually identical to the current Astro/iframe widget, backend
on the ipoc Nitro surface over the same processTurn engine, iframe machinery
retired from the Nuxt page. Chosen path: option (b) of the serving-layer
decision — the ipoc surface is canonical; the /demo contract is not ported.

## Arc Chain

Arc label: `sitenuxt-arc-002`. Roadmap chain `arc_002_chain` in
`docs/roadmaps/2026-07-02-site-nuxt-roadmap.yaml`.

| Chain id | Slice label | Summary |
| --- | --- | --- |
| sn-006 | sitenuxt-chat-backend-01 | Chat routes on the site-nuxt server (in-place ipoc imports) + cancel-handoff route; API probes |
| sn-007 | sitenuxt-chat-panel-01 | Native launcher/frost/panel + widget-styled chat UI on /contact/ |
| sn-008 | sitenuxt-chat-proof-01 | Behavior battery + closed-state 0.00% parity + open-state chrome proof |
| sn-009 | sitenuxt-chat-deploy-01 | Secrets sync, deploy, live behavior proof, closeout -> HUMAN CHECKPOINT |

Commit labels: `Epic: site-nuxt / Slice: <label> / Arc: sitenuxt-arc-002 /
Human checkpoint: arc-closeout`.

## Contract (D042)

- Reset: client-side new session. Cancel-handoff: ipoc route over the
  engine's exported `cancelHandoff` helper. Continuation tokens and demo
  access token: dropped. Devtools script: not carried on the Nuxt page.
- Panel texts, welcome message, intake labels/validation copied verbatim from
  the review-widget for behavior parity. Launcher/frost/panel chrome copied
  from loader.js values (60px #00879b launcher, 500x700 panel, frost
  rgba(250,247,241,0.58), radius 16px, full-screen under 600px, contact
  reveal-clearing on open).

## Non-Goals / Human Gates

- No engine, validator, routing, or /demo lab-server changes; review-widget
  and demo-widget untouched (deliberately separate surfaces).
- No changes to the Astro site or its deployed service; both sites stay live.
- No auth/PII/CRM; mock ticket store stays in-memory.
- Stop and checkpoint on: engine-change pressure, closed-state contact parity
  breaking irrecoverably, or card/roadmap/diff/receipt disagreement.

## Proof Bar

- sn-006: probes show session/message/intake/cancel-handoff working on the
  site-nuxt server, engine boundary case included.
- sn-007: panel functions locally end-to-end.
- sn-008: adapted battery green against site-nuxt; /contact/ closed-state
  0.00% vs Astro; open-panel initial-state screenshot + structural
  assertions committed.
- sn-009: live URL behavior proof (launcher -> engine turn -> intake ->
  server readback); `just verify` and `just branch-risk -- --base dev` at
  closeout; report to human (the arc's single touchpoint).
