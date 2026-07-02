# Integrated POC Deploy Build 01 Proof

Date: 2026-07-02

## Scope

- Epic: ipoc
- Slice: ipoc-deploy-build-01
- Arc: ipoc-arc-004
- Human checkpoint: arc-closeout
- Branch: feature/ipoc-deploy-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-deploy-01
- Authorization: batch arc green-light (D039/D040), agenda card
  `docs/prds/2026-07-02-integrated-poc-arc-004-agenda-card.md`

## Changes

- Root scripts: `ipoc-build` (workspace Nuxt build) and `ipoc-start`
  (`node packages/integrated-poc/.output/server/index.mjs`).
- Corpus resolution in `engineAdapter.ts` no longer assumes the dev-server
  cwd: it checks cwd-relative and dev-relative candidates and honors an
  `IPOC_CORPUS_PATH` override for deploy artifacts.

## Evidence

- `npm run ipoc-build` produced the Nitro node-server output (3.26 MB total).
- `PORT=3632 just secrets-run local -- npm run ipoc-start` served the built
  app from the repo root (the path that previously broke corpus loading).
- `node scripts/ipoc-integration-battery.mjs --base http://127.0.0.1:3632`:
  16/16 passed against the production-mode server, including the live-engine
  boundary case (report
  `artifacts/integrated-poc/ipoc-integration-battery-2026-07-02T02-40-33-674Z.json`).

## Boundaries Held

- No engine, validator, or contract changes; the corpus fix is app-level path
  resolution only.
- No Railway resources touched yet (that is ipoc-016).
- Secrets used only through the no-file wrapper.

## Checks

- `npm --workspace @loanslam/integrated-poc run typecheck` passed.
- `just gate-slice -- --staged` and `just verify` recorded in the landing
  commit.
