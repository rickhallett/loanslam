# Codebase audit — dead code, duplication, bad code

Date: 2026-06-17
Scope: all 8 workspaces under `packages/*` plus `scripts/` (~27k LOC source, 123 files analyzed).
Method: `fallow` static analysis (dead-code graph, duplication, complexity) followed by adversarial verification of every dead-code claim and a per-area qualitative review. Headline claims were re-checked by hand against the live tree.

## Takeaway

The engine is in better shape than its size suggests. There is **almost no truly dead code** — 73 static "dead" hits collapse to one removable function and a handful of redundant `export` keywords; the rest are analyzer blind spots. The real liabilities are **duplication** and a few **correctness-of-routing** risks, not rot.

Three things matter most:

1. **`demo-*` and `review-*` are twin packages.** ~400 lines of production widget logic (HTTP client, intake PII validation, host-bridge safety-flag sets) are copy-pasted across two packages and two host loaders. This is the single largest cleanup and a live drift hazard. Decide: delete the superseded `demo-*`, or extract a shared `widget-core`.
2. **The retriever hard-drops corpus evidence based on an LLM's serving-mode guess** (`retriever.ts:218-264`). A single mis-classified shadow signal silently suppresses relevant policy items before the planner ever sees them, with no trace. This is exactly the brittle static-routing restraint the project's own guidance warns against.
3. **`escalate + intake_form` bypasses the missing-field completion gate** that the other two handoff actions enforce (`engine.ts:435-440`) — a behavioral divergence on the most-exercised handoff path.

Everything else is maintainability work: a cognitive-40 validator, three-to-five-way duplicated helpers, two unenforced "guarantees", and left-in debug instrumentation.

## Caveats on this audit

- The `fallow` static baseline (dead-code counts, 6% duplication figure) was captured against a snapshot that predates three files added/changed since: `hellweek/compare.ts` (untracked), `hellweek/jasmineReport.ts`, and `scripts/phase0-cheap-model-quality-probe.ts`. The qualitative reviewers saw the **current** tree, so their findings against those files are included and were hand-verified; the raw fallow counts slightly understate duplication (e.g. `escapeHtml` is in 3 files, not 2; `compare.ts` re-declares canonical types).
- `vanilla-throwaway` had no dedicated qualitative pass (repeated transient API overload), but its substance is covered: the scripts were verified in the dead-code phase, and `devtools.js`/`loader.js` were reviewed under `widgets`.
- 0 circular dependencies, 0 architecture-boundary violations, 0 unused npm dependencies. Maintainability index averages 92/100.

---

## 1. Dead code — the static count is mostly false positives

`fallow` reported 73 dead-code issues (7 files, 14 exports, 46 types, 1 class member, 5 unresolved imports). After verifying each:

### Genuinely removable
- **`effectiveSeverity` + `worstSeverity` (dead pair).** `grade.ts:419-424` is exported but has zero callers, and it is a logical no-op (`severity === "fine" ? "fine" : worstSeverity(severity, "fine")` always returns the input). Its only dependency `worstSeverity` (`types.ts:24-26`) is used nowhere else. Delete both. The doc comment describes severity-flooring that was never wired in.
- **`scenarioById` dead computation.** `run.ts:153` builds a `Map`, then `run.ts:170-171` does `void scenarioById;` with a comment claiming "validation of membership" that does not happen. Delete the map and the `void`.
- **`scripts/ux-evaluator-probe.mjs`** — spent probe; the decision it informed (use `gpt-5.4-mini` for the UX evaluator) is already recorded in the Phase 0 evidence PRD. Human call: delete as a spent probe, or wire it into a recipe if it should stay repeatable. Same applies to `scripts/throwaway/openai-model-family-probe.ts`.

### Confirmed-dead exports (symbol stays, drop the `export` keyword)
The symbol is used inline as a parameter/return type, but the *public export* has no consumer: `TurnPlannerPrompt` (`planners/prompt.ts`), `BuildReportInput` (`hellweek/aggregate.ts`), `BuildStochasticArtifactPathsInput` / `WriteStochasticArtifactsInput` (`stochastic/artifacts.ts`). Demoting `export` clears the flag without behavior change.

### Dead *data*, not dead code
- **`scenario.severityFloor`** is a required field authored on ~122 hellweek scenarios but read by no grading/aggregation code (its only would-be consumer was the dead `effectiveSeverity`). Either wire it into `mergeGrade` as a real ceiling (stop a judge downgrading a `demo_killer`-floored safety scenario) or drop the field and its ~122 values. Don't keep a lovingly-curated field that influences nothing.

### False positives (keep as-is)
- **All 7 "unused files"** — Vite `public/` assets (`loader.js`, `styles.css`, `devtools.js`) referenced from HTML via `<script>`/`<link>`, and no-importer operator scripts. The import-graph analyzer cannot see HTML-referenced assets or hand-run CLIs. All ship in `dist/`.
- **All 5 "unresolved imports"** — the same Vite `public/`-served-at-root convention.
- **~50 of 60 "dead exports/types"** — used as inline param/return types or via interface dispatch within their module (`labApiClient.ts` alone has ~13 such types; `OpenAiSignalExtractor.extractSignals` is reached by polymorphic dispatch). Dropping `export` is optional hygiene, not a fix.

Net: the analyzer's 17.9% "dead export" rate is almost entirely *redundant `export` keywords*, not dead logic. Recommend excluding `packages/*/public/**` and `scripts/**` from the dead-code scan to stop the recurring noise.

---

## 2. Duplication — the real signal

fallow measured ~6% duplication (understated; see caveats). Ranked by value to fix:

### High
- **`demo-widget` ≈ `review-widget` (functional twins).** `engineClient.ts`, `main.ts`, `env.d.ts` are byte-identical; `IntakeForm.vue` `<script>` (incl. the email/phone PII-validation regexes) is byte-identical; `WidgetApp.vue` scripts are ~95% identical; `hostBridge.ts` shares the `VULNERABLE_FLAGS`/`HANDOFF_ACTIONS` safety-classification sets. The genuine divergence is small (review adds telemetry + devtools + brand chrome). Born in one commit; `review-*` is the superseding surface. **Action:** extract `@loanslam/widget-core` (engineClient + hostBridge base + a headless `useChatSession` composable) and reduce both packages to brand shells, or delete `demo-widget`/`demo-host` + the `demo` just recipe if the no-devtools variant isn't needed.
- **Host `loader.js` forked (318-line diff)** between `demo-host` and `review-host`. Same embed-loader concept (launcher + sandboxed iframe + postMessage protocol) hand-edited into two diverging copies. Parameterize one loader (id prefix, port, telemetry flag).
- **hellweek report helpers duplicated 3-4×.** `escapeHtml` is byte-identical in `hellweek/htmlReport.ts:462`, `hellweek/jasmineReport.ts:207`, and `stochastic/htmlReport.ts:364` (a security-relevant escaper that must not drift); the category-grouping loop is reimplemented in `aggregate.ts`, `htmlReport.ts`, and `jasmineReport.ts`. Extract a shared `reportHelpers.ts` (escapeHtml, formatDuration, `groupGradesByCategory`, `categoryRank`). Keep the two distinct CSS themes separate.

### Medium
- **`emptyConversationState` / `defaultConversationState` duplicated in 5 places** — `cli.ts:763`, `lab/server.ts:344`, `stochastic/runner.ts:219`, `simulation/runner.ts:457`, `simulation/personaRunner.ts:253` (last two differ only by a `journey-`/`persona-` ref prefix). This is the canonical engine-entry empty state of a contract shape; add a contract field and four copies silently fall out of sync. Define once (engine or contracts) and import.
- **Two parallel OpenAI adapters.** `planners/openaiPlanner.ts:21-96` and `signals/openaiSignalExtractor.ts:19-96` independently define the same `responses.parse` client port, request shape, constructor pattern, metadata assembly, and `schema.parse(normalize(output_parsed))` call. They already drift (the extractor supports `AbortSignal`; the planner doesn't). Extract one structured-output adapter taking `{schema, prompt, metadata, abortSignal?}`.
- **Safety-metric reducers duplicated across the two simulation runners.** `countCaughtUnsafeProposals` is byte-identical (`runner.ts:388` / `personaRunner.ts:208`); `isVulnerabilityFlag` (same 6-flag list) and the "saw vulnerability" predicate are copy-pasted (`runner.ts:396-403` inline vs `personaRunner.ts:224-232` named). These compute the safety numbers the journey and persona suites report; if they drift, the two suites report inconsistent safety outcomes. Extract shared trace-metric helpers.
- **`compare.ts` re-declares canonical types.** `severityRank` (`compare.ts:6`) duplicates `types.ts:18`; `HellWeekVerdict` (`compare.ts:12`) duplicates `types.ts:220`; `CompareReport`/`CompareGrade` are hand-maintained partial copies of `HellWeekReport`. Import the real ones; derive JSON-parse shapes via `Pick<HellWeekReport, ...>` so a report-schema change breaks the build instead of silently reading stale fields.

### Low
- `requestJson`/`isErrorPayload` fetch helper triplicated across `demo-widget`, `review-widget`, `lab-ui` (subsumed by the widget-core extraction; `lab-ui` is the third consumer).
- `journeyExpectationSchema` ≡ `stochasticExpectationSchema` tail (`schemas.ts:332-342` / `523-532`) — extract a shared `expectationBaseShape` spread into both; both are parsed at runtime so the duplication is live.
- `vite.config.ts`, stochastic finding-render blocks (`htmlReport.ts`), `practicalTakeaway` (verdict→sentence mapping implemented twice with *different wording* in `report.ts:274` and `htmlReport.ts:348`, so markdown and dashboard can disagree), test-scaffold repetition. Opportunistic only.
- The fallow "353-line clone" between the two HTML report generators is a **false positive** — the CSS bodies are genuinely different themes; only the shared `escapeHtml` head matters (covered above). Do not mechanically extract 353 lines.

---

## 3. Correctness & quality risks (ranked)

### High
- **Retriever hard-filters on an LLM serving-mode guess.** `retriever.ts:218-264` (`signalAllowsServingMode`, called at `:150-158`) drops every corpus item whose `serving_mode` ≠ the shadow signal's `recommendedServingMode` (except `answer`). A mis-classified signal silently suppresses `route_vulnerability`/`excluded` evidence before the planner runs, with nothing in the trace. **Fix:** demote the signal serving-mode from a hard filter to a boost (the `signalBoost` path already exists) and let the planner + validator decide with full evidence; if suppression must stay, record dropped item IDs + the suppressing mode in the trace.
- **`escalate + intake_form` skips the completion gate.** `applyHandoffStateRules` (`engine.ts:435-440`) recomputes missing fields and trims the field list only for `create_ticket` and `request_handoff_intake`; `escalate` (allowed with `intake_form` per `policy.ts:44`) is passed through verbatim, so its intake bookkeeping silently differs. `escalate` is the required action across most vulnerability/hardship scenarios. **Fix:** treat `escalate + intake_form` like `request_handoff_intake`, or document+test why it's exempt; add a sim turn that escalates with a partial form and asserts field behavior.
- **`clarification_loop` is an advertised guarantee the evaluator never enforces.** Every stochastic template sets `maxClarificationTurns: 1` and an `ambiguous-clarification` template targets `clarification_loop`, but `classifyTraceHardFailure` has no clarification branch and `maxClarificationTurns` is read nowhere in `stochastic/` (`evaluate.ts:192-217`, `:261-372`). Worse, coverage reports the category as "covered" merely because the template was *sampled* (`coverage.ts:116-139`), giving false confidence. **Fix:** implement the clarification-budget check, or drop the unreachable target + `case "clarification_loop"` so the engine stops advertising an unenforced guarantee.
- **`validateTurnPlan` is a 264-line / cognitive-40 implicit-precedence chain.** `validator.ts:57-320` is 7+ sequential guard blocks whose *order is load-bearing policy* (out-of-domain must precede the vulnerability backstop, etc.) but undocumented. This is the hard policy backstop and the least legible function in the package. **Fix:** extract each guard into a named predicate+builder, drive them through an explicit ordered list so precedence is data and visible; keep order identical, pin with existing tests.
- **The one untrusted HTTP boundary validates almost nothing.** `contracts` defines runtime zod schemas (`validatedTurnResultSchema`, `turnTraceSchema`, `conversationStateSchema`) for exactly the data the lab API returns — but none is ever `.parse`d (confirmed: type-only), and `mcp-server` has **no dependency on `contracts`**, re-describing the same data as all-optional interfaces it casts with `as unknown as` (`evidence.ts:54-76`). So the schemas pay zod's cost while delivering only inference, and the MCP client trusts shape by assertion. **Fix:** either wire `contracts` into the boundary and `safeParse` responses, or accept the schemas are type-only and stop pretending — a deliberate decision, not accidental drift.

### Medium
- **`deriveEffectiveServingMode` has a redundant branch that mislabels trace evidence.** `engine.ts:349-356`: a conditional returns `handoff_account_specific`, then line 356 returns the identical value unconditionally — the branch can't change the result, and it fail-*opens* (any non-vulnerability, non-excluded handoff is labelled account-specific even with no account-specific signal). It also re-derives precedence the validator already computed (`validator.ts:248-274`), so two places encode "vulnerability > handoff > excluded". Have the validator emit the effective mode; delete the dead branch.
- **Brittle static routers the project's own guidance flags as anti-patterns:** `classifyAuditRow` (`routeAudit.ts:462-552`, cyclomatic 23, hard-coded flag-set conjunctions) and `classifyBrief`/`detectBlockedInputs` (`scenarioPlan.ts:53-178`, substring matching on common words like `update`/`status`/`balance`, and discarding a brief's real intent when `account number` substring-matches). Keep them intentionally dumb but make precedence data, word-boundary the matches, and don't grow them into real classifiers.
- **`_candidate` values count toward handoff completion.** `hasCollectedHandoffField` (`engine.ts:801-809`) treats `${field}_candidate` as satisfying a required field, but per `prompt.ts:41` a `_candidate` is ambiguous and must be re-confirmed — so a ticket can auto-create on data the system flagged as needing confirmation, and `completeStructuredHandoff`/`hasAnyStandardHandoffFact` disagree about what "collected" means. Pick one rule and align all three.
- **`handleRequest` copy-paste route switch** (`lab/server.ts:76-276`, cognitive 46): the regex-match → `decodeURIComponent` → `sessions.get` → not-found → `readJsonBody` preamble is duplicated 4-5×. Extract a `{method, pattern, handler}` route table with a shared `resolveSession`+`readBody` guard. Also `serverHelpText` (`cli.ts:936-951`) omits the `/intake` and `/cancel-handoff` routes the server actually serves — derive the doc list from the same table.
- **`summarizeEvidence` complexity** (`evidence.ts:78-121`, cyclomatic 26) from stacked `?? ?? ?? null` chains over all-optional types — tightening the boundary types (above) removes most of the branching.
- **`normalizeUiPlan` hand-rebuilds the UI discriminated union** (`openaiPlanner.ts:174-237`) in lockstep with `uiPlanSchema`, including a redundant `.slice(0,6)` already enforced by the contract. Drive field projection from a per-primitive table and let the schema own the cap.

### Low
- **Left-in debug instrumentation that ships:** `devtools.js:15` `var DEBUG = true` (verbose console on every load); `review-widget/hostBridge.ts:52-58` unconditional `console.log` per telemetry post, forced past lint with `eslint-disable`. Gate behind a debug flag or remove.
- **`SHOW_INTAKE_FORM = true as boolean`** (`review-widget/MessagePrimitive.vue:15`) — a cast whose only purpose is to launder a dead, always-true toggle past TypeScript's unreachable-branch check. Remove the toggle and cast; inline the branch. A real kill-switch belongs in engine config.
- **Unanchored UK-postcode regex** (`engine.ts:754`) can capture reference/model numbers as a "postcode" and auto-complete a handoff with garbage; this path is already being patched commit-by-commit. Drop the unanchored fallback or gate it on an address cue.
- **Planner errors discard stack/cause** (`engine.ts:837-891`) — fail-closed UX is correct, but for a trace-evidence engine, preserve the structured error in the trace.
- **Wildcard `postMessage(message, '*')`** in both widgets + devtools deliberately skipping origin checks — safe today only because the payload is content-free/PII-free; add a guard-rail comment and tighten before any payload enrichment.
- **`requestJson` GET-with-body branch** (`labApiClient.ts:262-291`) is never exercised; split into `getJson`/`postJson`. **`readJsonBody`** (`lab/server.ts:303-317`) buffers the body with no size cap — cheap 413 guard for the automated harness.
- **Contract drift hazards:** `routeAudit.ts` compares `safetyFlags` against hard-coded string `Set`s instead of the contracts enum; `policy.ts:17-23` and `schemas.ts:22-29` use `postcode` while CLAUDE.md's documented intake fields say `address` — reconcile the doc or the code (it's a contract on collected PII).

---

## 4. Complexity hotspots (fallow check_health)

76 functions over threshold (14 critical). The ones that are both complex and load-bearing:

| Function | File | Cog / Cyc | Note |
|---|---|---|---|
| `handleRequest` | `lab/server.ts:76` | 46 / 34 | route-table refactor (above) |
| `validateTurnPlan` | `validator.ts:57` | 40 / 41 | safety-critical; ordered-guard refactor (above) |
| `summarizeEvidence` | `mcp-server/evidence.ts:78` | — / 26 | fallback chains; tighten types |
| `classifyAuditRow` | `routeAudit.ts:462` | — / 23 | brittle static router |
| `classifyBrief` | `scenarioPlan.ts:53` | — / 18 | CRAP 88; keyword router |
| `applyHandoffStateRules` | `engine.ts:362` | — | 117 lines; intersects the escalate gap |

`scripts/throwaway/openai-model-family-probe.ts` (1123 LOC, CRAP up to 756) is a disposable probe — ignore for complexity; gate its deletion on the markdown-context-pruning cleanup, not on these metrics.

---

## 5. What's genuinely fine (don't touch)

- The turn pipeline is **fail-closed**: planner crashes fall back to safe copy, the validator is a real hard-rule backstop, shadow-signal capture aborts on timeout and clears its timer.
- `seededRandom.ts` is correct (SHA-256-seeded SplitMix64, canonical mantissa extraction, domain-separated seeds, loud guards).
- The retriever's lexical scorer, `corpus.ts` zod preprocessing, and the prompt builders (which source allowed actions/flags from contract enums) are clean.
- `labApiClient.ts`'s SSRF-style base-URL allowlist and the artifact-path-traversal guard (`resolveArtifactPath`) are careful security code.
- The **13 `categoryA..M.ts` files are NOT problematic copy-paste** — they are pure typed scenario *data* (~6 lines of wrapper each), and keeping them as TS literals gives compile-time checking of every action/serving-mode/content-check against the contracts that a JSON file would lose. Leave them.
- The hellweek content-check battery correctly gates only `hardContentChecks` hard and treats the rest as advisory — consistent with the "no brittle static restraints" guidance.

---

## Suggested order of work

1. Resolve the `demo-*`/`review-*` split (delete or extract `widget-core`) — retires most meaningful duplication in one move.
2. Fix the retriever serving-mode hard-filter and the `escalate + intake_form` gate gap — both are routing-correctness, both want **live API-sim** evidence per the project's weighting, not new unit fixtures.
3. Decide the `clarification_loop` guarantee and the `contracts`↔`mcp-server` boundary — each is "enforce it or stop advertising it".
4. Refactor `validateTurnPlan` into an explicit ordered guard list (behavior-preserving, test-pinned).
5. Sweep the cheap wins: delete `effectiveSeverity`/`worstSeverity`/`scenarioById`, dedup `emptyConversationState` and `escapeHtml`/report helpers, import canonical types in `compare.ts`, strip `DEBUG=true`/`console.log`/`SHOW_INTAKE_FORM`, drop the ~50 redundant `export` keywords.
6. Exclude `packages/*/public/**` and `scripts/**` from the dead-code scan so the false-positive class stops recurring.
