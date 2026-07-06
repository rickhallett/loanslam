# Local Proof Cleanout - 2026-07-06

This records the item 34 cleanup from
`docs/reports/2026-07-05-adversarial-cleanup-review.md`.

Ignored local proof piles were removed from this checkout. No tracked history was
rewritten and no committed proof receipts were deleted. The retained durable
indexes are:

- `artifacts/evidence-index/hell-week-runs.md`
- `artifacts/evidence-index/phase0-retention-2026-07-06.md`
- `artifacts/evidence-index/ui-proof-receipts-2026-07-06.md`
- `artifacts/evidence-index/demo-concierge-proof-scripts-2026-07-06.md`

Removed local-only paths:

- `artifacts/ccusage/`
- `artifacts/contact-assistant-ux*/`
- `artifacts/demo-concierge/chat-parity-dc002/`
- `artifacts/demo-concierge/dc002-surface/`
- `artifacts/demo-concierge/dc003-navigate/`
- `artifacts/demo-concierge/dc005-form-state/`
- `artifacts/demo-concierge/dc006-handoff/`
- `artifacts/demo-concierge/dc2-*/`
- `artifacts/demo-concierge/frost-scope/`
- `artifacts/demo-concierge/nav-offer/`
- `artifacts/demo-concierge/rehearsal*/`
- `artifacts/demo-resilience/dr*/`
- `artifacts/integrated-poc/*-browser.png`
- `artifacts/phase0/`
- `artifacts/seam-walk*/`
- `artifacts/site-nuxt/chat-parity-sn008/`
- `artifacts/site-nuxt/*-browser*.png`
- `artifacts/site-nuxt/*-live.png`
- `artifacts/site-nuxt/site-nuxt-apply-01-interactive.png`

After cleanup, `git status --ignored --short artifacts` reports only the current
ignored runtime receipt:

```text
!! artifacts/evidence-index/floor-delta-latest.json
```
