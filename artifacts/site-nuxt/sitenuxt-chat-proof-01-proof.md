# Site Nuxt Chat Proof 01

Date: 2026-07-02

- Epic: site-nuxt / Slice: sitenuxt-chat-proof-01 / Arc: sitenuxt-arc-002
- Agenda: `docs/prds/2026-07-02-site-nuxt-arc-002-agenda-card.md` (D042)

## Behavior battery

`node scripts/sitenuxt-chat-battery.mjs` against the local built server under
secrets: 9/9 (report
`artifacts/site-nuxt/sitenuxt-chat-battery-2026-07-02T05-52-19-040Z.json`).
Live-engine cases: account question -> `request_handoff_intake` with
`intake_form` UiPlan; post-cancel turn -> grounded `answer`. Surface checks:
lookup/answers routes 404 on the site (not exposed); intake validation and
capture; unknown-session cancel 404.

## Visual parity vs the Astro iframe widget (both alive)

`node scripts/contact-chat-parity.mjs` with the Astro preview + review-widget
dev server on one side and the built Nuxt site on the other, 1280x900,
animations disabled (artifacts in `artifacts/site-nuxt/chat-parity-sn008/`):

- Panel geometry identical: 500x700, right 24, bottom 96, radius 16px, z 9998.
- Launcher chrome identical: 60x60, right 24, bottom 24, rgb(0,135,155).
- Closed-state page pixels: 0.00%.
- Open-state page pixels: 0.41% (iframe widget vs native port; escalation
  threshold 2% — no human review required).

## Panel behavior proof (sn-007, referenced)

9/9 browser checks including auto-open with frost, close/reopen, live engine
handoff, cancel back into chat, intake capture to terminal state
(`artifacts/site-nuxt/sitenuxt-chat-panel-01-browser.png`).

## Boundaries held

- No engine/validator/lab-server changes; review-widget and demo-widget
  untouched; Astro site untouched.
- Chat backend is the shared ipoc surface plus the cancel-handoff route over
  the engine's exported helper.
