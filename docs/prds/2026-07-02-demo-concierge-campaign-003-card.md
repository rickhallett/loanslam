# Demo Concierge Campaign 003 Card - 2026-07-02

Status: green. Authorized 2026-07-02 by D046 (risk-split expansion; this is
the tricksy tier — STAGING ONLY). Mechanics per
`docs/campaign-workflow-protocol.md`. Single human checkpoint: campaign
closeout, feeding the joint UAT round with campaign-002.

## Blast radius (the point of this card)

Everything here deploys only to a new `loanslam-site-nuxt-staging` Railway
service. `feature/demo-concierge-03` does NOT merge to dev until human UAT
accepts it. Production keeps campaign-002.

## Outcome

The concierge acts, with the user's hand on every trigger: structured
output proposes navigation targets validated against the committed route
manifest (rendered as confirm-to-act chips), and on /apply/ it can propose
form values from the conversation which apply client-side only after an
explicit click.

## Arc Chain

Campaign label: `demo-concierge-003`. Roadmap:
`docs/roadmaps/2026-07-02-demo-concierge-003-roadmap.yaml`. Branch:
`feature/demo-concierge-03` off the campaign-002 closeout commit, worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| dc3-001 | concierge-suggest-nav-01 | concierge3-arc-001 | Structured output {reply, navigateTo?} validated server-side against the route manifest; confirm chip navigates |
| dc3-002 | concierge-form-fill-01 | concierge3-arc-001 | Structured output may propose apply-form values; confirm chip applies them via native input events; shared component untouched |
| dc3-003 | concierge3-staging-01 | concierge3-arc-002 | Create loanslam-site-nuxt-staging service, sops->railway key sync (dry-run first), deploy, domain |
| dc3-004 | concierge3-rehearsal-01 | concierge3-arc-002 | Staging rehearsal battery (nav suggestion + form fill beats) + closeout/UAT handover |

Commit labels: `Epic: demo-concierge / Slice: <label> / Arc: <arc> /
Campaign: demo-concierge-003 / Human checkpoint: campaign-closeout`.

## Contract Defaults (D046)

- Suggestions are proposals only: nothing navigates or fills without an
  explicit user click; invalid or off-manifest targets are dropped
  server-side before the browser ever sees them.
- Form-fill proposals are restricted to the known apply-form field names;
  values apply client-side with native input/change events so the shared
  Astro-source component stays untouched.
- D045 posture carries over: ungated model, system-prompt guardrails, kill
  switch (also silences suggestions/fill), rate limits.
- The staging service mirrors production config; OPENAI_API_KEY flows
  sops -> railway via the established stdin tooling, dry-run recorded.

## Non-Goals / Preserved Human Gates

- No merge to dev, no production deploy, no custom domain — UAT gate.
- No auto-execution of any suggestion; no write-capable account flows; no
  changes to engine path, ipoc, widgets, or the Astro site.

## Proof Bar

- concierge3-arc-001: live flows prove a navigation suggestion rendered and
  executed by click on a non-apply route, an off-manifest hallucination
  dropped (forced via prompt or fixture), and a form-fill proposal applied
  by click with the Vue state visibly updated; contact battery green.
- concierge3-arc-002: staging URL serves the site; rehearsal battery
  including suggestion and fill beats green against staging; production
  spot-check confirms prod is untouched by this campaign; closeout with
  consistency output and UAT script.

## Stop Conditions

Campaign-001/002 stop conditions, plus: form filling cannot drive the
shared component through native events without modifying it; structured
output cannot be validated server-side; staging service costs or conflicts
surface on the shared project.
