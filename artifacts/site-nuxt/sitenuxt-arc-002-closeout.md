# Site Nuxt Arc 002 Closeout

Date: 2026-07-02

Arc: `sitenuxt-arc-002` — native ipoc-backed contact chat (D042, option b of
the serving-layer decision). This closeout is the arc's human touchpoint.

Live: https://loanslam-site-nuxt-production.up.railway.app/contact/

## Slice outcomes

| Slice | Receipt | Commit |
| --- | --- | --- |
| sitenuxt-chat-backend-01 | probes in commit message; battery in sn-008 | 634bd28 |
| sitenuxt-chat-panel-01 | artifacts/site-nuxt/sitenuxt-chat-panel-01-browser.png | 9e886b4 |
| sitenuxt-chat-proof-01 | artifacts/site-nuxt/sitenuxt-chat-proof-01-proof.md | fcd7e3a |
| sitenuxt-chat-deploy-01 | artifacts/site-nuxt/sitenuxt-chat-deploy-01-browser.png + battery report | (this commit) |

Arc agenda: `docs/prds/2026-07-02-site-nuxt-arc-002-agenda-card.md`
(commit 3465adc, D042 in the decision log).

## What shipped

- The Nuxt contact page's assistant is now a native launcher/frost/panel —
  no iframe — speaking the ipoc Nitro surface over the same processTurn
  engine. The site server re-exports the shared ipoc handlers (sessions,
  messages, intake) plus a new cancel-handoff route that calls the engine's
  exported `cancelHandoff` helper. Lookup/account-answer routes are NOT
  exposed on the site surface.
- Chrome parity vs the live Astro iframe widget: panel geometry and launcher
  chrome byte-identical; closed-state page pixels 0.00%; open-state 0.41%
  (under the 2% escalation threshold — no human diff review required).
- Behavior: battery 9/9 locally and 9/9 against the live URL (live engine:
  account question -> safe handoff with intake form; post-cancel grounded
  answer). Full panel journey 9/9 on the live URL including intake capture
  to terminal state.

## Gates

- `just gate-slice -- --staged` on every commit; `just verify` exit 0
  (unmasked); `just branch-risk -- --base dev`: 23 files, proof bar TOOLING
  (met). Secrets: dry-run then service-scoped apply of OPENAI_API_KEY and
  DEMO_STATE_TOKEN_SECRET to loanslam-site-nuxt only; no values displayed.

## Contract deltas applied (D042, vetoable)

Reset client-side; cancel-handoff via engine helper; continuation tokens and
demo access token dropped; devtools not carried on the Nuxt page. The
review-widget, demo-widget, /demo lab server, and the Astro site are
untouched — both sites remain live.

## Deferred / next human decisions

1. Veto window on any D042 delta.
2. Promotion of `feature/site-nuxt-chat-01` into `dev`.
3. The launcher auto-opens the panel on the contact page (deployed-Astro
   loader parity). Keep or change is a product call.
4. Site chat sessions are in-memory on the site service; tickets captured
   there are visible only to that service's admin surface (none exposed).
   Wiring site tickets to the ipoc admin readback is a candidate next arc.
