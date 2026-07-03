# Integrated POC Implementation Agenda Card - 2026-07-01

Status: executed and closed (historical record). Green-light was given and
the Golden Path Slice chain completed with receipts; see
`docs/roadmaps/2026-07-01-integrated-poc-roadmap.yaml`.

## Objective

Start the Integrated POC with one migration-first Golden Path Slice that proves
the end-to-end infrastructure through a real app route and admin readback.

The first slice should create the new Integrated POC App as a separate
app/package, route one customer-visible journey through the current engine, keep
mock external systems thin and read-only-first, and prove that a handoff/ticket
or support context can be read back by an admin/human-agent view.

## Source Chain

This card is valid only with these current sources:

- Cleanup matrix:
  `docs/non-operational/doc-cleanup/2026-07-01-classification.yaml`
- Final doctrine:
  `CONTEXT.md`, `docs/core-product-decision-log.yaml`,
  `docs/prds/closed/2026-06-30-integrated-poc-reference.md`,
  `docs/llm-turn-planner-architecture.md`
- Transitional deployable surface:
  current demo/review widget-adapter code remains usable until the Integrated
  POC is complete, then becomes code due for sunset.
- First roadmap chain:
  scaffold app plus roadmap/doctrine, port customer-visible contract, route the
  current assistant through the real app route, add thin read-only mock state
  plus handoff/ticket readback, add admin view, capture browser proof.

This agenda card supersedes chat context for implementation start. The older
cleanup agenda card and cleanup matrix are proof records, not product doctrine.

## Good Look

- A new Integrated POC App exists as a separate workspace/package. It does not
  mutate `site/`, `packages/demo-host`, `packages/demo-widget`,
  `packages/review-host`, or `packages/review-widget`.
- A committed in-repo roadmap or issue map exists for the first dependency
  chain, with dependency order, proof bars, and proof-of-work labels.
- The first Golden Path Slice reproduces the current Customer-Visible Contract
  in the new infrastructure before adding undeveloped features.
- A customer can enter the integrated surface, ask a supported help/handoff
  question, and receive behavior routed through the current engine contract.
- Thin mock support/ticket state is created or read by the server side, without
  real PII, real webhook side effects, account mutation, or eligibility/action
  decisions.
- An admin/human-agent view can list and inspect the resulting ticket or support
  context.
- The proof receipt includes a captured local browser flow through the real app
  path plus server/admin readback.
- Tests are added only where they protect valid behavior or provide useful
  verification fabric for future agents.

## First Golden Path Slice

Slice id: `ipoc-golden-path-01`

Arc label: `ipoc-arc-001`

Commit label shape:

```text
Epic: ipoc
Slice: ipoc-golden-path-01
Arc: ipoc-arc-001
Human checkpoint: final-review
```

Target journey:

1. Customer opens the Integrated POC App.
2. Customer asks a general support or handoff-shaped question that current Phase
   0 behavior already handles safely.
3. The app sends the turn through the current engine/demo-safe route or a thin
   adapter over `processTurn`.
4. The server records thin mock support context or a ticket receipt.
5. The customer receives the current safe assistant behavior: answer, clarify,
   handoff, fallback, or refusal as appropriate.
6. Admin/human-agent view reads back the ticket/support context from the mock
   store.

Non-goals for this slice:

- Existing-customer lookup.
- Account answers such as next payment date.
- Account or application actions.
- Real ticket webhook side effects.
- Real auth, real CRM, real SoloSight, real production audit storage.
- Production-grade deployment, secrets, compliance, or PII handling.

## Allowed Autonomy

The implementation agent may:

- Create the new Integrated POC app/package and necessary workspace wiring.
- Add a compact machine-readable roadmap or issue map for the first dependency
  chain.
- Add thin route/controller/service/repository layering at API-like boundaries:
  API handlers, mock persistence, mock external-system adapters, engine
  integration, and session/context boundaries.
- Reuse current engine/contracts and useful UI/copy assets by import or copy
  only when doing so preserves the Customer-Visible Contract.
- Add thin mock support/ticket state needed for admin readback.
- Add a simple admin/human-agent readback view.
- Add local scripts needed to run the app and proof flow.
- Add focused tests where they protect route contracts, mock store behavior, or
  future-agent regression safety.
- Run local browser verification and capture a concise proof receipt.
- Make atomic commits with the proof-of-work labels above and the required
  co-author trailer.

The implementation agent must not:

- Start from the existing `site/` or widget-adapter packages as the new app.
- Rewrite the public website as a side effect.
- Preserve iframe transport, package splits, or review-host quirks unless needed
  as temporary compatibility.
- Add account mutation, eligibility decisions, payment changes, or account
  actions.
- Add real PII persistence, real customer data, real webhook side effects, or
  real external-system integrations.
- Introduce or print secrets.
- Change deployment, promotion, or secret-source rules.
- Use Anthropic APIs, SDKs, CLI workflows, or Anthropic-backed judge paths.
- Treat unit, mocked, or static tests as proof of user-visible behavior.

## Pre-Start Gate

Before implementation begins, the agent must resolve the branch base:

- Preferred: start the implementation arc from a clean worktree whose base and
  promotion path are explicit.
- If continuing in this worktree, acknowledge that `just branch-risk` currently
  reports branch-wide ENGINE proof requirements because earlier core deltas exist
  vs `dev`.
- Do not promote a mixed branch without the required branch-wide proof:
  full Hell Week, OpenAI judge, and floor-delta REPAIRED/HOLDING receipt.
- A docs-only or fresh implementation branch may avoid inheriting unrelated
  engine proof obligations, but must preserve the committed doctrine this card
  references.

## Proof Bar

The slice is complete only when all are true:

- New app/package can be run locally from documented repo commands.
- Roadmap/issue map for the first dependency chain is committed and points to
  this agenda card.
- Browser proof shows the Golden Path customer journey through the real app
  route.
- Server/admin readback proves the mock ticket/support context exists and can be
  inspected.
- Verification receipt names the exact commands, local URLs, screenshots or
  captured artifacts, and relevant commit hashes.
- `just gate-slice -- --staged` passes before each commit.
- `just verify` passes unless the only changes are docs-only and the staged gate
  plus link/reference checks are sufficient.
- `just branch-risk` is run before closeout; any branch-wide ENGINE requirement
  is either satisfied or explicitly scoped as inherited/non-promoted risk.
- No behavior claim is made from static tests alone.

## Human Gate

Stop for human judgement before:

- Choosing a different framework or abandoning the separate Integrated POC App.
- Changing the Customer-Visible Contract rather than porting it.
- Changing product vocabulary, routing policy, safety posture, evidence labels,
  or validator/engine semantics.
- Adding real auth, real PII persistence, real CRM/SoloSight/webhook
  integration, real deployment changes, or secret changes.
- Expanding the first slice into existing-customer lookup, account answers, or
  account actions.
- Merging or promoting a branch that still carries ENGINE risk without the
  required integration proof.
- Continuing after browser proof or admin readback cannot be captured.

## Stop Condition

Stop and produce a checkpoint instead of continuing if:

- The app scaffold cannot be created without mutating the existing transitional
  surfaces.
- The current engine/demo route cannot be reused without changing engine
  behavior.
- The mock support/ticket store starts growing into a fake enterprise model.
- The proof path requires secrets, deployment changes, or external services.
- The browser flow works only through a mocked test and not through the real app
  path.
- The card, roadmap, implementation diff, and proof receipt disagree.

## Checkpoints

After human green-light, assume the human is AFK until one of these occurs:

- Failure trigger: any Human Gate or Stop Condition is hit.
- Never-suppressed ping: branch-risk or proof evidence changes the merge or
  promotion strategy.
- Batched digest: if multiple commits land, summarize what each commit proved
  before final verification.
- End-of-arc checkpoint: return with commits, diffstat, browser/admin evidence,
  verification commands, unresolved risks, and the recommended next slice.

## Recommended Execution Order

1. Confirm branch/worktree base and proof obligations.
2. Create or update the in-repo roadmap/issue map for the first dependency
   chain.
3. Scaffold the separate Integrated POC App and local run command.
4. Port the Customer-Visible Contract for one support/handoff journey.
5. Wire the current engine through the real app route.
6. Add thin mock support/ticket state and admin readback.
7. Capture browser proof and server/admin readback evidence.
8. Run gates, commit atomically, and produce the end-of-arc checkpoint.

## Second-Slice Touchstones

Do not implement these in the first slice. Keep them as coarse context:

- Read-only existing-customer/context lookup.
- Read-only account-answer demo using mock records.
- Agent/admin workflow improvements for handoff review and human readback.
- Widget-adapter sunset once the Integrated POC is demoable enough.
- Carefully scoped action capability only if stakeholder value later justifies
  the product and compliance risk.
