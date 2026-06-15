# Agent Instructions

## Start Here
- Current direction: Phase 0 proves the TurnPlanner engine before productising.
- Read `docs/llm-turn-planner-architecture.md` before implementation planning.
- Treat `docs/product-brief.md` as the product boundary and safety contract.
- Treat `docs/architecture.md` as the eventual product stack, not the first build slice.

## Phase 0 Scope
- Build the engine first: `processTurn`, TurnPlanner contract, retrieval, validator, traces, journey simulation, and model comparison.
- Use `TurnPlanner` for the planner interface, `TurnPlan` for the untrusted model proposal, and `ValidatedTurnResult` for the enforced result; reserve `ChatService` for later productisation.
- Do not start with the Vue widget, AWS deployment, SQL Server persistence, production audit store, real PII intake, or ticket webhook.
- Use local traces for review evidence; production audit comes after the engine proof.
- Commit atomic slices as they become safe, with narrow staging only

- The corpus `serving_mode` is policy data: `answer`, `handoff_account_specific`, `route_vulnerability`, `excluded`.
- `excluded` means recognised-but-not-answerable: do not answer the substance; refuse/signpost with approved links or route to human fallback while preserving the exclusion reason in traces.
- Standard handoff intake fields are `fullName`, `dateOfBirth`, `address`, `phone`, `email`, and `situationSummary`; Phase 0 represents them in simulations/traces only, and blocks payment/bank credential collection without building production-grade PII infrastructure.
- Grounding in Phase 0 means cited `serving_mode: answer` corpus items plus obvious invention checks; record retrieval scores as evidence, but do not build brittle score-threshold gates unless observed runs justify them.
- The validator is a hard-rule policy/schema backstop, not a UX-quality critic; put warmth, brevity, and clarification quality into journey reports and model comparison.
- Phase 0 uses one TurnPlanner call with `safetyFlags`; do not add a separate model-backed vulnerability detector unless trace evidence later shows it is needed.
- Journey simulations assert behavioral envelopes, not exact wording; use pass/fail for safety and policy boundaries, and report UX quality as metrics/notes unless safety-relevant.
- **Live lab API simulation evidence is worth roughly 100x static/unit/static fixture evidence for user-visible routing behavior.**
- **Static routing tests and hard-coded restraints are false-positive/false-negative magnets; they usually make tuning harder unless they guard a tiny non-negotiable safety invariant.**
- Model comparison ranks Phase 0 planner configurations and failure modes; do not treat it as production model approval or add fixed score gates.
- Do not build a fake planner baseline. Phase 0 evidence must come from real model-backed planner behavior over a broad journey suite, not a few curated happy paths.

## Package Manager
- Planned app scaffold: npm workspaces with TypeScript.
- Use TypeScript source imports without `.js` specifiers; configure module resolution to support actual TypeScript source.
- Current repo front door: `just --list`.

## Local Commands
| Task | Command |
|---|---|
| List recipes | `just --list` |
| Run tests | `just test` |
| Type-check workspaces | `just typecheck` |
| Build workspaces | `just build` |
| Check formatting | `just format-check` |
| Probe one engine turn | `just core-turn -- --message "How do I apply?"` |
| Start the full lab | `just lab` |
| Start the lab API | `just core-serve -- --port 8787` |
| Start the lab UI | `just lab-ui` |

## Commit Attribution
AI commits MUST include:
```text
Co-Authored-By: (the agent's name and attribution byline)
```

## Working Notes
- Keep handoff docs concise; link to source docs rather than duplicating them.
- Markdown context cleanup is tracked in `docs/prds/2026-06-15-markdown-context-pruning-spec.md`; handle it before trusting old docs/artifacts.
- Preserve unrelated user changes. Stage narrowly and check `git status` before committing.
