# Site Nuxt Arc 001 Agenda Card - 2026-07-02

Status: closed (historical record). Arc closeout receipt:
`artifacts/site-nuxt/sitenuxt-arc-001-closeout.md`.
Was: green. Human green-light given 2026-07-02 (decision log D041).
Batch-authorized like ipoc-arc-003/004: machine gates between slices,
per-slice proof receipts, human checkpoint at arc closeout. Shared mechanics
(labels, gates, receipts) follow
`docs/prds/closed/2026-07-02-integrated-poc-arc-004-agenda-card.md`.

## Objective

Recreate the Astro marketing site (`site/`) in a new Nuxt app
(`packages/site-nuxt`) with byte-identical content and visually identical
styling, proven route-by-route by a committed parity harness, and deploy it
as its own Railway service. The arc ends with both sites live side by side;
cutover stays human-gated.

## Parity standard (the proof mechanism)

Historical note, 2026-07-06: the Astro package and the Astro-to-Nuxt parity
scripts were retired after the Nuxt surface became the owned site. Current route
and UI proof receipts live in
`artifacts/evidence-index/ui-proof-receipts-2026-07-06.md` and
`packages/site-nuxt/route-manifest.json`.

- The Astro production build's emitted routes were the parity contract; a
  committed route manifest was generated from `site/dist`.
- The now-retired parity harness loaded every route on both apps
  (animations disabled, fonts settled) and produced per route, per viewport
  (1280x900, 375x812): a normalized DOM-text diff and a pixel-diff ratio.
- Pass: text matches exactly and pixel ratio <= 0.5%. Failing routes emit
  diff images for human review; passing routes need no human eyes.
- Committed parity report JSON is the receipt for every slice.

## Arc Chain

Arc label: `sitenuxt-arc-001`. Roadmap:
`docs/roadmaps/2026-07-02-site-nuxt-roadmap.yaml`.

| Chain id | Slice label | Summary |
| --- | --- | --- |
| sn-001 | site-nuxt-scaffold-01 | Nuxt package, layout/chrome port, parity harness; 404 + one prose route green |
| sn-002 | site-nuxt-prose-01 | Content lib, catch-all prose template, news routes green |
| sn-003 | site-nuxt-bespoke-01 | Home, faq, instalment-loan, contact, login green |
| sn-004 | site-nuxt-apply-01 | Apply page + ApplicationJourney.vue reuse; parity + interactive proof |
| sn-005 | site-nuxt-deploy-01 | Railway service, live URL, live parity spot-check, closeout |

Commit label shape: `Epic: site-nuxt / Slice: <label> / Arc: sitenuxt-arc-001
/ Human checkpoint: arc-closeout`.

## Non-Goals / Human Gates

- No content or styling changes: parity means parity; any intentional
  deviation is a human decision first.
- No changes to `site/`, `loanslam-site`, `loanslam-ipoc`, Postgres, DNS, or
  custom domains. No cutover, no redirects, no SEO changes (the site ships
  `noindex` as today).
- The engine/POC surfaces are untouched; site-plus-assistant unification is a
  later product decision.
- Stop and checkpoint if parity cannot converge on a route without changing
  content, if the harness needs mocked rendering, or if card/roadmap/diff/
  receipts disagree.

## Proof Bar

- Per slice: parity report JSON committed showing every in-scope route green;
  `just gate-slice -- --staged` per commit; `just verify` for code slices.
- sn-004 additionally: headless browser proof of the interactive apply
  journey.
- sn-005: live URL parity spot-check receipt; `just branch-risk -- --base
  dev` at closeout.
