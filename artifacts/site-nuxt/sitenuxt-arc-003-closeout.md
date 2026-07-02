# Site Nuxt Arc 003 Closeout

Date: 2026-07-02

Arc: `sitenuxt-arc-003` — final Astro feature-parity deltas (D044).

## Slice outcomes

| Slice | Receipt | Commit |
| --- | --- | --- |
| sitenuxt-contact-context-01 | artifacts/site-nuxt/sitenuxt-contact-context-01-live.png (4/4 live checks) | 72bb91c |
| sitenuxt-reports-01 | live /reports/ and hell-week-full.html both 200; served in place from review-host | cb92184 |

Also in this branch, arc-002 gained the post-closeout veto slice
`sitenuxt-chat-devtools-01` (D043, commit 2db74ed, 6/6 live checks).

## Feature-parity ledger vs the deployed Astro site

Closed: all 26 routes (0.00% pixel), apply journey, native assistant with
widget-identical chrome and behavior, devtools, contact-route context
reveal, /reports dashboards.

Open by decision: durable conversation recording (D044 defers; the recording
notice stands), access token / rate limiting before wide circulation (D043),
in-memory session loss on redeploy (accepted for demo phase).

Not ported by design: the /demo API and /widget/ iframe delivery (the ipoc
surface is canonical, D042); these retire with the adapter stack.

## Gates

- `just verify` exit 0 on the final tree; gate-slice on every commit.
- Deploy finding recorded: the Railway upload indexer honors the repo-root
  `reports/` gitignore rule; the pack ships a re-include negation.

## Next human decisions

1. Merge `feature/site-nuxt-chat-01` into `dev`.
2. Trigger the sunset plan (one stakeholder demo on the new URL), then the
   retirement arc: adapter stack retire, shared sources migrate from site/
   into packages/site-nuxt, old services decommission after a revert window.
