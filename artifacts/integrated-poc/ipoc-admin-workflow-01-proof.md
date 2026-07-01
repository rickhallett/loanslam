# Integrated POC Admin Workflow 01 Proof

Date: 2026-07-01

## Scope

- Epic: ipoc
- Slice: ipoc-admin-workflow-01
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

Probe path (session performed demo lookup + one account answer, then the
handoff-shaped engine turn created ticket `TCK-90719BE9`):

- `GET /api/ipoc/admin/tickets` showed the ticket with session activity:
  `lookup_matched: Matched demo record LS-10001.` and
  `account_answer: Answered nextPaymentDate from demo record LS-10001.`
- `POST /api/ipoc/admin/tickets/:id/status {in_review}`: status became
  `in_review`; repeating the same transition returned HTTP 409.
- `POST .../notes` with a blank note: HTTP 400. With a real note: note listed
  on the ticket.
- `POST .../status {resolved}`: status became `resolved`; resolving again
  returned HTTP 409. Unknown ticket id returned HTTP 404.

## Browser Evidence

- Screenshot: `artifacts/integrated-poc/ipoc-admin-workflow-01-browser.png`
- Path exercised (headless Chromium via playwright-core against the real dev
  server, including a real engine turn):
  1. Customer completed demo lookup for `LS-10001` and asked for the next
     payment date.
  2. Customer sent the handoff message through the engine; ticket appeared.
  3. Admin clicked "Start review" (status `in_review`), added the note
     "Reviewed demo lookup and answer activity; resolving demo ticket.", then
     clicked "Resolve" (status `resolved`).
  4. Ticket detail showed the session activity events, the agent note, and the
     final `resolved` status.

## Boundaries Held

- Ticket store remains thin and in-memory; status, notes, and activity are
  demo workflow state, not CRM/audit persistence.
- Status transitions are validated (open/intake_captured -> in_review ->
  resolved); intake capture no longer regresses an in_review/resolved ticket.
- Activity events carry only synthetic demo references, no PII.
- Engine, validator, and routing semantics untouched.
- Static checks are support only; behavior proof is the API and browser paths
  above.

## Checks

- `npm --workspace @loanslam/integrated-poc run typecheck` passed.
- `just gate-slice -- --staged` and `just verify` results recorded in the
  commit that lands this slice.
