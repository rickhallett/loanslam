# Integrated POC Customer Lookup 01 Proof

Date: 2026-07-01

## Scope

- Epic: ipoc
- Slice: ipoc-customer-lookup-01
- Arc: ipoc-arc-003
- Human checkpoint: arc-closeout
- Branch: feature/ipoc-golden-path-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-golden-path-01
- Authorization: batch arc green-light (D037/D038), agenda card
  `docs/prds/2026-07-01-integrated-poc-arc-003-agenda-card.md`

## Local App

- URL: http://127.0.0.1:3631/
- Run command:
  `just secrets-run local -- npm --workspace @loanslam/integrated-poc run dev -- --port 3631`
- Secret handling: existing local secret wrapper; no decrypted values printed
  or copied to an env cache.

## API Evidence

Probe path:

1. `POST /api/ipoc/sessions`
2. `POST /api/ipoc/sessions/:conversationRef/lookup` (matching synthetic fields)
3. `POST /api/ipoc/sessions/:conversationRef/lookup` (wrong dateOfBirth)
4. `POST /api/ipoc/sessions/:conversationRef/lookup` (missing loanReference)

Observed results:

- Matched lookup (fullName `Demo Applicant`, dateOfBirth `1990-01-01`,
  address `1 Demo Street, Demotown, AB12 3CD`, loanReference `LS-10001`):
  `{"matched": true, "customer": {"fullName": "Demo Applicant", "loanReference": "LS-10001"}}`
  — response contains only the display-safe pair, never the full mock record.
- No-match lookup (wrong dateOfBirth): `{"matched": false, "customer": null}`
  with an assistant message degrading to the standard safe handoff path and no
  account data disclosed.
- Missing field: HTTP 400.

## Browser Evidence

- Screenshot: `artifacts/integrated-poc/ipoc-customer-lookup-01-browser.png`
- Path exercised (headless Chromium via playwright-core against the real dev
  server):
  1. Opened the Integrated POC app.
  2. Clicked "I'm an existing customer" and submitted the prefilled synthetic
     lookup form.
  3. Observed banner: `Matched demo record LS-10001 for Demo Applicant.`
  4. Observed assistant message: "Thanks Demo Applicant, I've matched demo
     record LS-10001. I can answer read-only demo questions about your next
     payment date, outstanding balance, or loan status."
  5. Fresh page: same form with dateOfBirth `1991-02-02` observed
     `No matching demo record. No account information is available; the safe
     handoff path is still open.`

## Boundaries Held

- Lookup matches only on fullName, dateOfBirth, address, loanReference (D038).
- Mock records are synthetic, in-memory, and server-side only; the browser
  never receives dateOfBirth, address, balances, or statuses from the store.
- No match means no data disclosure; the safe handoff path remains available.
- No auth, CRM, SoloSight, webhook, account mutation, deployment, or secret
  changes. Engine, validator, and routing semantics untouched.
- Static checks are support only; behavior proof is the API and browser paths
  above.

## Checks

- `npm --workspace @loanslam/integrated-poc run typecheck` passed.
- `just gate-slice -- --staged` and `just verify` results recorded in the
  commit that lands this slice.
