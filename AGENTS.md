# Agent Instructions

Regulated consumer-loans support chat widget. npm workspaces: `contracts`, `backend`, `widget`. Architecture and safety boundary live in `docs/`.

## Decision Ledger
`DECISIONS.yaml` (repo root) records binding dev decisions with their risk and insurance. Read it before architectural or journey-modelling work. When you make or reverse a decision, APPEND a new `DD-NNNN` entry — never rewrite past entries (set `status: superseded` instead). Newest entries last.

## Package Manager
Use **npm** (workspaces). `just` is the command front door — `just --list`.
- `just setup` — install all workspaces
- `just check` — full local gate: typecheck + lint + test + build
- `just demo` — drive the pipeline through every journey and print the audit trail

## File-Scoped Commands
| Task | Command |
|------|---------|
| Typecheck (workspace) | `npm run typecheck --workspace backend` |
| Lint (file) | `npx eslint path/to/file.ts` |
| Test (file) | `npx vitest run path/to/file.test.ts` |

## Key Conventions
- Backend owns all business and safety decisions; the frontend renders backend-provided state only.
- Customer-facing answers must be grounded in the approved KB, or route to a human. See `docs/product-brief.md` §16 (non-negotiables).
- Vulnerability gate fails closed. Never collect or forward bank/payment credentials (sort code, account number).
- Every inbound and outbound message is audited — never drop an audit event.

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
