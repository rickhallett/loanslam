# Phase 0 Simulator Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 0 produce broad, inspectable customer/personality conversation data and provide thin local ways to drive the core engine manually.

**Architecture:** Keep `processTurn` as the engine boundary. Add a simulation layer that expands persona scenarios into full user/bot transcripts, then add local operator surfaces over the same core: an interactive CLI loop and a dev-only HTTP server. Avoid widget, SQL Server, production sessions, auth hardening, ticket webhooks, or deployment.

**Tech Stack:** Node 24-compatible TypeScript ESM, npm workspaces, Zod contracts, Vitest, tsx, built-in Node `readline/promises` and `node:http`.

---

## File Structure

- Modify `packages/contracts/src/schemas.ts`: add schemas/types for personas, scenario fixtures, transcript turns, conversation transcripts, and persona reports.
- Modify `packages/contracts/src/index.ts`: export the new contract types through the existing barrel.
- Add `packages/core/src/simulation/personas.ts`: persona/scenario fixtures and helpers for default state.
- Add `packages/core/src/simulation/personaRunner.ts`: run scenario turns through `processTurn`, write transcript JSONL, and build transcript objects.
- Add `packages/core/src/simulation/personaReport.ts`: aggregate hard data from transcripts.
- Add tests beside each new simulation file.
- Modify `packages/core/src/cli.ts`: add `persona-simulate`, `chat`, and `serve` commands.
- Add `packages/core/src/lab/server.ts`: dev-only HTTP wrapper around the core engine.
- Add `packages/core/src/lab/server.test.ts`: API behavior without a real network port where possible.
- Modify `Justfile` and `README.md`: operator commands and artifact locations.

## Task 1: Contracts For Persona Evidence

**Files:**
- Modify: `packages/contracts/src/schemas.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/schemas.test.ts`

- [ ] Write failing schema tests for:
  - `personaProfileSchema` requiring `id`, `label`, `traits`, and `styleNotes`.
  - `personaScenarioSchema` requiring a persona, scenario metadata, and at least one customer turn.
  - `conversationTranscriptSchema` preserving every user message, bot response, final action, retrieved item IDs, validator override codes, and trace IDs.
- [ ] Run `npm test packages/contracts/src/schemas.test.ts`.
- [ ] Add the minimal schemas and inferred types.
- [ ] Re-run the schema test until it passes.

## Task 2: Persona Scenario Harness

**Files:**
- Add: `packages/core/src/simulation/personas.ts`
- Add: `packages/core/src/simulation/personaRunner.ts`
- Add: `packages/core/src/simulation/personaRunner.test.ts`

- [ ] Write failing tests that prove the default scenario library includes cooperative, adversarial, confused, terse, impatient, vulnerable, oversharing, legal-threat, topic-switching, low-literacy, and hostile-valid personas.
- [ ] Write a failing test that runs one two-turn scenario through an injected planner and returns a transcript with exact user/bot message pairs and trace metadata for each turn.
- [ ] Implement the fixture library and runner over `processTurn`.
- [ ] Re-run the focused tests until they pass.

## Task 3: Persona Reports And Hard Data

**Files:**
- Add: `packages/core/src/simulation/personaReport.ts`
- Add: `packages/core/src/simulation/personaReport.test.ts`

- [ ] Write failing tests for metrics:
  - transcript count, turn count, persona count
  - handoff rate
  - answer rate
  - clarification rate
  - validator override rate
  - unsafe answer attempts
  - vulnerability handling count
  - per-persona final-action distribution
  - failure mode strings with scenario and persona IDs
- [ ] Implement report aggregation from transcripts only.
- [ ] Re-run the focused tests until they pass.

## Task 4: CLI Operator Surfaces

**Files:**
- Modify: `packages/core/src/cli.ts`
- Modify: `packages/core/src/cli.test.ts`

- [ ] Write failing CLI tests for:
  - `persona-simulate` writing transcript JSONL and report JSON with an injected planner.
  - `chat` accepting an injected input/output pair and preserving conversation state across turns.
  - `serve --help` documenting the dev API command without requiring credentials.
- [ ] Implement CLI handlers.
- [ ] Re-run focused CLI tests until they pass.

## Task 5: Thin Dev API

**Files:**
- Add: `packages/core/src/lab/server.ts`
- Add: `packages/core/src/lab/server.test.ts`
- Modify: `packages/core/src/cli.ts`

- [ ] Write failing tests for:
  - `POST /sessions` creating an in-memory conversation reference.
  - `POST /sessions/:conversationRef/messages` returning `ValidatedTurnResult` JSON and preserving state.
  - `GET /sessions/:conversationRef` returning state and traces.
  - `POST /sessions/:conversationRef/reset` clearing state.
  - unknown sessions and malformed JSON returning safe 4xx JSON.
- [ ] Implement a Node `http` server factory with injectable planner/corpus.
- [ ] Wire `core:serve` to start the server for local manual use.
- [ ] Re-run focused lab server tests until they pass.

## Task 6: Docs, Recipes, And Verification

**Files:**
- Modify: `Justfile`
- Modify: `README.md`

- [ ] Add `core-persona-simulate`, `core-chat`, and `core-serve` recipes.
- [ ] Document how to run:
  - batch persona simulation
  - turn-by-turn interactive CLI
  - thin local API
  - no-key failure checks
- [ ] Run `just test`, `just typecheck`, `just build`, and `just format-check`.
- [ ] Run `env -u OPENAI_API_KEY npm --silent run core:simulate -- --trace-output /tmp/loanslam-no-key-traces.jsonl` and confirm it fails with the explicit key message.
- [ ] If `OPENAI_API_KEY` is configured, run a real `just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts.jsonl --report-output artifacts/phase0/persona-report.json`; otherwise report that real evidence generation still needs credentials.
