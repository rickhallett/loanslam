# Integrated POC Deploy Service 01 Proof

Date: 2026-07-02

## Scope

- Epic: ipoc
- Slice: ipoc-deploy-service-01
- Arc: ipoc-arc-004
- Human checkpoint: arc-closeout
- Branch: feature/ipoc-deploy-01
- Worktree: /Users/mrkai/code/loanslam/.claude/worktrees/ipoc-deploy-01
- Authorization: batch arc green-light (D039/D040), agenda card
  `docs/prds/2026-07-02-integrated-poc-arc-004-agenda-card.md`

## What happened

1. `OPENAI_API_KEY` promoted into `secrets/production.env.sops` via
   `secrets.mjs run local | secrets.mjs set production` — value moved
   stdin-to-stdin through the encrypted tooling; never printed, rendered, or
   pasted. `just secrets-status` now shows 5 production keys.
2. `secrets/manifest.json`: `OPENAI_API_KEY` gains `railway` target and
   `production` required.
3. `railway add --service loanslam-ipoc` created the empty service in the
   `loanslam-staging-site` project (production environment), beside the
   untouched `loanslam-site` service and Postgres.
4. `just secrets-sync-railway production --service loanslam-ipoc --dry-run`
   listed exactly two keys: `DEMO_STATE_TOKEN_SECRET` (pre-existing railway
   target, unused by the POC, harmless) and `OPENAI_API_KEY`. Then `--apply`
   set both on the service only.
5. `railway variable list --service loanslam-ipoc --json` key names confirm:
   the two synced keys plus Railway-injected metadata. No values were
   displayed at any step.

## Boundaries Held

- `loanslam-site` service, its variables, and Postgres untouched (sync was
  service-scoped with `--service loanslam-ipoc`).
- Secret values flowed only through sops/railway stdin tooling.
- No deploy yet; that is ipoc-017.

## Checks

- `just gate-slice -- --staged` and commit hooks on the landing commit.
- Docs/secrets-manifest-only diff; `just verify` not required beyond the
  gate for this slice (no app code changed).
