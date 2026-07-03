# Demo Resilience Campaign 001 — Closeout

Date: 2026-07-03. Card: docs/prds/2026-07-02-demo-resilience-campaign-001-card.md (D047).

## Outcome

The demo survives a mid-conversation server restart, and the concierge
feels faster. Lost server sessions self-heal from the client transcript
(proven live against production with a real `railway redeploy` mid-
conversation), and plain-text concierge replies stream into the panel.

## Slices

| Slice | Commit | Proof |
| --- | --- | --- |
| dr-001 resurrection | a21bc31 | local 4/4 (recall across destroyed session, no dupes); battery 9/9 |
| dr-002 streaming | dab7df6 | 3/3 (40 growing partials); dr-001 re-proven 4/4; battery 9/9; rehearsal 6/6 local |
| dr-003 deploy | this commit | live: rehearsal 6/6, redeploy-recovery 5/5, parity harness green (see below) |

## dr-003 live proofs (production, loanslam-site-nuxt)

- Deployment 3b951a45 SUCCESS (2026-07-03).
- `concierge-rehearsal.mjs` against the live URL: 6/6 beats (campaign-001/002
  choreography unregressed on the resilience build).
- `dr003-live-restart-proof.mjs`: 5/5 — live conversation established;
  session known pre-restart (invalid-body probe 400); real
  `railway redeploy` wiped it (probe 404); the same open browser session
  recovered with the earlier fact recalled ("Orsino… cello"); no duplicate
  turns. Receipt: `dr003-live-restart/recovered-after-redeploy.png`.
- Site parity harness (Astro contract vs this exact tree, local): 52/52
  checks, 0.00% pixel diff and exact text/title on every route/viewport
  (`artifacts/site-nuxt/parity-2026-07-03T03-30-32-137Z/parity-report.json`).
  The merge to dev is a straight descendant of this tree with no further
  changes, so battery + parity results carry to the merged result.

## Boundaries held

- Client-side resilience only — no durable/server-side session store.
- Engine path, ipoc, widgets, Astro site, campaign-003 staging branch all
  untouched; non-streaming JSON remains the route default for scripts.
- Kill switch and rate limits unchanged and in force.

## For the human

A mid-demo Railway restart is now a non-event: the panel keeps its
transcript and the concierge keeps its memory of the conversation. The
thinking-dots pause is gone — replies render as they generate. The
deploy-flow correction (Railway CLI git-root gotcha) is recorded in
`docs/demo-concierge-runbook.md`.
