# Lab API MCP Session Simulator Implementation Plan

**Goal:** expose the browser-free Phase 0 lab API session simulator as a local
stdio MCP server while preserving the one-turn-at-a-time evidence loop.

**Architecture:** add a small npm workspace for MCP tooling. Keep the MCP layer as
an adapter over the existing lab API instead of importing `processTurn` directly.
The deep module is a lab API client plus evidence summarizer; MCP tools are thin
registration wrappers around that module.

**Tech Stack:** Node 24-compatible TypeScript ESM, npm workspaces, Vitest, Zod,
`@modelcontextprotocol/sdk`, built-in `fetch`, and the existing lab API routes.

---

## Source Inputs

- PRD: `docs/prds/2026-06-15-lab-api-mcp-session-simulator-prd.md`
- Architecture boundary: `docs/llm-turn-planner-architecture.md`
- Product safety boundary: `docs/product-brief.md`
- Skill workflow source: `loanslam-lab-api-session-simulator`
- Existing API routes: `packages/core/src/lab/server.ts`
- Existing operator commands: `Justfile`

## Fixed V1 Decisions

- Package name: `@loanslam/mcp-server`
- Runtime entrypoint: `packages/mcp-server/src/server.ts`
- npm script: `npm run mcp:lab-api`
- just recipe: `just mcp-lab-api`
- Transport: stdio only
- Default base URL: `http://127.0.0.1:8787`
- Allowed alternate base URL: `http://127.0.0.1:5173`
- Artifact directory default: `artifacts/phase0`
- Tool names:
  - `lab_session_start`
  - `lab_session_send`
  - `lab_session_dump`
  - `lab_session_reset`
  - `lab_session_summarize`
  - `lab_scenario_plan`

## File Structure

- Add `packages/mcp-server/package.json`
- Add `packages/mcp-server/tsconfig.json`
- Add `packages/mcp-server/src/labApiClient.ts`
- Add `packages/mcp-server/src/labApiClient.test.ts`
- Add `packages/mcp-server/src/evidence.ts`
- Add `packages/mcp-server/src/evidence.test.ts`
- Add `packages/mcp-server/src/scenarioPlan.ts`
- Add `packages/mcp-server/src/scenarioPlan.test.ts`
- Add `packages/mcp-server/src/server.ts`
- Modify root `package.json`
- Modify root `tsconfig.base.json` only if needed
- Modify `Justfile`
- Modify `README.md`

## Runtime Flow

```text
MCP tool call
-> validate local base URL and input
-> call local lab API
-> fetch or validate full session evidence
-> summarize route, state, and safety fields
-> optionally write a validated dump under artifacts/phase0
-> return compact JSON text to the MCP client
```

## Task 1: Package And Tooling Scaffold

**Files:**

- Add `packages/mcp-server/package.json`
- Add `packages/mcp-server/tsconfig.json`
- Modify root `package.json`
- Modify `Justfile`
- Modify `README.md`

- [ ] Add the MCP package to the npm workspace with build and typecheck scripts.
- [ ] Add `@modelcontextprotocol/sdk` as the runtime dependency.
- [ ] Add root `mcp:lab-api` script.
- [ ] Add `just mcp-lab-api`.
- [ ] Document the command and Codex/Claude-style local stdio config snippet.

**Verification:**

```bash
npm install
npm run build --workspace @loanslam/mcp-server
just --list
```

**Commit checkpoint:** package scaffold and operator command.

## Task 2: Lab API Client And Evidence Summary

**Files:**

- Add `packages/mcp-server/src/labApiClient.ts`
- Add `packages/mcp-server/src/labApiClient.test.ts`
- Add `packages/mcp-server/src/evidence.ts`
- Add `packages/mcp-server/src/evidence.test.ts`

- [ ] Implement `assertAllowedBaseUrl`.
- [ ] Implement `startSession`.
- [ ] Implement `sendMessage`, including the required follow-up session fetch.
- [ ] Implement `fetchSession`.
- [ ] Implement `resetSession`.
- [ ] Implement `dumpSession`.
- [ ] Validate that dumps include `conversationRef`, `state.history`, and `traces`.
- [ ] Summarize message count, trace count, collected fact count, requested fields,
      handoff state, last action, serving mode, safety flags, validator overrides,
      and final customer-facing message.
- [ ] Use a test HTTP server so tests do not require OpenAI or a running lab API.

**Verification:**

```bash
npm test --workspace @loanslam/mcp-server
```

**Commit checkpoint:** tested lab API client and evidence summarizer.

## Task 3: Scenario Planning

**Files:**

- Add `packages/mcp-server/src/scenarioPlan.ts`
- Add `packages/mcp-server/src/scenarioPlan.test.ts`

- [ ] Convert a free-text brief into a safe first message, terminal condition, and
      constraints.
- [ ] Include synthetic handoff detail guidance.
- [ ] Block or rewrite requests that would use bank credentials, card data,
      payment credentials, or real customer PII.
- [ ] Keep planning read-only; never send turns from this helper.

**Verification:**

```bash
npm test --workspace @loanslam/mcp-server
```

**Commit checkpoint:** scenario planner.

## Task 4: MCP Server Tool Registration

**Files:**

- Add `packages/mcp-server/src/server.ts`
- Extend tests if a lightweight registration smoke test is practical.

- [ ] Create an MCP stdio server.
- [ ] Register `lab_session_start`.
- [ ] Register `lab_session_send`.
- [ ] Register `lab_session_dump`.
- [ ] Register `lab_session_reset`.
- [ ] Register `lab_session_summarize`.
- [ ] Register `lab_scenario_plan`.
- [ ] Ensure stdout is reserved for MCP messages and logs go to stderr.
- [ ] Return compact JSON text results for every tool.

**Verification:**

```bash
npm run typecheck --workspace @loanslam/mcp-server
npm run build --workspace @loanslam/mcp-server
```

**Commit checkpoint:** MCP stdio server.

## Task 5: Whole-Repo Verification

- [ ] Run focused MCP tests.
- [ ] Run workspace typecheck.
- [ ] Run workspace build.
- [ ] Run formatting check.
- [ ] Inspect git status and commit any final documentation or formatting fixes.

**Verification:**

```bash
npm test --workspace @loanslam/mcp-server
just typecheck
just build
just format-check
```

## Parking Lot

- Whole-scenario autopilot.
- Streamable HTTP transport.
- Remote authentication.
- Rich MCP resources for trace browsing.
- A persistent scenario-run ledger.
