# Phase 0 Engine Stakeholder Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phase 0 TurnPlanner engine evidence robust, behaviorally sharper, and stakeholder-readable enough to support a productisation decision.

**Architecture:** Keep the engine-first shape: `processTurn` remains the core boundary, `TurnPlanner` remains untrusted model output, and `ValidatedTurnResult` remains enforced output. Add resilience at the planner/simulation/reporting boundary, then tune behavior through prompt/policy/tests without building product infrastructure.

**Tech Stack:** TypeScript, npm workspaces, Zod, Vitest, OpenAI Responses structured output, Justfile recipes.

---

## File Structure

- `docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md`: PRD and product boundary for this runway.
- `packages/contracts/src/schemas.ts`: report/result schemas if malformed planner results need first-class fields.
- `packages/contracts/src/schemas.test.ts`: schema regression tests.
- `packages/core/src/planners/openaiPlanner.ts`: OpenAI-specific structured output normalization and parse-error boundary.
- `packages/core/src/planners/openaiPlanner.test.ts`: adapter tests for oversized choice lists and invalid parsed output.
- `packages/core/src/engine.ts`: `processTurn` fail-closed behavior when planner output is invalid.
- `packages/core/src/engine.test.ts`: engine behavior tests for planner failures and safe fallbacks.
- `packages/core/src/cli.ts`: command handling, comparison output, and manual probe behavior.
- `packages/core/src/cli.test.ts`: CLI regression tests.
- `packages/core/src/simulation/runner.ts`: journey-suite failure capture and report continuation.
- `packages/core/src/simulation/runner.test.ts`: journey-suite malformed-plan regression tests.
- `packages/core/src/simulation/report.ts`: comparison metrics and failure-mode wording.
- `packages/core/src/simulation/report.test.ts`: report metric tests.
- `packages/core/src/simulation/personaRunner.ts`: persona transcript resilience if planner failures appear in persona runs.
- `packages/core/src/simulation/personaReport.ts`: persona metrics and failure-mode wording.
- `packages/core/src/simulation/personaReport.test.ts`: persona report tests.
- `packages/core/src/planners/prompt.ts`: planner guidance for clarification, UI choice limits, grounding, and route-item citations.
- `packages/core/src/validator.ts`: hard-rule enforcement only if tests show unavoidable validator-boundary change.
- `packages/core/src/validator.test.ts`: regression tests for safety boundaries.
- `Justfile`: quoted argument forwarding for documented recipes.
- `docs/phase-0-human-validation-guide.md`: update only if commands or evidence interpretation changes.
- `docs/phase-0-stakeholder-evidence.md`: final tracked evidence note generated in Slice 4.

## Task 1: PRD And Runway Artifacts

**Files:**
- Create: `docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md`
- Create: `docs/superpowers/plans/2026-06-13-phase-0-engine-stakeholder-readiness.md`

- [ ] **Step 1: Write the PRD**

Create the PRD with the problem statement, solution, user stories, implementation
decisions, testing decisions, out-of-scope boundaries, and decision gate.

- [ ] **Step 2: Write this implementation plan**

Create this implementation plan with slice-level tasks and verification commands.

- [ ] **Step 3: Verify doc artifacts**

Run:

```bash
test -f docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md
test -f docs/superpowers/plans/2026-06-13-phase-0-engine-stakeholder-readiness.md
rg -n 'F[I]XME|T[B]D|__PLACE''HOLDER__' docs/prds/2026-06-13-phase-0-engine-stakeholder-readiness-prd.md docs/superpowers/plans/2026-06-13-phase-0-engine-stakeholder-readiness.md
```

Expected: both `test` commands exit 0; `rg` finds no unfinished-marker language.

## Task 2: Slice 1 - Non-Fragile Evidence Runs And CLI Quoting

**Files:**
- Modify: `packages/core/src/planners/openaiPlanner.ts`
- Modify: `packages/core/src/planners/openaiPlanner.test.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/engine.test.ts`
- Modify: `packages/core/src/simulation/runner.ts`
- Modify: `packages/core/src/simulation/runner.test.ts`
- Modify: `packages/core/src/cli.ts`
- Modify: `packages/core/src/cli.test.ts`
- Modify: `Justfile`

- [ ] **Step 1: Write failing tests for malformed planner output**

Add tests proving that an invalid planner proposal produces a safe fallback or a
reportable malformed-plan journey result instead of aborting the run.

Minimum cases:

```ts
it("falls back safely when the planner returns a schema-invalid choice list", async () => {
  // planner returns a choice_list with seven choices
  // processTurn resolves with finalAction "fallback"
  // validatorOverrides or trace evidence includes "malformed_plan"
});
```

```ts
it("continues the journey suite after a malformed planner result", async () => {
  // first journey planner result is malformed
  // second journey still runs
  // reports include malformed plan evidence
});
```

- [ ] **Step 2: Verify the malformed-output tests fail**

Run:

```bash
npm test -- packages/core/src/engine.test.ts packages/core/src/simulation/runner.test.ts packages/core/src/planners/openaiPlanner.test.ts
```

Expected: new tests fail because malformed planner output currently throws.

- [ ] **Step 3: Implement fail-closed malformed-plan handling**

Keep provider-specific parsing in the planner adapter where possible. If invalid
planner output escapes the adapter, catch it at `processTurn`, emit a safe fallback,
and preserve enough trace data for reports. Do not weaken the Zod contracts for valid
customer-facing results.

- [ ] **Step 4: Write failing tests for CLI message forwarding**

Add a regression test that invokes the same argument shape documented by the Just
recipe and proves the full message `"I need help with my loan"` reaches `processTurn`.

- [ ] **Step 5: Verify the CLI test fails**

Run:

```bash
npm test -- packages/core/src/cli.test.ts
```

Expected: the test fails before the Justfile/CLI forwarding fix if it exercises the
documented broken path.

- [ ] **Step 6: Fix argument forwarding**

Update the documented local path so `just core-turn -- --message "I need help with my loan"`
preserves the full message. Prefer a Justfile quoting fix if sufficient; otherwise
adjust CLI parsing and docs together.

- [ ] **Step 7: Verify Slice 1**

Run:

```bash
npm test -- packages/core/src/engine.test.ts packages/core/src/simulation/runner.test.ts packages/core/src/planners/openaiPlanner.test.ts packages/core/src/cli.test.ts
just core-turn -- --message "I need help with my loan"
just core-compare -- --output artifacts/phase0/comparison-current.json
```

Expected: targeted tests pass; `core-turn` processes the whole message; `core-compare`
completes all 14 journeys and records malformed plans if they occur.

## Task 3: Slice 2 - Useful Clarification Behavior

**Files:**
- Modify: `packages/core/src/planners/prompt.ts`
- Modify: `packages/core/src/validator.ts` only if a hard-rule bug is proven
- Modify: `packages/core/src/validator.test.ts`
- Modify: `packages/core/src/simulation/journeys.ts` only if expectations need clearer envelopes
- Modify: `packages/core/src/simulation/runner.test.ts`
- Modify: `packages/core/src/simulation/personaReport.test.ts`

- [ ] **Step 1: Write failing clarification tests**

Add tests proving a vague low-risk message can result in `ask_clarifying_question`,
while account-specific, hardship, legal, and credential cases still route safely.

Minimum cases:

```ts
it("allows a low-risk vague request to clarify instead of handoff", () => {
  // plan action ask_clarifying_question
  // no safety flags
  // retrieved matches do not force route_vulnerability
  // validateTurnPlan keeps ask_clarifying_question
});
```

```ts
it("still routes hardship before clarification", () => {
  // plan tries ask_clarifying_question with hardship or route_vulnerability
  // validateTurnPlan returns request_handoff_intake
});
```

- [ ] **Step 2: Verify clarification tests fail where behavior is missing**

Run:

```bash
npm test -- packages/core/src/validator.test.ts packages/core/src/simulation/runner.test.ts packages/core/src/simulation/personaReport.test.ts
```

Expected: the new missing behavior fails before prompt/policy adjustment.

- [ ] **Step 3: Tune planner guidance and, only if needed, validator routing**

Update prompt guidance so vague low-risk requests ask a short clarifying question
instead of selecting a broad handoff. Keep vulnerability, complaint, legal,
accessibility, hardship, account-specific, and credential routing strict.

- [ ] **Step 4: Verify Slice 2**

Run:

```bash
npm test -- packages/core/src/validator.test.ts packages/core/src/simulation/runner.test.ts packages/core/src/simulation/personaReport.test.ts
just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts-current.jsonl --report-output artifacts/phase0/persona-report-current.json
jq '.metrics' artifacts/phase0/persona-report-current.json
```

Expected: tests pass; persona report has `clarificationRate` greater than 0 unless
real model behavior remains a documented failure mode; safety metrics do not regress.

## Task 4: Slice 3 - Reduce Validator Rescues

**Files:**
- Modify: `packages/core/src/planners/prompt.ts`
- Modify: `packages/core/src/planners/openaiPlanner.ts`
- Modify: `packages/core/src/planners/openaiPlanner.test.ts`
- Modify: `packages/core/src/validator.test.ts`
- Modify: `packages/core/src/simulation/report.test.ts`
- Modify: `packages/core/src/simulation/personaReport.test.ts`

- [ ] **Step 1: Write failing tests for avoidable overrides**

Add tests for the specific override patterns seen in current evidence:

```ts
it("does not cite route items for handoff actions", async () => {
  // planner output for request_handoff_intake should have null grounding
  // or unsupported grounding that does not count as an answer citation
});
```

```ts
it("normalizes oversized choice lists before final TurnPlan parsing or reports malformed output", async () => {
  // seven OpenAI choices should not abort the adapter without controlled evidence
});
```

```ts
it("does not phrase account-specific handoff copy as a promised account outcome", () => {
  // handoff copy remains safe and avoids account-promise regex triggers
});
```

- [ ] **Step 2: Verify tests fail for current behavior**

Run:

```bash
npm test -- packages/core/src/planners/openaiPlanner.test.ts packages/core/src/validator.test.ts packages/core/src/simulation/report.test.ts packages/core/src/simulation/personaReport.test.ts
```

Expected: new tests fail before prompt/adapter/report fixes.

- [ ] **Step 3: Tighten planner contract behavior**

Update prompt and adapter boundaries so the planner avoids route-item citations on
handoff, respects UI choice limits, and avoids phrasing that trips hard account-promise
rules.

- [ ] **Step 4: Verify Slice 3**

Run:

```bash
npm test -- packages/core/src/planners/openaiPlanner.test.ts packages/core/src/validator.test.ts packages/core/src/simulation/report.test.ts packages/core/src/simulation/personaReport.test.ts
just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts-current.jsonl --report-output artifacts/phase0/persona-report-current.json
jq '.metrics' artifacts/phase0/persona-report-current.json
```

Expected: targeted tests pass; current-head persona evidence shows a lower
`validatorOverrideRate` than the pre-slice value of about 0.77, or the remaining
override reasons are explicitly documented for Slice 4.

## Task 5: Slice 4 - Stakeholder Evidence Pack

**Files:**
- Create: `docs/phase-0-stakeholder-evidence.md`
- Modify: `docs/phase-0-human-validation-guide.md` only if command expectations changed

- [ ] **Step 1: Run deterministic gates**

Run:

```bash
just test
just typecheck
just build
just format-check
```

Expected: all exit 0.

- [ ] **Step 2: Run real model-backed evidence**

Run:

```bash
just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts-current.jsonl --report-output artifacts/phase0/persona-report-current.json
just core-compare -- --output artifacts/phase0/comparison-current.json
```

Expected: both commands complete. If the provider returns quota or transient errors,
record that explicitly and inspect the newest completed artifacts without claiming a
fresh model run.

- [ ] **Step 3: Extract evidence snippets**

Run:

```bash
jq '.metrics' artifacts/phase0/persona-report-current.json
jq '.metrics' artifacts/phase0/comparison-current.json
jq -c '{scenarioId, persona: .persona.id, finalAction, turns: [.turns[] | {userMessage, botMessage, finalAction, selectedServingMode, safetyFlags, validatorOverrideCodes}]}' artifacts/phase0/persona-transcripts-current.jsonl
```

Expected: metrics and transcript excerpts are readable enough to summarize.

- [ ] **Step 4: Write stakeholder evidence note**

Create `docs/phase-0-stakeholder-evidence.md` with:

- practical takeaway
- current baseline model/prompt/policy
- what works
- what still fails
- metric table or concise metric bullets
- representative transcript excerpts
- productisation recommendation
- explicit caveat that evidence is synthetic Phase 0, not production approval

- [ ] **Step 5: Verify Slice 4**

Run:

```bash
rg -n 'F[I]XME|T[B]D|__PLACE''HOLDER__' docs/phase-0-stakeholder-evidence.md
just test
just typecheck
just build
just format-check
```

Expected: no unfinished markers; all deterministic gates pass.

## Final Verification

- [ ] Run:

```bash
git status --short
just test
just typecheck
just build
just format-check
just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts-current.jsonl --report-output artifacts/phase0/persona-report-current.json
just core-compare -- --output artifacts/phase0/comparison-current.json
```

- [ ] Inspect:

```bash
jq '.metrics' artifacts/phase0/persona-report-current.json
jq '.metrics' artifacts/phase0/comparison-current.json
```

- [ ] Summarize the implemented slices, verification output, residual risks, and the
      productisation recommendation.
