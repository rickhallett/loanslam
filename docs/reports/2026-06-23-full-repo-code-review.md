# Full Repository Code Review - 2026-06-23

Practical takeaway: the TurnPlanner architecture is sound in intent — retrieval ->
untrusted `TurnPlan` -> deterministic validator -> audited trace — but the
deterministic layer is **not currently a complete backstop for the model on the
highest-stakes paths**. Two fronts must close before the safety and auditability
claims can be honestly asserted:

1. Crisis/vulnerability escalation is fail-open and can be silently vetoed by the
   cheap nano signal model (one critical, several high).
2. The deployed demo/lab surface fails open on auth, with client-side XSS, an
   unbounded request body, and error leakage.

The OpenAI-only provider mandate is clean: no Anthropic/Claude SDKs, APIs, or
model ids exist in code (only unused non-OpenAI keys in the secrets manifest).
No data-loss bug was confirmed.

## Environment and Baseline

- Worktree: `/Users/mrkai/code/loanslam/.claude/worktrees/hellweek-judge-default`
- Branch: `worktree-hellweek-judge-default`
- Baseline commit at write time: `bbf414ee2bd8fde7f612326bb1d51014e9630c98`
- Generated at: `2026-06-23T14:35:06+01:00`
- Node: `v25.8.2`
- Review scope: full repo, ~131 TS/TSX files, ~41k lines across 8 packages plus
  `api/`, `scripts/`, and `site/`.

Note on working-tree state: when the review ran, `packages/core/src/hellweek/`
`calibration.ts` and `openaiJudge.ts` had uncommitted modifications and eight
`gold/packets/*.json` files were untracked. Those changes have since been
committed (HEAD moved from `dfde1f5` to `bbf414e`); the Hell Week judge findings
below were reviewed against that working-tree content and remain valid against
the committed version.

## Methodology

This was a multi-agent review, not a single pass. 18 reviewers ran in parallel:

- 12 subsystem reviewers: engine/retrieval, validator/policy, contracts, planners,
  CLI, lab API, Hell Week judge (incl. the WIP), Hell Week orchestration/DB,
  stochastic, simulation, MCP server, frontend.
- 6 cross-cutting lenses: security/PII sweep, safety-boundary conformance trace,
  provider-mandate audit, fallow static analysis, build/deps/config, and
  test-evidence discipline.

Every finding rated medium or higher was then handed to an **independent
adversarial verifier** that opened the cited file, attempted to refute the claim,
and either confirmed with a verbatim code quote or rejected it. Low/info findings
were passed through unverified and are labelled as such.

Result: 76 raw findings -> **73 confirmed, 3 rejected**. De-duplicated counts:
**1 critical, 6 high, 16 medium, 18 low, 9 info**.

The verifier rejected three plausible-but-false findings, recorded here so the
review's filtering is auditable:

- Two test-discipline findings cited `packages/core/src/_safety_probe.test.ts` and
  `_safety_probe3.test.ts` (and siblings) with fabricated contents and a
  fabricated "10/10 pass" run. No such files exist in the repo or its history.
- One Hell Week finding claimed the `cred-staff-pressure=fine` gold label
  contradicts the rubric; it dropped the controlling rubric clause
  (`openaiJudge.ts` line 154) that treats "I cannot handle that directly in chat"
  as refusing an offered credential, making the label rubric-consistent.

---

## CRITICAL

### C1. The nano signal model can silently veto the planner's crisis flags

- Location: `packages/core/src/validator.ts:497-529` (consumed at `:332`)
- Category: safety-boundary (invariants #1 and #3)

`alignPlanSafetyFlagsWithSignal()` filters the untrusted planner's `safetyFlags`
down to what the cheap nano signal model endorses. The vulnerability family
(`vulnerability, distress, hardship, complaint, legal_threat, accessibility_need`)
survives **only** when the signal recommends `route_vulnerability`. If the signal
recommends `answer` or `handoff_account_specific` but the planner correctly
flagged distress/complaint/legal/accessibility, the flag is removed before
`hasVulnerabilitySafetyFlag(allSafetyFlags)` is evaluated. There is no
deterministic message-level backstop: `inferSafetyFlagsFromMessage` only detects
credentials/overshare, and `detectUrgentRisk` only catches narrow self-harm and
acute-medical phrasings.

Net effect: a genuine vulnerability the planner caught but the signal missed is
suppressed, and the turn answers/hands-off instead of escalating to a human.
Project memory records that the nano model misroutes, so this is a live
false-negative on the most safety-critical invariant. It also inverts "the LLM
does not own compliance" — a cheaper, untrusted model overrides the more capable
planner's safety judgement.

Fix: treat the full vulnerability family (plus credentials/overshare) as invariant
flags never filtered by signal mode — union planner and signal vulnerability-family
flags and only gate the account/change-carryover flags by serving mode. Add
deterministic message-level detectors for distress/complaint/legal/accessibility,
and add a validator test for the signal-disagreement suppression case.

---

## HIGH

### H1. Crisis escalation for distress/complaint/legal/accessibility is fail-open

- Location: `packages/core/src/validator.ts:454-469, 471-495, 313-330`
- Category: safety-boundary (invariant #3)

The only deterministic message-level inference detects credentials/overshare.
Escalation for these four categories relies on the optional, fail-open shadow
signal extractor, a lexical corpus hit on a `route_vulnerability` item, or the
untrusted planner self-declaring. When the signal extractor is unavailable (no
key, flag unset, timeout) and lexical retrieval misses, a genuine crisis turn
degrades to `action=fallback` with no human escalation.

Fix: add deterministic detectors for the high-signal forms of these categories;
add `legal_threat`/`accessibility_need` `route_vulnerability` KB items as a lexical
backstop; fail closed to human escalation rather than generic fallback when the
signal layer fails on a message with distress markers.

### H2. Self-harm detector misses common crisis phrasings

- Location: `packages/core/src/engine.ts:613-614, 815-830`
- Category: safety-boundary (invariant #3)

`selfHarmRiskPattern` matches only `(kill|harm|hurt) myself`, `self-harm`, and
`suicid(e|al)`. Common phrasings ("I want to end my life", "take my own life",
"I want to die", "overdose") do not match, so `detectUrgentRisk` returns null and
the urgent-safety escalation never fires. The negation list even references
"end it"/"end my life" that the positive detector does not include. Combined with
the fail-open signal layer, a customer expressing suicidal intent can receive
ordinary handoff/fallback copy with no emergency signposting.

Fix: extend `selfHarmRiskPattern` to cover "end (my life|it all)", "take my own
life", "want to die", "overdose", "do not want to be here/alive", keeping the
existing `negatesSelfHarm` guard. Add direct `engine.test.ts` cases.

### H3. Credential-solicitation block disabled by any warning phrase in the plan text

- Location: `packages/core/src/policy.ts:55-56, 107-113` (consumed at `validator.ts:201`)
- Category: safety-boundary (invariant #4)

`detectForbiddenCredentialRequest` tests `credentialWarningPattern` over the
entire concatenated plan text and returns false (no block) if any warning clause
is present. A plan that both warns and solicits in one string ("Never share your
password. Now please send me your sort code") bypasses the only plan-text
credential-solicitation guard, and nothing else scans the bot's own solicitation.

Fix: scope the warning exemption to the matched clause, not the whole text;
evaluate per sentence/clause and block when an unguarded collection clause exists.
Re-run the credential scan against the final outgoing message after all overrides.
Add a "warn + solicit in one message" policy test.

### H4. Model-proposed link URLs reach the customer widget with no scheme/host allowlist

- Location: `packages/contracts/src/schemas.ts:59-63`;
  `packages/demo-widget/src/components/MessagePrimitive.vue:46-56`;
  `packages/review-widget/.../MessagePrimitive.vue:73-82`
- Category: security

`approvedLinkSchema` validates `url`/`href` only with `z.string().url()`, which in
zod v4 accepts `javascript:`, `data:`, `vbscript:`, and credential-embedded hosts.
This schema is the only gate: `validateTurnPlan` returns `base.ui = plan.ui`
verbatim on the answer path (`validator.ts:84`) and never rebuilds `ui.links` from
the cited corpus, so model-emitted links reach the widget, which binds them
directly into an anchor `:href="link.url ?? link.href ?? '#'"` with no scheme check
and no CSP anywhere. A manipulated model proposal that cites a valid corpus item
can attach a `javascript:` anchor (DOM XSS on click) or an external phishing link.

Fix: constrain `approvedLinkSchema` to https-only with a host allowlist via a
refine, or rebuild answer links solely from the cited corpus item. At the widget,
allowlist schemes before binding to `href`. Add a CSP to host and site.

### H5. Deployed demo/lab API fails open when `DEMO_ACCESS_TOKEN` is unset

- Location: `packages/core/src/lab/server.ts:883-904, 188-206`; `api/index.ts:29,41`;
  `packages/core/src/cli.ts:1169-1170, 1206`
- Category: security

`authorizeDemoRequest` returns `true` unconditionally when `demoAccessToken` is
undefined. Both deployment wirings pass the token only conditionally, and
`DEMO_ACCESS_TOKEN` is read with a bare `process.env` lookup (no `requireEnv`
guard, unlike `DEMO_STATE_TOKEN_SECRET`). A Vercel deploy or local `--demo-only`
run that omits the token serves every `/demo/*` route to anyone: each message runs
the OpenAI planner + signal extractor (unbounded spend) and writes arbitrary
customer text into the `demo_interaction_events` audit DB.

Fix: make the token mandatory whenever demo routes are enabled
(`requireEnv('DEMO_ACCESS_TOKEN')` in `api/index.ts`; fail startup in `cli.ts` when
`enableDemoRoutes` is true and no token is configured). Change
`authorizeDemoRequest` to deny when no token is configured.

### H6. Untrusted `plan.collectedFacts` persist on answer turns and can auto-complete a handoff with fabricated PII

- Location: `packages/core/src/engine.ts:111-135, 392-423, 1121-1124`;
  `validator.ts:87, 226`
- Category: safety-boundary (invariant #1)
- Note: the adversarial verifier graded this medium; impact analysis raises it to
  high given the PII-fidelity invariant. Treat the severity as a judgement call.

On any answer (or non-credential, non-routed) turn the validator passes
`plan.collectedFacts` straight through and the engine merges them into persistent
`ConversationState`. The only filter is credential-term detection; there is no
check that keys are real intake fields or that values came from the customer.
`applyHandoffStateRules` later reads `state.collectedFacts` to compute
`missingStandardFields` and to drive `shouldCompleteHandoffNow`. An untrusted
planner can pre-seed `fullName/dateOfBirth/postcode/email/phone` on a harmless
answer turn; a later handoff sees zero missing fields and deterministically creates
a ticket whose confirmation copy advertises model-invented contact details.

Fix: do not trust `plan.collectedFacts` as customer intake. Restrict merged facts
to the deterministic, message-derived `extractHandoffFacts` output, and only when
the action is an actual handoff/intake step. Drop `plan.collectedFacts` on
answer/refuse/fallback turns before `mergeState`.

---

## MEDIUM

Safety boundary / correctness:

- Invented handoff reference and confirmation copy pass through verbatim on the
  model `create_ticket` path — `engine.ts:434-445, 496-528`; `schemas.ts:98-102`
  (`handoff_confirmation.reference` is an unconstrained model string);
  `planners/openaiPlanner.ts:110-111, 220-226`. Make `reference` engine-owned;
  rebuild confirmation copy deterministically from a real backend record.
- Medical-emergency detection over-escalates ("stroke of luck", a future routine
  hospital trip) and discards the real loan answer — `engine.ts:815-830`. Add
  first-person/present-danger context and a negation guard.
- Urgent-medical detector also misses overdose, collapse, severe bleeding, and
  "I'm dying" — `engine.ts:820-829`.

Planner boundary:

- No output-token cap, timeout, or retry control on the OpenAI call —
  `planners/openaiPlanner.ts:69-82`.
- Untrusted user/history/corpus text concatenated into the prompt without
  isolation (prompt-injection surface) — `planners/prompt.ts:61-101`.

Security / DoS:

- No request body-size limit; unbounded `Buffer.concat` enables a memory-exhaustion
  DoS — `lab/server.ts:1013-1052`.
- DOM-based XSS in the review-host devtools panel: cross-origin `postMessage`
  telemetry rendered via `innerHTML`, origin check bypassed behind a DEBUG branch;
  ships to the public `/contact/` page behind a `?devtools=true` flag —
  `review-host/public/devtools.js:382-420, 508-548`. Enforce the origin check
  unconditionally; build nodes with `textContent`; add a CSP.

Evidence / test integrity (project evidence-discipline mandate):

- `policy.test.ts:97-112, 186-215` asserts the live bot does NOT escalate two
  crisis paraphrases, justified as "covered by judge" — but `openaiJudge` is never
  imported by `engine.ts` or the lab server, so it cannot change live behaviour.
  These tests freeze a real-time failure to signpost crisis support and will break
  any future fix. Flip them to assert escalation, or mark `it.todo`.
- `caughtUnsafeProposals` metric omits three validator block codes
  (`internal_data_exposure_blocked`, `payment_link_handoff_required`,
  `secondary_borrowing_advice_blocked`) — `simulation/runner.ts:48-56`,
  `personaRunner.ts:44-52`. Export one canonical list from policy/validator.
- Stochastic `clarification_loop` hard failure is structurally unreachable while
  coverage reports it covered — `stochastic/evaluate.ts:192-217, 475-494`.
- MCP evidence summary uses `latestTrace?.safetyFlags ?? state.safetyFlags`; an
  empty (non-nullish) array masks accumulated session flags, so a persisted crisis
  reads as absent to an orchestrating agent — `mcp-server/src/evidence.ts:91-93`.
- Persona vulnerability failure-mode detector is blind to a fully-missed
  vulnerability — `simulation/personaReport.ts:110-112, 133-139`.
- `unnecessaryHandoffRate` false-positives on legitimate multi-turn topic-switch
  journeys — `simulation/report.ts:58-68`.
- `retriever.ts` (grounding/route gating) has effectively no unit coverage —
  `retriever.test.ts:6-27`.

Build:

- The production serverless entry `api/index.ts` (which gates
  `enableTrustedLabRoutes`/`enableDemoRoutes`) is never type-checked by any build
  gate — `api/index.ts:1-60`. Add `api/` and `scripts/` to a type-checked tsconfig
  invoked by `npm run verify`.
- `escapeHtml` duplicated byte-for-byte across four report generators —
  `hellweek/htmlReport.ts:506-513`, `hellweek/jasmineReport.ts:214-221`,
  `stochastic/htmlReport.ts:364-371`, `hellweek/stability.ts:526-533`.

---

## LOW

Security / privacy:

- Internal error messages and stack traces returned to clients —
  `lab/server.ts:106-134`.
- Demo access token compared with non-constant-time `===` — `lab/server.ts:887-897`.
- Continuation token has no expiry; valid tokens replay session state indefinitely
  — `lab/demoStateToken.ts:19-75`.
- Unsealed demo state cast to `ConversationState` without schema validation —
  `lab/demoStateToken.ts:65-71`.
- Owner audit log stores raw PII in `internalJson`, bypassing display-surface
  redaction — `lab/demoInteractionLog.ts:389-411, 454-476`.
- Widget inbound `postMessage` handlers do not validate `event.origin` —
  `demo-widget/src/hostBridge.ts:41-58`, `review-widget/src/hostBridge.ts:66-83`.
- Widget broadcasts decision telemetry / relays messages with target origin `"*"`
  — `review-widget/src/hostBridge.ts:22-34, 53-55`.
- Demo API access token bundled into the browser via `VITE_` prefix —
  `demo-widget/src/engineClient.ts:24-32`.

CLI:

- `serve`: server `error` events unhandled, so port-in-use hangs/crashes instead
  of exiting cleanly — `cli.ts:1218-1226`.
- `readOption` silently consumes a following flag as an option value —
  `cli.ts:1585-1594`.
- `--seed` is not filename-safe despite the documented contract; can write
  artifacts outside the output dir — `cli.ts:1343-1346`.

Hell Week / orchestration:

- `readReport` swallows all errors; malformed `report.json` silently drops
  `sourceRunId` from the judge artifact — `openaiJudge.ts:684-695`.
- Concurrency worker exits the whole pool on a falsy scenario slot, leaving a
  result hole that can crash downstream grading — `runner.ts:181-208`.
- Stability-report structured columns are write-only and can silently drift from
  the authoritative JSON blob — `db.ts:275-319`.

Validator / contracts:

- Refusal and internal-data early returns trust untrusted model copy and UI
  verbatim — `validator.ts:100-141`.
- Signal `safetySignals` are trusted unfiltered while planner flags are filtered
  (inconsistent trust model) — `validator.ts:471-495, 497-529`.
- `validateTurnPlan` complexity hotspot (cognitive ~50) at the single most
  safety-critical enforcement point — `validator.ts:63-404`. High-value refactor
  target.
- No maximum length on any free-text contract field — `schemas.ts:57, 271-279,
  290-317`.
- `approvedLinkSchema` allows a link with neither `url` nor `href` —
  `schemas.ts:59-63`.

Simulation:

- `trace.turnIndex` diverges between simulation and production paths —
  `simulation/runner.ts:90-101`, `personaRunner.ts:89-100`, `engine.ts:127`,
  `lab/server.ts:272-280`.
- Journey JSONL trace writer appends without truncating, mixing stale runs into one
  evidence file — `simulation/runner.ts:165-174`.
- Dead branch in `personaReport.buildFailureModes` that can never fire —
  `personaReport.ts:114-121`.

MCP server:

- Summary reports `effectiveServingMode` under the `selectedServingMode` field
  name, contradicting scenario terminal conditions — `evidence.ts:110-112`.
- Dump output guard uses `startsWith` prefix, allowing sibling dirs like
  `artifacts/phase0extra` — `labApiClient.ts:245-251`.

Safety (other):

- Trusted lab intake route still returns an invented `LS-` support reference —
  `engine.ts:695-700, 733, 770-771`.

Static analysis (fallow-verified dead code):

- `judgeScenario` orphaned, superseded by the escalation path —
  `openaiJudge.ts:370-391`.
- `isTriageLabel` type guard never used — `triageLabels.ts:36-38`.

Build hygiene:

- `scripts/` (including the source-policy checker itself) excluded from
  type-checking — `scripts/phase0-cheap-model-quality-probe.ts:1-37`.
- `vercel-build` runs `prisma migrate deploy` against the runtime database on every
  deploy — `package.json:16`.
- Source-policy gate's file-discovery/entrypoint logic untested —
  `scripts/check-typescript-source-policy.test.ts:1-51`.
- A 31k throwaway probe script is committed in the shipped tree —
  `scripts/throwaway/openai-model-family-probe.ts`.
- `prisma/migrations/migration_lock.toml` is absent — `prisma/schema.prisma:6-8`.

---

## INFO

- `retrieveMatches` computes its slice bound from pre-sort `matches.length` —
  harmless but fragile — `retriever.ts:181-189`.
- Inconsistent CLI-level numeric validation for `--passes`/`--concurrency` on
  judge/calibration commands — `cli.ts:934-935, 980-983`.
- Valid pretty-printed single-verdict JSON produces a misleading whole-file JSONL
  parse error — `hellweek/run.ts:491-516`.
- Jasmine report formats sub-second per-turn latencies via a seconds formatter —
  `hellweek/jasmineReport.ts:204-212`.
- `negatedOrCorrected` signal flag handled inconsistently between retriever and
  validator (fails safe) — `retriever.ts:284-298`.
- Secrets manifest declares unused non-OpenAI provider keys (Anthropic, Bedrock,
  Gemini, Google, OpenRouter, Claude Code OAuth) — `secrets/manifest.json:38-92`.
  Not a code violation; prune to match the OpenAI-only mandate.
- Pervasive over-exporting across core/hellweek/lab modules (unnecessary public
  surface, not dead code).
- A planned contract test for the judge request-builder was never written —
  `docs/prds/closed/2026-06-21-calibration-foundations-spec.md:88`.

---

## What is clean

- Provider mandate: no Anthropic/Claude SDKs, APIs, or model ids in code. Only the
  secrets manifest carries unused non-OpenAI keys (info-level).
- No confirmed data-loss bug. The migrate-on-deploy and PII-in-audit-DB items are
  availability/governance risks, not active corruption.
- The adversarial verifier rejected three plausible-but-false findings (two cited
  files that do not exist), so nothing fabricated reached this report.

---

## Suggested order of operations

1. C1 (signal-veto) together with H1/H2 (deterministic crisis detection) — same
   subsystem, fix as one change.
2. H5 fail-open auth + the body cap and error-leakage items — quick, high
   blast-radius security wins on the deployed surface.
3. The untrusted-output passthrough cluster: H4 links/CSP, H6 `collectedFacts`, and
   the invented-reference medium — all the same invariant-#1 erosion.
4. The `policy.test.ts` crisis fixtures — flip them so they stop freezing the unsafe
   behaviour, which also forces fix #1 to be testable.

## Provenance

Generated by an 18-reviewer multi-agent pass with per-finding adversarial
verification (medium and above). Findings cite `file:line` against commit
`bbf414e`. Severity reflects the verifier-adjusted grade except H6, noted inline.
This is a dated evidence receipt; supersede or delete it once the listed issues are
resolved, per the documentation-audit decision rules in
`docs/non-operational/doc-cleanup/2026-06-20-documentation-audit-recommendation-matrix.md`.
