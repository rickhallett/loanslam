# Site Nuxt Arc 003 Agenda Card - 2026-07-02

Status: completed. This arc was authorized directly in conversation on
2026-07-02 (decision log D044, following the D043 devtools veto) rather than
by an upfront card; this card exists so the card/roadmap/receipt chain stays
auditable. Batch mechanics as in the arc-001/002 cards.

## Objective

Close the final feature-parity deltas against the deployed Astro site:
contact-route highlighting from chat context, and the stakeholder report
dashboards at /reports. With these landed, the Astro stack proceeds toward
retirement under the existing human-gated sunset plan (D044).

## Arc Chain

Arc label: `sitenuxt-arc-003`. Chain `arc_003_chain` in
`docs/roadmaps/2026-07-02-site-nuxt-roadmap.yaml`.

| Chain id | Slice label | Summary |
| --- | --- | --- |
| sn-011 | sitenuxt-contact-context-01 | Contact-route reveal from chat context on panel close |
| sn-012 | sitenuxt-reports-01 | Hell Week report dashboards served at /reports |

## Deferred by D044

- Durable conversation recording on the ipoc surface (the widget's verbatim
  recording notice stands until that decision).

## Proof Bar (met)

- sn-011: 4/4 browser checks locally and on the live URL (reveal on close,
  badge on the promoted card, clear on open).
- sn-012: /reports/ and hell-week-full.html serve 200 locally and live.
- `just verify` exit 0; gate-slice on every commit.
