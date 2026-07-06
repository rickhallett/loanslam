# Railway Decommission Inventory - 2026-07-06

Practical takeaway: `loanslam-site-nuxt` is the only keeper app deployment. The
other app services are still live and need a separate destructive
decommissioning action after final confirmation.

## Read-only Inventory

- Project: `loanslam-staging-site` (`0eb02bd3-37ac-4ac7-be33-53f7bfda764f`)
- Environment: `production` (`c72b8b7f-959c-484b-a2e4-77522d4512ce`)
- CLI: `railway 5.23.1`
- Commands:
  - `railway status --json`
  - `railway service list --json`
  - `railway environment list --json`

## Keeper

| Service | ID | URL | Latest deployment | Status |
| --- | --- | --- | --- | --- |
| `loanslam-site-nuxt` | `37d76068-e1eb-412c-b1e3-2c07cf31c460` | `https://mal-demo.up.railway.app` | `9243857e-c487-47da-8685-21c8249508f1` on 2026-07-05 | running |

The keeper is deployed from a prebuilt Nuxt/Nitro artifact with Railpack and
`npm start`. It does not need the repo-root Astro `railway.json`.

## Decommission Candidates

| Service | ID | URL | Latest deployment | Status |
| --- | --- | --- | --- | --- |
| `loanslam-site` | `93231cb8-750a-4e93-b9da-bbcd03a56c0f` | `https://loanslam-site-production.up.railway.app` | `fadd94dc-527a-4fa4-805e-803e3afb68de` on 2026-06-26 | running |
| `loanslam-site-nuxt-staging` | `7d094b0f-e1dd-4f8d-a589-9934e7cbb808` | `https://loanslam-site-nuxt-staging-production.up.railway.app` | `1b661e4a-7d7c-4848-b60d-bb78cae60203` on 2026-07-04 | running |
| `loanslam-ipoc` | `13812e52-78de-4896-bb0e-b40a187088d2` | `https://loanslam-ipoc-production.up.railway.app` | `e660c944-55b7-4663-aa94-8baf5eb7a330` on 2026-07-02 | running |

## Dependency To Decide

| Service | ID | Notes |
| --- | --- | --- |
| `Postgres` | `e7ad4b1d-8090-4228-ab6f-479286e3066c` | Running with `postgres-volume` at `/var/lib/postgresql/data`, about 217 MB used of 5 GB. Keep until the keeper runtime, proof capture, and demo-log paths are checked against its variables and usage. |

## Local Cleanup Applied

- Deleted repo-root `railway.json`; it represented the retired Astro
  `loanslam-site` path.
- Removed root `railway-build` / `railway-start` scripts.
- Removed the standalone IPOC deploy pack script.
- Updated the IPOC runbook to mark standalone Railway deployment as historical.

## Not Done In This Commit

- No Railway service, domain, variable, deployment, or volume was deleted.
- No Postgres dependency decision was made.
- Final service deletion still needs explicit destructive approval and a fresh
  inventory immediately before the command runs.
