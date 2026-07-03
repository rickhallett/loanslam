# Demo Killbeat Campaign 001 Card - 2026-07-03

Status: green. Authorized 2026-07-03 by D048 (docs tier). Mechanics per
`docs/campaign-workflow-protocol.md`. Single human checkpoint: the
stakeholder demo itself (the campaign prepares a demo move; only a human
performs it). Lands on dev.

## Outcome

The demo gains its element of surprise: a scripted kill beat where the
driver runs a real `railway redeploy` of the production service
mid-conversation, in front of stakeholders, and the assistant's next turn
recovers with full context. The move is machine-rehearsable — it goes in
the script only because a battery can prove it green on demo morning.

## Arc Chain

Campaign label: `demo-killbeat-001`. Roadmap:
`docs/roadmaps/2026-07-03-demo-killbeat-001-roadmap.yaml`. Branch:
`feature/demo-killbeat-01` off dev, worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| kb-001 | kill-beat-script-01 | killbeat-arc-001 | Runbook gains the kill beat (placement, driver lines, timing, abort rule); `dr003-live-restart-proof.mjs` wired as the demo-morning go/no-go check via a `just` target |

Commit labels: `Epic: demo-killbeat / Slice: <label> / Arc: <arc> /
Campaign: demo-killbeat-001 / Human checkpoint: stakeholder-demo`.

## Contract Defaults (D048)

- Choreography only: `docs/demo-concierge-runbook.md`, `justfile`, and
  receipts. Zero changes to product code, routes, or the concierge prompt.
- The beat is optional per demo: the runbook states the go/no-go rule
  (restart proof green that morning, driver has Railway auth) and the
  abort posture (skip the beat silently; the demo runs fine without it).
- The kill mechanism is `railway redeploy` (restart of the existing
  build), never the kill switch (which would silence the assistant).

## Non-Goals / Preserved Human Gates

- No new concierge capability; no changes to the campaign-003 staging
  branch or the UAT surfaces.
- Performing the beat in the real demo is irreducibly human.

## Proof Bar

- killbeat-arc-001: runbook beat reads as a followable script; the
  `just` go/no-go target runs the live restart proof against production
  and reports 5/5; consistency output committed with closeout.

## Stop Conditions

Campaign-protocol stop conditions, plus: the restart proof cannot be made
reliably green against production (the beat leaves the script until it
can).
