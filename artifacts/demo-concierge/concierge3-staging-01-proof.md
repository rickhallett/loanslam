# Concierge3 Staging 01 Proof

Date: 2026-07-02

- Epic: demo-concierge / Slice: concierge3-staging-01 / Arc:
  concierge3-arc-002 / Campaign: demo-concierge-003 (D046, staging tier)

## Change

New Railway service `loanslam-site-nuxt-staging` (project
loanslam-staging-site, production environment) serving the campaign-003
build. Keys via the established sops -> railway stdin tooling: dry-run
recorded (2 keys: OPENAI_API_KEY, DEMO_STATE_TOKEN_SECRET), then apply.
Domain generated. No values printed anywhere.

## Proof

- Staging URL: https://loanslam-site-nuxt-staging-production.up.railway.app
  - `/api/concierge/status` -> {"enabled":true,"model":"gpt-5.5"}
  - `/contact/` -> 200
- Production untouched by this campaign: no deploy was executed against
  `loanslam-site-nuxt` on `feature/demo-concierge-03`; prod status still
  serves the campaign-002 build ({"enabled":true}).
