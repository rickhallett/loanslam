# Demo Concierge Campaign 002 — Closeout

Date: 2026-07-02
Card: `docs/prds/2026-07-02-demo-concierge-campaign-002-card.md` (D046)
Live URL: https://loanslam-site-nuxt-production.up.railway.app

## Outcome delivered (production)

The concierge is present across the whole site, dormant until clicked
(contact keeps auto-open), page-aware on every route it serves, and the
conversation survives full page loads.

## Slices

| Slice | Commit | Proof |
| --- | --- | --- |
| dc2-001 presence | 9169619 | presence 8/8; harness 52/52 (generalized D046 mask) |
| dc2-002 page-context | 61008e8 | 3/3 live (FAQ + product awareness; contact still engine) |
| dc2-003 persistence | fb06a91 | 4/4 live (restore, recall across reload, reset clears) |
| dc2-004 deploy | this commit | local regression: battery 9/9, campaign-001 rehearsal 6/6, harness 52/52; live spot proofs 3/3 page-context and 4/4 persistence on production |

`just verify` exit 0 at every slice; consistency check green throughout.

## Boundaries held

Engine path, ipoc, widgets, Astro site untouched; /contact/ still serves
the validated engine (proven live: account question -> intake form).
Kill switch and rate limits unchanged and live.

## Notes for UAT

- The full campaign-001 demo choreography still passes unchanged (6/6).
- Persistence is per-tab (sessionStorage); tab close is a clean slate.
