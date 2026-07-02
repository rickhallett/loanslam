# Demo Concierge Campaign 003 — Closeout

Date: 2026-07-02
Card: `docs/prds/2026-07-02-demo-concierge-campaign-003-card.md` (D046)
Staging URL: https://loanslam-site-nuxt-staging-production.up.railway.app
Merge gate: `feature/demo-concierge-03` is NOT merged to dev — UAT decides.

## Outcome delivered (staging only)

The concierge proposes and the user disposes: allowlist-validated
navigation suggestions and propose-and-confirm form filling, both rendered
as chips that do nothing until clicked.

## Slices

| Slice | Commit | Proof |
| --- | --- | --- |
| dc3-001 suggest-nav | 1eb4c8d | 4/4 live (allowlist drop under insistence; chip navigates) |
| dc3-002 form-fill | 1d0c212 | 5/5 live (7 fields from conversation; errors 11->4; nothing pre-click) |
| dc3-003 staging | ecdb58b | service + key sync (dry-run recorded) + domain; prod untouched |
| dc3-004 rehearsal | this commit | staging: suggest 4/4, fill 5/5, base rehearsal 6/6 |

`just verify` exit 0 at every code slice; consistency green throughout.

## Boundaries held

- Nothing executes without a user click; off-manifest routes and unknown
  field names die server-side; fills only on the form page.
- ApplicationJourney.vue (shared Astro source) untouched — fills go through
  native input/change events.
- Production serves campaign-002 only; this branch never deployed there.

## UAT

`docs/demo-concierge-uat.md` is the side-by-side script and names the
decision: accept -> merge + one production deploy; reject -> staging stays
a sandbox (kill switch or service deletion).
