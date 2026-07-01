# Integrated POC Handoff Capture Proof

Date: 2026-07-01
Slice: ipoc-handoff-capture-01
Arc: ipoc-arc-002
Worktree: `/Users/mrkai/code/loanslam/.claude/worktrees/ipoc-golden-path-01`
Branch: `feature/ipoc-golden-path-01`

## Scope

Implemented the approved demo-only customer handoff capture slice from
`docs/prds/2026-07-01-integrated-poc-handoff-capture-form-agenda-card.md`.

The capture fields are limited to:

- `fullName`
- `dateOfBirth`
- `postcode`
- `email`
- `phone`

## Commits

- `640e479` - `docs(poc): Add handoff capture agenda`
- `1843df6` - `feat(poc): Add handoff capture form`

## Commands

- `git diff --check`
- `npm --workspace @loanslam/integrated-poc run typecheck`
- `npm --workspace @loanslam/integrated-poc run build`
- `just secrets-run local -- npm --workspace @loanslam/integrated-poc run dev -- --port 3631`
- `just gate-slice -- --staged`

## API Proof

Local URL: `http://127.0.0.1:3631/`

Path exercised:

1. `POST /api/ipoc/sessions`
2. `POST /api/ipoc/sessions/:conversationRef/messages`
3. `POST /api/ipoc/sessions/:conversationRef/intake`
4. `GET /api/ipoc/admin/tickets`

Evidence:

```json
{
  "conversationRef": "3c410b4f-e4f9-4a7e-a22f-34de85cf8e3a",
  "ticketId": "TCK-CC2D0F21",
  "assistantFinalAction": "request_handoff_intake",
  "requestedFields": [
    "fullName",
    "dateOfBirth",
    "postcode",
    "email",
    "phone"
  ],
  "intakeStatus": "intake_captured",
  "structuredIntake": {
    "fields": {
      "fullName": "Demo Applicant",
      "dateOfBirth": "1990-01-01",
      "postcode": "AB12 3CD",
      "email": "demo.applicant@example.invalid",
      "phone": "07000000000"
    },
    "piiPolicy": "synthetic_demo_fields_only"
  },
  "adminReadback": {
    "id": "TCK-CC2D0F21",
    "status": "intake_captured"
  }
}
```

## Browser Proof

Local URL: `http://127.0.0.1:3631/`

Path exercised:

1. Opened the Integrated POC app in the browser.
2. Sent the default customer message through the engine.
3. Submitted the customer-side "Capture for agent" form with synthetic demo values.
4. Verified the admin readback showed `Status: intake_captured`, `Action: request_handoff_intake`, and the captured intake fields.

Browser evidence:

- Screenshot: `artifacts/integrated-poc/ipoc-handoff-capture-01-browser.png`
- Browser ticket observed: `TCK-03E8E782`
- Browser readback included:
  - `Full name`: `Demo Applicant`
  - `Date of birth`: `1990-01-01`
  - `Postcode`: `AB12 3CD`
  - `Email`: `demo.applicant@example.invalid`
  - `Phone`: `07000000000`

## Boundaries Held

- No real customer PII was entered.
- No full-address expansion was added.
- No auth, CRM, SoloSight, webhook, account lookup, account mutation, deployment, or secret changes were added.
- The ticket store remains the existing in-memory demo store.
- Static checks are recorded as support only; behavior proof is from the API and browser paths above.
