# Site Nuxt Arc 001 Closeout

Date: 2026-07-02

Arc: `sitenuxt-arc-001` — Astro-to-Nuxt site migration, batch-authorized
(D041). Live URL: https://loanslam-site-nuxt-production.up.railway.app

## Parity result

The full Astro route manifest (26 routes) passes machine parity in the Nuxt
app: normalized body text, page titles, and full-page pixels at desktop
(1280x900) and mobile (375x812), threshold 0.5%, actual diff 0.00% on every
check. No route required human diff review.

- Full-manifest run: 52/52
  (`artifacts/site-nuxt/parity-sn004-full/parity-report.json`)
- Live spot-check (local Astro build vs deployed URL): 16/16
  (`artifacts/site-nuxt/parity-sn005-live/parity-report.json`)

## Slice outcomes

| Slice | Receipt | Commit |
| --- | --- | --- |
| site-nuxt-scaffold-01 | artifacts/site-nuxt/site-nuxt-scaffold-01-proof.md | 33b0435 |
| site-nuxt-prose-01 | artifacts/site-nuxt/parity-sn002/parity-report.json | 8e0ef1b |
| site-nuxt-bespoke-01 | artifacts/site-nuxt/parity-sn003/parity-report.json | e3b2496 |
| site-nuxt-apply-01 | artifacts/site-nuxt/parity-sn004-full/parity-report.json | e0ce94c + 931718c |
| site-nuxt-deploy-01 | artifacts/site-nuxt/parity-sn005-live/parity-report.json | (this commit) |

Arc agenda: `docs/prds/2026-07-02-site-nuxt-arc-001-agenda-card.md`
(commit c314874).

## Architecture notes

- Single source until cutover (D041): the Nuxt app imports the Astro site's
  content JSON, site-copy JSON, global CSS, public assets, and
  `ApplicationJourney.vue` in place. Content parity holds by construction;
  only templates could diverge, and the harness checks those.
- Deploys as `loanslam-site-nuxt` on Railway via the prebuilt-artifact pack
  pattern (`scripts/site-nuxt-deploy-pack.mjs`); no secrets needed.
- Interactive proof: apply journey hydrates and validates in the Nuxt build
  (`artifacts/site-nuxt/site-nuxt-apply-01-interactive.png`).

## Process notes (honest ledger)

- The sn-004 commit initially landed with `just verify` failing (nuxt
  typecheck strictness) because a shell pipe masked the exit code; fixed in
  931718c with runtime guards and an unmasked verify (exit 0). The same pipe
  mistake briefly misread a parity run that actually failed due to a stale
  server serving a swapped build; re-run clean at 6/6.
- Astro's scoped `h1 em` accent rule is dead on the live Astro site (the
  injected em never carries the scope attribute); it is reproduced faithfully
  as dead, flagged in `packages/site-nuxt/pages/index.vue` for a future human
  parity-deviation decision.

## Gates

- `just gate-slice -- --staged` on every commit; `just verify` exit 0 on the
  final tree; `just branch-risk -- --base dev`: 36 files, required proof bar
  TOOLING (met by verify).

## Deferred / next human decisions

1. Cutover: pointing traffic at the Nuxt site, moving the shared sources
   from `site/` into `packages/site-nuxt`, and retiring the Astro site — all
   human-gated (D041).
2. The dead em-accent rule: keep dead (parity) or fix (deviation decision).
3. Promotion of `feature/site-nuxt-01` into `dev`.
4. Whether the site and the Integrated POC eventually merge into one app.
