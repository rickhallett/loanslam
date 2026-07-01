# Widget-Adapter Sunset Assessment - 2026-07-01

Slice: `ipoc-adapter-sunset-01` (arc `ipoc-arc-003`). Docs-only assessment per
the arc agenda card; acting on this recommendation stays behind a human gate.

## Question

D012 already classified the widget-adapter architecture as transitional code
due for sunset once the Integrated POC can replace it. This assessment answers:
is the Integrated POC demoable enough yet, what does the adapter stack still
uniquely provide, and what should happen next?

## What the Integrated POC now covers (proven, with receipts)

All through the real app path in `packages/integrated-poc/`, each with a
committed proof receipt under `artifacts/integrated-poc/`:

- Golden customer-to-admin path: engine turn, ticket creation, admin readback
  (`ipoc-golden-path-01-proof.md`).
- Structured handoff capture form and intake readback
  (`ipoc-handoff-capture-01-proof.md`).
- Read-only existing-customer demo lookup with no-match degrade
  (`ipoc-customer-lookup-01-proof.md`).
- Read-only demo account answers, gated on a matched session
  (`ipoc-account-answers-01-proof.md`).
- Admin workflow: status transitions, agent notes, session activity
  (`ipoc-admin-workflow-01-proof.md`).
- A committed app-surface integration battery, 16/16 passing including a
  live-engine boundary case (`ipoc-integration-proof-01-proof.md`).

This is strictly more customer-and-admin capability than the demo-widget
surface demonstrates.

## What the adapter stack still uniquely provides

1. **Deployed demoability.** The demo-host/demo-widget surface is live on
   Railway (`fix(demo): Include reports in Railway site build`,
   `feat(demo): Serve site assets on Railway`). The Integrated POC runs
   locally only; deploying it is explicitly behind the arc's human gate
   (no Vercel/Railway/secret changes). Until the POC is deployed somewhere a
   stakeholder can click, the adapter stack is the only remotely demoable
   surface.
2. **Iframe/embed delivery.** Embedding into a WordPress-style host page is
   the adapter's core trick. The reference memo keeps this "useful for the
   current WordPress-style surface until the integrated POC is ready." No POC
   equivalent exists or is planned yet.
3. **Review surface.** `review-host`/`review-widget` is a deliberately
   separate stakeholder review UI (recorded product decision: the demo and
   review widgets are intentionally not deduplicated). It is out of scope for
   this sunset: its fate needs its own product decision and should not be
   bundled with the demo-adapter sunset.

## Recommendation

- **Do not delete anything yet.** The sunset condition in the roadmap
  ("widget-adapter sunset once the Integrated POC is demoable enough") is not
  met while the POC has no deployed URL.
- **Freeze the demo-adapter stack.** Stop investing in demo-host/demo-widget
  beyond keeping the deployed demo alive. New demo capability goes into the
  Integrated POC only (this arc already followed that rule).
- **Make POC deployment the next human decision.** The single blocker between
  "transitional code" and "deletable code" is a deployed Integrated POC demo.
  That is a deployment/secrets change, so it is a human-gated arc of its own.
- **Sunset order when green-lit:** demo-host and demo-widget retire together
  after one stakeholder demo runs on the deployed POC; `site/` embed points
  migrate or drop at the same time; review-host/review-widget are assessed
  separately afterwards.

## Evidence, inference, next rep

- Observed: receipts and commits listed above; Railway demo commits; D012,
  D015, D016 in `docs/core-product-decision-log.yaml`.
- Inferred: no remaining functional reason to extend the demo-adapter stack;
  its only live value is deployment reach and embed delivery.
- Next rep (human): decide whether to green-light an Integrated POC deployment
  arc; that decision converts this assessment into an actionable sunset plan.
