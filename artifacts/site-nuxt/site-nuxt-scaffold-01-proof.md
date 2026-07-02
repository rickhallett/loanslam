# Site Nuxt Scaffold 01 Proof

Date: 2026-07-02

- Epic: site-nuxt / Slice: site-nuxt-scaffold-01 / Arc: sitenuxt-arc-001 /
  Human checkpoint: arc-closeout (agenda
  `docs/prds/2026-07-02-site-nuxt-arc-001-agenda-card.md`, D041)

## What landed

- `packages/site-nuxt`: Nuxt app consuming the Astro site's data JSON, global
  CSS, and public assets in place (single source until cutover); ported
  chrome (SiteHeader/SiteFooter/app shell), error page (404), and the
  catch-all prose template.
- `scripts/site-parity-harness.mjs`: per-route text + title + pixel parity
  against the Astro build, thresholded escalation (<=0.5% pixel), diff
  images only for failures. Route manifest generated from `site/dist`
  (26 routes) committed at `packages/site-nuxt/route-manifest.json`.

## Evidence

- Astro preview on 4321 vs built Nuxt output on 3640.
- `node scripts/site-parity-harness.mjs --routes '/__parity-not-found__/,/about-us/,/about-us/credit-score/'`:
  6/6 checks passed, pixel diff 0.00% on every check
  (`artifacts/site-nuxt/parity-sn001/parity-report.json`).

## Findings fixed en route

- Nitro SSR chunk collision: content JSON keys named `process` became
  top-level named exports; fixed with `vite.json.namedExports: false` plus a
  local variable rename in the ported site-copy validator.

## Boundaries held

- `site/` untouched; no content or styling deviation (0.00% is the evidence).
