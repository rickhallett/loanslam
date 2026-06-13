# Phase 0 TurnPlanner Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 0 TurnPlanner core engine, retrieval, validator, traces, journey simulation, model comparison, and CLI.

**Architecture:** A TypeScript npm workspace with `packages/contracts` for shared schemas and `packages/core` for engine behavior. `processTurn` orchestrates retrieval, a swappable real `TurnPlanner`, hard-rule validation, trace creation, and state updates.

**Tech Stack:** Node 24-compatible TypeScript ESM, npm workspaces, Zod, Vitest, tsx, OpenAI JavaScript SDK structured outputs.

---

### Task 1: Workspace And Contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/schemas.ts`
- Create: `packages/contracts/src/schemas.test.ts`
- Modify: `.gitignore`
- Modify: `Justfile`

- [ ] Add root npm scripts for `test`, `typecheck`, `build`, `format:check`, `core:turn`, `core:simulate`, and `core:compare`.
- [ ] Add Zod schemas and TypeScript types for serving modes, intake fields, safety flags, UI primitives, corpus items, retrieval matches, planner input, `TurnPlan`, validator overrides, `ValidatedTurnResult`, turn traces, journey fixtures, and comparison reports.
- [ ] Add focused schema tests that first fail for required fields and enum boundaries, then pass after implementation.

### Task 2: Corpus Loading And Retrieval

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/corpus.ts`
- Create: `packages/core/src/retriever.ts`
- Create: `packages/core/src/corpus.test.ts`
- Create: `packages/core/src/retriever.test.ts`

- [ ] Load and validate `data/public-info/loanslam-synthetic-kb.json`.
- [ ] Implement inspectable lexical retrieval over question, variants, tags, route reasons, and answer text.
- [ ] Return ranked `RetrievedMatch` objects with item IDs, scores, serving modes, and matched terms.
- [ ] Prove all 60 corpus items load and retrieval finds answer, handoff, vulnerability, and excluded cases.

### Task 3: Validator And Engine

**Files:**
- Create: `packages/core/src/validator.ts`
- Create: `packages/core/src/engine.ts`
- Create: `packages/core/src/policy.ts`
- Create: `packages/core/src/validator.test.ts`
- Create: `packages/core/src/engine.test.ts`

- [ ] Validate hard rules for answer grounding, serving mode, safety flags, forbidden credentials, account-specific answers, unsupported UI primitives, malformed plans, and promised outcomes.
- [ ] Override invalid plans to the safest valid action while recording explicit override reasons.
- [ ] Implement `processTurn` to create correlation IDs, retrieve matches, call `TurnPlanner`, validate, update conversation state, and produce trace evidence.
- [ ] Prove validator and engine behavior with direct `TurnPlan` fixtures and inline test planners only.

### Task 4: Real Planner Adapter

**Files:**
- Create: `packages/core/src/planners/openaiPlanner.ts`
- Create: `packages/core/src/planners/prompt.ts`
- Create: `packages/core/src/planners/config.ts`
- Create: `packages/core/src/planners/openaiPlanner.test.ts`

- [ ] Implement a real OpenAI-backed `TurnPlanner` using structured outputs and the shared `TurnPlan` schema.
- [ ] Build planner prompts from conversation history, retrieval matches, policy rules, and allowed UI primitives.
- [ ] Fail clearly when `OPENAI_API_KEY` is missing.
- [ ] Unit-test prompt/config/schema behavior without calling the live API.

### Task 5: Journey Simulation And Reports

**Files:**
- Create: `packages/core/src/simulation/journeys.ts`
- Create: `packages/core/src/simulation/runner.ts`
- Create: `packages/core/src/simulation/report.ts`
- Create: `packages/core/src/simulation/runner.test.ts`
- Create: `packages/core/src/simulation/report.test.ts`

- [ ] Add a representative journey suite covering answerable FAQ, vague clarification, application status, payment issue, settlement figure, change request, vulnerability direct/indirect, complaint/legal, excluded advice, impatience, sensitive over-sharing, topic change, and malformed model output.
- [ ] Assert behavioral envelopes rather than exact wording.
- [ ] Write JSONL traces and aggregate comparison-ready metrics.
- [ ] Preserve `excluded` item route reasons in traces and reports.
- [ ] Keep UX notes in reports without making them hard validator gates.

### Task 6: CLI And Operator Surface

**Files:**
- Create: `packages/core/src/cli.ts`
- Create: `packages/core/src/cli.test.ts`
- Modify: `README.md`
- Modify: `Justfile`

- [ ] Add `core:turn`, `core:simulate`, and `core:compare` commands.
- [ ] Ensure simulation/model comparison uses real configured planner adapters and refuses to run without credentials.
- [ ] Document the Phase 0 commands and generated artifact locations.

### Task 7: Final Verification

**Files:**
- Review all changed source, docs, generated package metadata, and tests.

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `just --list`.
- [ ] Run a no-credential CLI check to confirm real-planner configuration failure is explicit.
- [ ] Run a configured real-model simulation/comparison when `OPENAI_API_KEY` is available; if unavailable, report that Phase 0 product evidence is not complete in this checkout.
- [ ] Run final code review and fix any material issues.
