# Integrated POC Golden Path 01 Proof

Date: 2026-07-01

## Scope

- Epic: ipoc
- Slice: ipoc-golden-path-01
- Arc: ipoc-arc-001
- Human checkpoint: final-review
- Branch: feature/ipoc-golden-path-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-golden-path-01

## Commits

- e086b97 feat(poc): Scaffold integrated POC app
- a74ba5d feat(poc): Wire golden path ticket readback

## Local App

- URL: http://127.0.0.1:3631/
- Run command:
  `just secrets-run local -- npm --workspace @loanslam/integrated-poc run dev -- --port 3631`
- Secret handling: used the existing local secret wrapper for the current OpenAI-backed engine path; no decrypted values were printed or copied to an env cache.

## API Evidence

Probe path:

1. `POST /api/ipoc/sessions`
2. `POST /api/ipoc/sessions/:conversationRef/messages`
3. `GET /api/ipoc/admin/tickets`

Observed result:

```json
{
  "sessionStatus": 200,
  "turnStatus": 200,
  "ticketCount": 1,
  "finalAction": "request_handoff_intake",
  "ticketId": "TCK-7283BE9E",
  "adminTicketId": "TCK-7283BE9E",
  "servingMode": "handoff_account_specific"
}
```

## Browser Evidence

- Screenshot: artifacts/integrated-poc/ipoc-golden-path-01-browser.png
- Customer message: "I need help with my loan application and would like someone to contact me."
- Browser status: `Ticket TCK-A975DE20 is ready for human review.`
- Admin readback values:
  - status: open
  - queue: support
  - action: request_handoff_intake
  - serving mode: handoff_account_specific

## Checks

- `npm --workspace @loanslam/integrated-poc run typecheck`
- `npm --workspace @loanslam/integrated-poc run build`
- `just gate-slice -- --staged`

## Boundaries Held

- Separate app/package: `packages/integrated-poc/`
- Did not mutate `site/`, `packages/demo-host`, `packages/demo-widget`, `packages/review-host`, or `packages/review-widget`
- No account lookup, account answers, account actions, real auth, real PII persistence, CRM, SoloSight, webhook, deployment, or secret-source changes
- Mock ticket receipt omits raw customer message storage
