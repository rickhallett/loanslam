# Integrated POC Handoff Capture Form Agenda Card - 2026-07-01

Status: executed and closed (historical record). The handoff capture chain
completed with receipts under
`artifacts/integrated-poc/ipoc-handoff-capture-01-proof.md`; see
`docs/roadmaps/2026-07-01-integrated-poc-roadmap.yaml`.

## Objective

Add the next Integrated POC slice for structured handoff capture after the
Golden Path Slice has proven the real app route and admin readback.

This slice should let a customer complete the current safe handoff path by
submitting a demo-only capture form, persist the submitted context in the thin
mock ticket store, and show the structured intake fields in the admin/human-agent
readback view.

This was intentionally deferred from `ipoc-golden-path-01`: that slice proved
the customer-to-admin infrastructure and ticket receipt first. This card makes
the capture form the explicit next proof-bearing slice, so it is scheduled and
not left as an implicit gap.

## Source Chain

This card is valid only with these current sources:

- `docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md`
- `docs/roadmaps/2026-07-01-integrated-poc-roadmap.yaml`
- `artifacts/integrated-poc/ipoc-golden-path-01-proof.md`
- `CONTEXT.md`
- `docs/core-product-decision-log.yaml`
- `docs/prds/closed/2026-06-30-integrated-poc-reference.md`
- `docs/llm-turn-planner-architecture.md`

## Good Look

- The Integrated POC App still lives in `packages/integrated-poc/`; no existing
  site, demo-host, demo-widget, review-host, or review-widget package is mutated.
- After the engine returns a handoff/intake-shaped result, the customer can fill
  a visible capture form in the Integrated POC App.
- The form uses the current engine contract fields for this slice:
  `fullName`, `dateOfBirth`, `postcode`, `email`, and `phone`.
- The UI makes the data demo-only and uses synthetic values in proof. The proof
  must not enter or store real customer PII.
- Server-side route/controller/service/repository-style layering owns validation,
  mock ticket update, and readback boundaries.
- The mock ticket store remains thin and in-memory. It does not become a fake
  CRM, auth system, production audit store, webhook sink, or long-term customer
  record model.
- Admin/human-agent readback shows the captured fields, ticket status, engine
  final action, serving mode, and assistant preview.
- Browser proof shows the real flow: customer message -> engine handoff response
  -> capture form submission -> admin readback of the structured intake.

## Slice

Slice id: `ipoc-handoff-capture-01`

Arc label: `ipoc-arc-002`

Commit label shape:

```text
Epic: ipoc
Slice: ipoc-handoff-capture-01
Arc: ipoc-arc-002
Human checkpoint: final-review
```

Target journey:

1. Customer opens the Integrated POC App.
2. Customer asks the current handoff-shaped support question.
3. The app routes the turn through the current engine path.
4. The assistant asks for the current standard handoff fields.
5. Customer submits synthetic demo intake fields through a capture form.
6. Server validates and stores the submitted intake against the mock ticket.
7. Admin/human-agent view reads back the ticket and structured intake fields.

## Non-Goals

- Existing-customer lookup.
- Account answers such as next payment date.
- Account, application, payment, or repayment-date actions.
- Real identity verification, auth, CRM, SoloSight, webhook, or production audit
  persistence.
- Real customer PII entry or persistence.
- Expanding the handoff field contract beyond current engine fields.
- Production-grade privacy/compliance infrastructure.
- Deploying or changing Vercel/Railway/secret-source configuration.

## Allowed Autonomy

The implementation agent may:

- Add customer-side capture form UI to `packages/integrated-poc/`.
- Add API handlers, controller/service/repository boundaries for intake
  submission and ticket update.
- Extend the thin mock ticket model only enough to store the current demo
  handoff fields and read them back.
- Add focused validation for empty or malformed demo fields where it protects
  the route contract.
- Add focused tests for route validation or mock store behavior if they provide
  useful future-agent regression safety.
- Run local browser verification and capture a proof receipt.
- Make atomic commits with the proof-of-work labels above and the required
  co-author trailer.

The implementation agent must not:

- Add real auth, real PII storage, CRM/SoloSight/webhook integration, or secret
  changes.
- Add account answers, eligibility decisions, account mutations, payment
  changes, repayment-date changes, or application actions.
- Change engine, validator, routing, safety, product vocabulary, or evidence
  semantics to make the form easier.
- Expand from `postcode` to full `address` without a human product decision.
- Treat unit or static tests as proof of user-visible behavior.

## Proof Bar

The slice is complete only when all are true:

- `packages/integrated-poc/` runs locally from documented repo commands.
- Browser proof shows the customer handoff question, engine response, capture
  form submission, and admin readback through the real app path.
- Server/admin readback proves the submitted synthetic handoff fields were
  attached to the mock ticket.
- Verification receipt names the exact commands, local URLs, screenshots or
  captured artifacts, and relevant commit hashes.
- `just gate-slice -- --staged` passes before each commit.
- `just verify` passes unless only docs are changed.
- `just branch-risk -- --base dev` is run before closeout and the required proof
  bar is reported.
- No behavior claim is made from static tests alone.

## Human Gate

Stop for human judgement before:

- Changing the handoff field set, especially expanding `postcode` to full
  `address`.
- Changing Customer-Visible Contract behavior, engine semantics, validator
  policy, routing policy, evidence labels, or safety posture.
- Adding real PII, auth, identity verification, CRM/SoloSight/webhook, deployment,
  or secret changes.
- Expanding into existing-customer lookup, account answers, or account actions.
- Persisting intake outside the thin mock in-memory store.
- Continuing after browser proof or admin readback cannot be captured.

## Stop Condition

Stop and produce a checkpoint instead of continuing if:

- The form requires changing the current engine handoff contract.
- The capture model starts growing into CRM, KYC, production audit, or customer
  account state.
- The proof path requires real PII, secrets, deployment changes, or external
  services.
- The browser flow works only through a mocked test and not through the real app
  path.
- This card, the roadmap, implementation diff, and proof receipt disagree.

## Recommended Execution Order

1. Confirm branch/worktree base and proof obligations.
2. Update the roadmap to mark `ipoc-handoff-capture-01` as active.
3. Add customer capture form state to the Integrated POC App.
4. Add intake submission route and thin ticket update/readback behavior.
5. Add admin readback display for the structured intake fields.
6. Capture browser proof through the real app path.
7. Run gates, commit atomically, and produce the end-of-slice checkpoint.
