# Concierge Presence 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge-presence-01 / Arc:
  concierge2-arc-001 / Campaign: demo-concierge-002 (D046)

## Change

Launcher on every route, closed by default; only /contact/ auto-opens. The
parity harness gains a default Nuxt-side chat-chrome mask (D046) so the
site-wide launcher is one recorded deviation and every page body stays
pixel-guarded; /contact/ keeps its both-sides mask (D042/D043).

## Proof

- `scripts/dc2-001-presence-proof.mjs`: 8/8 — launcher visible + panel
  closed on /, /faq/, /instalment-loan/, /news/, /privacy-policy/; opens and
  closes on /; contact auto-open unchanged
  (`artifacts/demo-concierge/dc2-001-presence/`).
- Full manifest parity harness: 52/52
  (`artifacts/demo-concierge/parity-dc2-001/parity-report.json`).
