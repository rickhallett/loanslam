# Integrated POC Arc 004 Closeout

Date: 2026-07-02

Arc: `ipoc-arc-004` — deployment arc, batch-authorized upfront (D039/D040).

Live demo URL: https://loanslam-ipoc-production.up.railway.app

## Slice outcomes

| Slice | Outcome | Receipt | Commit |
| --- | --- | --- | --- |
| ipoc-deploy-build-01 | completed | artifacts/integrated-poc/ipoc-deploy-build-01-proof.md | b845471 |
| ipoc-deploy-service-01 | completed | artifacts/integrated-poc/ipoc-deploy-service-01-proof.md | 595b03d |
| ipoc-deploy-live-01 | completed | artifacts/integrated-poc/ipoc-deploy-live-01-proof.md | 09c5bff |
| ipoc-demo-runbook-01 | completed | docs/integrated-poc-demo-runbook.md | (this commit) |

Arc agenda: `docs/prds/2026-07-02-integrated-poc-arc-004-agenda-card.md`
(commit 36cc783, with D039/D040 in the decision log).

## Gates

- `just gate-slice -- --staged` passed before every commit.
- `just verify` passed at each code slice.
- `just branch-risk -- --base dev`: 16 changed files; required proof bar
  SECRET — met: only `secrets/manifest.json` and the sops-encrypted
  `secrets/production.env.sops` were committed; the Railway sync ran
  `--dry-run` before `--apply`, service-scoped to `loanslam-ipoc`; no
  decrypted value appeared in any transcript, file, or receipt.
- Battery: 16/16 locally against the production build and 16/16 against the
  live URL, including the live-engine mock-store boundary case.

## Human gates hit during the run

None. `loanslam-site` and Postgres were never touched; no custom DNS; no
auth/contract/engine changes.

## Deploy-time findings (fixed in scripts/ipoc-deploy-pack.mjs)

- Railway's upload indexer drops dot-directories and `node_modules`; the
  artifact packs the Nitro output as `output/` and declares the Nitro dep
  manifest for Railpack to install.

## Deferred / next human decisions

1. Run one stakeholder demo from `docs/integrated-poc-demo-runbook.md` — that
   is the sunset trigger. Sunset execution remains fully human-gated.
2. Promotion of `feature/ipoc-deploy-01` into `dev`.
3. The demo URL has no auth or rate limiting (matching the existing demo
   posture); decide whether that is acceptable for the circulation you plan.
4. review-host/review-widget product decision (unchanged from D039).
