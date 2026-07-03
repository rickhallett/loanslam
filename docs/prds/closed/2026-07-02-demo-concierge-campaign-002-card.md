# Demo Concierge Campaign 002 Card - 2026-07-02

Status: closed 2026-07-02 (historical record). Closeout receipt:
`artifacts/demo-concierge/demo-concierge-002-closeout.md`.
Was: green. Authorized 2026-07-02 by D046 (risk-split expansion; this is
the confident tier). Mechanics per `docs/campaign-workflow-protocol.md` and
the campaign-001 card. Single human checkpoint: campaign closeout, feeding
the joint UAT round with campaign-003.

## Outcome

The concierge is present but dormant across the whole site: launcher on
every route, closed by default (contact keeps its auto-open), page-aware on
every route it serves (DOM-derived page snapshot: route, title, headings,
text excerpt), with the conversation surviving full page loads via
sessionStorage. Deploys to the existing production demo service.

## Arc Chain

Campaign label: `demo-concierge-002`. Roadmap:
`docs/roadmaps/2026-07-02-demo-concierge-002-roadmap.yaml`. Branch:
`feature/demo-concierge-02` off dev (05da1f9), worktree
`.claude/worktrees/demo-concierge-01`.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| dc2-001 | concierge-presence-01 | concierge2-arc-001 | Launcher on all routes, closed by default; harness deviation generalized |
| dc2-002 | concierge-page-context-01 | concierge2-arc-001 | Page snapshot context; concierge serves all routes except /contact/; prompt generalized to site guide |
| dc2-003 | concierge-persistence-01 | concierge2-arc-001 | Transcript/session refs persist in sessionStorage across full page loads |
| dc2-004 | concierge2-deploy-01 | concierge2-arc-002 | Full regression (battery, parity, rehearsal) + production deploy + live proof + closeout |

Commit labels: `Epic: demo-concierge / Slice: <label> / Arc: <arc> /
Campaign: demo-concierge-002 / Human checkpoint: campaign-closeout`.

## Contract Defaults (D046)

- Concierge serves every route except /contact/ (the validated engine keeps
  the support chat); /apply/ additionally includes the form snapshot.
- Page snapshot is DOM-derived and capped (title, h1/h2 headings, ~1200
  chars of main text); synthetic prototype content only.
- Launcher closed by default everywhere; auto-open remains contact-only.
- Persistence uses sessionStorage (per-tab, cleared on tab close); restored
  transcripts render text only (no interactive UiPlans).
- Kill switch and rate limits unchanged and in force.

## Non-Goals / Preserved Human Gates

- Everything from the campaign-001 card (engine path, Astro site, DNS,
  auth/PII/CRM, productization).
- No structured output, navigation suggestions, or form filling — that is
  campaign-003, staging only.

## Proof Bar

- concierge2-arc-001: surface proof (launcher on prose/news/faq routes,
  closed by default; contact auto-open unchanged); page-aware live turns on
  at least two non-apply route types; persistence proof across a full page
  reload; contact battery green.
- concierge2-arc-002: full manifest parity harness green with the
  generalized deviation; campaign-001 rehearsal still 6/6; production
  deploy; live page-aware and persistence spot proof; closeout with
  consistency-check output.

## Stop Conditions

Campaign-001 stop conditions, plus: persistence cannot restore without
corrupting chat behavior; the generalized parity deviation masks anything
beyond chat chrome.
