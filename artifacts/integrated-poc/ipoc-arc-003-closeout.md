# Integrated POC Arc 003 Closeout

Date: 2026-07-01

Arc: `ipoc-arc-003` — first batch-authorized multi-slice arc (upfront human
green-light, D037/D038; machine gates between slices; human checkpoint at
this closeout).

## Slice outcomes

| Slice | Outcome | Receipt | Commit |
| --- | --- | --- | --- |
| ipoc-customer-lookup-01 | completed | artifacts/integrated-poc/ipoc-customer-lookup-01-proof.md | 179591c |
| ipoc-account-answers-01 | completed | artifacts/integrated-poc/ipoc-account-answers-01-proof.md | 32ab23a |
| ipoc-admin-workflow-01 | completed | artifacts/integrated-poc/ipoc-admin-workflow-01-proof.md | 1a6e202 |
| ipoc-integration-proof-01 | completed | artifacts/integrated-poc/ipoc-integration-proof-01-proof.md | 6b73dce |
| ipoc-adapter-sunset-01 | completed | docs/reports/2026-07-01-widget-adapter-sunset-assessment.md | (this commit) |

Arc agenda: `docs/prds/2026-07-01-integrated-poc-arc-003-agenda-card.md`
(commit 0f74303, includes D037/D038 in the decision log).

## Gates

- `just gate-slice -- --staged` passed before every commit (also enforced by
  the pre-commit hook).
- `just verify` (test + typecheck + build + source-policy) passed at each
  code slice.
- `just branch-risk -- --base dev`: 68 changed files vs dev; required proof
  bar TOOLING (verify); tiers touched TOOLING/DOCS/BASELINE — no ENGINE tier,
  matching the arc's no-engine-change boundary.
- Integration battery: 16/16 including the live-engine mock-store boundary
  case.

## Human gates hit during the run

None. No slice required expanding lookup fields or the answer set, no
write-capable flow was needed, and no PII/auth/CRM/deployment/secret surface
was touched. The per-slice human checkpoints removed by the batch
authorization were replaced by the machine gates above plus per-slice
receipts.

## Deferred / next human decisions

1. Veto window on the D038 agent-chosen answer set default (nextPaymentDate,
   outstandingBalance, loanStatus) remains open; shrink freely, expansion
   needs a new decision.
2. Integrated POC deployment (required before the widget-adapter sunset can
   execute) — deployment/secrets are human-gated and were not touched.
3. Promotion of `feature/ipoc-golden-path-01` into `dev` — promotion is a
   human call per branch discipline.
4. review-host/review-widget fate — explicitly out of scope of the sunset
   assessment; needs its own product decision.

## Data-quality notes

- The first integration-battery run failed its engine-boundary case due to a
  battery assertion bug (transcript echo), not an app leak; recorded honestly
  in the ipoc-integration-proof-01 receipt.
- Browser proofs ran headless (playwright-core + local Chromium) against the
  real dev server with the live OpenAI planner; no mocked engine paths were
  presented as behavior proof.
