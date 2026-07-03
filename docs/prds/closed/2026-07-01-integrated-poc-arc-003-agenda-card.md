# Integrated POC Arc 003 Agenda Card - 2026-07-01

Status: closed (historical record). Arc closeout receipt:
`artifacts/integrated-poc/ipoc-arc-003-closeout.md`.
Was: green. Human green-light was given upfront for the whole arc on
2026-07-01 (decision log D037/D038). This card authorizes all five slices
below without per-slice human checkpoints; only the Human Gate section
interrupts the run.

## Objective

Run the first batch-authorized multi-slice arc (`ipoc-arc-003`) on top of the
completed golden-path and handoff-capture arcs. The arc takes the Integrated
POC from "capture a handoff" to "demonstrate read-only existing-customer
value": mock-record customer lookup, read-only account answers, admin workflow
improvements, an integration-proof batch, and a widget-adapter sunset
assessment.

Unlike arc-001/arc-002, this arc replaces per-slice human green-lights with
machine gates between slices and per-slice proof receipts. Human judgement is
collected upfront (see Upfront Decisions) or at the invariant gates below.

## Upfront Decisions

Recorded in `docs/core-product-decision-log.yaml`:

- D037: existing-customer lookup and read-only account answers are authorized
  for the Integrated POC against synthetic mock records only. Account actions
  and write-capable flows remain gated.
- D038: lookup match fields are `fullName`, `dateOfBirth`, `address`, and
  `loanReference`. Full `address` supersedes `postcode` for lookup matching
  (explicit human decision; the previous postcode-to-address gate is resolved
  for this surface). The demoable answer set defaults to `nextPaymentDate`,
  `outstandingBalance`, and `loanStatus` — this default was agent-chosen and
  is vetoable; shrinking it is allowed without a new decision, expanding it is
  not.

## Source Chain

This card is valid only with these current sources:

- `docs/roadmaps/2026-07-01-integrated-poc-roadmap.yaml`
- `docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md`
- `docs/prds/closed/2026-07-01-integrated-poc-handoff-capture-form-agenda-card.md`
- `artifacts/integrated-poc/ipoc-golden-path-01-proof.md`
- `artifacts/integrated-poc/ipoc-handoff-capture-01-proof.md`
- `CONTEXT.md`
- `docs/core-product-decision-log.yaml`
- `docs/prds/closed/2026-06-30-integrated-poc-reference.md`
- `docs/llm-turn-planner-architecture.md`

## Good Look

- The Integrated POC App still lives in `packages/integrated-poc/`; no existing
  site, demo-host, demo-widget, review-host, or review-widget package is
  mutated (demo-widget and review-widget stay separate by design).
- A customer can identify as an existing customer, submit the four lookup
  fields, and be matched against a small synthetic mock-record set held in the
  thin in-memory store. No match means no data disclosure — the flow degrades
  to the current safe handoff path.
- A matched customer can receive read-only answers for the demoable answer set
  only. Answers are rendered from the mock record server-side; the browser
  never receives the full record.
- Lookup is demo identification, not identity verification. The UI labels the
  data demo-only; proof uses synthetic values throughout.
- Admin/human-agent readback gains workflow improvements: ticket status
  transitions, agent notes, and visibility of lookup/answer activity on the
  ticket.
- The Hell Week battery is extended to cover the lookup and account-answer
  paths, per the repo evidence discipline. All LLM inference in simulations,
  judges, or probes uses the OpenAI ladder per the provider mandate.
- The widget-adapter sunset assessment is a written recommendation with
  evidence, not a deletion.

## Arc Chain

Arc label: `ipoc-arc-003`. Roadmap chain: `arc_003_chain`.

| Chain id | Slice label | Summary |
| --- | --- | --- |
| ipoc-010 | ipoc-customer-lookup-01 | Read-only existing-customer lookup against mock records |
| ipoc-011 | ipoc-account-answers-01 | Read-only account-answer demo from the matched mock record |
| ipoc-012 | ipoc-admin-workflow-01 | Admin/human-agent workflow improvements on the ticket view |
| ipoc-013 | ipoc-integration-proof-01 | Browser-proof batch plus Hell Week battery extension |
| ipoc-014 | ipoc-adapter-sunset-01 | Widget-adapter sunset assessment (docs-only) |

ipoc-012 is independent of ipoc-010/011 and may run in parallel in a separate
worktree if useful; ipoc-013 depends on 010–012; ipoc-014 depends on 013.

Commit label shape per slice:

```text
Epic: ipoc
Slice: <slice label above>
Arc: ipoc-arc-003
Human checkpoint: arc-closeout
```

## Non-Goals

- Account, application, payment, or repayment-date actions; any write-capable
  account flow.
- Real identity verification, auth, CRM, SoloSight, webhook, or production
  audit persistence.
- Real customer PII entry, storage, or lookup against real data.
- Expanding the demoable answer set beyond D038 without a new human decision.
- Changing engine, validator, routing, safety, product vocabulary, or evidence
  semantics to make lookup or answers easier.
- Deleting or mutating the widget-adapter packages (assessment only).
- Deploying or changing Vercel/Railway/secret-source configuration.

## Allowed Autonomy

The implementation agent may, across the whole arc without further human
green-lights:

- Add lookup form UI, matched-customer answer UI, and admin workflow UI to
  `packages/integrated-poc/`.
- Add API handlers and controller/service/repository boundaries for lookup,
  answer readback, ticket status transitions, and agent notes.
- Seed a small synthetic mock-record set in the in-memory store and extend the
  thin ticket model to reference lookup/answer activity.
- Add focused validation and focused tests where they protect route contracts
  or give regression safety.
- Extend the Hell Week battery and run it with OpenAI-backed judges per the
  provider mandate.
- Run local browser verification and capture one proof receipt per slice.
- Update the roadmap slice statuses as each slice completes.
- Make atomic commits with the labels above and the required co-author
  trailer, and write non-blocking checkpoint notes between slices.

The agent must not do anything listed in Non-Goals or gated below.

## Proof Bar

Per slice (receipts under `artifacts/integrated-poc/`):

- Browser proof through the real app path for customer-visible slices; admin
  readback proof for workflow slices; battery run output for ipoc-013.
- Receipt names exact commands, local URLs, screenshots or captured artifacts,
  and relevant commit hashes.
- `just gate-slice -- --staged` passes before each commit; `just verify`
  passes unless only docs changed.
- No behavior claim from static or mocked tests alone.

Arc closeout:

- `just branch-risk -- --base dev` run and reported.
- Roadmap, this card, implementation diffs, and proof receipts agree.
- A single arc-closeout summary lists slice outcomes, receipts, and any
  deferred items.

## Human Gate

Stop for human judgement before:

- Expanding lookup fields or the demoable answer set beyond D037/D038.
- Any write-capable account flow, account action, or payment/repayment change.
- Adding real PII, auth, identity verification, CRM/SoloSight/webhook,
  deployment, or secret changes.
- Changing Customer-Visible Contract behavior, engine semantics, validator
  policy, routing policy, evidence labels, or safety posture.
- Persisting lookup or answer data outside the thin mock in-memory store.
- Acting on the widget-adapter sunset assessment (deletion or migration).
- Promoting the branch with inherited ENGINE risk without integration proof.

## Stop Condition

Stop and produce a checkpoint instead of continuing if:

- Lookup or answers require changing the current engine contract.
- The mock-record or ticket model starts growing into CRM, KYC, production
  audit, or customer account state.
- The proof path requires real PII, secrets, deployment changes, or external
  services.
- A flow works only through a mocked test and not through the real app path.
- The Hell Week extension cannot run under the OpenAI provider mandate.
- This card, the roadmap, implementation diff, and proof receipts disagree.

## Recommended Execution Order

1. Confirm branch/worktree base and proof obligations.
2. Mark `ipoc-customer-lookup-01` active in the roadmap.
3. Execute ipoc-010 and ipoc-011 serially; capture per-slice proof.
4. Execute ipoc-012 (serially or in a parallel worktree merged back).
5. Execute ipoc-013 (proof batch + Hell Week extension).
6. Execute ipoc-014 (sunset assessment document).
7. Run arc closeout: branch risk, closeout summary, roadmap final statuses.
