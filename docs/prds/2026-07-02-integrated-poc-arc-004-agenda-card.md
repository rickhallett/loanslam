# Integrated POC Arc 004 Agenda Card - 2026-07-02

Status: green. Human green-light for the deployment arc was given on
2026-07-02 (decision log D039/D040) as part of approving the arc-003
closeout. Batch-authorized like arc-003: machine gates between slices,
per-slice proof receipts, human checkpoint at arc closeout.

## Objective

Give the Integrated POC a deployed, stakeholder-clickable demo URL — the one
blocker the widget-adapter sunset assessment identified — without touching the
existing demo service, the engine, or any real customer data. Then convert the
sunset assessment into an executable plan gated on one stakeholder demo.

## Source Chain

- `docs/prds/2026-07-01-integrated-poc-arc-003-agenda-card.md`
- `artifacts/integrated-poc/ipoc-arc-003-closeout.md`
- `docs/reports/2026-07-01-widget-adapter-sunset-assessment.md`
- `docs/roadmaps/2026-07-01-integrated-poc-roadmap.yaml`
- `docs/core-product-decision-log.yaml` (D039, D040)
- `CONTEXT.md`

## Deployment shape (D040)

- New Railway service `loanslam-ipoc` in the existing `loanslam-staging-site`
  project, beside the untouched `loanslam-site` service and Postgres.
- Railway-generated domain only; no custom DNS.
- Root `ipoc-build` / `ipoc-start` scripts over the Nuxt/Nitro node-server
  output; the service uses its own config, not the root `railway.json` (which
  belongs to the demo-site service).
- `OPENAI_API_KEY` promoted into `secrets/production.env.sops` and given a
  `railway` deploy target in `secrets/manifest.json`. All value movement goes
  through the encrypted-secrets tooling via stdin; no value is ever printed,
  rendered to a tracked file, or pasted.

## Arc Chain

Arc label: `ipoc-arc-004`. Roadmap chain: `arc_004_chain`.

| Chain id | Slice label | Summary |
| --- | --- | --- |
| ipoc-015 | ipoc-deploy-build-01 | Production build/start entry points; local production-mode proof |
| ipoc-016 | ipoc-deploy-service-01 | Railway service creation and secret wiring (no deploy yet) |
| ipoc-017 | ipoc-deploy-live-01 | Deploy, generated domain, live battery + browser proof |
| ipoc-018 | ipoc-demo-runbook-01 | Stakeholder demo runbook and executable sunset plan |

Commit label shape per slice:

```text
Epic: ipoc
Slice: <slice label above>
Arc: ipoc-arc-004
Human checkpoint: arc-closeout
```

## Non-Goals

- Any change to the `loanslam-site` service, its config, variables, or the
  Postgres database.
- Custom domains, DNS, TLS, or Vercel changes.
- Auth, rate limiting, or production hardening beyond what the demo needs
  (recorded as known limitations in the runbook instead).
- Real PII, CRM, SoloSight, webhooks, persistent storage for the mock store.
- Deleting or mutating adapter packages (the sunset plan is a document).
- Engine, validator, routing, or contract changes.

## Allowed Autonomy

- Add root build/start scripts and per-service Railway config for the ipoc
  service; small `nuxt.config.ts` adjustments needed for production serving
  (e.g. corpus path resolution) that do not change engine behavior.
- Create the `loanslam-ipoc` Railway service and set its variables through
  the secrets tooling (dry-run first, then apply — apply is pre-authorized by
  D040 for this service only).
- Edit `secrets/manifest.json` and add the key to `production.env.sops` via
  the stdin path.
- Deploy the service with `railway up`, generate the service domain, and run
  the integration battery and headless browser proof against the live URL.
- Update the roadmap and write per-slice receipts and the arc closeout.

## Proof Bar

- ipoc-015: production build runs locally (`node .output/server/index.mjs`
  shape) and the integration battery passes against it.
- ipoc-016: dry-run sync output (names only) recorded; service exists with
  variables set; no value appears in any transcript, receipt, or file.
- ipoc-017: battery passes against the live URL; headless browser proof of
  the full demo journey on the live URL; receipt names the URL, commands,
  and commit hashes.
- ipoc-018: runbook a stakeholder can follow cold; sunset plan with explicit
  trigger (one completed stakeholder demo) and rollback note.
- `just gate-slice -- --staged` before every commit; `just verify` for code
  slices; `just branch-risk -- --base dev` at closeout.

## Human Gate

Stop for human judgement before:

- Touching `loanslam-site`, Postgres, or any non-ipoc Railway resource.
- Custom domains/DNS, scaling changes, or paid-plan changes.
- Any secret value exposure risk beyond the stdin tooling path.
- Adding auth or changing the Customer-Visible Contract to make deployment
  work.
- Executing any part of the sunset plan (deletion stays gated on the
  stakeholder demo).

## Stop Condition

Stop and checkpoint instead of continuing if:

- The production build requires engine or contract changes.
- Railway CLI auth or project access fails mid-run.
- The deployed app cannot reach OpenAI through the synced variables.
- Costs or resources would exceed obvious demo scale.
- Card, roadmap, diffs, and receipts disagree.
