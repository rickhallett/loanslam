# Integrated POC Deploy Live 01 Proof

Date: 2026-07-02

## Scope

- Epic: ipoc
- Slice: ipoc-deploy-live-01
- Arc: ipoc-arc-004
- Human checkpoint: arc-closeout
- Branch: feature/ipoc-deploy-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-deploy-01
- Authorization: batch arc green-light (D039/D040), agenda card
  `docs/prds/2026-07-02-integrated-poc-arc-004-agenda-card.md`

## Live URL

https://loanslam-ipoc-production.up.railway.app
(Railway-generated service domain; no custom DNS.)

## Deploy mechanism

Prebuilt-artifact deploy, reproducible with:

1. `npm run ipoc-build`
2. `node scripts/ipoc-deploy-pack.mjs` (assembles
   `packages/integrated-poc/.railway-pack`: Nitro output as a non-dot
   `output/` dir, the synthetic corpus, an artifact package.json carrying the
   Nitro-emitted runtime dependencies, and a service-local railway.json)
3. From the pack dir: `railway link -p loanslam-staging-site -e production -s
   loanslam-ipoc` then `railway up --ci`

Rationale: the root `railway.json` belongs to the `loanslam-site` service
(prisma pre-deploy included) and per-service config file paths are not
settable from the CLI, so the ipoc service deploys its own artifact directory
and the two services stay fully independent.

Two deploy-time findings, both fixed in `scripts/ipoc-deploy-pack.mjs`:

- The Railway upload indexer drops dot-directories: `.output/` never reached
  the image (`Cannot find module '/app/.output/server/index.mjs'`). Packed as
  `output/` instead.
- The indexer also drops `node_modules`, so the Nitro server's external deps
  were missing (`Cannot find package 'vue-bundle-renderer'`). The artifact
  package.json now declares the Nitro-emitted dependency set (20 packages)
  for Railpack to install in the image.

## Evidence

- Battery against the live URL: 16/16 passed, including the live-engine
  boundary case (matched session asking the engine for its balance got
  `request_handoff_intake` with no mock values in the engine reply). Report:
  `artifacts/integrated-poc/ipoc-integration-battery-2026-07-02T02-54-31-057Z.json`.
- Headless browser proof of the full journey on the live URL: demo lookup for
  `LS-10001`, next-payment-date answer, engine handoff ticket, admin start
  review, agent note, resolve. Final status `resolved`; activity and note
  visible in the readback. Screenshot:
  `artifacts/integrated-poc/ipoc-deploy-live-01-browser.png`.

## Boundaries Held

- `loanslam-site` and Postgres untouched; the ipoc service is a separate
  artifact-deployed service.
- Synthetic data only; the mock store remains in-memory (state resets on
  redeploy/restart — a demo property, recorded for the runbook).
- No auth or rate limiting on the demo URL — known limitation for the
  runbook, matching the existing demo-site posture.
- No engine, validator, or contract changes.

## Checks

- `just gate-slice -- --staged` and `just verify` recorded in the landing
  commit.
