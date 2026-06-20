# Repository Surface Audit - 2026-06-20

## Practical Takeaway

Loanslam is still a small repo, but it now has several distinct operator
surfaces: the Phase 0 engine, model-backed evidence harnesses, local lab/demo
apps, Vercel demo deployment wiring, Postgres evidence/log storage, a separate
Astro site, encrypted secrets, and local MCP tooling. The root `Justfile` is the
right human front door for Phase 0 engine work. The main risks are command
ambiguity, a few stale documentation references, and deployment/database commands
that look like build checks but can touch external state.

No source behavior was changed for this audit.

## Evidence Scope

Commands and files inspected:

```bash
pwd
git status --short --branch
git worktree list --porcelain
git branch -vv
find . -maxdepth 2 -type d -not -path './.git*' -not -path './node_modules*' | sort
rg --files -g 'package.json' -g '!node_modules/**' | sort
npm pkg get scripts --json
npm --workspaces --if-present pkg get scripts --json
just --list
just secrets-status
rg -n "docs/architecture.md|phase-0-human-validation-guide|agent-hell-battery|TODO|FIXME" README.md docs packages site api scripts -g '*.md' -g '*.ts' -g '*.json'
```

Key files inspected include `README.md`, `AGENTS.md`, `CONTEXT.md`,
`Justfile`, `package.json`, `vercel.json`, `prisma.config.ts`,
`prisma/schema.prisma`, `api/index.ts`, `packages/*/package.json`,
`packages/*/vite.config.ts`, `packages/core/src/engine.ts`,
`packages/core/src/cli.ts`, `packages/core/src/lab/server.ts`,
`packages/core/src/lab/demoInteractionLog.ts`,
`packages/mcp-server/src/server.ts`, `site/package.json`,
`site/astro.config.mjs`, `secrets/README.md`, and the current docs audit matrix.

Not run: model-backed checks, Hell Week, local servers, Prisma migrations,
deployment syncs, or decrypted secret reads.

Current worktree state at audit start:

```text
branch: worktree-repo-surface-audit
head: ec2d172
dirty: docs/prds/2026-06-20-repository-surface-audit-prd.md untracked
```

## Repository Surface Map

| Path                                              | Surface                                             | Current role                                                                                      | Notes                                                                                 |
| ------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `README.md`                                       | Repo front door                                     | Product, architecture, command, evidence, deploy, and source-of-truth index                       | Mostly useful, but the repository map still names missing `docs/architecture.md`.     |
| `AGENTS.md` / `CLAUDE.md`                         | Agent authority                                     | Branch/worktree/secret discipline and protocol override                                           | `CLAUDE.md` is a compatibility symlink to `AGENTS.md`.                                |
| `CONTEXT.md`                                      | Domain vocabulary                                   | Keeps Phase 0 engine terms distinct from later product terms                                      | Aligns with current `TurnPlanner` / `TurnPlan` / `ValidatedTurnResult` language.      |
| `docs/`                                           | Product, architecture, operator docs, PRDs, reports | Active docs plus dated decision records                                                           | The docs audit matrix is the current cleanup decision record.                         |
| `packages/contracts`                              | Shared contracts                                    | Zod schemas and runtime types                                                                     | Export root is `src/index.ts`, backed by `src/schemas.ts`.                            |
| `packages/core`                                   | Phase 0 engine                                      | `processTurn`, retrieval, validator, OpenAI adapters, CLI, lab API, STS, Hell Week                | This is the main architecture owner.                                                  |
| `packages/lab-ui`                                 | Engineer console                                    | Vue UI for local lab API diagnostics                                                              | Local only; Vite proxies `/sessions` to port `8787`.                                  |
| `packages/mcp-server`                             | Agent tooling                                       | Stdio MCP wrapper around local lab API sessions                                                   | Defaults to `http://127.0.0.1:8787` and can dump evidence artifacts.                  |
| `packages/demo-host` / `packages/demo-widget`     | Customer-facing generic demo                        | Host page plus iframe widget over demo-safe `/demo` routes                                        | Uses port `5180` / `5174` locally.                                                    |
| `packages/review-host` / `packages/review-widget` | Legacy MAL review demo                              | MAL-branded demo shell over the Loanslam engine                                                   | Vercel currently builds and mounts the review host/widget, not the generic demo pair. |
| `api/index.ts`                                    | Vercel function                                     | Creates a demo-only lab server, OpenAI planner, optional signal extractor, Prisma-backed demo log | Requires `DEMO_STATE_TOKEN_SECRET`; optional `DEMO_ACCESS_TOKEN`.                     |
| `prisma/`                                         | Postgres schema and migrations                      | Demo interaction receipts plus Hell Week run/stability evidence                                   | `prisma.config.ts` chooses migration DB URL from migration/unpooled env first.        |
| `data/public-info`                                | Policy/corpus data                                  | Synthetic Loanslam knowledge base and FAQ                                                         | `serving_mode` is live policy data for routing and answerability.                     |
| `artifacts/evidence-index`                        | Durable evidence index                              | Compact index of DB-imported Hell Week runs and replay commands                                   | Current authority for imported Hell Week run IDs.                                     |
| `artifacts/phase0`                                | Generated local evidence                            | Local JSON traces/probes/session dumps                                                            | Contains historical local artifacts; not all are current authority.                   |
| `scripts/`                                        | Local helper scripts                                | Source policy, secrets workflow, probes, throwaway helpers                                        | `scripts/secrets.mjs` is the secret workflow backend.                                 |
| `secrets/`                                        | Encrypted secret source                             | SOPS env files, manifest, workflow README                                                         | Plain `.env.*` files are ignored generated caches.                                    |
| `site/`                                           | Public Astro site                                   | Separate Loans by MAL static/content surface                                                      | Important: not included in root npm workspaces.                                       |

## Architecture Authority Map

Current authority stack:

1. `CONTEXT.md` defines the shared language: Phase 0 engine proof,
   `TurnPlanner`, untrusted `TurnPlan`, enforced `ValidatedTurnResult`,
   `Validator`, `Serving Mode`, grounded answers, and handoff intake.
2. `docs/llm-turn-planner-architecture.md` is the primary Phase 0 architecture
   authority. It matches the live code shape: `processTurn` retrieves matches,
   optionally captures shadow signals, asks the planner, validates the untrusted
   plan, applies state rules, and emits trace evidence.
3. `docs/product-brief.md` owns product and safety boundaries. It explicitly
   points current implementation back to the TurnPlanner architecture before
   full productisation resumes.
4. `README.md` is the normal front door and command map, but not the final
   authority where it conflicts with current files or the docs audit matrix.
5. `docs/prds/2026-06-20-documentation-audit-recommendation-matrix.md` is the
   current documentation cleanup decision record.
6. `docs/hell-week-gauntlet.md`, `docs/hell-week-agent-loop-playbook.md`,
   `docs/stochastic-test-simulator-guide.md`, and
   `artifacts/evidence-index/hell-week-runs.md` own evidence workflows.

The code authority boundary is `packages/core/src/engine.ts`: `processTurn`
returns `ValidatedTurnResult`; `TurnPlan` remains untrusted; `validateTurnPlan`
and deterministic state rules own policy enforcement.

## Package And Runtime Ownership

Root npm workspaces are only:

```json
["packages/*"]
```

Package roles:

| Package                   | Role                                              | Build/typecheck behavior                   |
| ------------------------- | ------------------------------------------------- | ------------------------------------------ |
| `@loanslam/contracts`     | Shared Zod schemas and runtime types              | `tsc --build`; emits `dist`.               |
| `@loanslam/core`          | Engine, CLI, lab server, model/evidence harnesses | `tsc --build`; depends on contracts.       |
| `@loanslam/lab-ui`        | Vue engineer console                              | `vue-tsc --noEmit` plus Vite build.        |
| `@loanslam/mcp-server`    | Stdio MCP wrapper over lab API                    | `tsc --build`; has targeted Vitest script. |
| `@loanslam/demo-host`     | Generic demo host page                            | Vite build only.                           |
| `@loanslam/demo-widget`   | Generic iframe widget                             | `vue-tsc --noEmit` plus Vite build.        |
| `@loanslam/review-host`   | Legacy MAL review host                            | Vite build only.                           |
| `@loanslam/review-widget` | Legacy MAL review widget                          | `vue-tsc --noEmit` plus Vite build.        |

`site/package.json` is a separate Astro package (`loansbymal-site`) and is not
included in `npm --workspaces` or `npm run build` from the root.

## Build And Verification Flow

Pure local static gates:

```bash
just source-policy
just test
just typecheck
just build
just verify
just format-check
```

What they cover:

- `just source-policy` runs `scripts/check-typescript-source-policy.ts`.
- `just test` runs source policy plus all Vitest suites.
- `just typecheck` runs source policy plus workspace typechecks.
- `just build` runs source policy plus workspace builds for `packages/*`.
- `just verify` chains test, typecheck, and build.
- `just format-check` checks selected root, API, and package files.

Important gaps:

- Root `build` does not build `site/`.
- Root `format-check` does not include Markdown or `site/`.
- Site verification currently requires the explicit site package command, for
  example `npm --prefix site run build`.

Vercel/deploy build path:

- `vercel.json` sets `buildCommand` to `npm run vercel-build`.
- Root `vercel-build` runs `prisma generate && prisma migrate deploy && npm run review-widget:build && npm run review-host:build`.
- `vercel.json` includes `data/public-info/**`, `packages/review-host/dist/**`,
  and `packages/review-widget/dist/**`, then rewrites all paths to `/api`.
- `api/index.ts` serves the demo-safe API plus built review host/widget assets.

Risk: `vercel-build` is not just a local build. It runs Prisma migrations against
the configured database and should be treated as database/deployment-adjacent.

## Justfile Recipe Taxonomy

| Group                         | Recipes                                                                                                                                         |                    Calls model? |                                                             Needs Postgres? |                                                                      May touch external state? |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------: | --------------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------: |
| Quality gates                 | `test`, `source-policy`, `typecheck`, `build`, `verify`, `format-check`                                                                         |                              No |                                                                          No |                                                                                             No |
| Prisma/deploy                 | `prisma-generate`, `prisma-migrate-deploy`, `vercel-build`                                                                                      |                              No |                             `migrate` and `vercel-build` need configured DB |                                                                  Yes, migrations can mutate DB |
| Secrets                       | `secrets-status`, `secrets-init`, `secrets-edit`, `secrets-set`, `secrets-render`, `secrets-run`, `secrets-sync-vercel`, `secrets-sync-railway` |                              No |                                                                          No | Sync recipes can mutate Vercel/Railway only with `--apply`; render writes ignored local caches |
| Core probes                   | `core-turn`, `core-chat`                                                                                                                        |                             Yes |                                                                          No |                                                                                 Model API only |
| Core simulations/evidence     | `core-simulate`, `core-compare`, `core-persona-simulate`, `core-stochastic`, `hell-week`                                                        |                  Yes by default |                                          Optional for Hell Week persistence |                                                 Model API; optional DB writes with store flags |
| Read-only evidence transforms | `route-audit`, `hell-week-compare`                                                                                                              |                              No |                                                                          No |                                                                                             No |
| DB evidence reads             | `hell-week-stability`, `demo-log-summary`, `demo-log-session`, `demo-log-turn`                                                                  |                              No |                                    Yes when reading DB-backed evidence/logs |                                                                             No writes expected |
| Local apps                    | `lab`, `demo`, `review`, `lab-ui`, `lab-ui-build`                                                                                               | Runtime engine paths call model | `demo` / `review` need DB URL unless demo logging is disabled or configured |                                         Local servers; DB writes possible through demo logging |
| MCP                           | `mcp-lab-api`                                                                                                                                   |                    No by itself |                                                                No by itself |                                           No by itself; it drives whichever lab API is running |

`just demo` and `just review` are convenient, but they start `core:serve
--demo-only` without `--no-demo-log`. In a fresh worktree without `.env.local` or
DB env, that server path fails by design because demo interaction logging needs
`DEMO_INTERACTION_DATABASE_URL` or `DATABASE_URL`.

## Secrets, Database, And Deployment Boundaries

Secret source of truth:

- `secrets/*.env.sops` are canonical.
- `.env.local`, `.env.staging`, and `.env.production` are ignored generated
  caches.
- `just secrets-status` is safe metadata. Current observed status:
  - `local`: ok, 8 required keys present.
  - `staging`: missing `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
  - `production`: missing `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
- Vercel and Railway variables are deployment sinks, not source of truth.

Database boundaries:

- Runtime demo logging uses `DEMO_INTERACTION_DATABASE_URL` or `DATABASE_URL`.
- Hell Week DB reporting uses `HELL_WEEK_DATABASE_URL`,
  `DEMO_INTERACTION_DATABASE_URL`, or `DATABASE_URL`.
- Prisma migrations prefer `DATABASE_MIGRATE_URL`, `DATABASE_URL_UNPOOLED`,
  `POSTGRES_URL_NON_POOLING`, then `DATABASE_URL`.
- `prisma/schema.prisma` owns demo interaction events, Hell Week runs, scenarios,
  turns, grades, and run-set stability tables.

Deployment boundaries:

- Vercel runtime entrypoint is `api/index.ts`.
- Vercel currently serves review host/widget assets, not generic demo host/widget
  assets.
- `DEMO_STATE_TOKEN_SECRET` is mandatory for deployed demo API.
- `DEMO_ACCESS_TOKEN` optionally gates shared demos with bearer or
  `x-demo-access-token`.

## Documentation Authority And Drift

Current source-of-truth docs:

- `CONTEXT.md`
- `README.md`
- `docs/product-brief.md`
- `docs/llm-turn-planner-architecture.md`
- `docs/hell-week-gauntlet.md`
- `docs/hell-week-agent-loop-playbook.md`
- `docs/stochastic-test-simulator-guide.md`
- `artifacts/evidence-index/hell-week-runs.md`
- `docs/prds/2026-06-20-documentation-audit-recommendation-matrix.md`
- `secrets/README.md`

Drift observed:

1. `README.md` repository map still names `docs/architecture.md`, which is not
   present in this checkout. The source-of-truth list later in README correctly
   points at `docs/llm-turn-planner-architecture.md`.
2. The docs audit matrix still records earlier drift around
   `phase-0-human-validation-guide` and old Hell Week artifacts. The direct
   search now finds these mostly in the matrix itself and in source comments.
3. Hell Week source comments still refer to generated `agent-hell-battery`
   markdown and a missing artifact glob, while active docs say the encoded
   battery lives under `packages/core/src/hellweek/` and imported runs live in
   `artifacts/evidence-index/hell-week-runs.md`.
4. `site/` has no root `Justfile` recipe or workspace build path, despite being
   an active surface.
5. `vercel-build` reads like a build check but runs `prisma migrate deploy`.
   Operators should treat it as migration/deployment-adjacent.

## Risks And Cleanup Opportunities

1. **Command ambiguity around deploy/database flows.**
   `just vercel-build` and `npm run vercel-build` can apply migrations. Keep
   them away from routine local verification language.

2. **Site surface is easy to miss.**
   Root workspaces and `just build` exclude `site/`, so a future agent can change
   site code and get a green root build without validating Astro output.

3. **Demo recipes depend on local secret/cache state.**
   `just demo` and `just review` are useful, but in a fresh worktree they rely on
   `.env.local` or DB env for default demo logging. The package READMEs document
   `--no-demo-log`, but the all-in-one recipes do not expose a no-DB variant.

4. **README is both useful and slightly stale.**
   It is the correct repo front door, but stale repository-map entries can still
   send agents to missing architecture docs.

5. **Historical evidence artifacts need authority labels.**
   `artifacts/phase0` contains old JSON/session artifacts. Keep the distinction:
   local artifacts are useful evidence, while the current imported Hell Week run
   index is `artifacts/evidence-index/hell-week-runs.md`.

## Recommended Follow-Up Slices

1. **README authority repair**
   - Remove `docs/architecture.md` from the repository map.
   - Ensure architecture readers are pointed only at
     `docs/llm-turn-planner-architecture.md` plus `docs/product-brief.md`.
   - Verify with the stale-reference `rg` command from this report.

2. **Site operator surface slice**
   - Add explicit `site-dev`, `site-build`, and possibly `site-preview` recipes,
     or document clearly that site commands are intentionally separate.
   - Verify with `npm --prefix site run build` plus `just --list`.

3. **Demo local/no-DB slice**
   - Add no-DB local demo/review recipes or make the existing recipes accept a
     clear flag path for `--no-demo-log`.
   - Verify in a clean shell without `.env.local` if possible.

4. **Deploy command naming/safety slice**
   - Clarify that `vercel-build` runs migrations and is not a pure local build.
   - Consider a README/Justfile warning before any command that touches database
     migration state.

5. **Hell Week authority comment cleanup**
   - Replace source comments that point at missing `agent-hell-battery` markdown
     artifacts with references to encoded categories and the evidence index.
   - Verify with the stale-reference `rg` command.

6. **Docs matrix execution**
   - Continue the already-approved documentation cleanup matrix rather than
     reintroducing old broad docs.
   - Keep this report as a map, not a new architecture source of truth.

## Completion Against PRD

This report satisfies the repository surface audit PRD by producing an
observational map of repo structure, package roles, operator commands,
build/deploy flow, secret/database boundaries, documentation authority, drift,
risk, and follow-up slices. It intentionally leaves source behavior unchanged.
