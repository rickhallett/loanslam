# Agent Instructions

## Start Here
- Current direction: Phase 0 proves the TurnPlanner engine before productising.
- Read `docs/llm-turn-planner-architecture.md` before implementation planning.
- Treat `docs/product-brief.md` as the product boundary and safety contract.
- Treat `docs/architecture.md` as the eventual product stack, not the first build slice.

## Phase 0 Scope
- Build the engine first: `processTurn`, TurnPlanner contract, retrieval, validator, traces, journey simulation, and model comparison.
- Do not start with the Vue widget, AWS deployment, SQL Server persistence, production audit store, real PII intake, or ticket webhook.
- Use local traces for review evidence; production audit comes after the engine proof.
- The corpus `serving_mode` is policy data: `answer`, `handoff_account_specific`, `route_vulnerability`, `excluded`.

## Package Manager
- Planned app scaffold: npm workspaces with TypeScript.
- Current repo front door: `just --list`.

## Local Commands
| Task | Command |
|---|---|
| List recipes | `just --list` |
| Start local SQL Server | `just local-db` |
| Print database URL | `just mssql-url` |
| Stop SQL Server | `just mssql-stop` |

## Commit Attribution
AI commits MUST include:
```text
Co-Authored-By: (the agent's name and attribution byline)
```

## Working Notes
- Keep handoff docs concise; link to source docs rather than duplicating them.
- Preserve unrelated user changes. Stage narrowly and check `git status` before committing.
