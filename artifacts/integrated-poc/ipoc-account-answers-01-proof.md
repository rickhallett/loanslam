# Integrated POC Account Answers 01 Proof

Date: 2026-07-01

## Scope

- Epic: ipoc
- Slice: ipoc-account-answers-01
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

## API Evidence

Probe path (fresh session):

1. `POST /api/ipoc/sessions/:conversationRef/account-answers` before any
   lookup: HTTP 403 ("No matched demo record for this session.").
2. `POST /api/ipoc/sessions/:conversationRef/lookup` with matching synthetic
   fields for `LS-10001`.
3. `POST .../account-answers` for each question:
   - nextPaymentDate: "Your next demo payment for LS-10001 is due on 2026-07-28."
   - outstandingBalance: "Your demo outstanding balance for LS-10001 is £1,240.50."
   - loanStatus: "Your demo loan LS-10001 is currently active."
4. Unknown question `badQuestion`: HTTP 400 naming the allowed set.

Answers are rendered server-side from the mock record; the response carries
only the answer string and conversation messages, never the record.

## Browser Evidence

- Screenshot: `artifacts/integrated-poc/ipoc-account-answers-01-browser.png`
- Path exercised (headless Chromium via playwright-core against the real dev
  server):
  1. Opened the app, completed the demo lookup for `LS-10001`.
  2. Clicked "Next payment date", "Outstanding balance", "Loan status".
  3. Conversation showed each customer question and its demo answer, ending
     with "Your demo loan LS-10001 is currently active."

## Boundaries Held

- Answer set is exactly the D038 default: nextPaymentDate, outstandingBalance,
  loanStatus. No expansion.
- Read-only throughout: no account action, mutation, or write-capable flow.
- Answers gated on a matched session; unmatched sessions get 403 and no data.
- Engine, validator, and routing semantics untouched; the demo answers are an
  app-level path over the mock store, and the engine handoff path remains the
  route for unmatched account-specific requests.
- Static checks are support only; behavior proof is the API and browser paths
  above.

## Checks

- `npm --workspace @loanslam/integrated-poc run typecheck` passed.
- `just gate-slice -- --staged` and `just verify` results recorded in the
  commit that lands this slice.
