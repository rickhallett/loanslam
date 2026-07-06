# Demo Widget

Status: frozen legacy iframe skin.

This package is retained for historical demo receipts and build compatibility.
Do not add new behavior, transport changes, or product logic here. Current
customer-facing chat work belongs in `packages/site-nuxt`; review-shell iframe
work belongs in `packages/review-widget`.

Allowed changes:

- security or dependency fixes required to keep `npm run verify` green
- build-tool compatibility fixes
- deletion/migration work that removes this package from active surfaces

The HTTP/session transport intentionally mirrors `packages/review-widget` as of
the freeze point. Do not fork that logic further inside this package.
