# Demo Resilience Campaign 001 Card - 2026-07-02

Status: closed 2026-07-03 (historical record). Closeout receipt:
`artifacts/demo-resilience/demo-resilience-001-closeout.md`.
Was: green. Authorized 2026-07-02 by D047 (confident tier). Mechanics per
`docs/campaign-workflow-protocol.md`. Single human checkpoint: campaign
closeout. Lands on dev and the production surface.

## Outcome

The demo survives a mid-conversation server restart, and the concierge feels
faster: lost server sessions self-heal from the client transcript, and
plain-text concierge replies stream.

## Arc Chain

Campaign label: `demo-resilience-001`. Roadmap:
`docs/roadmaps/2026-07-02-demo-resilience-001-roadmap.yaml`. Branch:
`feature/demo-resilience-01` off dev (created after the probes campaign
lands, so it carries any probe-surfaced notes), worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| dr-001 | session-resurrection-01 | resilience-arc-001 | On a 404 from the concierge messages route, reseed a new session from the sessionStorage transcript and retry once |
| dr-002 | reply-streaming-01 | resilience-arc-001 | Stream plain-text concierge replies into the panel (production reply path; structured-output streaming deferred) |
| dr-003 | resilience-deploy-01 | resilience-arc-002 | Regression + production deploy + live restart-recovery proof + closeout |

Commit labels: `Epic: demo-resilience / Slice: <label> / Arc: <arc> /
Campaign: demo-resilience-001 / Human checkpoint: campaign-closeout`.

## Contract Defaults (D047)

- Resurrection is transparent and bounded: one automatic reseed+retry on a
  lost session; the replayed transcript is text-only context, never
  re-executed UI.
- Streaming applies to the plain-text reply path only. The campaign-003
  structured-output path (suggestions/fill) does not stream until that
  branch's merge decision reconciles streaming with structured output.
- Kill switch and rate limits unchanged and in force.

## Non-Goals / Human Gates
- No durable/server-side session store (that remains a future decision); this
  is client-side resilience only.
- No changes to the validated engine, ipoc, widgets, or Astro site.
- Does not touch the campaign-003 staging branch.

## Proof Bar

- resilience-arc-001: killing the server session (or restarting the process)
  mid-conversation and sending again recovers with the transcript intact;
  streaming visibly renders a reply incrementally; contact battery green.
- resilience-arc-002: campaign-001/002 rehearsals still green; production
  deploy; live proof that a fresh browser session recovers after a server
  redeploy; closeout with consistency output.

## Stop Conditions

Campaign-protocol stop conditions, plus: resurrection causes duplicate or
out-of-order turns; streaming cannot render without regressing the
non-streaming or structured-output paths.
