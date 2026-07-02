# Concierge Surface 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-surface-01 / Arc: concierge-arc-001
  / Campaign: demo-concierge-001
- Card: `docs/prds/2026-07-02-demo-concierge-campaign-001-card.md` (D045)

## Change

ChatWidget lifted from `pages/contact.vue` to `app.vue` (layout level) so
chat state survives client-side navigation. The chrome renders only on the
chat routes (`/contact/`, `/apply/`); `/contact/` keeps its per-arrival
auto-open loader parity; the `mal-open` body class is scoped to chat routes.

## Proof

All against the built Nuxt server under secrets (port 3641), Astro preview
(4321), review-widget dev (5175).

- Contact chat parity (`scripts/contact-chat-parity.mjs`): 4/4 — closed-state
  pixels 0.00%, open-state 0.72% (threshold 2%), panel geometry and launcher
  chrome identical (`artifacts/demo-concierge/chat-parity-dc002/`).
- Live-engine battery (`scripts/sitenuxt-chat-battery.mjs`): 9/9 including
  the engine boundary case
  (`artifacts/site-nuxt/sitenuxt-chat-battery-2026-07-02T07-21-20-755Z.json`).
- Full route-manifest parity harness: 52/52 with two named accepted
  deviations recorded in the report — `/apply/` launcher (D045, Nuxt-side
  mask) and `/contact/` chat chrome (D042/D043, masked both sides; the chat
  surface has its own dedicated proof script)
  (`artifacts/demo-concierge/parity-dc002/parity-report.json`).
- Surface browser proof (`scripts/dc002-surface-proof.mjs`): 9/9 — contact
  auto-open + welcome, no chrome on `/` and `/faq/`, launcher on `/apply/`
  closed by default, panel opens/closes with welcome
  (`artifacts/demo-concierge/dc002-surface/apply-panel-open.png`).
- `just verify` exit 0.

## Notes

- Header/footer links remain plain anchors (parity markup), so full-page
  navigation still resets chat state exactly as the Astro iframe did. The
  state-survival mechanism is programmatic SPA navigation, which is what the
  dc-003 chat-driven navigation action uses; cross-navigation persistence is
  proven there per its proof bar.
