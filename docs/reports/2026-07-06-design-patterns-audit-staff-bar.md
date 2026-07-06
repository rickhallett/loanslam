# loanslam — design health of the working code

_Design-Patterns Audit · Staff Bar_

A full-scale design audit of the code that is staying: 15 subsystems, ~34k lines across core, site, IPOC, MCP, widgets, and the wired tooling scripts. Judged on architecture and design quality — not lint, not dead code.

Source: Claude artifact `416af1e3-8c6f-46ec-ba54-1838984f899b` (`https://416af1e3-8c6f-46ec-ba54-1838984f899b.frame.claudeusercontent.com/_f/1783315152-3332/`).

## Metadata

- Date: 2026-07-06
- Branch: `codex/chore/commit-dirty-cleanup`
- Findings: 90
- Verification split: 70 verified · 20 review-stage
- Grade: B−

## At a Glance

| Metric | Count |
| --- | ---: |
| findings | 90 |
| high | 11 |
| medium | 52 |
| verified | 70 |
| low | 27 |
| review-stage | 20 |

### Category Distribution

| Category | Findings |
| --- | ---: |
| duplication | 15 |
| error-handling | 13 |
| type-design | 12 |
| abstraction | 8 |
| state-management | 7 |
| separation-of-concerns | 6 |
| coupling | 6 |
| god-object | 5 |
| consistency | 3 |

## Executive Summary

This is not a codebase in trouble. The domain is modelled with real discriminated unions (`TurnAction`, `StakeholderDimension`, `SignalExtractionStatus`, `StochasticHardFailureCategory`), there is a Zod contract package, a declarative `Route<Context>` table in the lab server, and the signal-extraction path already does parse-don’t-throw with a typed status union. The problem is that these good patterns are *islands*. The same knowledge — safety vocabularies, serving-mode precedence, URL policy, report primitives, the judge escalation ladder — is re-encoded by hand two, three, four files over, and the type system is switched off exactly where classification matters most (`routeAudit` rows, `collectedFacts`, scenario `category`, `forbiddenBehaviors`, finding `category` are all bare strings).

The through-line, and why it matters for *this* product specifically: almost every high- and medium-severity finding converges on one systemic risk — **the proof surface can go green while the property it claims to prove is violated or unmeasured.** A judge that silently discards deterministic content failures; safety-count vocabularies that differ across the three evidence suites; calibration that grades a packet through a duplicated ladder that can drift from production; probe and proof scripts that exit 0 when the endpoint is down; a re-grade path that scores yesterday’s run against today’s scenarios; stochastic replays that overwrite the full-run artifact. Each is a way for evidence to lie — in a project whose own doctrine is that “a test that gives false confidence is a net-negative contribution.”

Two findings cross from design into **latent correctness bugs** (both grounded in code): IPOC’s persistence is two module-level `Map`s that site-nuxt mounts by deep-re-exporting the handler files, so whether a session survives the hop between apps is decided by the bundler, not the code (spot-verified); and audit logging is `await`ed *fail-closed* on the serving path, so a transient Postgres blip turns a completed, successful customer turn into a 500 — the exact inversion of what an observability write should be.

The monoliths — `ChatWidgetPanel` (~1,200 lines), the engine’s 130-line handoff cascade, `lab-ui/App.vue`, IPOC `app.vue`, the CLI dispatch — are real but secondary. They raise the cost of every change and conceal the duplication above, but they are not actively producing wrong answers. Decompose them *after* the vocabularies are unified and the failure paths are made honest, using the seams the codebase already demonstrates.

Bottom line: the fixes are mostly “apply the pattern you already have, everywhere,” not “invent new architecture.” For debt this pervasive that is an unusually low-risk, high-leverage position.

## The Six Design Themes

### One fact, many copies

_duplication / single-source-of-truth_

The dominant pattern. Safety vocabularies (`UNSAFE_PROPOSAL_*`, vulnerability flags, safe actions), `severityRank`, first-party URL policy, `escapeHtml`, the judge escalation ladder, the telemetry projection, and the MCP wire types are each encoded independently in 2–4 places. Because several of these feed the *evidence* surface (safety counts, verdicts), the inevitable drift is silent and lands on the number a stakeholder reads.

References: [`unsafe-vulnerability-sets-diverged-copies`](#f-simulation--unsafe-vulnerability-sets-diverged-copies), [`duplicated-safety-taxonomy-drift`](#f-validator-audit--duplicated-safety-taxonomy-drift), [`severityrank-redeclared`](#f-hellweek-judge--severityrank-redeclared), [`duplicated-wire-types-no-contract-dep`](#f-mcp-server--duplicated-wire-types-no-contract-dep), [`first-party-url-policy-triplicated`](#f-nuxt-lib-server--first-party-url-policy-triplicated), [`escalation-ladder-duplicated`](#f-hellweek-judge--escalation-ladder-duplicated)

### The proof surface can lie

_fail-open on evidence paths_

The single most important theme for this product. The judge merge drops deterministic content failures when the LLM says `fine`; probe/proof/ux-evaluator scripts exit 0 on a totally failed run; signal coercions are applied but never recorded; the stochastic runner folds a genuine engine crash into `replayability_loss`; re-grade and replay quietly lose provenance. Every one lets a broken property present as green.

References: [`judge-drops-deterministic-content`](#f-hellweek-core--judge-drops-deterministic-content), [`probes-exit-code-blind`](#f-scripts-probes--probes-exit-code-blind), [`judge-broke-verdict-exit-zero`](#f-scripts-probes--judge-broke-verdict-exit-zero), [`runner-swallows-scenario-error-into-conflated-hard-failure`](#f-stochastic--runner-swallows-scenario-error-into-conflated-hard-failure), [`regrade-scenario-substitution-silent`](#f-hellweek-core--regrade-scenario-substitution-silent), [`seed-only-artifact-paths-overwrite-narrowed-replay`](#f-stochastic--seed-only-artifact-paths-overwrite-narrowed-replay)

### Stringly-typed where classification is load-bearing

_primitive obsession_

The compiler is switched off at exactly the boundaries where a wrong value produces false-green evidence. `routeAudit` rows carry `finalAction: string` / `safetyFlags: string[]`; `collectedFacts` is `record<string,string>` against a closed intake vocabulary; scenario `category`, `forbiddenBehaviors` and finding `category` are free text with hidden switch fallbacks; `severityFloor`/`failureMarkers` look like contracts but are never read.

References: [`stringly-typed-routeaudit-model`](#f-validator-audit--stringly-typed-routeaudit-model), [`collectedfacts-stringly-typed`](#f-planner-signals-contracts--collectedfacts-stringly-typed), [`forbidden-behaviors-stringly-typed-fail-open`](#f-simulation--forbidden-behaviors-stringly-typed-fail-open), [`category-primitive-obsession`](#f-hellweek-reports-taxonomy--category-primitive-obsession), [`failuremarkers-severityfloor-decorative`](#f-hellweek-core--failuremarkers-severityfloor-decorative), [`finding-category-primitive-obsession`](#f-stochastic--finding-category-primitive-obsession)

### Failure handling points the wrong way

_fail-open evidence, fail-closed observability_

The two error-handling instincts are inverted. Diagnostic writes that should shrug off a DB blip instead take down a good customer turn (`logging-fails-turn-open`), while safety/evidence checks that should fail *closed and loud* fail open and silent. The planner throws one untyped error for network, auth and malformed-shape alike, collapsing three incidents into one reason code.

References: [`logging-fails-turn-open`](#f-lab-logging--logging-fails-turn-open), [`planner-parse-throws-no-typed-error`](#f-planner-signals-contracts--planner-parse-throws-no-typed-error), `normalize-fail-open-silent-coercion`, [`ux-evaluator-always-green`](#f-scripts-probes--ux-evaluator-always-green)

### Boundaries that leak

_uneven parse-don’t-validate + feature envy_

Parse-don’t-validate is applied at some boundaries and skipped at others, and consumers re-derive the producer’s rules across package lines. The state token and telemetry are cast unvalidated; the MCP `/messages` body is cast while its siblings are checked; `summarizeEvidence`, the simulation report, and the IPOC adapter each re-implement serving-mode / handoff precedence the engine already owns.

References: [`token-payload-unvalidated-cast`](#f-lab-logging--token-payload-unvalidated-cast), [`summarize-evidence-precedence-god-fn`](#f-mcp-server--summarize-evidence-precedence-god-fn), [`report-feature-envy-into-trace-internals`](#f-simulation--report-feature-envy-into-trace-internals), [`leaky-turn-action-abstraction-handoff-set`](#f-integrated-poc--leaky-turn-action-abstraction-handoff-set), [`override-vs-decline-implicit-contract`](#f-validator-audit--override-vs-decline-implicit-contract)

### Monoliths without seams

_god objects / concern-mixing_

Concern-mixing raises change cost and hides the duplication above. `ChatWidgetPanel.vue` holds two transports, two session lifecycles and the offer rules in one 1,200-line script; the engine’s `applyHandoffStateRules` is a 130-line ordered if-cascade whose precedence is encoded only by statement order; `lab-ui/App.vue` buries the lab’s safety-verdict logic in a view file where it drifts from server policy.

References: [`chatwidget-god-component`](#f-nuxt-frontend--chatwidget-god-component), [`handoff-rules-god-function`](#f-engine-runtime--handoff-rules-god-function), [`labui-god-component`](#f-widgets-labui--labui-god-component), [`app-vue-god-component`](#f-integrated-poc--app-vue-god-component), [`concierge-module-god-object`](#f-nuxt-lib-server--concierge-module-god-object), [`command-dispatch-shotgun-surgery`](#f-lab-cli--command-dispatch-shotgun-surgery)

## Work Packs, Ordered by Leverage

### 1. Close the two latent correctness bugs

Small and urgent — these are production incidents in waiting, not just design debt. (a) Give IPOC a real persistence seam (`IpocSessionStore` resolved once via a Nitro plugin / `useStorage()`) and stop site-nuxt from mounting the store by deep-re-exporting live module `Map`s. (b) Make audit logging fail-open on the serving path — move it after `writeJson` or catch-and-drop — so a Postgres blip can never 500 a successful turn.

**Sequencing:** Do first. Both are contained, high-impact, and independent of the larger refactors.

References: [`shared-mutable-map-store-cross-app`](#f-integrated-poc--shared-mutable-map-store-cross-app), [`cross-store-activity-join-in-withactivity`](#f-integrated-poc--cross-store-activity-join-in-withactivity), [`site-nuxt-partial-reexport-incoherent-api`](#f-integrated-poc--site-nuxt-partial-reexport-incoherent-api), [`logging-fails-turn-open`](#f-lab-logging--logging-fails-turn-open)

### 2. One source of truth for safety & routing vocabularies

Promote the duplicated classification vocabularies to named exports in `@loanslam/contracts` (or a core policy module) and have every runner, report, audit and adapter import them: unsafe-proposal codes, vulnerability flags, safe actions, serving modes, `severityRank`, the handoff action set, category ids, and the first-party URL/host policy. This is the highest-breadth pack — it kills the silent cross-suite count drift and produces the unions the next pack needs.

**Sequencing:** Do second; it unblocks Pack 4 (the unions become the types).

References: [`unsafe-vulnerability-sets-diverged-copies`](#f-simulation--unsafe-vulnerability-sets-diverged-copies), [`duplicated-safety-taxonomy-drift`](#f-validator-audit--duplicated-safety-taxonomy-drift), [`severityrank-redeclared`](#f-hellweek-judge--severityrank-redeclared), [`leaky-turn-action-abstraction-handoff-set`](#f-integrated-poc--leaky-turn-action-abstraction-handoff-set), [`first-party-url-policy-triplicated`](#f-nuxt-lib-server--first-party-url-policy-triplicated), [`faqs-normalization-scattered`](#f-nuxt-lib-server--faqs-normalization-scattered), [`categories-as-code-not-data`](#f-hellweek-reports-taxonomy--categories-as-code-not-data)

### 3. Make the evidence honest

Stop the proof surface from lying. Judge merge *records* a deterministic override instead of dropping it; signal coercions push a note; the planner returns a typed result union; the stochastic runner separates an engine crash from a replay-metadata loss; probe/proof/ux scripts set a non-zero exit on any failure; re-grade stamps which scenario source it used; stochastic artifact paths encode run scope; judge metadata makes `rubricHash` required.

**Sequencing:** Parallel with Pack 2; this is the highest product-doctrine risk.

References: [`judge-drops-deterministic-content`](#f-hellweek-core--judge-drops-deterministic-content), [`planner-parse-throws-no-typed-error`](#f-planner-signals-contracts--planner-parse-throws-no-typed-error), `normalize-fail-open-silent-coercion`, [`runner-swallows-scenario-error-into-conflated-hard-failure`](#f-stochastic--runner-swallows-scenario-error-into-conflated-hard-failure), [`seed-only-artifact-paths-overwrite-narrowed-replay`](#f-stochastic--seed-only-artifact-paths-overwrite-narrowed-replay), [`regrade-scenario-substitution-silent`](#f-hellweek-core--regrade-scenario-substitution-silent), [`judge-metadata-bolted-on`](#f-hellweek-judge--judge-metadata-bolted-on), [`probes-exit-code-blind`](#f-scripts-probes--probes-exit-code-blind), [`judge-broke-verdict-exit-zero`](#f-scripts-probes--judge-broke-verdict-exit-zero), [`ux-evaluator-always-green`](#f-scripts-probes--ux-evaluator-always-green)

### 4. Make illegal states unrepresentable

Apply parse-don’t-validate at the boundaries that classify. Turn the stringly-typed fields into the unions from Pack 2: `routeAudit` rows, `collectedFacts` keyed by `IntakeField`, scenario/finding `category`, `forbiddenBehaviors`; collapse `approvedLink` to one required destination; parse the state token and telemetry through their Zod schemas instead of casting; make the UI-primitive render exhaustive with a `never` arm.

**Sequencing:** Depends on Pack 2’s unions existing.

References: [`stringly-typed-routeaudit-model`](#f-validator-audit--stringly-typed-routeaudit-model), [`collectedfacts-stringly-typed`](#f-planner-signals-contracts--collectedfacts-stringly-typed), [`forbidden-behaviors-stringly-typed-fail-open`](#f-simulation--forbidden-behaviors-stringly-typed-fail-open), [`category-primitive-obsession`](#f-hellweek-reports-taxonomy--category-primitive-obsession), [`link-url-href-dual-optional`](#f-planner-signals-contracts--link-url-href-dual-optional), [`approvedlink-primitive-obsession`](#f-widgets-labui--approvedlink-primitive-obsession), [`token-payload-unvalidated-cast`](#f-lab-logging--token-payload-unvalidated-cast), [`telemetry-unvalidated-cast`](#f-nuxt-frontend--telemetry-unvalidated-cast), [`nonexhaustive-primitive-render`](#f-widgets-labui--nonexhaustive-primitive-render)

### 5. Collapse the duplicated scaffolding

Behavior-preserving dedup of the leaf machinery: one `escapeHtml`/`formatDuration`/verdict-tone module shared by all report renderers; one parameterised judge escalation ladder; one `driveConversation` behind `runJourney`/`runPersonaScenario`; a real `@loanslam/contracts` dependency in the MCP client; and a single scripts harness (browser launcher, `check`/report/exit, concierge session client) the 18 scripts import.

**Sequencing:** Independent; can proceed alongside Packs 2–4.

References: [`renderer-duplication-shared-helpers`](#f-hellweek-reports-taxonomy--renderer-duplication-shared-helpers), [`duplicated-report-render-verdict-machinery-vs-hellweek`](#f-stochastic--duplicated-report-render-verdict-machinery-vs-hellweek), [`escalation-ladder-duplicated`](#f-hellweek-judge--escalation-ladder-duplicated), [`runner-personarunner-near-duplication`](#f-simulation--runner-personarunner-near-duplication), [`duplicated-wire-types-no-contract-dep`](#f-mcp-server--duplicated-wire-types-no-contract-dep), [`check-scaffolding-duplicated`](#f-scripts-probes--check-scaffolding-duplicated), [`proofs-01`](#f-scripts-proofs--proofs-01), [`hellweek-plumbing-duplication`](#f-lab-cli--hellweek-plumbing-duplication)

### 6. Decompose the monoliths behind existing seams

Last, once the churn above has stopped. Extract the engine handoff cascade into a named ordered rule pipeline; pull `ChatWidgetPanel`’s transport/session/persistence into composables; split IPOC `app.vue` and the concierge utils along the seams the IPOC store/adapter/telemetry split already models; lift `lab-ui`’s analysis into a testable TS module; give the CLI a command registry mirroring the existing Route table.

**Sequencing:** Do after Packs 1–4; purely structural, verify behavior-preserving.

References: [`handoff-rules-god-function`](#f-engine-runtime--handoff-rules-god-function), [`chatwidget-god-component`](#f-nuxt-frontend--chatwidget-god-component), [`app-vue-god-component`](#f-integrated-poc--app-vue-god-component), [`concierge-module-god-object`](#f-nuxt-lib-server--concierge-module-god-object), [`labui-god-component`](#f-widgets-labui--labui-god-component), [`command-dispatch-shotgun-surgery`](#f-lab-cli--command-dispatch-shotgun-surgery), [`fat-context-bag-threading`](#f-lab-cli--fat-context-bag-threading), [`buildRouteAudit-god-function`](#f-validator-audit--buildRouteAudit-god-function)

## Finding Index

- [Widgets + lab UI](#s-widgets-labui) — 7 findings — 3 high
- [Integrated POC](#s-integrated-poc) — 7 findings — 2 high
- [Nuxt site — lib + server API](#s-nuxt-lib-server) — 6 findings — 1 high
- [Hell Week — judge/calibration/compare](#s-hellweek-judge) — 5 findings — 1 high
- [Lab logging / display / token](#s-lab-logging) — 5 findings — 1 high
- [MCP server](#s-mcp-server) — 5 findings — 1 high
- [Simulation](#s-simulation) — 5 findings — 1 high
- [Stochastic testing](#s-stochastic) — 5 findings — 1 high
- [Validator + route audit](#s-validator-audit) — 6 findings
- [CLI + lab server](#s-lab-cli) — 5 findings
- [Nuxt site — components/pages](#s-nuxt-frontend) — 5 findings
- [Planner / signals / contracts](#s-planner-signals-contracts) — 5 findings
- [Runtime engine](#s-engine-runtime) — 4 findings
- [Hell Week — run/grade/aggregate](#s-hellweek-core) — 4 findings
- [Hell Week — reports/taxonomy](#s-hellweek-reports-taxonomy) — 4 findings
- [Scripts — concierge probes](#s-scripts-probes) — 5 findings
- [Scripts — behavior proofs](#s-scripts-proofs) — 3 findings
- [Scripts — infra tooling](#s-scripts-infra) — 2 findings
- [Scripts — parity/integration batteries](#s-scripts-parity) — 2 findings

## All Findings

### Application & library code

<a id="s-widgets-labui"></a>
#### Widgets + lab UI

_widgets-labui · 7 findings_

<a id="f-widgets-labui--nonexhaustive-primitive-render"></a>
##### HIGH — MessagePrimitive silently drops the clarifying_prompt primitive (non-exhaustive union render, fail-open)

- Category: `error-handling` · Verification: `review-stage`
- Locations: `packages/demo-widget/src/components/MessagePrimitive.vue:17-65`, `packages/contracts/src/schemas.runtime.ts:110-118`

**Problem:** The UiPlan discriminated union in contracts has six primitives (message, clarifying_prompt, choice_list, intake_form, handoff_confirmation, safe_fallback). MessagePrimitive.vue branches on choice_list, intake_form, message/safe_fallback (with links), and handoff_confirmation, but has no branch for clarifying_prompt (schemas.runtime.ts:72-76, which carries a required questions[] array). Because the template is a chain of v-if/v-else-if with no final else, an unhandled primitive renders nothing — the interactive affordance for that turn just disappears. The demo/review widgets treat `ui` as best-effort chrome and there is no compile-time exhaustiveness check, so the gap is invisible until the engine emits that primitive live.

**Impact:** The moment the planner returns a clarifying_prompt UiPlan (a legitimate server output the contract explicitly allows), the customer sees the assistant's text bubble but none of the clarifying questions/affordance, silently degrading the turn during a stakeholder demo with no error surfaced.

**Fix:** Make the union exhaustive at the render boundary: either add the clarifying_prompt branch, or route UiPlan through a typed switch in script setup (a function returning a narrowed component/props) with a `never`-typed default arm so TypeScript fails the build when a new primitive is added to the contract. The discriminated union already exists server-side; the client should consume it exhaustively rather than as an open v-if chain.

<a id="f-widgets-labui--intake-path-diverges-from-handleresult"></a>
##### HIGH — onIntakeSubmit hand-copies handleResult and drops sendContext (shotgun-surgery divergence)

- Category: `duplication` · Verification: `review-stage`
- Locations: `packages/demo-widget/src/WidgetApp.vue:80-85`, `packages/demo-widget/src/WidgetApp.vue:132-140`

**Problem:** The message path calls handleResult(result) (WidgetApp.vue:80-85), which does storeResult + pushMessage + set isChatComplete + sendContext(contextForTurn(result)). The intake path (onIntakeSubmit, lines 132-140) re-implements that sequence inline — storeResult, two pushMessage calls, isChatComplete — but omits sendContext. So after an intake submission the host loader never receives an updated session-context and cannot surface the correct contact route for that (often terminal) turn. review-widget hit the same fork: it patched BOTH branches to add sendContext + sendTurnTelemetry (review WidgetApp.vue:88-94 and 150-151), proving this response-handling logic is being maintained by hand-copying across two code paths.

**Impact:** Any post-turn side effect added to handleResult (host context, telemetry, analytics, terminal-state signalling) is silently missed on the intake path unless every future editor remembers to duplicate it — exactly the divergence already visible between the demo widget (missing sendContext on intake) and the review widget.

**Fix:** Collapse the two paths onto one handleResult(result: DemoTurnResponse) that owns all post-turn side effects, and have onIntakeSubmit call it (pushing the 'Shared my contact details.' customer bubble before invoking it). One place to add a side effect, one contract for what happens after a turn.

<a id="f-widgets-labui--labui-god-component"></a>
##### HIGH — lab-ui App.vue is a god component: transport + safety-policy analysis + export + view in one 790-line file

- Category: `god-object` · Verification: `review-stage`
- Locations: `packages/lab-ui/src/App.vue:151-233`, `packages/lab-ui/src/App.vue:262-288`, `packages/lab-ui/src/App.vue:290-465`

**Problem:** App.vue mixes four unrelated responsibilities with no seam: (1) HTTP transport — its own private requestJson/isErrorPayload (262-288), a near-duplicate of the widgets' engineClient but re-inlined here rather than abstracted; (2) domain judgment — analyseTurn/hardSafetyIssues/engineDiagnosticIssues/uxQualityNotes/decisionFields (290-465) that encode safety-policy knowledge (which safetyFlags are dangerous, retrieval score < 2 is 'weak', message length thresholds); (3) file export via Blob/anchor DOM plumbing (209-233); and (4) the entire two-panel inspector view. The analysis layer is pure functions of ValidatedTurnResult with zero Vue dependency, yet lives inside the SFC.

**Impact:** The lab is the real proof surface for engine behavior, but its verdict logic (what counts as a hard-safety breach, what a 'weak' retrieval score is) is buried in a view file, untestable without mounting the component, and free to drift from the server's actual policy — a lab that quietly grades turns by different rules than production is worse than no lab.

**Fix:** Extract the pure analysis functions into a plain TS module (e.g. turnAnalysis.ts exporting analyseTurn/decisionFields over ValidatedTurnResult) and the transport into a labClient.ts, leaving App.vue as presentation wiring. This makes the diagnostics unit-testable in isolation and gives the safety thresholds a single named home that can be checked against the engine's own constants.

<a id="f-widgets-labui--labui-client-side-terminal-and-policy-duplication"></a>
##### MED — lab-ui recomputes terminal state and re-derives safety verdicts the server already owns (feature envy on trace)

- Category: `coupling` · Verification: `review-stage`
- Locations: `packages/lab-ui/src/App.vue:97-104`, `packages/lab-ui/src/App.vue:334-366`, `packages/demo-widget/src/WidgetApp.vue:83`

**Problem:** Two divergent notions of the same concept. The widgets trust the server's authoritative terminalSession flag (demo WidgetApp.vue:83: isChatComplete = result.terminalSession). lab-ui instead recomputes completion client-side from finalAction === 'create_ticket' || ui.primitive === 'handoff_confirmation' (App.vue:97-104). Separately, hardSafetyIssues (334-366) re-derives safety judgments from raw trace fields — e.g. 'answer with selectedServingMode !== answer', 'forbidden_credentials flag not in safeNonAnswerActions', 'account_specific_request resolved to answer'. This is the validator's own logic, re-encoded in the browser against the trace it receives.

**Impact:** When the engine changes what makes a session terminal, or adjusts validator policy, the lab keeps grading by its stale hard-coded copy and silently reports green while production diverges — the lab loses its value as ground truth precisely when policy is in flux. A single serving-mode rename in contracts requires shotgun edits across engine + this file.

**Fix:** Have the server emit the derived verdicts (terminal flag, hard-safety pass/fail, per-lane summaries) as first-class fields on ValidatedTurnResult/its trace, and let lab-ui render them. The lab should visualize the engine's judgment, not independently reconstruct it. If a client-side check is deliberately an independent oracle, name it that and pin it to shared constants, don't inline magic thresholds.

<a id="f-widgets-labui--approvedlink-primitive-obsession"></a>
##### MED — ApprovedLink allows both url and href optional, making an unreachable link representable

- Category: `type-design` · Verification: `review-stage`
- Locations: `packages/contracts/src/schemas.runtime.ts:59-64`, `packages/demo-widget/src/components/MessagePrimitive.vue:47-52`

**Problem:** approvedLinkSchema declares url?: string and href?: string as two independent optional URL fields (schemas.runtime.ts:61-62). The renderer papers over the ambiguity with `:href="link.url ?? link.href ?? '#'"` (MessagePrimitive.vue:50). Nothing in the type prevents a link with neither field set, and the fallback to '#' produces a live anchor that navigates nowhere. Two fields modeling one concept (the destination) is primitive obsession, and the illegal state (no destination) is representable and silently rendered.

**Impact:** An engine or corpus row that populates neither url nor href yields a clickable link that goes to '#', reloading/anchoring the host page instead of routing the customer — a broken CTA that passes schema validation and renders without error.

**Fix:** Collapse to a single required destination field on approvedLinkSchema (url: z.string().url()) so the type makes a link-without-destination unrepresentable; if a legacy alias must be tolerated, normalize it once at the parse boundary (parse-don't-validate) rather than at every render site.

<a id="f-widgets-labui--hostbridge-outbound-untyped-and-devtools-leak"></a>
##### MED — review-widget hostBridge outbound protocol is untyped (object/Record) and ships a console.log devtools probe

- Category: `abstraction` · Verification: `review-stage`
- Locations: `packages/review-widget/src/hostBridge.ts:22-34`, `packages/review-widget/src/hostBridge.ts:53-55`, `packages/demo-widget/src/hostBridge.ts:18-22`

**Problem:** The postMessage boundary is asymmetric and stringly-typed. Inbound is guarded (onHostMessage validates typeof type === 'string'), but outbound postToHost takes `message: object` (review) / `Record<string, unknown>` (demo) with no discriminated union over the wire messages (ready | session-context | close-requested | turn-telemetry). sendTurnTelemetry(telemetry) posts the raw telemetry object with no envelope, so the host must sniff shape to route it. review hostBridge.ts:24-33 also ships a permanent `console.log('[sm-devtools] widget posting telemetry ...')` on the hot turn path, an eslint-disabled debug probe left in the transport layer.

**Impact:** There is no single source of truth for the widget->host message contract; the host and widget can drift (a renamed type is a runtime-only failure), and the shipped console.log noises every reviewer's devtools during the live UAT the review widget exists for. Adding a new outbound message type is unguided by the type system.

**Fix:** Define a HostOutboundMessage discriminated union in contracts (mirroring the inbound guard) and type postToHost against it; wrap telemetry in a { type: 'turn-telemetry', telemetry } envelope so the host routes by tag, not shape. Delete the [sm-devtools] console.log or move it behind an explicit debug flag.

<a id="f-widgets-labui--widget-in-flight-state-boolean-soup"></a>
##### MED — Widget turn lifecycle modeled as three loosely-coupled booleans with repeated guard clauses

- Category: `state-management` · Verification: `review-stage`
- Locations: `packages/demo-widget/src/WidgetApp.vue:41-43`, `packages/demo-widget/src/WidgetApp.vue:89`, `packages/demo-widget/src/WidgetApp.vue:123`, `packages/demo-widget/src/WidgetApp.vue:152`, `packages/demo-widget/src/WidgetApp.vue:162`

**Problem:** Conversation lifecycle is spread across isSending, isChatComplete, and errorMessage refs with no single state model. Every entry point (submit, onIntakeSubmit, onIntakeCancel) re-implements the same guard — the `if (isSending.value || isChatComplete.value) return` + `errorMessage.value = ''` + try/finally toggling isSending pattern is hand-copied four times across each widget, and the intake paths that set isSending must remember to reset it in finally. There is no representation of the legitimate states (idle | sending | terminal | error) as one discriminated value, so illegal combinations (e.g. sending && terminal) are representable.

**Impact:** Any new user action (retry, edit, a second primitive type) must re-derive the same four-line guard-and-toggle ritual; forgetting the finally reset on one path leaves the widget stuck 'sending' forever, and the copy-paste guards drift between the two widgets over time.

**Fix:** Model the turn lifecycle as a single status ref ('idle' | 'sending' | 'terminal') plus errorMessage, and funnel mutations through one runTurn(fn) helper that owns the guard, the isSending toggle, and error capture. Illegal combinations become unrepresentable and each action becomes a one-liner body.

<a id="s-integrated-poc"></a>
#### Integrated POC

_integrated-poc · 7 findings_

<a id="f-integrated-poc--shared-mutable-map-store-cross-app"></a>
##### HIGH — Module-level Map stores are a hidden global singleton shared across two Nitro apps by direct re-export

- Category: `state-management` · Verification: `review-stage`
- Locations: `packages/integrated-poc/server/utils/ipocStore.ts:56`, `packages/integrated-poc/server/utils/ipocStore.ts:57`, `packages/site-nuxt/server/api/ipoc/sessions.post.ts:1`, `packages/site-nuxt/server/api/ipoc/sessions/[conversationRef]/messages.post.ts:1`

**Problem:** The entire persistence layer is two module-level `Map`s (`sessions`, `tickets`) with no seam. site-nuxt does not call IPOC over HTTP or via an injected client; it re-exports the handler modules directly (`export { default } from "../../../../integrated-poc/server/api/ipoc/sessions.post"`). Whether the two apps share one Map or get two copies now depends entirely on Nitro/Vite module resolution and bundling, which is invisible from the code. There is no persistence seam (no store interface, no injection); the Map IS the storage decision, baked in at import time.

**Impact:** In dev the module may be evaluated once (shared state); in a bundled/deployed build each app can get its own module instance (divergent state), so a session created through site-nuxt's `/api/ipoc/sessions` may 404 on site-nuxt's `/messages` if that route resolved a different Map instance — a bug that only appears after build and is near-impossible to reproduce locally. Any move to multi-instance/serverless deploy silently drops all sessions between requests. Swapping to Redis/SQLite later is shotgun surgery: every `sessions.get`/`tickets.set` call site must change because there is no interface to reimplement behind.

**Fix:** Introduce a narrow `IpocSessionStore` / `IpocTicketStore` interface and resolve it once (e.g. a Nitro plugin or `useStorage()`-backed impl) instead of importing the module's live Maps. Keep the in-memory impl as the default binding, but make the seam explicit so the two consuming apps share a defined instance and a future durable backend is a one-file swap, not a rewrite.

<a id="f-integrated-poc--cross-store-activity-join-in-withactivity"></a>
##### HIGH — Ticket admin reads reach into the session Map to synthesize `activity`, coupling two stores through a private helper

- Category: `coupling` · Verification: `review-stage`
- Locations: `packages/integrated-poc/server/utils/ipocStore.ts:252`, `packages/integrated-poc/server/utils/ipocStore.ts:255`, `packages/integrated-poc/shared/ipoc.ts:173`

**Problem:** `IpocAdminTicket` is `IpocTicket` plus an `activity` array, but activity lives on the *session*, not the ticket. `withActivity` reaches across into `sessions.get(ticket.conversationRef)?.activity ?? []` to graft it on. The `?? []` silently fails open: if the session is gone (evicted, different Map instance per the store-seam finding, or never created for a directly-saved ticket) the admin UI shows an empty activity list rather than any signal that the join failed.

**Impact:** Any future session lifecycle change — TTL eviction, a durable ticket store that outlives in-memory sessions, or the per-app Map divergence above — makes `activity` silently vanish from tickets with no error, so an agent reviewing a ticket sees a blank activity log and cannot tell 'no activity happened' from 'the session it lived on is gone'. The invariant 'a ticket's activity is its session's activity' is enforced nowhere and is invisible at the type level.

**Fix:** Make the ticket own (a copy or reference to) its activity events at write time, or model the admin read as an explicit join that returns a discriminated result (`{ activity, sessionResolved: boolean }`) instead of `?? []`. Decide deliberately whether activity is session-scoped or ticket-scoped and encode that; do not paper over a missing session with an empty array.

<a id="f-integrated-poc--session-guard-plumbing-duplicated-across-routes"></a>
##### MED — conversationRef guard + session-load boilerplate is copy-pasted verbatim across six session routes

- Category: `duplication` · Verification: `review-stage`
- Locations: `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/messages.post.ts:20`, `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/intake.post.ts:18`, `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/lookup.post.ts:18`, `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/account-answers.post.ts:25`, `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/cancel-handoff.post.ts:14`

**Problem:** Every `[conversationRef]` route opens with the same ~15 lines: read the router param, 400 if missing, `getIpocSession`, 404 if null. The 404 message string is duplicated verbatim five times (`Session ${conversationRef} was not found.`). There is no shared `resolveSession(event)` helper despite the codebase having a `server/utils` folder that is the obvious home for one.

**Impact:** Shotgun surgery: any change to session resolution — auth on the conversationRef, an eviction/'session expired' 410 vs a never-existed 404, a rate limit, telemetry on session miss — must be applied identically in five places, and drift is likely (one route already diverges by using `body?.fields` optional chaining while others assume `body.message`). A missed route becomes an inconsistent API contract.

**Fix:** Extract a single `requireIpocSession(event): { conversationRef, session }` guard in `server/utils` that throws the standard 400/404, and have each handler call it on line one. This is the standard Nitro/h3 shared-guard pattern; it removes the duplicated string and gives session-resolution policy one home.

<a id="f-integrated-poc--telemetry-builder-duplicates-core-projection"></a>
##### MED — buildTurnTelemetry reimplements core's telemetryForTurnResult line-for-line across the package boundary

- Category: `duplication` · Verification: `review-stage`
- Locations: `packages/integrated-poc/server/utils/turnTelemetry.ts:15`, `packages/core/src/lab/demoDisplay.ts:116`

**Problem:** `turnTelemetry.buildTurnTelemetry` is a near-identical copy of `core/src/lab/demoDisplay.ts` `telemetryForTurnResult`: same `DemoDisplayTelemetry` shape, same `effectiveServingMode ?? selectedServingMode` fallback, same `retrievedMatches.slice(0, 6)` cap, same `shadowSignalBundle` projection. The file comment even says it 'Mirrors core/src/lab/demoDisplay.ts'. This is a hand-maintained mirror of a projection that already exists as a function in core, not two intentionally-separate UIs.

**Impact:** The `DemoDisplayTelemetry` contract is 'frozen by review-host/public/devtools.js' (per the comment), so the two copies must stay byte-compatible. When the trace shape changes in core (a new safety flag field, a different serving-mode fallback, a retrieval cap bump), core's copy updates and IPOC's silently diverges, so the stakeholder devtools panel shows stale/wrong decision metadata for IPOC turns only — a data-correctness bug with no compile error, since both independently satisfy the same type.

**Fix:** Export the projection from core (e.g. `telemetryForTurnResult` as a public helper) and have IPOC call it, keeping only the IPOC-specific `turn` counting and the synthetic intake case local. One projection, one place it can drift.

<a id="f-integrated-poc--app-vue-god-component"></a>
##### MED — app.vue is a ~600-line god component owning six unrelated workflows, their state, and their fetch plumbing

- Category: `god-object` · Verification: `review-stage`
- Locations: `packages/integrated-poc/app/app.vue:261`, `packages/integrated-poc/app/app.vue:295`, `packages/integrated-poc/app/app.vue:411`

**Problem:** A single component holds 20+ refs and six independent async workflows — send message, submit intake, lookup, account questions, ticket status, ticket notes — each with its own `isX`/loading flag and its own hand-rolled `try/catch` that funnels into one shared `errorMessage`. It also re-declares domain knowledge that lives on the server: `nextStatuses` (lines 295-300) duplicates the store's `allowedStatusTransitions` (ipocStore.ts:189), and field/label/type tables are inlined. Customer journey and admin readback — two distinct panes with disjoint state — share one script block.

**Impact:** The shared `errorMessage` means a failed note-add overwrites a lookup error banner; the six near-identical `try/catch/finally` blocks are a copy-paste family where one will drift. The duplicated `nextStatuses` will silently disagree with the server's transition table the first time a status is added, letting the UI offer a transition the server 409s. Any new workflow means editing the single largest file in the subsystem, raising merge-conflict and regression risk across unrelated features.

**Fix:** Split by workflow into composables (`useIpocConversation`, `useIpocLookup`, `useIpocAdminTickets`) that own their own state, loading flag, scoped error, and a shared `$fetch` wrapper; render two child components for the customer vs admin panes. Derive available transitions from server data rather than re-hardcoding `nextStatuses` client-side.

<a id="f-integrated-poc--leaky-turn-action-abstraction-handoff-set"></a>
##### MED — Ticket-creation decision is a stringly-typed Set membership test smeared across engineAdapter, leaking core action taxonomy

- Category: `abstraction` · Verification: `review-stage`
- Locations: `packages/integrated-poc/server/utils/engineAdapter.ts:44`, `packages/integrated-poc/server/utils/engineAdapter.ts:92`

**Problem:** Whether a turn produces a ticket is decided by `maybeBuildTicketFromTurn` via `handoffActions.has(result.finalAction) || ui.primitive === 'intake_form' || ui.primitive === 'handoff_confirmation'` — a hardcoded `Set<string>` of action names plus two literal UI-primitive checks. The Set is built from raw strings (`"request_handoff_intake"`, `"create_ticket"`, `"escalate"`) rather than the `TurnAction` union from contracts, so it is not checked against the core taxonomy at all. The 'is this a handoff' predicate is core domain knowledge living in the adapter.

**Impact:** If core renames or adds a handoff-shaped action (or a new UI primitive that should mint a ticket), this Set does not fail to compile — `Set<string>.has()` accepts any string — so IPOC silently stops creating tickets for the new handoff path, and the golden demo path breaks with no type error. The predicate being a raw string set means the compiler cannot help when the enum moves under it.

**Fix:** Model the handoff decision as a single typed predicate keyed on the `TurnAction`/`UiPlan` unions (ideally an exhaustive `switch`/mapped record over the discriminated union so a new action forces a compile error), and source the action names from the contracts union rather than string literals. Keep the predicate as the one place that answers 'does this turn hand off'.

<a id="f-integrated-poc--site-nuxt-partial-reexport-incoherent-api"></a>
##### MED — site-nuxt re-exports only 4 of the IPOC routes, so its IPOC API is a silent, undocumented subset

- Category: `coupling` · Verification: `review-stage`
- Locations: `packages/site-nuxt/server/api/ipoc/sessions.post.ts:1`, `packages/site-nuxt/server/api/ipoc/sessions/[conversationRef]/messages.post.ts:1`, `packages/site-nuxt/server/api/ipoc/sessions/[conversationRef]/cancel-handoff.post.ts:1`

**Problem:** site-nuxt mounts the IPOC API by re-exporting the handler modules through relative filesystem paths (`../../../../../../integrated-poc/server/...`), but only for sessions, messages, intake, and cancel-handoff. lookup, account-answers, and the entire admin/* surface are not re-exported. The coupling mechanism is a deep relative import into another package's internal server tree, and which routes exist on site-nuxt is decided by which files someone remembered to create.

**Impact:** The two apps present different IPOC APIs with no single source of truth: a client (e.g. ChatWidgetPanel, which also imports `integrated-poc/shared/ipoc` for types) can call an endpoint that exists in one app and 404s in the other, and nothing signals the gap. Adding a route to IPOC requires remembering to also hand-create a mirror file in site-nuxt; the deep relative path means any restructuring of IPOC's server folder breaks site-nuxt's build. It is shotgun surgery plus a latent 404 surface.

**Fix:** Make the app-to-app dependency explicit and total: expose the IPOC route set as a registerable Nitro handler group (or a package export map) that site-nuxt mounts wholesale, rather than per-file relative re-exports. If the subset is deliberate, encode it as an explicit allowlist in one place with a comment, so 'site-nuxt intentionally omits admin' is a decision, not an accident of missing files.

<a id="s-nuxt-lib-server"></a>
#### Nuxt site — lib + server API

_nuxt-lib-server · 6 findings_

<a id="f-nuxt-lib-server--first-party-url-policy-triplicated"></a>
##### HIGH — First-party host/path rewrite policy is implemented three times with divergent authorities

- Category: `duplication` · Verification: `review-stage`
- Locations: `packages/site-nuxt/lib/siteUrls.ts:5`, `packages/site-nuxt/lib/content.ts:33`, `packages/site-nuxt/lib/navOffer.ts:60`, `packages/site-nuxt/lib/brandText.ts:9`

**Problem:** The knowledge 'these are our first-party hosts and here is how a foreign/source URL maps to a local path' is encoded independently in at least three places, each with its own literals and its own path-authority set. siteUrls.ts (siteUrls.ts:5-11) hardcodes applicationHosts/siteHosts/loginHost and validates against sitePagePaths derived from siteMap.ts. content.ts (content.ts:33-66) re-derives the same host mapping via regex replaces (applyloansbymal.co.uk -> /apply/, anchor login -> /login/) and validates against a SEPARATE generatedPaths set built from content records. navOffer.ts:60 hardcodes a fourth copy of the application host ('apply.loanslam.co.uk'). brandText.ts:9-10 hardcodes the loanslam->loansbymal host mapping again. The two validation authorities genuinely differ: siteUrls' sitePagePaths includes /about-us/personal-loans/ and excludes /news/, while content's generatedPaths includes /news/ and every content-record link — so the same input path resolves as 'known' in one module and 'unknown' in the other.

**Impact:** Adding a page, renaming a host, or retiring a domain requires shotgun surgery across four files, and the divergent authorities guarantee drift: a link the concierge display-rewriter (siteUrls) treats as valid can be dropped by the content rewriter, or vice versa, so the same customer-visible URL is rendered inconsistently depending on which path produced it. This is exactly the class of first-party-URL bug the subsystem exists to prevent.

**Fix:** Extract one site-policy module that owns (a) the first-party host sets, (b) the source->local host mapping, and (c) the single canonical set of known local paths, and have siteUrls, content, navOffer, and brandText consume it. Pick ONE path authority (siteMap is already the declared 'single source of truth' per its header comment) rather than maintaining siteMap-backed and content-backed sets in parallel.

<a id="f-nuxt-lib-server--faqs-normalization-scattered"></a>
##### MED — The /faqs -> /faq/ special case is duplicated across three call sites

- Category: `duplication` · Verification: `review-stage`
- Locations: `packages/site-nuxt/lib/siteUrls.ts:40`, `packages/site-nuxt/lib/content.ts:45`, `packages/site-nuxt/lib/content.ts:63`

**Problem:** The single legacy-alias rule 'faqs is really faq' is hand-coded three separate times: siteUrls.ts:40 (normalizeSitePath), content.ts:45 (normalizedKnownPath), and content.ts:63 (a blanket replaceAll on rendered HTML). Each is a slightly different implementation of the same alias. There is no shared alias table.

**Impact:** The next legacy alias (e.g. /faqs -> /faq/ plus a future /help -> /faq/) or a change to trailing-slash handling must be applied in three places or it silently half-works: a link normalized correctly by the concierge rewriter but missed by the content HTML pass renders as a broken /faqs/ URL on the page. Primitive-obsession on raw path strings makes this invisible to the type checker.

**Fix:** Model path aliases as data (a Map of alias->canonical) in the same site-policy module as finding #1, and route all three normalizers through one normalizePath(alias) function. One table, one rule.

<a id="f-nuxt-lib-server--siteurls-fail-open-vs-null"></a>
##### MED — siteUrls mixes fail-closed (null) and fail-open (homepage) policies for unknown paths within one module, undocumented at the type level

- Category: `error-handling` · Verification: `review-stage`
- Locations: `packages/site-nuxt/lib/siteUrls.ts:69`, `packages/site-nuxt/lib/siteUrls.ts:38`, `packages/site-nuxt/lib/siteUrls.ts:86`

**Problem:** pathForDisplayUrl applies two opposite failure policies depending on the host bucket: for the current origin (siteUrls.ts:65) an unknown path fails CLOSED (returns null -> URL left untouched), but for a recognised first-party siteHost (siteUrls.ts:69-71) an unknown path fails OPEN, silently collapsing to '/' via `?? '/'`. normalizeSitePath returns string|null and rewriteDisplayedSiteUrls returns the original candidate on null — three different unknown-path behaviours (leave-as-is, drop-to-null, rewrite-to-homepage) coexist with no discriminated result type explaining which applies where.

**Impact:** A model that emits a real but unmapped first-party URL like https://loanslam.co.uk/positive-outcomes/ (a page that exists in siteMap but whose host-branch reaches the fail-open line) can be silently rewritten to the homepage, sending the customer to the wrong page while looking like a successful rewrite. Because the failure is a silent value substitution, not an error, it is invisible in logs and easy to reintroduce when editing the host branches. The fail-open branch and the fail-closed branch look symmetric but behave oppositely.

**Fix:** Make the unknown-path outcome explicit: return a discriminated result ({kind:'mapped', path} | {kind:'unknown'}) from the resolver and decide fail-open vs fail-closed once, at the caller, rather than burying a `?? '/'` in one host branch. If homepage-fallback is genuinely wanted for first-party hosts, name it (e.g. fallbackToHome) so the asymmetry is a stated policy, not an accident of one line.

<a id="f-nuxt-lib-server--concierge-client-server-boundary-thin"></a>
##### MED — Client-side concierge.ts contract is a near-empty stub while the server route re-derives the shapes inline

- Category: `abstraction` · Verification: `review-stage`
- Locations: `packages/site-nuxt/lib/concierge.ts:3`, `packages/site-nuxt/server/api/concierge/sessions/[conversationRef]/messages.post.ts:11`, `packages/site-nuxt/server/api/concierge/sessions/[conversationRef]/messages.post.ts:105`

**Problem:** lib/concierge.ts declares only three response interfaces and no request contract. The messages route re-declares its own ConciergeMessageRequest inline (messages.post.ts:11) and emits stream frames ({text}, {done, conversationRef, message}, {error}) as ad-hoc object literals (messages.post.ts:100-109) that appear nowhere in the shared contract. The named client 'contract' therefore does not describe the streaming protocol the panel actually consumes, and the request side is untyped on both ends. Contrast with the IPOC surface, which imports IpocSendMessageRequest/Response from a shared/ipoc module used by both client and server.

**Impact:** The SSE frame schema lives only in the route body and the panel's parser; changing a frame field (e.g. renaming 'text') compiles cleanly on both sides and breaks the stream at runtime with no type error. The 'contract' file gives false confidence that the client/server boundary is typed when the load-bearing part (request + stream frames) is not.

**Fix:** Either promote lib/concierge.ts to the real shared contract — request body, and a discriminated union for the stream frames (StreamDelta | StreamDone | StreamError) imported by both the route and the panel — mirroring the shared/ipoc pattern already in the codebase, or delete the stub and stop implying a contract exists. Consistency with the IPOC surface is the target.

<a id="f-nuxt-lib-server--concierge-module-god-object"></a>
##### MED — server/utils/concierge.ts bundles session store, rate limiter, prompt, model config, and OpenAI transport in one module

- Category: `cohesion` · Verification: `review-stage`
- Locations: `packages/site-nuxt/server/utils/concierge.ts:27`, `packages/site-nuxt/server/utils/concierge.ts:55`, `packages/site-nuxt/server/utils/concierge.ts:95`, `packages/site-nuxt/server/utils/concierge.ts:156`

**Problem:** One 263-line utils module owns five unrelated concerns: an in-memory session Map (line 27), a fixed-window IP rate limiter with its own eviction sweep (line 55-73), the ~50-line system prompt (line 95), model/env config (line 75), and the OpenAI streaming/non-streaming transport (runConciergeTurn, line 156-262). runConciergeTurn alone does history seeding, truncation, developer-message assembly, two divergent OpenAI call paths, empty-reply handling, and URL rewriting. The IPOC side, by contrast, splits these into ipocStore, engineAdapter, turnTelemetry.

**Impact:** Every change — tightening the rate limiter, swapping the session store for something shared across workers, editing the prompt — touches the same file and risks the others; the rate-limiter's module-global rateBuckets and the sessions Map also make the module impossible to unit-test in isolation and unsafe under multi-instance deploy (both maps are per-process). The single streaming/non-streaming fork duplicates the responses.create call with only the stream flag differing.

**Fix:** Split along the seams the IPOC surface already established: a session store, a rate-limit helper, a prompt/config module, and a thin transport that takes assembled input and returns the reply. Collapse the two responses.create branches into one call assembled from a shared options object plus an optional onDelta. This is proportionate — it mirrors an existing in-repo pattern, not new architecture.

<a id="f-nuxt-lib-server--application-form-detection-primitive-obsession"></a>
##### LOW — navOffer re-implements first-party application-URL detection instead of reusing siteUrls' resolver

- Category: `coupling` · Verification: `review-stage`
- Locations: `packages/site-nuxt/lib/navOffer.ts:74`, `packages/site-nuxt/lib/navOffer.ts:84`, `packages/site-nuxt/lib/siteUrls.ts:49`

**Problem:** hasApplicationFormLink (navOffer.ts:74-93) parses a URL, normalizes the path, and checks 'is this the application form' using its own applicationFormHost literal and a path === '/apply' check with a throwaway 'https://mal-demo.local' base — a fourth, subtly different implementation of the host/path resolution that siteUrls.pathForDisplayUrl already performs (siteUrls.ts:49, where the same host maps to '/apply/'). The two even disagree on trailing slash ('/apply' here vs '/apply/' there) and on which hosts count.

**Impact:** The two application-URL detectors can diverge: siteUrls recognises three application hosts (siteUrls.ts:5-9) while navOffer recognises one (navOffer.ts:60), so a link the display rewriter routes to /apply/ may not be recognised as an application link by the offer suppressor, producing a duplicated or missing apply chip. Any change to what counts as 'the application' must be made in both.

**Fix:** Have navOffer ask the shared site-policy resolver 'does this URL resolve to the application path?' rather than re-deriving host/path matching with its own literals and base URL. Reuse the single resolver from finding #1.

<a id="s-hellweek-judge"></a>
#### Hell Week — judge/calibration/compare

_hellweek-judge · 5 findings_

<a id="f-hellweek-judge--escalation-ladder-duplicated"></a>
##### HIGH — Escalation ladder (judge → verify → adjudicate) implemented twice with divergent packet sourcing

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/hellweek/openaiJudge.ts:266`, `packages/core/src/hellweek/openaiJudge.ts:440`, `packages/core/src/hellweek/openaiJudge.ts:518`, `packages/core/src/hellweek/openaiJudge.ts:550`

**Problem:** The three-tier ladder logic (shouldEscalateSafetyFloorSafe / shouldVerifyDemoKiller → verify → shouldAdjudicateHardDispute → final_adjudicate → worstVerdict for safety-floor) exists in two hand-maintained copies. `judgeHellWeekRun` inlines it over `verifyVerdict` (openaiJudge.ts:266-320), which reads the packet from disk via readScenarioPacket. `judgeScenarioPacketWithEscalation` reimplements the identical control flow (openaiJudge.ts:440-516) over `verifyScenarioPacketVerdict`, which takes packetJson in memory. calibration.ts drives the second path; the run entrypoint drives the first. The only real difference is where the packet bytes come from, yet the branching, ordering, and worst-verdict merge are copy-pasted.

**Impact:** Any change to the ladder — a new tier, a different hard-dispute trigger, changing whether safety-floor takes worstVerdict — must be made in two places or the batch run and the calibration harness will grade the same packet differently, silently invalidating calibration numbers against production runs. This is textbook shotgun surgery on the subsystem's core decision path.

**Fix:** Extract one ladder function parameterized by a packet source (e.g. `escalateVerdict(getPacketJson: () => string, initial, models, safetyFloor)`), and have both `judgeHellWeekRun` and `judgeScenarioPacketWithEscalation` call it — disk-read vs in-memory becomes the injected closure. The ladder decisions (`shouldEscalate*`, `shouldAdjudicateHardDispute`, `worstVerdict`) already exist as pure functions; only the orchestration is duplicated.

<a id="f-hellweek-judge--compare-redeclares-report-model"></a>
##### MED — compare.ts redeclares the entire report/grade/judge type family instead of consuming canonical types

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/hellweek/compare.ts:16`, `packages/core/src/hellweek/compare.ts:39`, `packages/core/src/hellweek/compare.ts:85`, `packages/core/src/hellweek/types.ts:229`, `packages/core/src/hellweek/types.ts:285`

**Problem:** compare.ts imports `Severity` from ./types but then defines parallel structural copies of the domain model: `HellWeekVerdict` (compare.ts:16, duplicating types.ts:251), `ReportTotals` (compare.ts:18, duplicating the inline totals on HellWeekReport), `CompareGrade` (compare.ts:29, a lossy copy of HellWeekGrade), `CompareReport` (compare.ts:39), and `CompareJudgeMetadata` (compare.ts:85, a third variant of JudgeMetadata). Because these are hand-written subsets, `normalizeReport`/`normalizeGrade` re-validate fields the canonical types already guarantee, and the compare model can silently drift from the producer (HellWeekReport in aggregate.ts) it is meant to consume.

**Impact:** When a real field is added to HellWeekReport or HellWeekGrade (e.g. a new routing metric or a new judge metadata field), compare silently drops it — the comparison keeps compiling and reports 'no material movement' on a dimension it can no longer see. A reviewer has no compile-time signal that compare is stale; the divergence only shows up as a missing warning in a report a stakeholder trusts.

**Fix:** Make the canonical types the single source: have compare accept `HellWeekReport` (or a `Pick`/`Readonly` view of it) and keep only the defensive `normalizeReport` boundary for untrusted JSON on disk, deriving its output type from HellWeekReport rather than a hand-maintained CompareReport. Parse-don't-validate at the file boundary once, into the shared type, instead of maintaining a shadow schema.

<a id="f-hellweek-judge--severityrank-redeclared"></a>
##### MED — severityRank comparator redeclared locally in compare.ts and stability re-derives ordering

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/hellweek/compare.ts:10`, `packages/core/src/hellweek/types.ts:15`

**Problem:** types.ts:15 exports the canonical `severityRank` and `worstSeverity`, and calibration.ts, openaiJudge.ts, stability.ts, and aggregate.ts all import it. compare.ts:10 instead declares its own private `const severityRank: Record<Severity, number>` with the same literal mapping, even though it already imports `Severity` from ./types on line 15. The severity ordering — which drives improvedSeverity/worsenedSeverity classification and sort order — now has two definitions of truth.

**Impact:** If the severity scale is ever extended (e.g. a fourth tier between dent and demo_killer), the canonical map updates but compare's private copy does not, so compare's regression classification and its `sortChanges` ordering silently disagree with stability and calibration, which both consume compare output. A whole tier could be mis-ranked in the comparison recommendation.

**Fix:** Delete the local map at compare.ts:10 and import `severityRank` (and `worstSeverity` where compare hand-rolls max-severity logic) from ./types, matching every other file in the subsystem. One comparator, one place.

<a id="f-hellweek-judge--judge-metadata-bolted-on"></a>
##### MED — Judge metadata (model/version/rubric hash) modeled four times as drifting parallel shapes

- Category: `abstraction` · Verification: `verified`
- Locations: `packages/core/src/hellweek/types.ts:196`, `packages/core/src/hellweek/types.ts:224`, `packages/core/src/hellweek/compare.ts:85`, `packages/core/src/hellweek/openaiJudge.ts:41`, `packages/core/src/hellweek/openaiJudge.ts:328`

**Problem:** The judge's identity (provider, mode, judgeModel/verifierModel/finalAdjudicatorModel, tool, promptVersion, rubricHash) is expressed as four near-identical but non-shared shapes: `JudgeMetadata` (types.ts:196, all-optional), `HellWeekJudgeReportMetadata` (types.ts:224), `CompareJudgeMetadata` (compare.ts:85, adds required verdictCount + artifactSchemaVersion), and the inline `OpenAiHellWeekJudgeRequest.metadata` (openaiJudge.ts:48). The artifact's metadata is then assembled by a hand-written object literal (openaiJudge.ts:328-344) that spreads sourceRunId conditionally. Nothing binds the produced metadata to any of the consuming metadata types, and JudgeMetadata makes provider/model/promptVersion/rubricHash all optional, so an artifact with no rubricHash is representable and type-checks.

**Impact:** The rubricHash is the mechanism that lets compare warn when two runs were graded under different rubrics (compare.ts:634). Because the field is optional across all four shapes and the artifact is built by an untyped literal, a producer that forgets to set rubricHash (or names it differently) yields a comparison that silently reports rubric parity and lets an incomparable A/B through. Adding a real metadata field means editing four shapes by hand with no compiler linkage.

**Fix:** Define one authoritative `JudgeMetadata` with the invariant fields required (provider, tool, promptVersion, rubricHash, model set), and derive the report/compare views from it via `Pick`/extension. Build the artifact metadata through a typed constructor that returns that type, so a missing rubricHash is a compile error rather than a silently-lost comparability guarantee.

<a id="f-hellweek-judge--verdict-mutation-regex-policy"></a>
##### MED — Safety floor/ceiling verdict rewriting encodes compliance policy as module-level regexes inside the judge normalizer

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/core/src/hellweek/openaiJudge.ts:187`, `packages/core/src/hellweek/openaiJudge.ts:700`, `packages/core/src/hellweek/openaiJudge.ts:744`, `packages/core/src/hellweek/openaiJudge.ts:841`

**Problem:** normalizeVisibleSafetyVerdict (openaiJudge.ts:744) post-processes every LLM verdict through applyVisibleSafetyFloorVerdict and applyVisibleSafetyCeilingVerdict, which re-`JSON.parse(packetJson)` on each call (700/708, 841/849) and apply ~10 module-level compliance regexes (credential refusal, other-customer-data, internal leak — openaiJudge.ts:187-202) to override the model's severity. This is a second, deterministic grading engine — the real credential/privacy policy — living inside a function named 'normalize' in the OpenAI client module, re-parsing the packet the judge already sanitized.

**Impact:** The subsystem now has two homes for safety policy: the LLM rubric text (openaiJudge.ts:149) and this regex ladder, with no shared vocabulary between them. A policy change (e.g. a new credential noun, or treating a new dimension as floor) must be made in prose and in regex, and the double JSON.parse per verdict means the packet contract is decoded three times per scenario (sanitize + floor + ceiling) with no shared parsed value. A reviewer touching credential handling cannot tell that the authoritative behavior lives in a regex 500 lines from the rubric.

**Fix:** Lift the deterministic floor/ceiling into a named policy unit (e.g. `applyVisibleSafetyPolicy(parsedPacket, verdict)`) that takes an already-parsed packet — parse once in judgeScenarioPacket and thread the object — and colocate it with the other deterministic content checks (hardContentChecks in types.ts / the deterministic grader), so LLM grading and deterministic backstop are visibly the two halves of one policy rather than one buried in a client-module 'normalizer'.

<a id="s-lab-logging"></a>
#### Lab logging / display / token

_lab-logging · 5 findings_

<a id="f-lab-logging--logging-fails-turn-open"></a>
##### HIGH — Serving-path interaction logging is fail-closed: a log write failure turns a completed turn into a 500

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/core/src/lab/server.ts:725`, `packages/core/src/lab/server.ts:635`, `packages/core/src/lab/demoInteractionLog.ts:134`, `packages/core/src/lab/demoInteractionLog.ts:499`

**Problem:** The record helpers are awaited on the hot serving path with no local try/catch, and the write happens before writeJson (server.ts:725 -> 736, 635 -> 643). record() is a raw prisma create (demoInteractionLog.ts:134) that can reject on any DB blip. A rejection unwinds past the already-computed successful response, is caught by the outer handler (server.ts:106), which then attempts a SECOND DB write via recordDemoError (server.ts:111 -> demoInteractionLog.ts:499). Diagnostic/audit logging is thus fail-closed against the customer turn.

**Impact:** A transient Neon/Postgres hiccup during the observability write converts a fully-processed, successful support turn into an HTTP 500 for the end user; the recovery path then issues another write to the same unavailable DB, which also throws, so the error log the operator would rely on to diagnose the outage is exactly the write that fails. Observability failure escalates into a customer-facing outage.

**Fix:** Make the audit log fail-open on the serving path: wrap each recordDemo* call site (or record() internally) so a persistence rejection is caught and dropped/counter-incremented rather than propagated, and move logging after writeJson (or fire-and-forget with a caught tail). Keep the query/read path fail-closed as it is. This is the standard 'telemetry must never break the request' seam.

<a id="f-lab-logging--record-record-god-mapping"></a>
##### MED — 40-field flat DemoInteractionRecord with three near-identical hand-maintained mappings (shotgun surgery)

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/lab/demoInteractionLog.ts:25`, `packages/core/src/lab/demoInteractionLog.ts:134`, `packages/core/src/lab/demoInteractionLog.ts:612`, `packages/core/src/lab/demoInteractionLog.ts:652`

**Problem:** DemoInteractionRecord (25-60) and its twin DemoLoggedEvent (77-113) are ~40 parallel optional primitives, and every one is re-listed by hand in three separate places: PrismaDemoInteractionLog.record() data object (134-172), eventFromModel() DB->domain (612-649), and loggedEventFromRecord() record->domain (652-692). The three lists must stay field-for-field in lockstep with the Prisma schema and each other, but nothing enforces it.

**Impact:** Adding one telemetry column (e.g. a new signal field) requires coordinated edits in the interface, the Prisma data map, both hydration functions, and projectTurnTelemetry. Miss one and the field silently persists as null in Postgres while working in the in-memory log, or hydrates in review but is absent in the CLI path — a class of bug that passes unit tests using InMemoryDemoInteractionLog and only shows up against real Postgres. This is textbook shotgun surgery over a primitive-obsessed flat record.

**Fix:** Collapse the record<->row<->event boundary to one source of truth: derive DemoLoggedEvent from DemoInteractionRecord plus {id}, and centralize the null-coalescing/JSON-array normalization in one mapper used by both the Prisma and in-memory backends instead of three divergent copies. Group the telemetry columns into nested value objects (retrieval, signal, intake, decision) so illegal partial states aren't spread across 40 optional flats.

<a id="f-lab-logging--token-payload-unvalidated-cast"></a>
##### MED — State-token decode trusts the decrypted payload with an unchecked cast — no parse-don't-validate at the trust boundary

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/lab/demoStateToken.ts:65`, `packages/core/src/lab/demoStateToken.ts:67`, `packages/core/src/lab/server.ts:1171`

**Problem:** unsealDemoStateToken JSON.parses the plaintext and casts to Partial<DemoStateTokenPayload> (65), then gates only on payload.version === tokenVersion && payload.state (67), returning payload.state as a fully-typed ConversationState with no schema validation. GCM authentication guarantees the bytes were sealed by a holder of the secret, but it does NOT guarantee the enclosed state matches the CURRENT ConversationState shape. The returned state flows straight into processTurn as trusted session state (server.ts:1171-1184).

**Impact:** When ConversationState evolves (new required field, changed enum, renamed key), an in-flight v1 token still decrypts, still passes the version===1 check, and yields a structurally-stale object typed as the new ConversationState. The planner then reads undefined where it expects a value — a runtime crash or silent misbehavior mid-conversation, surfacing only in production continuations, not in same-shape tests. The version field exists but is a dead guard: it is never bumped and there is no migration/reject branch.

**Fix:** Parse, don't cast: run payload.state through the existing Zod ConversationState schema (the contracts package already defines it) inside unsealDemoStateToken and return null on failure, so a shape mismatch fails closed to 'invalid_continuation_token' exactly like a tamper. Make the version check load-bearing — reject or migrate unknown versions explicitly rather than treating version purely as a formality.

<a id="f-lab-logging--two-summary-implementations-diverge"></a>
##### LOW — summaries() has two independent implementations (SQL vs JS) that can silently disagree

- Category: `consistency` · Verification: `verified`
- Locations: `packages/core/src/lab/demoInteractionLog.ts:176`, `packages/core/src/lab/demoInteractionLog.ts:243`, `packages/core/src/lab/demoInteractionLog.ts:558`, `packages/core/src/lab/demoInteractionLog.ts:575`

**Problem:** The DemoSessionSummary aggregation exists twice with different engines: a hand-written raw SQL GROUP BY in PrismaDemoInteractionLog.summaries() (176-196, mapped by summaryFromRow 558) and a re-implemented JS reduce in InMemoryDemoInteractionLog.summaries() (243-263, via summaryFromEvents 575). They already differ in ordering semantics (SQL ORDER BY last_at DESC on timestamptz vs JS right.lastAt.localeCompare on ISO strings) and in overrideCount source (SQL SUM(action_changed=true) vs JS filter on actionChanged===true — coincidentally aligned today, but nothing keeps them so).

**Impact:** The in-memory log is the test double for the Prisma log, so tests assert against the JS aggregation while production serves the SQL aggregation. A future change to summary semantics (e.g. counting a new event type, or a tie-break on ordering) can be made in one path and pass all tests while the other production path returns different numbers to the owner-facing dashboard. The double is no longer a faithful stand-in.

**Fix:** Pick one authority for the aggregation shape: either express summaries purely in SQL and have the in-memory backend load rows and run the SAME reducer used to interpret SQL output, or define the summary reducer once over DemoLoggedEvent[] and have the Prisma path fetch-and-fold for correctness parity (accepting the cost, since this is an owner-only audit path, not the hot turn). Do not maintain two hand-written aggregations of the same contract.

<a id="f-lab-logging--display-sanitization-in-mapper"></a>
##### LOW — PII redaction (a safety concern) is embedded inside the display-mapping module with no dedicated seam

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/core/src/lab/demoDisplay.ts:276`, `packages/core/src/lab/demoDisplay.ts:292`, `packages/core/src/lab/demoDisplay.ts:249`, `packages/core/src/lab/demoInteractionLog.ts:521`

**Problem:** demoDisplay.ts mixes three responsibilities: response shaping (mapTurnResultToDemoResponse), telemetry projection, and PII redaction (sanitizeCustomerMessageForDemo/buildSafeHandoffConfirmation, 276-313). The redaction is a substring split/join over collected fact values (288) applied only to the customerMessage/ui.message fields. Meanwhile the logging path independently strips only the continuation token before persisting displayResponseJson (demoInteractionLog.ts:521), and persists customerMessage/internalJson which carry the raw userMessage and full result. Redaction lives in the display formatter, not at a boundary both display and logging share.

**Impact:** The redaction guarantee is scoped to what the display mapper happens to touch. Any new field added to the response, or the logging path's internalJson:{result} (which contains the unredacted turn result and raw userMessage, demoInteractionLog.ts:394), bypasses it entirely — collected PII lands in Postgres unredacted while the on-screen message is scrubbed. Because the scrub is naive substring replacement (an email fragment appearing inside another word gets partial replacement), correctness also drifts. A reviewer changing display code will not realize they are the sole owner of a data-protection invariant.

**Fix:** Extract the collected-fact scrub (sanitizeCustomerMessageForDemo, demoDisplay.ts:276-290) into a named, single-purpose helper such as redactCollectedFacts(state, value), so display formatting stops owning a redaction rule by accident and the fragile substring split/join has one testable home. Do NOT extend it to rewrite internalJson persistence: the persisted turn result sits in the operator's own lab-logging trust zone alongside the already-raw customerMessage, so whether internal audit records should redact collected facts is a separate data-retention decision to make deliberately, not a bug to fix by widening the display seam.

<a id="s-mcp-server"></a>
#### MCP server

_mcp-server · 5 findings_

<a id="f-mcp-server--duplicated-wire-types-no-contract-dep"></a>
##### HIGH — Client hand-rolls loose duplicates of contract types the lab server already owns

- Category: `duplication` · Verification: `verified`
- Locations: `packages/mcp-server/src/evidence.ts:1-52`, `packages/mcp-server/package.json:12-15`, `packages/core/src/lab/server.ts:10-18`

**Problem:** The lab server's response bodies are built from `@loanslam/contracts` types: /sessions returns `{conversationRef, state: ConversationState}`, GET /sessions/:ref returns `{state: ConversationState, traces: TurnTrace[]}`, and POST /messages returns a `validatedTurnResultSchema` object (server.ts:450-500, contracts schemas.runtime.ts:173-329). The MCP client does NOT depend on `@loanslam/contracts` (package.json has no such dep) and instead re-declares its own structurally-looser copies — `LabConversationMessage`, `LabTrace`, `LabSessionState`, `LabSessionDump`, `ValidatedTurnResultLike` — in evidence.ts, with nearly every field marked optional/`unknown`. These are ad-hoc restatements of shapes another package authoritatively owns.

**Impact:** Shotgun surgery: any field rename or shape change on the server side (e.g. `effectiveServingMode`, `validatorOverrides`, `history` message role naming) compiles cleanly on both sides and silently produces wrong/empty evidence summaries at runtime, because the client's copy is a parallel, unenforced dialect. A staff engineer maintaining the routing contract has no compiler signal that the MCP evidence view drifted.

**Fix:** Add a `@loanslam/contracts` workspace dependency and derive the client's view from the canonical schemas (import `ConversationState`/`TurnTrace`/`ValidatedTurnResult` types, or narrow via `z.pick`/partial subschemas for the summary). Delete the parallel `Lab*`/`*Like` interfaces. The contract package is the single source of truth for wire shapes; the MCP client is a consumer, not a co-author, of that contract.

<a id="f-mcp-server--no-http-timeout"></a>
##### MED — requestJson has no timeout/AbortController; a hung lab server hangs the MCP tool indefinitely

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/mcp-server/src/labApiClient.ts:262-291`

**Problem:** `requestJson` calls `fetch` with only method/headers/body — no `AbortController`, no `signal`, no timeout. Every tool (`lab_session_start`, `_send`, `_dump`, `_reset`, `_summarize`) flows through this one function.

**Impact:** If the local lab server is started but wedged (slow planner call, deadlocked in-memory session, half-open socket), the `fetch` never resolves and the MCP tool call hangs with no error and no bound. Over stdio the calling agent gets no response and no failure it can react to — the single worst failure mode for a tool boundary, because it is indistinguishable from 'still working'. `lab_session_send` compounds this: one message is two sequential unbounded fetches (POST then GET).

**Fix:** Add an `AbortController` with a bounded timeout (e.g. injected via options, defaulting to a few seconds) to `requestJson`, and translate the abort into a `LabApiError`-style typed failure so tools fail closed with a clear message instead of hanging. This is the standard fail-fast pattern for an HTTP client at a process boundary.

<a id="f-mcp-server--parse-dont-validate-shallow-assert"></a>
##### LOW — assertValidSessionDump does shallow structural checks then casts through `unknown`, ignoring available zod schemas

- Category: `type-design` · Verification: `verified`
- Locations: `packages/mcp-server/src/evidence.ts:54-76`, `packages/contracts/src/schemas.runtime.ts:173-318`

**Problem:** `assertValidSessionDump` validates only four top-level shapes (object, string conversationRef, array history, array traces) and then returns `value as unknown as LabSessionDump`. The interior — trace `finalAction`, `selectedServingMode`, `validatorOverrides[].code`, message `role`/`content` — is never validated but is typed as if it were. Meanwhile the contracts package already ships `conversationStateSchema`, `turnTraceSchema`, and `validatedTurnResultSchema` (zod) that parse exactly these bodies.

**Impact:** This is validate-then-trust, not parse-don't-validate. A malformed or partially-populated trace (e.g. a `validatorOverrides` entry that is a string, or a `history` entry missing `role`) passes the assert, then `summarizeEvidence` silently coerces it to empty arrays / null. The evidence artifact the whole MCP server exists to produce looks well-formed but is quietly lossy, and the failure is invisible because the cast asserted correctness that was never checked.

**Fix:** Do not blanket-swap assertValidSessionDump for `.parse()` against the full runtime schemas — turnTraceSchema/validatedTurnResultSchema are strictly required-field contracts (traceId, turnIndex, planner, outboundMessageId, retrievedMatches, role enum, etc.) that the MCP summarizer does not need and that a partial or differently-serialized dump would fail-closed on. summarizeEvidence is deliberately a lossy best-effort projection, and the LabSessionDump interface already types every interior field as optional/unknown, so the cast is not asserting a false-strong type. If you want a genuine boundary parse, derive a narrow, mostly-optional zod schema (or `turnTraceSchema.partial().passthrough()` / `.pick()` the fields the summary reads) so the boundary parses only what it consumes, and use `.safeParse()` so a malformed interior surfaces as a typed warning on the evidence artifact rather than silently coercing to empty arrays/null. That preserves the lossy-projection intent while making silent lossiness observable — which is the one defensible part of the finding.

<a id="f-mcp-server--send-message-unvalidated-cast"></a>
##### LOW — POST /messages response is blind-cast to ValidatedTurnResultLike while every other route is validated

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/mcp-server/src/labApiClient.ts:137-158`

**Problem:** `sendSessionMessage` casts the /messages response directly: `(await requestJson(...)) as ValidatedTurnResultLike`, with no structural check. This is inconsistent with `fetchSession`/`resetSession`/`startSession`, which all run their bodies through `assertValidSessionDump`. The cast result is then handed to `summarizeEvidence` as the authoritative `result` that overrides the fetched session (evidence.ts:85-118 prefers `result.trace`/`result.state` over session).

**Impact:** Inconsistent idiom at the same boundary: the one response that most influences the evidence summary (it wins the `??` precedence over the session) is the one that is never validated. If the server changes the /messages envelope or returns an error-shaped 200, the cast succeeds, `result.trace`/`result.finalAction` read as undefined, and the summary silently falls back to stale session data rather than surfacing the mismatch.

**Fix:** Add a local `assertValidTurnResult` guard in evidence.ts, mirroring the existing `assertValidSessionDump`, and run the /messages body through it in `sendSessionMessage` (labApiClient.ts:137-144). This achieves the one-idiom-at-the-boundary goal the finding wants. Do NOT pull in the contracts `validatedTurnResultSchema` as the finding recommends: the mcp-server package is deliberately self-contained (evidence.ts has zero imports; package.json depends only on zod and the MCP SDK, not @loanslam/contracts), hand-rolling all its own Lab* types and validators. Wiring in a contracts schema would add a cross-package coupling the package intentionally avoids, which is a heavier change than the inconsistency warrants. Since every consumer field is read via null-coalescing (`??`) with a graceful session fallback, a lighter alternative is also defensible: leave the cast but drop the trailing `result` fields from summarizeEvidence's precedence if they aren't load-bearing. Either way, the fix is a few lines, local, and low-priority.

<a id="f-mcp-server--summarize-evidence-precedence-god-fn"></a>
##### LOW — summarizeEvidence reconstructs serving-mode/action precedence the server already computed, via deep optional-chaining ladders

- Category: `feature-envy` · Verification: `verified`
- Locations: `packages/mcp-server/src/evidence.ts:78-121`, `packages/core/src/lab/server.ts:489-500`

**Problem:** `summarizeEvidence` reaches across the wire into deeply-nested optional server internals and re-derives precedence with long `??` chains: `lastAction` = `result.finalAction ?? latestTrace.finalAction ?? state.lastAction ?? null`; `selectedServingMode` = `latestTrace.effectiveServingMode ?? latestTrace.selectedServingMode ?? null`. This encodes the server's own effective-vs-selected and result-vs-trace-vs-state resolution rules a second time, in a consumer, from optional fields.

**Impact:** Feature envy plus duplicated business logic across a package boundary. The engine already decides effective serving mode and final action (server.ts processes the turn and returns `result`); the MCP client re-guesses that precedence. When the engine's precedence rules change (e.g. effective vs selected semantics), this ladder silently disagrees and the evidence summary misreports routing — the exact thing this subsystem exists to report on. Each fallback branch is also an untested-in-isolation assumption about which field the server populated.

**Fix:** Scope the fix to the one genuinely-duplicated domain rule and drop the API-restructuring proposal. The serving-mode precedence `effectiveServingMode ?? selectedServingMode` is duplicated across a package boundary: packages/core/src/simulation/personaReport.ts:144 (routeServingMode) and packages/mcp-server/src/evidence.ts:110-113. The engine trace (engine.ts:144-145) deliberately carries selectedServingMode and effectiveServingMode as separate raw fields and exposes no single pre-resolved value, so any consumer must apply the rule — and two consumers now apply it independently. Extract that one expression into a shared helper (e.g. resolveEffectiveServingMode(trace) alongside the LabTrace/trace type definitions or in @loanslam/contracts) and have both call sites use it, so an engine change to effective-vs-selected semantics can't leave the evidence summary silently reporting the wrong mode. Do NOT pursue the finding's primary recommendation of having the server return resolved values: summarizeEvidence operates on a serialized LabSessionDump at a separate summarization boundary, so client-side reconstruction from the dump is legitimate and reworking the server API is disproportionate. Leave the lastAction (result ?? trace ?? state) and finalCustomerMessage fallbacks as-is — those are reasonable prefer-freshest defensiveness over optional wire fields, not encoded business logic, and the finding over-broadens by grouping them with the real duplication.

<a id="s-simulation"></a>
#### Simulation

_simulation · 5 findings_

<a id="f-simulation--runner-personarunner-near-duplication"></a>
##### HIGH — runner.ts and personaRunner.ts are the same orchestration cloned, diverging only in output shape

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/simulation/runner.ts:66`, `packages/core/src/simulation/personaRunner.ts:62`

**Problem:** runJourney and runPersonaScenario are structurally identical: same input shape (planner|plannerFactory, signalExtractor, initialState|Factory, now, idFactory), same processTurn loop over customerTurns accumulating traces/state, same finalTrace guard. They differ only in what they emit (JourneyReport vs ConversationTranscript). The entire supporting toolkit is duplicated verbatim: unsafeOverrideCodes (runner.ts:48 vs personaRunner.ts:44), safeVulnerabilityActions (runner.ts:58 vs personaRunner.ts:54), countCaughtUnsafeProposals (runner.ts:392 vs personaRunner.ts:209), isVulnerabilityFlag (runner.ts:438 vs personaRunner.ts:235), resolveNow (runner.ts:453 vs personaRunner.ts:246), defaultConversationState (runner.ts:461 vs personaRunner.ts:254).

**Impact:** Any change to the turn-driving contract — a new processTurn argument, a change to how vulnerability is counted, a new safe action — must be shotgun-applied to both files or the two harnesses silently disagree about the same run. This has already happened: see the credential_offer_warned divergence finding. Reviewers must diff two files to reason about one behavior.

**Fix:** Extract a single driveConversation(scenarioLike, deps) -> { traces, finalState } that both entrypoints call, where scenarioLike is the shared { id, customerTurns } shape. Keep runJourney/runPersonaScenario as thin adapters that only build their report/transcript from the shared trace array. Collapse the six duplicated helpers into one shared module (e.g. simulation/traceMetrics.ts) imported by both.

<a id="f-simulation--unsafe-vulnerability-sets-diverged-copies"></a>
##### MED — Safety-critical code sets (unsafe overrides, vulnerability flags) are hand-copied across 3-4 modules and have already drifted

- Category: `consistency` · Verification: `verified`
- Locations: `packages/core/src/simulation/runner.ts:48`, `packages/core/src/simulation/personaRunner.ts:44`, `packages/core/src/stochastic/evaluate.ts:151`, `packages/core/src/simulation/personaReport.ts:147`

**Problem:** The definition of 'an unsafe proposal was caught' lives as a literal Set in at least three places and they are NOT identical. simulation/runner.ts:48 and personaRunner.ts:44 both include "credential_offer_warned"; stochastic/evaluate.ts:151 (unsafeProposalOverrideCodes) omits it. Likewise isVulnerabilityFlag / vulnerabilityFlags is copied four times (runner.ts:438, personaRunner.ts:235, personaReport.ts:147, plus stochastic/evaluate.ts:141), and safeVulnerabilityActions three times (runner.ts:58, personaRunner.ts:54, evaluate.ts:133).

**Impact:** The three evidence surfaces (journey suite, persona suite, stochastic suite) can report different caughtUnsafeProposals counts for the exact same transcript because they disagree on whether a credential_offer_warned override counts as unsafe. Since these are the product's proof surface for safety behavior, a divergent copy produces a metric that looks authoritative but silently under-counts. The next person who adds a new override code will patch some copies and miss others.

**Fix:** Promote these safety vocabularies to a single source of truth in @loanslam/contracts (or a core/policy module) as named exported constants: UNSAFE_PROPOSAL_OVERRIDE_CODES, VULNERABILITY_SAFETY_FLAGS, SAFE_VULNERABILITY_ACTIONS. Every runner and report imports the same constant. If stochastic genuinely needs a different set, name the difference explicitly rather than letting it be an accidental copy drift.

<a id="f-simulation--forbidden-behaviors-stringly-typed-fail-open"></a>
##### MED — forbiddenBehaviors is a stringly-typed marker dispatched by magic strings with a fail-open default

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/simulation/runner.ts:328`, `packages/core/src/simulation/runner.ts:365`, `packages/contracts/src/schemas.eval.ts:24`

**Problem:** journeyExpectationSchema types forbiddenBehaviors as z.array(nonEmptyStringSchema) — any string passes. runner.ts detectForbiddenBehavior (line 328) then switches on hardcoded literals ('ungrounded_answers', 'forbidden_credential_requests', 'normal_routing_after_vulnerability', 'promised_outcomes', 'malformed_plan') and returns false for anything unrecognized (line 365). formatForbiddenBehaviorFailure (line 368) has a parallel string switch with its own fallback. The set of legal markers is implicit in two functions, not in the type.

**Impact:** A typo in a fixture ('ungrounded_answer' vs 'ungrounded_answers') is accepted by the schema and silently treated as 'no forbidden behavior' — the check passes, giving false green evidence that a safety property held when it was never evaluated. Because the default is fail-open (return false), the failure mode is silent and points the wrong way for a safety harness.

**Fix:** Model forbiddenBehaviors as a z.enum / discriminated union of the known markers so an unknown marker fails schema parse at fixture-load time (fail-closed). Drive both detection and message formatting from one table keyed by that enum (Record<Marker, {detect, message}>), making the exhaustiveness compiler-checked and eliminating the two divergent string switches.

<a id="f-simulation--vulnerability-handled-semantics-fragmented"></a>
##### MED — 'Did we see / safely handle a vulnerability' is re-derived with subtly different logic in every module

- Category: `abstraction` · Verification: `verified`
- Locations: `packages/core/src/simulation/personaRunner.ts:225`, `packages/core/src/simulation/runner.ts:400`, `packages/core/src/simulation/personaReport.ts:133`

**Problem:** The 'saw a vulnerability' predicate is reimplemented three ways over three different data shapes. personaRunner.sawVulnerability (line 225) reads a TurnTrace and carries a comment warning that mere candidate-set presence must not inflate the count. runner.countVulnerabilityMisses (line 400) inlines the same predicate against TurnTrace but expresses the outcome as a miss. personaReport.sawVulnerability (line 133) reruns it against the flattened TranscriptTurn shape. The nuanced 'outcome semantics only' rule documented in personaRunner is not visibly enforced in the other two copies.

**Impact:** The invariant that matters most for this product (vulnerability was actually routed, not just present as a candidate) is guarded in one copy by a comment and reimplemented without that guard in the others. A future edit to the routing model can make personaReport count a vulnerability the runner does not, and the discrepancy will only surface as an unexplained metric mismatch between transcript and report.

**Fix:** Define the predicate once over TurnTrace (sawVulnerability(trace) and wasVulnerabilitySafelyHandled(trace)) in the shared trace-metrics module, and have the transcript carry the boolean the runner computed rather than letting personaReport recompute it from the lossy TranscriptTurn. Reports should read derived facts, not re-derive safety semantics.

<a id="f-simulation--report-feature-envy-into-trace-internals"></a>
##### MED — Report builders reach through report.traces into engine-internal override/serving-mode structure the runner already summarized

- Category: `feature-envy` · Verification: `verified`
- Locations: `packages/core/src/simulation/report.ts:50`, `packages/core/src/simulation/report.ts:75`, `packages/core/src/simulation/report.ts:160`

**Problem:** calculateJourneyMetrics does not consume the summary fields JourneyReport already exposes; it re-walks report.traces and inspects trace.validatorOverrides[].code, trace.finalAction, trace.safetyFlags, and effectiveServingMode ?? selectedServingMode directly (groundedAnswerCount at line 50, unnecessaryHandoffCount at line 61, malformedJourneyCount at line 75, failure-mode enumeration at line 160). It duplicates malformedOverrideCodes (report.ts:33) and its own routeServingMode (report.ts:182), the same concepts the runner owns.

**Impact:** The report layer is coupled to the exact internal shape of TurnTrace and the ValidatorOverride code vocabulary. When the engine changes an override code or the serving-mode fields, both the runner AND every report that re-parses traces must change together — classic shotgun surgery across the abstraction boundary the runner was supposed to seal.

**Fix:** Have runJourney compute the trace-derived facts the report needs (grounded-answer flag, unnecessary-handoff flag, malformed flag) once and put them on JourneyReport, so calculateJourneyMetrics aggregates pre-summarized booleans instead of re-reading raw override codes. The report module should depend on the report contract, not on trace internals.

<a id="s-stochastic"></a>
#### Stochastic testing

_stochastic · 5 findings_

<a id="f-stochastic--seed-only-artifact-paths-overwrite-narrowed-replay"></a>
##### HIGH — Seed-only artifact paths let a narrowed --scenario replay silently overwrite the full-run artifacts

- Category: `state-management` · Verification: `verified`
- Locations: `packages/core/src/stochastic/artifacts.ts:34-49`, `packages/core/src/stochastic/runner.ts:73-90`, `packages/core/src/stochastic/runner.ts:157-164`, `packages/core/src/stochastic/artifacts.ts:104-115`

**Problem:** buildStochasticArtifactPaths derives every output path from the run seed alone (stochastic-run-${seed}.json etc.). runStochasticTestSimulator builds those paths BEFORE it decides whether this is a full run or a single-scenario replay (scenarioPath set at runner.ts:82-90), and always writes to them at runner.ts:157. A replay of one scenario therefore produces a one-scenario run artifact at the exact same path as the original full run for that seed. assertRunArtifactsMatchPaths (artifacts.ts:104-115) cannot catch this: both derive from the same seed so run.artifacts always equals paths. The seed is the sole provenance key and it does not encode profile-vs-scenario scope.

**Impact:** An engineer reproducing a single hard-failure scenario with `just core-stochastic --seed X --profile review --scenario <path>` (the exact replay command the tool itself emits, report.ts:246-252) overwrites stochastic-run-X.json / dashboard-X.html with a coverage-poor, one-scenario run whose verdict is now 'useful_with_findings' or 'blocked' for the wrong reason. The promotion evidence for that seed is destroyed by the act of investigating it, and it looks legitimate because schema validation passes.

**Fix:** Make the artifact path a function of run scope, not just the seed: thread scenarioPath (or a run-scope discriminant full|scenario) into BuildStochasticArtifactPathsInput and include a slug of it in the filenames, or write narrowed replays to a distinct replay/ subdirectory. Parse-don't-validate the scope into the path builder so a scenario replay cannot address the full-run path at all.

<a id="f-stochastic--duplicated-report-render-verdict-machinery-vs-hellweek"></a>
##### LOW — Stochastic report/HTML/verdict layer is a parallel copy of the hellweek report layer instead of a shared reporting core

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/stochastic/htmlReport.ts:336-371`, `packages/core/src/stochastic/report.ts:127-146`, `packages/core/src/hellweek/htmlReport.ts:47-64`, `packages/core/src/hellweek/htmlReport.ts:506`, `packages/core/src/hellweek/jasmineReport.ts:1-40`

**Problem:** The stochastic subsystem reimplements, byte-for-byte in places, concepts the hellweek subsystem already owns: escapeHtml (stochastic htmlReport.ts:364-371 vs hellweek htmlReport.ts:506), verdictTone / verdict->tone->CSS mapping (stochastic htmlReport.ts:336-346 vs hellweek htmlReport.ts:47-64), a bespoke HTML-string-concatenation report renderer with panels/bars/badges, and a verdict-selection function (chooseVerdict, report.ts:127-146) that mirrors hellweek's verdict logic (blocked / mid / promote). Both subsystems answer the same domain question — 'run a battery, classify a verdict, emit an HTML+markdown report with replay commands' — with two independent implementations.

**Impact:** Shotgun surgery: an XSS fix, a verdict-tier rename (e.g. adding a fourth verdict), or a CSS/accessibility change to the report shell must be made in two places and will drift. The stochastic escapeHtml and hellweek escapeHtml can silently diverge on entity coverage, so one report becomes injection-safe and the other does not. New engineers cannot tell these are meant to be the same thing.

**Fix:** Scope the fix to the one genuinely-shared leaf utility: escapeHtml. It is byte-for-byte identical in FOUR core files (stochastic/htmlReport.ts:364, hellweek/htmlReport.ts:506, hellweek/jasmineReport.ts:214, hellweek/stability.ts:526); entity-coverage drift is a real correctness hazard. Hoist one shared escapeHtml into a core module and import it from all four. Do NOT build a broader reporting kernel with a shared verdict->tone table or panel primitives — the two subsystems use different verdict vocabularies and CSS token sets, and chooseVerdict shares only a three-tier shape; sharing those couples distinct domains and is premature abstraction.

<a id="f-stochastic--finding-category-primitive-obsession"></a>
##### LOW — StochasticFinding.category is an unconstrained string while hard-failure categories are a closed union

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/stochastic/evaluate.ts:437-473`, `packages/core/src/stochastic/evaluate.ts:278-352`, `packages/contracts/src/schemas.eval.ts:287-295`

**Problem:** addFinding types category as bare `string` (evaluate.ts:439) and callers pass string literals like 'validator_rescued_unsafe_proposal', 'unexpected_final_action', 'missing_required_serving_mode' (evaluate.ts:279, 318, 335, 347, 362). The contract schema (schemas.eval.ts:288) also validates category as nonEmptyStringSchema. Meanwhile StochasticHardFailureCategory is a proper discriminated union with exhaustive switch handling (hardFailureMessage, evaluate.ts:475-494). Finding categories are the same kind of closed vocabulary but are modeled as free text.

**Impact:** Illegal states are representable: a typo'd category ('missing_requird_serving_mode') compiles, passes schema, and renders as a finding no downstream consumer can branch on. The dashboard's countBy/grouping and any future per-category thresholds cannot switch exhaustively, so a new finding category can be added without the compiler forcing every consumer to handle it. Verdict logic that treats 'findings.length > 0' uniformly hides this today, but any per-category policy will be built on stringly-typed data.

**Fix:** Promote the finding categories to a StochasticFindingCategory union in contracts (mirroring StochasticHardFailureCategory), type addFinding and the schema against it, and let the exhaustive switch guarantee every category has a handler. This makes illegal categories unrepresentable at the boundary.

<a id="f-stochastic--grouped-finding-scenariopaths-leaky-abstraction"></a>
##### LOW — scenarioPaths (grouped-finding) is a first-class schema and render concept the evaluator never produces

- Category: `abstraction` · Verification: `verified`
- Locations: `packages/contracts/src/schemas.eval.ts:291`, `packages/core/src/stochastic/htmlReport.ts:196-198`, `packages/core/src/stochastic/htmlReport.ts:296-297`, `packages/core/src/stochastic/report.ts:233-239`, `packages/core/src/stochastic/report.ts:357-362`

**Problem:** StochasticFinding has both scenarioPath (singular) and scenarioPaths (plural array), and htmlReport.ts + report.ts carry three-way fallback logic everywhere a finding scope is rendered (finding.scenarioPath ?? finding.scenarioPaths?.slice(0,3).join... ?? 'run', htmlReport.ts:196-198; report.ts:359 join; report.ts:237 map). But evaluate.ts's addFinding only ever sets scenarioPath (singular) — nothing in this subsystem emits scenarioPaths. The plural branch is a speculative 'grouped findings across scenarios' abstraction with no producer.

**Impact:** Every reader of a finding pays the cost of a discriminated-union-that-isn't: three-branch scope resolution duplicated across the markdown renderer, HTML risk panel, and HTML finding item, all defending against a shape the evaluator cannot create. It is premature abstraction that makes the data model ambiguous (which of the two fields is authoritative when both are set?) and invites divergent handling — the HTML risk panel slices to 3 (htmlReport.ts:197) while the finding item joins all (htmlReport.ts:297).

**Fix:** Either make grouping real — add an evaluator pass that aggregates same-category findings into one grouped finding and drop the singular field for grouped output — or delete scenarioPaths from the schema and collapse the renderers to a single scenarioPath. Do not keep a two-field union with only one producer; pick one representation and make the other unrepresentable.

<a id="f-stochastic--runner-swallows-scenario-error-into-conflated-hard-failure"></a>
##### LOW — Runner collapses any processTurn exception into a single opaque replayability_loss, losing failure provenance

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/core/src/stochastic/runner.ts:100-140`, `packages/core/src/stochastic/evaluate.ts:56-63`, `packages/core/src/stochastic/evaluate.ts:394-414`

**Problem:** In the turn loop (runner.ts:100-128) any exception from processTurn is caught, stored as scenarioError, and the loop breaks. evaluate.ts:56-63 then maps every such error — a planner crash, a validator bug, an OpenAI transport failure, a schema-parse throw — to the single category 'replayability_loss' with message 'Scenario replay crashed'. Distinct failure modes with very different meanings (the engine is broken vs. the run was non-deterministic vs. the network flaked) all become the same hard-failure category. addHardFailure's dedup keyed on (category, scenarioPath, turnIndex) with turnIndex undefined (evaluate.ts:405-411) further collapses multiple run-level crashes in one scenario into one entry.

**Impact:** Diagnosability loss and misclassification: a genuine engine defect surfaces to the verdict as 'lost replayability', pointing the operator at replay metadata rather than the real crash. Because the category is shared with legitimate replay-metadata failures, you cannot tell from the artifact whether the run was non-deterministic or the planner threw. The verdict correctly blocks (report.ts:133) but the reason is wrong, sending investigation the wrong direction.

**Fix:** Distinguish an execution/engine failure from a replayability failure: add a hard-failure category (e.g. scenario_execution_error) for caught processTurn exceptions and keep replayability_loss for the missing-metadata/no-traces cases. Preserve the error class/message as structured provenance rather than only string-formatting it, and don't dedup run-level failures on an undefined turnIndex.

<a id="s-validator-audit"></a>
#### Validator + route audit

_validator-audit · 6 findings_

<a id="f-validator-audit--duplicated-safety-taxonomy-drift"></a>
##### MED — routeAudit re-hardcodes the safety-flag taxonomy instead of sharing the validator's canonical sets

- Category: `coupling` · Verification: `verified`
- Locations: `packages/core/src/routeAudit.ts:131`, `packages/core/src/routeAudit.ts:138`, `packages/core/src/routeAudit.ts:143`, `packages/core/src/policy.ts:43`, `packages/core/src/policy.ts:52`

**Problem:** routeAudit.ts inlines its own copies of the domain classification vocabulary that the validator/policy layer already owns: `servingModes` (line 131) duplicates the `servingModeSchema` enum in contracts; `stateCarryoverFlags` (line 138: account_specific_request, change_request) is an exact re-hardcoding of policy's exported `handoffSafetyFlags` (policy.ts:52); and `humanSupportSignals` (line 143) is `vulnerabilitySafetyFlags` (policy.ts:43) plus `language_barrier`. These are string-literal sets, not references to the exported constants, so the two files silently diverge. The audit even lives in the same `packages/core/src` directory as the validator that produces the traces it reads.

**Impact:** Shotgun surgery and silent classification drift. When someone adds a new handoff-family flag (e.g. a future `account_closure_request`) to policy's `handoffSafetyFlags`, the validator carries it correctly but routeAudit's `stateCarryoverFlags`/`state_leak.carryover_on_answer` detector and `normalizeCurrentSafetyFlags` stripping (line 687) keep using the stale set — the audit stops flagging the exact leak class it exists to catch, with no compile error and no test failure. The audit becomes quietly wrong about live-lab evidence, which the memory note says is the ~100x proof surface.

**Fix:** Have routeAudit import `handoffSafetyFlags`, `vulnerabilitySafetyFlags`, and the serving-mode set from the shared policy/contracts module and derive its Sets from them (e.g. `humanSupportSignals = new Set([...vulnerabilitySafetyFlags, 'language_barrier'])`). One source of truth for the taxonomy; a `satisfies readonly SafetyFlag[]` gate already exists on the policy side to keep it honest.

<a id="f-validator-audit--override-vs-decline-implicit-contract"></a>
##### MED — Guard pipeline mixes 'override' and 'passthrough decline' semantics through a nullable return with no type distinction

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/validator.ts:91`, `packages/core/src/validator.ts:186`, `packages/core/src/validator.ts:690`, `packages/core/src/validator.ts:719`, `packages/core/src/validator.ts:747`

**Problem:** A `TurnGuard` returns `ValidatedPlanFragment | null`, where `null` means 'decline, run the next guard' and a fragment means 'stop, this is the answer'. But several guards return a fragment that is a near-clone of `base` used purely to *mutate accumulated state and still terminate* rather than to render a final decision. `guardInternalDataExposure` (line 202) returns a base-derived fragment that only adds a flag; `guardOutOfDomainFallback` (line 707) returns a fragment that rewrites finalAction to 'fallback'; `guardVulnerabilityRoute` (line 728) returns `acceptPolicyRoute(base)` which is a pass-through-with-flags. The single nullable return conflates 'I am the final authority', 'I accept the current plan but annotate it', and 'not my concern'.

**Impact:** Adding or reordering a guard is high-risk: an author who reads the pipeline as first-match-wins will not realize that `guardVulnerabilityRoute` and `guardNonAnswerServingMode` can *accept and terminate* on a plan they consider already-compliant, so any backstop guard placed after them (grounding, ui-action-match) is skipped for those routes. The ORDER-IS-A-SAFETY-INVARIANT comment (line 92) documents the hazard but the type system does nothing to enforce that a compliant-route acceptance still runs downstream sanity guards.

**Fix:** Make the guard outcome a discriminated union: `{ kind: 'decline' } | { kind: 'override', fragment } | { kind: 'accept', fragment }`, and let the runner decide whether 'accept' short-circuits or continues to a fixed set of terminal invariant guards (grounding/ui-match). This makes 'is this decision final?' a checked property instead of tribal knowledge pinned by one ordering test.

<a id="f-validator-audit--guard-body-boilerplate-envy"></a>
##### MED — Every guard hand-assembles the same detect -> buildCopy -> applyOverride shape, leaking copy-builder structure into 12+ near-identical bodies

- Category: `abstraction` · Verification: `verified`
- Locations: `packages/core/src/validator.ts:385`, `packages/core/src/validator.ts:416`, `packages/core/src/validator.ts:451`, `packages/core/src/validator.ts:520`, `packages/core/src/validator.ts:280`

**Problem:** The boundary/handoff guards (`guardSecondaryBorrowingAdvice`, `guardCreditCheckEvasion`, `guardApprovalEstimateAdvice`, `guardApprovalStatusHandoff`, `guardPaymentLink`, etc.) are structurally identical: run one `detect*` predicate on `userMessage`, build a fixed copy object, then call `applyOverride` with a hardcoded code/reason and a replacement object that copies `action`/`customerMessage`/`ui`/`requestedFields` field-by-field off the copy result, plus a fixed extra safety flag. The per-guard variation is pure data (predicate, code string, reason, copy builder, extra flags, serving mode), yet each is re-expressed as imperative wiring.

**Impact:** Feature-envy on the copy builders plus copy-paste risk: the replacement spread (`requestedFields: handoff.requestedFields`, `collectedFacts: {}`, `selectedServingMode: ...`) is retyped in every guard, so an omission (e.g. forgetting `collectedFacts: {}` in a new boundary guard) silently leaks the planner's collected facts through a refusal — a real safety regression that no signature change would catch. Adding a new boundary rule means writing ~30 lines of ceremony where 6 lines of data would do.

**Fix:** Introduce a declarative `messageBoundaryGuard({ detect, code, reason, buildCopy, servingMode, extraFlags })` factory for the uniform message-triggered boundary/handoff cases and keep only the genuinely stateful guards (grounding, out-of-domain, vulnerability route, ui-match) as bespoke functions. This collapses the repeated wiring into one audited path and makes the fact-clearing invariant unforgettable.

<a id="f-validator-audit--stringly-typed-routeaudit-model"></a>
##### MED — routeAudit models actions and flags as bare strings, discarding the discriminated unions the validator emits

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/routeAudit.ts:57`, `packages/core/src/routeAudit.ts:62`, `packages/core/src/routeAudit.ts:662`, `packages/core/src/routeAudit.ts:199`

**Problem:** RouteAuditRow types `finalAction: string | null` and `safetyFlags: string[]` (lines 57, 62) even though the upstream contracts define `TurnAction` and `SafetyFlag` as closed enums. `deriveCurrentHandoffPending` (line 662) then compares this string against literals 'request_handoff_intake' / 'create_ticket' / 'escalate', and `normalizeCurrentSafetyFlags` (line 683) special-cases the literal 'answer'. These are the same closed vocabularies the validator consumes with real types, but the audit re-enters string-land.

**Impact:** Primitive obsession that defeats the compiler exactly where classification correctness matters. If `create_ticket` is ever renamed in the TurnAction enum, the validator side fails to compile and gets fixed; routeAudit's string comparison keeps matching the dead literal and quietly misclassifies handoff-pending, corrupting the finding counts that gate scoring. Typos in the flag literals (`stateCarryoverFlags`, `humanSupportSignals`) are equally unchecked.

**Fix:** Parse the ingested log/trace strings into `TurnAction`/`SafetyFlag` at the readTurnLog/parseTurnLogRow boundary (you already use `turnTraceSchema.safeParse` for traces at line 429 — extend the same parse-don't-validate discipline to the summary rows) and carry the typed values through the row model so literal comparisons are enum-checked.

<a id="f-validator-audit--safety-flag-recompute-divergence"></a>
##### LOW — guardOutOfDomainFallback recomputes 'genuine' safety flags with a subset of the sources buildGuardContext used, creating two answers to 'what are the flags?'

- Category: `state-management` · Verification: `verified`
- Locations: `packages/core/src/validator.ts:699`, `packages/core/src/validator.ts:146`, `packages/core/src/validator.ts:889`

**Problem:** buildGuardContext computes `allSafetyFlags` from five sources including `inferSafetyFlagsFromMatches(selectedMatch)` (line 146-152). guardOutOfDomainFallback then *re-derives* a parallel `genuineSafetyFlags` (line 699) from only four of those sources, deliberately excluding the retrieval-match source, to decide whether a spurious match should be ignored. The two flag computations live in different functions and share no helper, so the 'which sources count as genuine' rule is implicit in an inlined array literal.

**Impact:** When a new safety-flag source is added to `buildGuardContext` (say a future `inferSafetyFlagsFromHistory`), a maintainer will update `allSafetyFlags` and reasonably assume the out-of-domain backstop follows — but it silently won't, because it hand-lists its sources. The result is either an out-of-domain message that should have been backstopped getting released as a bare fallback, or vice-versa. The divergence is invisible at the call site.

**Fix:** Extract a named `genuineSafetyFlags(context)` (flags from message/signal/plan/explicit options, excluding retrieval) and define `allSafetyFlags = genuineSafetyFlags(...) ∪ matchFlags`. Both the context builder and the out-of-domain guard then reference the same predicate, making the 'retrieval doesn't count as genuine evidence' rule a single documented decision.

<a id="f-validator-audit--buildRouteAudit-god-function"></a>
##### LOW — buildRouteAuditArtifacts fuses input resolution, per-row assembly, classification, aggregation, and file I/O in one 130-line function

- Category: `god-object` · Verification: `verified`
- Locations: `packages/core/src/routeAudit.ts:153`, `packages/core/src/routeAudit.ts:174`, `packages/core/src/routeAudit.ts:237`, `packages/core/src/routeAudit.ts:279`

**Problem:** The single exported function (line 153-287) resolves inputs, reads and joins turn-log rows with per-scenario traces, builds every RouteAuditRow inline (a 60-line `.map`, lines 174-235), triggers classification, computes six aggregate count tables, resolves two output paths, and writes two files. Row-building, aggregation, and persistence are three separable concerns welded together; the only way to obtain the in-memory `RouteAuditReport` is to also write JSON and Markdown to disk.

**Impact:** The report cannot be computed without side effects, so any caller that wants the audit object (a test, a live-lab evidence pipeline that streams instead of writing, an in-process check) is forced through filesystem writes. The inline row-map also mixes null-coalescing precedence logic (turnRow vs trace fallback, lines 189-197) with schema assembly, so a change to trace/log precedence means editing the same function that owns I/O — raising the blast radius of every edit.

**Fix:** Split into pure `computeRouteAudit(inputs): RouteAuditReport` (resolve -> rows -> classify -> aggregate) and a thin `writeRouteAuditArtifacts(report, paths)`. Extract the per-row assembly into a `buildAuditRow(turnRow, trace, scenario)` function. buildRouteAuditArtifacts becomes an orchestrator; the report becomes testable and reusable without disk.

<a id="s-lab-cli"></a>
#### CLI + lab server

_lab-cli · 5 findings_

<a id="f-lab-cli--command-dispatch-shotgun-surgery"></a>
##### MED — Command dispatch is a hand-maintained if-ladder with a parallel help registry and a per-command function triad

- Category: `extensibility` · Verification: `verified`
- Locations: `packages/core/src/cli.ts:124`, `packages/core/src/cli.ts:129`, `packages/core/src/cli.ts:1632`

**Problem:** runCli dispatches 17 subcommands via a flat if (command === "...") ladder (lines 129-189). The command surface is duplicated in three unrelated places that must be edited together for every command: the dispatch ladder, the hand-written helpText() command list (lines 1636-1651), and a per-command cluster of runX / xHelpText / xSummary functions. server.ts already models its HTTP routes as a declarative Route<Context>[] table (server.ts:389, 414), so the codebase has the registry pattern but the CLI does not use it. The ladder also does string matching with no shared notion of a command object, so --help is special-cased at the top instead of being a property of each command.

**Impact:** Adding or renaming a subcommand is shotgun surgery: forget to update helpText() and the CLI silently ships an undocumented command (this has low blast radius but is a guaranteed drift source); forget a dispatch branch and the command falls through to "Unknown command". There is no single place to enumerate commands for tests, tab-completion, or docs, and no compile-time guarantee that a command in the ladder has help text.

**Fix:** Introduce a Command registry mirroring the existing Route table: an array of { name, run, help } records keyed by command string. Dispatch, --help/-h handling, and the top-level helpText() command list all derive from that one array. This is proportionate (the Route pattern is already in the repo) and collapses three edit sites to one.

<a id="f-lab-cli--two-arg-parsing-idioms"></a>
##### MED — Two divergent arg-parsing idioms; the dominant one silently swallows typo'd and unknown flags

- Category: `consistency` · Verification: `verified`
- Locations: `packages/core/src/cli.ts:1585`, `packages/core/src/cli.ts:719`, `packages/core/src/cli.ts:1324`, `packages/core/src/cli.ts:1560`

**Problem:** The CLI mixes two incompatible option parsers. stochastic and route-audit use a switch-based scanner (parseStochasticArgs:1324, parseRouteAuditArgs:1395) with readRequiredOptionValue (1560), which validates that a flag has a value and throws on unknown --flags. Every hell-week command instead uses the loose readOption (1585) / readRestOption (1596), which does args.indexOf(name) and grabs the next token with no validation and no unknown-flag rejection. readOption also mis-parses --flag --nextflag: readOption returns undefined when the value starts after the trimmed next token, but a value like --db --json will consume --json as the URL.

**Impact:** In the loose commands a typo such as --concurency 8 or --databse-url ... is silently ignored and the default is used, so an operator running hell-week-review believes they set concurrency/DB when they did not — a wrong result presented as correct, which is exactly the failure class this project treats as a net-negative. The two idioms also mean a contributor cannot predict whether an unknown flag errors or is dropped.

**Fix:** Pick one parser. Promote the switch/readRequiredOptionValue style (it already rejects unknown flags and missing values) into a small shared option-spec helper, and route the hell-week commands through it. At minimum, make unknown --flags fail closed everywhere.

<a id="f-lab-cli--hellweek-plumbing-duplication"></a>
##### LOW — DB-URL resolution, judge-model triad, and theme/concurrency validation are copy-pasted across hell-week commands

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/cli.ts:730`, `packages/core/src/cli.ts:836`, `packages/core/src/cli.ts:941`, `packages/core/src/cli.ts:988`

**Problem:** The same option-resolution blocks are repeated verbatim across runHellWeekCommand, runHellWeekReviewCommand, runHellWeekJudgeCommand, and runHellWeekJudgeCalibrationCommand: the three-way databaseUrl fallback (readOption --database-url ?? --db ?? readHellWeekDatabaseUrl(env)) appears at 730, 832, 1030; the judge-model triad (judgeModel/verifierModel/finalAdjudicatorModel via readOption ?? readHellWeekJudgeModel(env) etc.) appears at 836-843, 941-948, 987-994; and the theme in (minimal|jasmine) and positive-integer concurrency checks are re-implemented per command (742, 852-864, 866).

**Impact:** Shotgun surgery: adding a fourth judge tier, changing the DB-URL precedence, or adding a new theme requires editing three or four call sites in lockstep, and they already drift (only some commands validate --judge-concurrency, only some validate --theme). A precedence bug fixed in one command silently persists in the others.

**Fix:** Extract a resolveHellWeekCommonOptions(normalized, env) that returns the parsed { databaseUrl, judgeModels, theme, concurrency } with validation, and have each hell-week command consume it. This is a genuine shared abstraction (four real callers), not premature.

<a id="f-lab-cli--demo-handler-prologue-and-logging-shotgun"></a>
##### LOW — Every demo handler re-implements the body-parse / state-load / interaction-log prologue as inline imperative code

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/core/src/lab/server.ts:646`, `packages/core/src/lab/server.ts:792`, `packages/core/src/lab/server.ts:739`, `packages/core/src/lab/server.ts:886`

**Problem:** The demo route handlers (handleDemoMessage:646, handleDemoIntake:792, handleDemoReset:739, handleDemoCancel:886) each repeat the same choreography by hand: readJsonBody + undefined guard, loadDemoState + null guard, do work, persistDemoState, then a bespoke recordDemo* call that must be threaded with createdAt/startedAt/method/pathname and a manually recomputed durationMs (Date.now() - startedAt) at every exit including each 400 branch (671, 828). Interaction logging is a cross-cutting concern implemented as duplicated inline statements rather than a wrapper around the handler.

**Impact:** Shotgun surgery and silent gaps: a new demo route, or a change to what gets logged (e.g. adding a field, or logging on a new error branch), must be manually replicated across every handler and every early-return, and it is easy to add an error return that forgets its recordDemoError (the invalid-message path already had to hand-duplicate it at 671). Duration/timing correctness depends on every author remembering the Date.now()-startedAt pattern.

**Fix:** Extract only the uniform choreography into a small helper, not a logging decorator over a discriminated result. A `parseDemoRequest(ctx)` that runs readJsonBody + undefined-guard and loadDemoState + null-guard and returns `{ body, session } | undefined` collapses the identical prologue in all four handlers. For timing, compute `durationMs` once (e.g. a `ctx.elapsedMs()` closure over startedAt) so no author re-types `Date.now() - startedAt` at each exit. Leave the recordDemo* calls inline in each handler, since their payloads legitimately differ — do not force a five-way discriminated result type and a dispatch switch just to centralize them. This removes the repeated body/state/timing boilerplate (the actual duplication) without adding a leaky abstraction over divergent log shapes.

<a id="f-lab-cli--fat-context-bag-threading"></a>
##### LOW — Request dependencies are threaded as a 10+-field destructured bag re-listed at every hop

- Category: `coupling` · Verification: `verified`
- Locations: `packages/core/src/lab/server.ts:143`, `packages/core/src/lab/server.ts:273`, `packages/core/src/lab/server.ts:87`

**Problem:** createLabServer closes over corpus/plannerFactory/signalExtractor/idFactory/now/flags/secrets/log/assets and then re-passes the whole set into handleRequest as an inline-typed object (143-175), which re-passes a subset into handleDemoRequest (273-299), which builds DemoRouteContext (303-319). The same ~12 fields are spelled out as a parameter, as an inline type literal, and as a destructure at each of three layers. handleRequest and handleDemoRequest also each contain a near-identical route-walking loop (241-265 vs 321-345) that differs only in the route table and context shape.

**Impact:** Adding one dependency (say a rate limiter or clock override) edits at least six sites: the options interface, the closure destructure, both function signatures, both inline type literals, and both context constructors. The duplicated dispatch loop means a routing fix (e.g. trailing-slash handling, HEAD support) must be applied twice or the two APIs diverge.

**Fix:** Define one ServerDeps type constructed once in createLabServer and passed by reference (not re-destructured) through the layers; make the per-request context = { ...deps, request, response, conversationRef }. Extract the route-walking loop into a single dispatch<Ctx>(routes, ctx, method, pathname) generic used by both tables.

<a id="s-nuxt-frontend"></a>
#### Nuxt site — components/pages

_nuxt-frontend · 5 findings_

<a id="f-nuxt-frontend--chatwidget-god-component"></a>
##### MED — ChatWidgetPanel is a god component fusing two transports, two session lifecycles, offer rules, seam state, persistence, and view

- Category: `god-object` · Verification: `verified`
- Locations: `packages/site-nuxt/components/ChatWidgetPanel.vue:279`, `packages/site-nuxt/components/ChatWidgetPanel.vue:753`, `packages/site-nuxt/components/ChatWidgetPanel.vue:796`, `packages/site-nuxt/components/ChatWidgetPanel.vue:895`

**Problem:** A single ~1200-line `<script setup>` owns: two distinct transports (JSON `$fetch` to the ipoc engine at 959-963 plus a hand-rolled SSE reader/decoder to the concierge at 796-869), two independent session lifecycles (`ensureSession`/`ensureConciergeSession` at 753-772), the deterministic offer business rules (`applyOfferEligible`, `replyAlreadyLinksApplication`, telemetry->context mapping at 683-751), the seam-brain state machine (`noteSeamBrain` at 454-466), sessionStorage persistence (580-637), scroll/animation state (560-573), and the whole rendering surface. None of these concerns can be tested, reused, or reasoned about in isolation.

**Impact:** Any change to one concern forces a re-read of the entire file and risks the others: e.g. adjusting the SSE frame parser (831-859) sits 400 lines from the persistence schema (582-595) it must stay consistent with (both must agree on which fields survive a reload). Onboarding cost and merge-conflict surface are high, and the review-widget parity mandate (comment at 305-307) is impossible to verify against a monolith. This is the single largest maintainability liability in the subsystem.

**Fix:** Extract the transport+session layer behind a small composable seam, e.g. `useChatTransport()` returning `sendEngineTurn()` / `sendConciergeTurn()` with a common `{ text, onDelta }` shape, and a `useChatPersistence()` composable owning the sessionStorage schema. The component keeps view + wiring only. This is a Humble-Object / composable-extraction split, not new abstraction layers.

<a id="f-nuxt-frontend--submit-dual-pipeline-branch"></a>
##### MED — submit() forks into two whole inline request/stream/offer pipelines with duplicated stream-finalization

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/site-nuxt/components/ChatWidgetPanel.vue:895`, `packages/site-nuxt/components/ChatWidgetPanel.vue:918`, `packages/site-nuxt/components/ChatWidgetPanel.vue:934`

**Problem:** `submit()` switches on `usesConcierge` and inlines two completely different flows in one function body. The concierge branch (912-957) hand-manages the streaming message bubble: the 'find the streaming message by id, else push a new one and record its id' block appears once inside the onText callback (922-931) and again verbatim on final reply (935-945). The engine branch (959-979) is a different shape entirely. Offer/nav/handoff assignment logic is then repeated in three places with different rules (947-956 vs 971-979 vs onIntakeSubmit).

**Impact:** The duplicated streaming-finalize is a correctness trap: a fix to how a partial bubble is reconciled (e.g. the empty-final-message guard) must be applied in both spots or the last delta and the final reply diverge. A future third surface (or a change to which surface serves which route) means editing this 100-line branch rather than adding a strategy. The `finally` reset of `isSending` (994) is shared but the two `try` bodies have no common contract.

**Fix:** Hoist a single `upsertStreamingMessage(text)` helper so the reconcile logic exists once, and give each surface a transport function with the identical `(text, onDelta) => Promise<reply>` signature so `submit` becomes: pick transport, stream, then run one offer-derivation step. Strategy-by-function, not a class hierarchy.

<a id="f-nuxt-frontend--welcome-text-identity-control-flow"></a>
##### MED — Welcome/message classification by string-equality against a growing legacy-constant list drives four behaviors

- Category: `primitive-obsession` · Verification: `verified`
- Locations: `packages/site-nuxt/components/ChatWidgetPanel.vue:507`, `packages/site-nuxt/components/ChatWidgetPanel.vue:491`, `packages/site-nuxt/components/ChatWidgetPanel.vue:774`, `packages/site-nuxt/components/ChatWidgetPanel.vue:522`

**Problem:** Message meaning is recovered by comparing `message.text` against a hardcoded set of welcome strings (`isWelcomeText`, 507-514), including two legacy constants kept solely so old persisted transcripts still classify (333-347). This identity check then gates starter-chip rendering (`showStarterChips` 491-501), resume-transcript filtering (`transcriptForResume` 785-788), and the context-swap on route change (`ensureContextWelcome` 522-528). `ChatMessage` carries only `role: 'customer' | 'assistant' | 'seam'` (309-314) with no notion of 'this is a welcome/system line'.

**Impact:** Every copy edit to a welcome string is a breaking change that must also append the old string to the legacy list, or restored transcripts silently mis-render (chips reappear, or a real user turn gets filtered out of resume context). The list only grows. A welcome that happens to equal user-typed text would be misclassified. This is domain state (message kind) smuggled through string comparison.

**Fix:** Add a `kind: 'welcome' | 'turn' | 'seam' | 'primer'` (or a `system: boolean`) field to `ChatMessage`, set at push time, and persist it. All four call sites test the field, not the text. The legacy-string list can then be retired behind a one-time migration of old persisted state.

<a id="f-nuxt-frontend--offer-state-parallel-refs"></a>
##### LOW — Four correlated offer refs model mutually-exclusive UI state as independent primitives, making illegal states representable

- Category: `state-management` · Verification: `verified`
- Locations: `packages/site-nuxt/components/ChatWidgetPanel.vue:409`, `packages/site-nuxt/components/ChatWidgetPanel.vue:414`, `packages/site-nuxt/components/ChatWidgetPanel.vue:947`, `packages/site-nuxt/components/ChatWidgetPanel.vue:1082`

**Problem:** The 'quick action attached to the last assistant message' is one logical slot, but it is spread across `applyOfferMessageId`, `handoffOfferMessageId`, `navOfferMessageId`, and `navOffer` (409-415). Their mutual exclusivity is enforced only by hand: every write site must null the other three. `submit` does this twice (947-956, 971-979), `reset` does it (1082-1085), and `goToApply`/`connectSupport`/`goToNavOffer` each clear a subset (710, 718-719, 728). The template then races three `v-if index === last && message.id === xOfferMessageId` blocks (158-212).

**Impact:** Nothing structurally prevents two offer ids pointing at the same last message, which would render two chips. Adding a new offer type is shotgun surgery: a new ref, a new clear in ~5 sites, and a new template block; forget one clear and a stale chip from a prior turn re-renders when the next message lands on the same id. The `nextId` counter never resets in `reset` (only `messages` is cleared), so message ids keep climbing — fine today, but the offer-id comparisons assume monotonic uniqueness that is coupled to that global.

**Fix:** Model it as one discriminated union on the last assistant message: `activeOffer: { kind: 'apply' | 'handoff' | 'nav'; messageId; payload } | null`. One write, one clear, one template switch. This makes the two-chips state unrepresentable and collapses the five clear-sites to one.

<a id="f-nuxt-frontend--telemetry-unvalidated-cast"></a>
##### LOW — Telemetry crosses the transport boundary as an unchecked cast and fails open into stored reveal-context

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/site-nuxt/components/ChatWidgetPanel.vue:659`, `packages/site-nuxt/components/ChatWidgetPanel.vue:737`, `packages/site-nuxt/components/ChatWidgetPanel.vue:683`

**Problem:** `emitTelemetry(telemetry: unknown)` immediately casts to `DemoDisplayTelemetry` and reads nested fields — `telemetry.safetyFlags`, `telemetry.retrieval.matches[0]`, `telemetry.intake.handoffPending`, `telemetry.finalAction` — in `contextForTelemetry` (737-751) and `applyOfferEligible` (683-692), with no parse step (659-664). The value comes from the ipoc server response (`result.assistant.telemetry`, 970). This is validate-by-assertion at a real network boundary.

**Impact:** If the server ever ships a telemetry shape missing `retrieval.matches` or `safetyFlags`, `applyOfferEligible` throws a TypeError mid-`submit`, which the outer catch (980) converts into a generic 'something went wrong' error banner even though the assistant reply already succeeded and was rendered — the user sees a good answer followed by an error. Worse for the offer path: a malformed `safetyFlags` that isn't an array means the safety-flag gate (687) throws or silently passes, so the apply-offer chip can appear on a turn that should have suppressed it. The parse-don't-validate boundary is missing exactly where a wrong answer has product consequences.

**Fix:** Parse the telemetry once at the boundary (a narrow runtime guard or the contracts schema) returning a typed value or `null`; on `null`, skip offers/context rather than throwing. Fail-closed on the offer decision. Keep it proportional — one guard function, reusing the `@loanslam/contracts` type.

<a id="s-planner-signals-contracts"></a>
#### Planner / signals / contracts

_planner-signals-contracts · 5 findings_

<a id="f-planner-signals-contracts--strict-mirror-duplicated-by-hand"></a>
##### MED — Strict-output schema mirror is a hand-maintained parallel copy of the canonical schema with no drift guard

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/planners/openaiPlanner.ts:102-147`, `packages/contracts/src/schemas.runtime.ts:59-118`, `packages/contracts/src/schemas.runtime.ts:261-280`

**Problem:** The OpenAI strict-mode 'lenient mirror' (openAiUiPlanSchema, openAiGroundingDecisionSchema, openAiTurnPlanOutputSchema) is a second, hand-written copy of the canonical turnPlanSchema/uiPlanSchema/groundingDecisionSchema. It flattens the discriminated UI union into one struct carrying every primitive's fields at once, restates every field, and is coupled to the canonical schema only by human diligence. Nothing fails at build time if the two drift.

**Impact:** Shotgun surgery: adding a field to the canonical turnPlanSchema (e.g. a new grounding field, a new UI primitive, a new intake field on a UI variant) silently fails to reach the model prompt unless the author also remembers to mirror it here and add a canonicalizer entry. The model then can never emit the new field, and the failure is invisible — output just lacks the data, no error. A new UiPrimitive added to the enum with no canonicalizer falls through normalizeUiPlan's `canonicalizer ? ... : ui` branch and hits turnPlanSchema.parse unnormalized, throwing on every turn that selects it.

**Fix:** Derive the strict mirror from the canonical schema instead of restating it. Either generate the flat mirror programmatically (walk the discriminated union, union the members' fields, swap optional->nullable) or add a compile-time exhaustiveness assertion: type-level `satisfies Record<UiPrimitive, ...>` already exists for uiPlanCanonicalizers, but there is no guard that the mirror's fields cover the canonical fields. Add a type-level assertion (as in schemas.eval.ts's AssertTrue pattern) that the normalized shape is assignable to the canonical input type, so drift breaks the build.

<a id="f-planner-signals-contracts--planner-parse-throws-no-typed-error"></a>
##### MED — Planner parse failures propagate as raw ZodError/Error across the boundary; no typed extraction-error result

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/core/src/planners/openaiPlanner.ts:85-88`, `packages/core/src/engine.ts:983-1000`

**Problem:** planTurn returns Promise<TurnPlan> and models failure only by throwing. turnPlanSchema.parse (line 85) throws a ZodError on any malformed model output; the transport can throw an OpenAI SDK error; both surface as an untyped exception. The contract has a rich SignalExtractionStatus discriminated union ('disabled'|'fulfilled'|'failed'|'timed_out') for the signal side, but the planner boundary has no equivalent — the caller must try/catch and string-sniff via plannerFailureReason to tell a schema-validation failure from a transport failure from a timeout.

**Impact:** The engine's recovery at engine.ts:985 collapses every planner failure into one 'planner_malformed_output' reason code regardless of whether it was a network timeout, an auth error, or genuinely malformed JSON. Operators triaging a production incident cannot distinguish 'model returned bad shape' (prompt/schema bug) from 'OpenAI was down' (transport) from the trace, because the type system threw that distinction away at the boundary. Adding a new failure mode (e.g. content filter) means more string matching, not a new union arm the compiler forces callers to handle.

**Fix:** Mirror the signal side's design: return a discriminated union result (parse-don't-throw at the boundary), e.g. `{status:'fulfilled', plan}` | `{status:'malformed', zodError}` | `{status:'transport_failed', error}`. Use turnPlanSchema.safeParse and classify transport vs parse explicitly so the engine switches on a typed status instead of catch+string-match.

<a id="f-planner-signals-contracts--collectedfacts-stringly-typed"></a>
##### MED — collectedFacts is a Record<string,string> where the domain has a fixed intake-field vocabulary

- Category: `type-design` · Verification: `verified`
- Locations: `packages/contracts/src/schemas.runtime.ts:176`, `packages/contracts/src/schemas.runtime.ts:274`, `packages/core/src/planners/openaiPlanner.ts:162-184`

**Problem:** conversationStateSchema.collectedFacts and turnPlanSchema.collectedFacts are typed z.record(z.string(), z.string()), but the prompt (prompt.ts:42) mandates a closed vocabulary of keys — fullName, dateOfBirth, postcode, email, phone, plus *_candidate variants — that exactly parallels intakeFieldSchema. The normalizer at openaiPlanner.ts:162-184 folds the model's key/value array into this open record with no key validation (`String(fact.key ?? '')`), so any hallucinated key is accepted verbatim.

**Impact:** Primitive obsession / stringly-typed data at a load-bearing state boundary. The engine's 'don't re-request already-collected fields' logic (prompt.ts:41) depends on collectedFacts keys matching intakeField keys exactly; a model that emits 'full_name' or 'e-mail' silently populates a fact that no requestedFields check will ever match, causing the bot to loop re-asking for a field the customer already gave. Because the type is open, the compiler cannot catch this and no schema rejects it.

**Fix:** Model the known keys explicitly: a partial record keyed by IntakeField (plus an explicit candidate variant type) for the standard fields, and if free-form facts are genuinely needed keep them in a separate, clearly-named field. At minimum validate/canonicalize keys against the intake vocabulary in normalizeCollectedFacts so unknown keys are dropped or normalized rather than silently trusted.

<a id="f-planner-signals-contracts--link-url-href-dual-optional"></a>
##### MED — ApprovedLink models URL as two independently-optional fields (url and href) with no invariant that one exists

- Category: `type-design` · Verification: `verified`
- Locations: `packages/contracts/src/schemas.runtime.ts:59-64`, `packages/core/src/planners/openaiPlanner.ts:104-108`, `packages/core/src/policy.ts:73-84`

**Problem:** approvedLinkSchema has both `url` and `href` as independently optional. Nothing in the schema requires at least one to be present, and nothing says what it means when both are set or differ. Downstream code copes by coalescing (policy.ts:74 `link.url ?? link.href ?? ''`), and the strict mirror carries both as nullable and strips nulls in normalizeLink. The 'which field holds the destination' question is answered ad hoc at every consumer.

**Impact:** Illegal states are representable: a link with neither url nor href passes validation, then isApplicationFormLink and every renderer silently treats its target as empty string. A link with url and href disagreeing has undefined semantics. New consumers must rediscover the `url ?? href` convention or they read the wrong field. This is exactly the 'make illegal states unrepresentable' failure — a required 'destination' is spread across two optional slots.

**Fix:** Collapse to a single required destination field (or a `.refine` requiring at least one of url/href with a documented precedence). If both names must be accepted on input for compatibility, normalize to one canonical field at the parse boundary so all downstream code reads exactly one field. Keep label required, destination required.

<a id="f-planner-signals-contracts--normalize-fail-open-silent-coercion"></a>
##### LOW — Signal normalizer silently coerces/masks malformed model fields, hiding extraction quality problems from the fail-closed backstop

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/core/src/signals/normalize.ts:27-70`, `packages/core/src/signals/openaiSignalExtractor.ts:110-111`

**Problem:** normalizeOpenAiParsedSignalBundle fails open: an out-of-enum recommendedServingMode becomes null (line 40-42), a NaN/missing uncertainty becomes 0.5 (clampUncertainty), any non-array becomes [] (normalizeStringArray). These coercions repair the model's mistakes so signalBundleSchema.parse succeeds, but the repair is invisible — parserNotes exists as a channel to record 'I had to coerce this' yet the normalizer never appends to it. A model that emits garbage for recommendedServingMode is indistinguishable downstream from a model that correctly emitted null.

**Impact:** Because the signal path is designed as a best-effort shadow, silent coercion means the comparison metrics (compareSignalToOutcome) treat a coerced-to-null serving mode as a legitimate 'no recommendation', masking a real extraction-quality regression. When routing precision is 'more time not a model swap' (per repo memory), the one telemetry channel that could reveal how often the extractor emits malformed fields is being swallowed by the normalizer's fail-open coercion. uncertainty defaulting to 0.5 also injects a plausible-looking middle value that pollutes any uncertainty-based analysis.

**Fix:** Keep failing open for robustness but make the coercions observable: when a field is coerced (out-of-enum serving mode, NaN uncertainty, non-array), push a note into parserNotes so the shadow comparison and dashboards can count coercion events. This turns a silent drop into a measured signal without changing the fail-open behavior.

<a id="s-engine-runtime"></a>
#### Runtime engine

_engine-runtime · 4 findings_

<a id="f-engine-runtime--handoff-rules-god-function"></a>
##### MED — applyHandoffStateRules is a god-function encoding the entire handoff state machine as ordered if-cascade

- Category: `god-object` · Verification: `verified`
- Locations: `packages/core/src/engine.ts:368-495`

**Problem:** applyHandoffStateRules is a single ~130-line function that folds together at least six distinct decisions: (1) whether to run free-text fact extraction, (2) urgent-risk escalation, (3) completed-handoff-plus-new-safety-intent, (4) generic completion, (5) progress-preservation (ask next field), (6) create_ticket gating, and (7) intake-form message/field rewriting. Each is a guard-clause return whose ordering is load-bearing and implicit: the 'new safety intent after create_ticket' branch (401-412) must precede shouldCompleteHandoffNow (414-424), which must precede the handoffPending progress branch (426-433). Nothing names or enforces this priority; it is encoded purely by statement order.

**Impact:** Adding a seventh handoff condition (e.g. 'partial facts submitted mid-form') is shotgun surgery with a landmine: inserting the new branch at the wrong point silently changes whether an existing case (completion vs. ask-next-field vs. re-ticket) fires, and there is no single place that lists the precedence to reason about. A reviewer cannot tell from the code why order matters, so a plausible reordering during refactor changes runtime routing.

**Fix:** Extract an explicit ordered rule pipeline: model each branch as a named HandoffRule { code, applies(ctx): boolean, build(ctx): fragment } and iterate a const ordered array, returning the first match. The precedence becomes data (the array order) with each rule's name visible, replacing implicit statement-ordering. This is the same 'chain of responsibility / first-matching-guard' shape validator.ts already uses for TurnGuard (validator.ts:91), so it also aligns the two halves of the engine on one idiom.

<a id="f-engine-runtime--handoff-complete-condition-scattered"></a>
##### LOW — Handoff-complete condition is computed in three different places with divergent rules

- Category: `cohesion` · Verification: `verified`
- Locations: `packages/core/src/engine.ts:414-424`, `packages/core/src/engine.ts:435-446`, `packages/core/src/engine.ts:455-462`, `packages/core/src/engine.ts:709-773`

**Problem:** 'Is the handoff complete enough to create a ticket?' is answered by at least four independent code paths that each recompute completeness with subtly different predicates. shouldCompleteHandoffNow (865-879) gates on handoffPending plus action/fact heuristics; the create_ticket branch (435-446) gates purely on missingStandardFields.length===0; the intake-form branch (455-462) re-checks the same length; and completeStructuredHandoff (709-773) bypasses all of it and just merges form fields and emits the ticket with no missing-field check at all. Each path also independently reconstructs the merged fact map (393-396, 503-506, 726-732).

**Impact:** The completion invariant ('a ticket is never created with a missing standard field') is not enforced in one place, so it can be violated per-path: completeStructuredHandoff (the structured form path) writes lastAction='create_ticket' even if the submitted fields object omits a standard field, because it only copies fields that are present and never checks standardHandoffFields coverage. A future change to what 'complete' means (e.g. postcode becomes optional) must be found and edited in four places or the paths silently diverge.

**Fix:** Introduce one pure predicate, e.g. handoffCompletion(facts): { complete: boolean; missing: IntakeField[] }, as the single source of truth, and route every completion decision (free-text and structured) through it. completeStructuredHandoff should call it and refuse/return-to-intake on missing fields rather than trusting the form payload. Consolidating the merged-facts construction into one helper removes the parallel reconstructions too.

<a id="f-engine-runtime--safety-flag-lifecycle-tangled"></a>
##### LOW — Safety-flag lifecycle is split across three ad-hoc merge/filter functions with mode-specific carve-outs

- Category: `state-management` · Verification: `verified`
- Locations: `packages/core/src/engine.ts:1190-1213`, `packages/core/src/engine.ts:1144-1164`, `packages/core/src/engine.ts:104`

**Problem:** How safety flags persist vs. reset across turns is governed by three functions with different, hardcoded per-action rules. mergeTraceSafetyFlags (1190-1213) decides trace flags: for action 'answer' with selectedServingMode 'answer' it filters out handoff-route flags, otherwise keeps them, and for refuse/fallback/ask_clarifying_question it drops accumulated state flags entirely. nextStateSafetyFlags (1144-1164) decides persisted flags with a different rule keyed on handoffPending and action. cancelHandoff (781-789) hard-resets to []. The 'which flags survive' logic is therefore duplicated and inconsistent between the trace surface and the persisted-state surface.

**Impact:** trace.safetyFlags (what evidence/telemetry sees) and nextState.safetyFlags (what the next turn routes on) are computed by separate rules over the same inputs, so they can disagree for the same turn — e.g. an ask_clarifying_question turn persists merged state flags (1156-1160) but the trace path for that action returns only validated.safetyFlags (1204-1208). Anyone debugging a mis-route from the trace is looking at a flag set that differs from the one that actually drove the next turn. A new safety flag added to a new action requires editing both functions in lockstep or state and trace silently drift.

**Fix:** Do not frame this as trace/state divergence — the code already derives nextState.safetyFlags from traceSafetyFlags (engine.ts:104, 125, 1133), so they cannot silently disagree via "separate rules over the same inputs." The real, narrower concern is shotgun surgery: safety-flag and handoff per-action branching is spread across mergeTraceSafetyFlags (1190), nextStateSafetyFlags (1144), nextHandoffPending (1166), and deriveEffectiveServingMode (331), so a new action must be threaded through all four consistently. Consolidate the per-action rules into a single action-keyed policy descriptor (e.g. {resetFlags, accumulateOnHandoff, effectiveMode}) consumed by these functions, and rename nextStateSafetyFlags to make explicit that it is an accumulation projection of the already-computed trace flag set, not an independent computation. Keep the intentional accumulate-across-clarifying-question behavior (documented at cancelHandoff, 775-789).

<a id="f-engine-runtime--fact-extraction-regex-in-engine"></a>
##### LOW — Free-text PII extraction (names, DOB, postcode, email, phone) lives inline in the engine, duplicating retrieval/policy regex responsibilities

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/core/src/engine.ts:612-625`, `packages/core/src/engine.ts:829-936`

**Problem:** The engine owns two nontrivial NLP concerns as inline regex batteries: urgent-risk detection with self-harm negation handling (612-655, 829-856) and structured PII fact extraction for all five intake fields (881-936). These are parsing/classification responsibilities, the same kind of work retriever.ts (term normalization) and policy.ts (intent/credential detection) each own for their domains — but here they are embedded directly in the turn orchestrator rather than behind a boundary. captureFact/cleanFactValue/extractHandoffFacts are a self-contained extractor with no dependency on turn state.

**Impact:** The orchestrator (processTurn and its handoff helpers) cannot be understood or changed without also reasoning about regex-level PII parsing and self-harm negation grammar, and vice versa. When postcode or phone formats need to change, or a locale is added, the edit lands inside engine.ts next to state-transition logic, raising the blast radius of every fact-format change to the core turn loop. It also means the engine holds a second, weaker fact source that competes with the signal extractor and the structured form for the same fields, with no shared parser.

**Fix:** Extract the fact/risk parsers into their own module (e.g. facts.ts exporting extractHandoffFacts and detectUrgentRisk) behind a small interface, so the engine consumes 'parse these fields from text' as a dependency the same way it consumes retrieveMatches and the SignalExtractor. This is a parse-at-the-boundary move: the engine orchestrates, the parser parses. It also creates the seam to later unify free-text extraction with the signal extractor instead of maintaining two.

<a id="s-hellweek-core"></a>
#### Hell Week — run/grade/aggregate

_hellweek-core · 4 findings_

<a id="f-hellweek-core--judge-drops-deterministic-content"></a>
##### MED — Judge path silently discards deterministic content violations for non-hard checks (fail-open on the merge)

- Category: `error-handling` · Verification: `verified`
- Locations: `packages/core/src/hellweek/grade.ts:376`, `packages/core/src/hellweek/grade.ts:391`

**Problem:** `mergeGrade` has three branches: hard-floor (deterministic wins), judge-present (judge is fully authoritative), and deterministic-only. In the judge branch (line 376-391) the merged grade is built purely from the judge verdict: pass = `judge.severity === 'fine'`, triageLabels come only from the judge, and every deterministic envelope/content failure is thrown away. So if a scenario has a non-hard content violation (e.g. `no_excluded_advice`, `no_offdomain_help`, `english_only`) or an envelope failure (wrong finalAction, forbidden serving mode, negation-flag miss) that the deterministic grader caught, and the judge returns `fine`, the authoritative grade is `pass` with no record of the deterministic failure. The comment frames this as intentional ('the advisory envelope's labels are the noise it is overruling'), but the merge keeps `deterministic` on the grade object only as inert data — nothing surfaces the disagreement.

**Impact:** A judge that is miscalibrated or prompt-drifted can green a scenario that deterministically violated a documented content backstop, and the report shows no trace of the conflict. Because live judged runs are the ship-gate, this is a fail-open path on exactly the checks the system claims to enforce. Debugging a 'why did this pass' regression requires manually diffing evidence.json against the judge verdict.

**Fix:** Make the merge record disagreement rather than silently drop it: when the judge overrules a deterministic failure, keep a `deterministicOverridden` marker (and the dropped labels) on the grade so the aggregate can count and display judge-vs-deterministic conflicts. This preserves 'judge is authoritative' while making the override auditable instead of invisible.

<a id="f-hellweek-core--regrade-scenario-substitution-silent"></a>
##### MED — renderFromRun silently substitutes current scenario definitions over captured ones, risking stale-run grade drift

- Category: `state-management` · Verification: `verified`
- Locations: `packages/core/src/hellweek/run.ts:271`, `packages/core/src/hellweek/run.ts:303`

**Problem:** `renderFromRun` re-grades a captured run using `currentScenariosForCapturedRun` (run.ts:303-316), which for each scenario in the prior report prefers the CURRENT `selectScenarios(profile)` definition (`currentById.get(scenario.id) ?? scenario`) over the one stored in the report. So re-grading an old evidence.json applies today's `expected` envelope, contentChecks, and severityFloor to yesterday's captured turns, with a silent per-scenario fallback to the stored definition only when the id no longer exists. The grade the engine emits for a captured run therefore depends on the working tree's scenario source at render time, not on what was actually run.

**Impact:** Two people re-rendering the same run folder on different commits get different verdicts with no error and no marker in the report saying the scenarios were swapped. A tightened contentCheck can retroactively turn an archived 'ship_ready' run into 'blocked', or a loosened one can whitewash a historical failure, undermining the run folder as durable evidence. The `?? scenario` fallback also means a run can be graded against a mix of current and captured scenario definitions in the same report.

**Fix:** Make the substitution explicit and opt-in: default `renderFromRun` to grade against the scenarios embedded in the captured report (the evidence's actual contract), and if re-grading against current definitions is wanted, require an explicit flag and stamp the report with which scenario source was used plus any ids whose definitions changed. Evidence re-grading should be reproducible from the folder alone.

<a id="f-hellweek-core--failuremarkers-severityfloor-decorative"></a>
##### LOW — Taxonomy fields failureMarkers and severityFloor are carried through the whole pipeline but never enforced

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/hellweek/types.ts:118`, `packages/core/src/hellweek/types.ts:122`, `packages/core/src/hellweek/grade.ts:315`

**Problem:** Every scenario declares `failureMarkers: string` and `severityFloor: Severity` (types.ts:118-123), and each category file fills them in with care (e.g. `severityFloor: 'demo_killer'`). But no code in grade.ts, aggregate.ts, or run.ts reads `severityFloor` to bound or cross-check the computed severity, and `failureMarkers` is only persisted to the DB / packet — it is not fed into the deterministic grader. The actual demo_killer severity is derived solely from `hardContentChecks` membership (grade.ts:317) or the judge, entirely independent of the per-scenario `severityFloor`. So a scenario authored with `severityFloor: 'demo_killer'` but no hard content check and no judge will grade at most `dent`, contradicting its own declared floor, and nothing flags the contradiction.

**Impact:** Scenario authors get a false sense that setting `severityFloor: 'demo_killer'` makes a breach blocking; it does not. The field is documentation that looks like a contract. Over time authors tune these values expecting behavior changes that never occur, and reviewers cannot trust the field. This is primitive/decorative-field obsession at a safety boundary.

**Fix:** The core factual claim holds and is worth acting on, but the recommendation rests on a false premise and must be corrected. Two scenario fields are inert: `severityFloor` (types.ts:122) is written across ~14 category files and persisted to the DB (db.ts:398) but never read by gradeDeterministic/mergeGrade to bound or cross-check severity; `failureMarkers` (types.ts:119) is likewise persisted but not fed to any grader. So a scenario declaring `severityFloor: 'demo_killer'` with no hard content check and no judge grades at most `dent`, silently contradicting its own declared floor. That is a real decorative-contract / primitive-obsession smell at the grading boundary.\n\nHowever, the finding's stated rationale is wrong on a load-bearing point: it claims severityFloor/failureMarkers "feed the judge packet" and concludes "promoting it to an enforced floor is the higher-value option" because of that. openaiJudge.test.ts:149-150 explicitly asserts the judge input contains NEITHER field (alongside `expected`), and openaiJudge.ts does not reference them — the judge deliberately excludes answer-shaped hints to avoid leaking the expected verdict. The doc comment at types.ts:118 ("handed to the LLM judge") is itself stale/false. Do not build a recommendation on the judge-packet premise.\n\nThe real enforced safety mechanism is `hardSafetyViolations` (grade.ts:302-304, 317-318) via `hardContentChecks`, which works. `severityFloor` is closer to author-facing annotation than a live safety invariant, so the 'safety boundary' framing and medium severity are inflated; low is honest.\n\nProportionate fix: prefer deleting `severityFloor` and `failureMarkers` from the type/scenarios/DB (they advertise contracts the engine does not honor), OR, if authors want the floor enforced, add a single grade-time assertion/clamp — a scenario with `severityFloor: 'demo_killer'` must have a backing hard content check or a judged path, else fail author-time validation. Either way, fix the false doc comment at types.ts:118. Enforcing the floor as a runtime clamp on merged severity is over-engineering for what is currently an annotation; validate-at-authoring is the cheaper, higher-signal option. (Note: dead-code aspects of these fields belong to the separate cleanup review; the design point here is the advertised-but-unenforced contract.)

<a id="f-hellweek-core--judge-source-union-leaky"></a>
##### LOW — JudgeVerdictSource union forces the same disambiguation (Map vs LoadedJudgeVerdicts) at every call site

- Category: `abstraction` · Verification: `verified`
- Locations: `packages/core/src/hellweek/run.ts:34`, `packages/core/src/hellweek/run.ts:396`, `packages/core/src/hellweek/run.ts:406`

**Problem:** `JudgeVerdictSource = Map<string, JudgeVerdict> | LoadedJudgeVerdicts` (run.ts:34) is an untagged union of two shapes that mean the same thing (a set of verdicts) at different fidelity. Every consumer must re-run the same `source instanceof Map ? ... : source.verdicts` disambiguation: `judgeVerdictMap` (line 403), `judgeReportMetadata` (line 419: `if (!source || source instanceof Map)`), and callers reason about `source.metadata` / `source.artifact` only in the non-Map arm. The Map arm is a degenerate LoadedJudgeVerdicts with no metadata, expressed as a structurally different type rather than as `{ verdicts, metadata: undefined }`.

**Impact:** Adding any new field derived from judge metadata (as `judgeReportMetadata` already does for ~15 optional fields) requires every branch to re-handle the Map case, and it is easy to forget the Map arm and dereference `source.metadata` on a raw Map. The union leaks the 'was this loaded from an artifact or handed in as a bare map' distinction into unrelated call sites.

**Fix:** Collapse to the single `LoadedJudgeVerdicts` shape at the boundary: wrap any incoming bare `Map` into `{ verdicts }` once at entry, and have internals accept only `LoadedJudgeVerdicts`. This removes the repeated `instanceof Map` disambiguation and makes 'no metadata' a normal `undefined` field rather than a distinct type.

<a id="s-hellweek-reports-taxonomy"></a>
#### Hell Week — reports/taxonomy

_hellweek-reports-taxonomy · 4 findings_

<a id="f-hellweek-reports-taxonomy--categories-as-code-not-data"></a>
##### MED — Scenario taxonomy is 13 near-parallel code modules where it should be data

- Category: `shotgun-surgery` · Verification: `verified`
- Locations: `packages/core/src/hellweek/categories/index.ts:5-33`, `packages/core/src/hellweek/categories/categoryB.ts:5-205`, `packages/core/src/hellweek/categories/categoryF.ts:5-182`

**Problem:** The A-M battery is 13 hand-written TypeScript array modules (categoryA..categoryM), each a flat list of scenario object literals, aggregated by a hardcoded 13-import spread in categories/index.ts. Every scenario re-states its `category` letter and the full `categoryTitle` string on every element (categoryF.ts repeats 'F. Vulnerability, Hardship, Complaint, Legal, Accessibility' 10 times; categoryB repeats its title 11 times). The header comment justifies the split as parallel authoring to avoid merge churn, but the data is homogeneous — there is no per-category behavior, only rows.

**Impact:** Adding or renaming a section is shotgun surgery: create a new categoryN.ts, add an import line and a spread entry to index.ts, and never miss one — a forgotten spread silently drops a whole section from every run with no error. Renaming a section title means editing the same literal on every row of that file, and any single-row typo produces a split section in the 'By section' table (sectionTable groups by `category` but labels by the first grade's `categoryTitle`, so a mismatched title on one row is invisible until it corrupts a report). This is data masquerading as code.

**Fix:** Model the taxonomy as data: a single `categories` table (id/letter -> title -> scenario rows) so the title lives in exactly one place and rows carry only `categoryId`. Derive `categoryTitle` at load time rather than storing it per row. If the physical file split must stay for authoring ergonomics, at minimum give each module a `defineCategory({ id, title, scenarios })` helper that stamps the title onto rows once, eliminating per-row title repetition and making a dropped category a type error.

<a id="f-hellweek-reports-taxonomy--renderer-duplication-shared-helpers"></a>
##### MED — Two HTML renderers duplicate escaping, duration, and category-ordering logic

- Category: `duplication` · Verification: `verified`
- Locations: `packages/core/src/hellweek/htmlReport.ts:488-513`, `packages/core/src/hellweek/jasmineReport.ts:195-221`

**Problem:** htmlReport.ts and jasmineReport.ts are separate renderers of the same HellWeekReport, and both privately redefine identical primitives: `escapeHtml` (htmlReport.ts:506 vs jasmineReport.ts:214, byte-identical), `formatDuration` (htmlReport.ts:500 vs jasmineReport.ts:204, with a subtle divergence — the Jasmine copy prints `(ms/1000).toFixed(3)` seconds while the main copy rounds), and the category-ordering rank (`categoryRank` at htmlReport.ts:488 vs `rank` at jasmineReport.ts:195, both encoding `smoke ? -1 : charCodeAt(0)`). Both also rebuild the same `Map<string, HellWeekGrade[]>` grouping-by-category (htmlReport.ts:343-348 vs jasmineReport.ts:86-91).

**Impact:** The escaping and ordering rules are load-bearing invariants that now live in two places. A future contributor who fixes an escaping gap or changes section ordering in one renderer will not know the other exists; the two report surfaces will silently disagree. The formatDuration copies have ALREADY drifted, so the same run renders durations differently depending on which report you open.

**Fix:** Extract the shared, presentation-neutral helpers (escapeHtml, formatDuration, category rank, group-grades-by-category) into a small `reportShared.ts` and have both renderers import them. This is not the same as deduping the demo/review widgets (which are deliberately separate UIs) — these are internal pure functions with no product-identity reason to diverge.

<a id="f-hellweek-reports-taxonomy--category-primitive-obsession"></a>
##### LOW — Category and profile-selection modeled with stringly-typed sentinels that make illegal states representable

- Category: `type-design` · Verification: `verified`
- Locations: `packages/core/src/hellweek/types.ts:105-130`, `packages/core/src/hellweek/scenarios.ts:216-253`

**Problem:** `HellWeekScenario.category` is typed as bare `string` (types.ts:107) with the real constraint ('smoke or a battery section letter A-M') expressed only in a comment. Meanwhile `dimension` right beside it IS a discriminated union (StakeholderDimension). Profile selection compounds this: `HellWeekProfile.categories: string[]` uses empty-array-means-all as a sentinel (scenarios.ts:126-129 comment, enforced at scenarios.ts:247 `profile.categories.length === 0`), so the `full` profile is defined by an empty list (scenarios.ts:224-227) rather than an explicit 'all' marker.

**Impact:** A typo'd category ('f' vs 'F', or 'Smoke') compiles cleanly, silently vanishes from `selectScenarios` filtering (scenarios.ts:252 `wanted.has(scenario.category)`), and produces a report missing rows with no error — exactly the failure the categories-as-data finding also enables. The empty-means-all sentinel is a latent bug: a future profile intended to select zero categories is indistinguishable from 'run everything'.

**Fix:** Make category a union type (`type CategoryId = 'smoke' | 'A' | ... | 'M'`) so the compiler rejects bad letters and `selectScenarios` becomes exhaustive. Replace the empty-array sentinel with an explicit discriminated shape (`{ kind: 'all' } | { kind: 'sections'; ids: CategoryId[] }`) so 'all' and 'none' are distinct and unrepresentable-illegal. Parse-don't-validate: turn category strings into the union at the scenario-authoring boundary.

<a id="f-hellweek-reports-taxonomy--html-report-god-function-figures"></a>
##### LOW — Report renderer mixes metric computation into presentation across many single-purpose section functions

- Category: `separation-of-concerns` · Verification: `verified`
- Locations: `packages/core/src/hellweek/htmlReport.ts:89-145`, `packages/core/src/hellweek/htmlReport.ts:209-256`

**Problem:** The renderer functions do not just render — they recompute derived metrics inline. keyFigures (htmlReport.ts:89-145) decides tone thresholds and formats rates; sectionTable (htmlReport.ts:210-217) and dimensionTable (htmlReport.ts:234-237) each independently recompute a pass rate as `total === 0 ? 0 : pass/total`; miniBar (htmlReport.ts:463-466) re-derives tone bands from that rate. The aggregate.ts module already owns metric computation for the report, so rate/tone logic is split between aggregation and presentation.

**Impact:** Presentation and analysis are coupled: a change to how a pass rate or a tone threshold is defined must be made in aggregate.ts AND in each table renderer, and the two renderers can disagree on thresholds (miniBar's 0.9/0.6 bands are a presentation policy embedded in the HTML layer, not visible to the Jasmine renderer). Testing metric correctness requires rendering HTML.

**Fix:** Push all derived numbers (rates, tones/severity bands, formatted display values) up into the aggregate/report model so renderers consume ready-to-display fields and only lay out markup. Keep the divide-by-zero guard and threshold policy in one place. This is a separation-of-concerns cleanup, not a rewrite — the section functions stay, they just stop computing.

### Tooling & harness scripts

<a id="s-scripts-probes"></a>
#### Scripts — concierge probes

_scripts-probes · 5 findings_

<a id="f-scripts-probes--probes-exit-code-blind"></a>
##### MED — concierge-probes.mjs never signals failure via exit code; a broken lab endpoint reads as a clean run

- Category: `error-handling / exit-code discipline` · Verification: `verified`
- Locations: `scripts/concierge-probes.mjs`

**Problem:** The probe runner has no exit-code handling at all. runProbe() catches a failed session create by returning an object with an `error` field (line 108-110), the main loop pushes it into `results` and prints `RAN ...` for it (line 134-139), then the script writes the JSON and falls off the end with the default exit code 0 (line 141-143). There is no `process.exit`/`process.exitCode` anywhere in the file. A per-turn HTTP failure (turn.status !== 200) is not even recorded as an error — `reply` is just set to null (line 127).

**Impact:** If the lab API is down, the base URL is wrong, or every session POST 500s, the script still exits 0 and writes a probe-run.json full of `error`/null replies. Any `just` target or CI wrapper that keys off exit status treats a totally failed run as success, and the downstream judge (concierge-probes-judge.mjs) then scores null replies as if they were real assistant output. The failure is silent until a human reads the file.

**Fix:** Track a failure count (session non-200 or turn non-200) and set `process.exitCode = 1` when any probe failed to produce a real reply, so a broken endpoint surfaces as a non-zero exit rather than a green-looking artifact.

<a id="f-scripts-probes--judge-broke-verdict-exit-zero"></a>
##### MED — concierge-probes-judge.mjs exits 0 on a 'broke' verdict and has no error handling around OpenAI calls

- Category: `error-handling / exit-code discipline` · Verification: `verified`
- Locations: `scripts/concierge-probes-judge.mjs`

**Problem:** The judge only exits non-zero for a missing --in/--out arg (line 20-23). When the rubric scores a reply `broke` (a real safety/quality violation) the tally is written and the script exits 0 (line 105-111). Separately, judge() calls client.responses.create and JSON.parse(response.output_text) with no try/catch (line 59-79); one rate-limit, network error, or non-JSON response throws out of the `for` loop (line 83-90), aborting mid-run with a raw stack and no partial artifact written. There is also no guard for probes that already carried an `error`/null reply from the runner — they still burn a gpt-5.4-mini call (and, since a null reply often scores broke/low-confidence, a gpt-5.5 adjudication call too) and land in the tally as if a real reply was judged.

**Impact:** CI/`just` cannot distinguish a clean pass from a run where the concierge broke on several probes — both exit 0, so a regression in the product surface passes gates. An OpenAI hiccup on probe N destroys the whole run instead of degrading, wasting the earlier calls. And errored probes inflate spend and pollute the tally with judgments of empty strings.

**Fix:** Wrap each judge() call in try/catch, record the failure per-probe and continue; skip probes whose reply is null/errored (mark them as errored, not judged); and set a non-zero exit code when tally.broke > 0 or when any judge call failed, so the pipeline can gate on it.

<a id="f-scripts-probes--ux-evaluator-always-green"></a>
##### MED — ux-evaluator-probe.mjs swallows every API error and always exits 0, so an all-errors run looks successful

- Category: `error-handling / exit-code discipline` · Verification: `verified`
- Locations: `scripts/ux-evaluator-probe.mjs`

**Problem:** evaluateCase() wraps the OpenAI call in try/catch and stores the message in an `error` field (line 256-272), then the top-level loop (line 217-230) pushes every result regardless. The report counts `errors` per model in the summary (line 455) but the script never sets a non-zero exit code on that path: the only `process.exit` calls are for --help (183), missing key (188), and --dry-run (211). After the run it writes the report and prints the markdown table, ending with default exit 0 (line 242-247).

**Impact:** A run where the API key is valid but every request fails (model deprecated, quota exhausted, transient 5xx) produces a report with `errors == calls`, a 0% pass rate, and exit 0. A scheduled or `just`-driven invocation records that as a healthy evaluation. Nobody notices the evaluator stopped evaluating until someone reads the token/error columns by hand.

**Fix:** After building the report, set `process.exitCode = 1` when any result has an error (or when errors exceed a threshold), mirroring the exit discipline the proof scripts already use, so a broken evaluator run fails loudly.

<a id="f-scripts-probes--hardcoded-chromium-path"></a>
##### MED — Hardcoded pinned Chromium executable path duplicated across ~15 scripts breaks all of them on any Playwright bump

- Category: `config / duplication` · Verification: `verified`
- Locations: `scripts/concierge-rehearsal.mjs`, `scripts/concierge-nav-proof.mjs`, `scripts/concierge-journey-memory-proof.mjs`

**Problem:** Each browser-driving script hardcodes the same absolute, version-pinned path: `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/...` (concierge-rehearsal.mjs:21, concierge-nav-proof.mjs:21, concierge-journey-memory-proof.mjs:19). The `chromium-1228` build id and `mac-arm64` arch are baked in. Grep shows 15 scripts carry this identical string. There is no shared resolver and no fallback to Playwright's own executablePath resolution.

**Impact:** The next `playwright-core` upgrade changes the `chromium-1228` directory name and every one of these scripts fails at launch with an ENOENT on the executable — 15 edit sites to fix, easy to miss some. On a non-arm64 machine or a fresh checkout without that exact cache, they all fail identically. This is copy-paste config that turns a one-line dependency bump into a scavenger hunt.

**Fix:** Extract one tiny shared module (e.g. scripts/lib/browser.mjs) exporting a `launchChromium()` that resolves the executable via Playwright's own API or a single env-overridable constant, and import it from the browser scripts so the path lives in exactly one place.

<a id="f-scripts-probes--check-scaffolding-duplicated"></a>
##### MED — Probe/proof harness is ~18 snowflake scripts each reimplementing check(), session HTTP, and result plumbing instead of one library

- Category: `duplication / architecture` · Verification: `verified`
- Locations: `scripts/concierge-nav-proof.mjs`, `scripts/concierge-journey-memory-proof.mjs`, `scripts/concierge-rehearsal.mjs`, `scripts/concierge-probes.mjs`

**Problem:** The identical `const check = (id, ok, detail = '') => { results.push(ok); console.log(...) }` block plus the `passed/total` tally, results.json write, and exit-code line are hand-copied into 18 scripts (grep: 18 files define that exact check helper). The concierge session HTTP client (`async function api(path, options)` with the JSON-parse-or-null pattern) is re-inlined in 4 scripts (concierge-probes.mjs:91, dc004, plus the batteries), and the `POST /api/concierge/sessions` then `POST .../messages` shape is duplicated verbatim (concierge-probes.mjs:107-120, dc004-concierge-probe.mjs:42-48). None of it lives in a shared module.

**Impact:** These are not independent tools — they are the same harness stamped out 18 times. When the concierge session API changes shape (new required body field, renamed conversationRef, added auth header), every inlined `api()`/session caller must be found and edited by hand, and the ones that get missed fail in inconsistent ways. Fixing the exit-code and error-handling bugs above means making the same fix in a dozen copies. The divergence is already visible: some scripts exit(1) on failure, one (concierge-probes) exits 0, one uses process.exitCode.

**Fix:** Factor the shared surface into one small harness module (check/report/exit + a concierge session client that owns the sessions+messages shape and JSON handling) and have the scripts import it. This is a concrete, load-bearing win: the exit-code, error-handling, and API-shape-coupling findings above collapse to a single fix site instead of eighteen.

<a id="s-scripts-proofs"></a>
#### Scripts — behavior proofs

_scripts-proofs · 3 findings_

<a id="f-scripts-proofs--proofs-01"></a>
##### MED — Pinned Playwright browser path is copy-pasted into all five proofs, so a Playwright bump silently breaks every proof at once

- Category: `duplicated-scaffolding` · Verification: `verified`
- Locations: `scripts/contact-assistant-ux-proof.mjs`, `scripts/seam-walk-proof.mjs`, `scripts/dr001-resurrection-proof.mjs`, `scripts/dr002-streaming-proof.mjs`, `scripts/dr003-live-restart-proof.mjs`

**Problem:** Every script hardcodes the identical absolute chromium executable path with the pinned build number chromium-1228 inline (contact-assistant-ux-proof.mjs:20-31, seam-walk-proof.mjs:27-38, dr001:19, dr002:18, dr003:70). There is no shared launch helper even though scripts/ already contains shared modules (concierge-probes.mjs exports PROBES). Nothing derives the browser from Playwright's own resolver; the build number is a literal string in five places.

**Impact:** When Playwright is upgraded, ms-playwright/chromium-1228 becomes chromium-<newbuild> and chromium.launch() throws ENOENT in all five proofs simultaneously. The failure surfaces as a launch crash, not a proof FAIL, so the two justfile-wired proofs (contact-assistant-proof, seam-walk-proof) and the three dr-series scripts all break in lockstep and must be edited in five separate files to recover. The pin also assumes macOS arm64 and a warm Playwright cache, so the same path breaks on a different arch.

**Fix:** Extract one launchProofBrowser() helper (e.g. scripts/proof-browser.mjs) that resolves the executable via playwright-core's own executablePath resolution (or a single PLAYWRIGHT_CHROMIUM env override) and import it in all five. One edit point instead of five, and the build number stops being a literal.

<a id="f-scripts-proofs--proofs-02"></a>
##### MED — dr001/dr002/dr003 reimplement the same say()/check()/launch/exit-code harness three times with subtle divergence

- Category: `duplicated-scaffolding` · Verification: `verified`
- Locations: `scripts/dr001-resurrection-proof.mjs`, `scripts/dr002-streaming-proof.mjs`, `scripts/dr003-live-restart-proof.mjs`

**Problem:** The dr-series share a near-identical say(page, text) turn-completion helper (dr001:27-45, dr003:78-100), the same check()/results-array/exit-code footer (dr001:21-25/91-93, dr002:20-24/91-93, dr003:72-76/179-183), and the same browser bootstrap - but each is a hand-copied variant. dr001 and dr003 use a baseline-count say(); dr002 inlines a bespoke sampling loop instead. The three check() implementations push bare booleans into results while the contact/seam proofs' identically-named check() push {id, ok, detail} objects - same name, two incompatible contracts across the group.

**Impact:** The 'turn is complete' definition is correctness-load-bearing (dr001's comment explains the streaming race that makes naive dot-vanish waits wrong). When that heuristic needs to change - e.g. a new composer state attribute - an editor must fix it in each copy, and dr002's divergent loop is easy to miss, producing proofs that pass on stale wait logic. The two check() contracts mean any future attempt to consolidate reporting has to untangle which shape each call site expects.

**Fix:** Promote say(), check(), the results/exit-code footer, and browser launch into a small shared proof harness the dr-series imports. Converge on the richer {id, ok, detail} results contract already used by the two justfile proofs so a report/exit-code helper can be shared across the whole group.

<a id="f-scripts-proofs--proofs-05"></a>
##### MED — Concierge HTTP contract (route shape + status-code semantics) is duplicated inline across dr001 and dr003 with no single source

- Category: `coupling-to-app-internals` · Verification: `verified`
- Locations: `scripts/dr001-resurrection-proof.mjs`, `scripts/dr003-live-restart-proof.mjs`

**Problem:** Both scripts hand-build requests to /api/concierge/sessions/${ref}/messages with POST + content-type header, and both encode load-bearing assumptions about that endpoint's status semantics: dr001 asserts a missing session yields 404 (dr001:67-77), while dr003 relies on the subtler rule that an invalid empty body yields 400 when the session exists but 404 when it does not, because session lookup precedes body validation (dr003:104-118, 133-154). That ordering assumption lives only in prose comments in two scripts and is asserted centrally nowhere.

**Impact:** If the concierge route reorders validation (body-check before session lookup) or renames the path, dr003's before/after probe inverts - session-known-before-restart and restart-wiped-session can both read the wrong branch, and the proof can pass or fail for the wrong reason while claiming to prove restart recovery. Because the knowledge lives in comments, a route refactor has no failing test pointing back here; it quietly changes what the proof measures.

**Fix:** Centralize the concierge probe (path builder + the documented status-code meaning) in one shared helper the dr-series imports, so the '404 = gone, 400 = exists' contract is asserted in one place. A route contract change then breaks one helper loudly instead of two proofs drifting into false green.

<a id="s-scripts-infra"></a>
#### Scripts — infra tooling

_scripts-infra · 2 findings_

<a id="f-scripts-infra--sync-secret-input-stderr-pipe-leak-surface"></a>
##### MED — sync commands feed secret values via stdin to third-party CLIs while piping their stderr into the shared `run` error path

- Category: `secrets-hygiene` · Verification: `verified`
- Locations: `scripts/secrets.mjs`

**Problem:** In `syncVercel`/`syncRailway` the per-key `run(...)` passes the raw secret as `input: values.get(key)` with `stdio: ['pipe','inherit','pipe']` (scripts/secrets.mjs:336-339, 367-370). On a non-zero exit, the shared `run` helper (49-55) throws `new Error(result.stderr?.trim() || result.stdout?.trim() || ...)`, and the top-level catch prints that message. If the vercel/railway CLI ever echoes the offending value into stderr on a validation error (e.g. 'invalid value "<the-secret>"'), that secret is surfaced to the console and exit path. The tool takes care to use `--sensitive`/`--stdin` on the happy path but reuses a generic error helper that blindly reflects child stderr.

**Impact:** A failed production sync could print a decrypted secret to the terminal (and thus to any CI log capturing the command), defeating the `--sensitive` intent. This is a latent leak conditioned on third-party CLI behavior the script does not control, on the least-tested (error) path of the most sensitive command.

**Fix:** For the sync path, do not reflect raw child stderr verbatim into the thrown Error; wrap failures as `"${provider} set ${key} failed (exit N)"` and only surface stderr when it is known not to contain the value, or scrub the value from any stderr before printing. Keep the generic `run` for non-secret commands.

<a id="f-scripts-infra--sync-partial-write-nonidempotent"></a>
##### LOW — sync-vercel / sync-railway apply key-by-key with no atomicity, leaving partial remote state on mid-loop failure

- Category: `idempotency-production-safety` · Verification: `verified`
- Locations: `scripts/secrets.mjs`

**Problem:** `syncVercel` (scripts/secrets.mjs:314-341) and `syncRailway` (343-372) iterate `for (const key of keys)` and call `run('vercel'|'railway', ...)` once per key. `run` throws on the first non-zero exit (49-55), which propagates to the top-level catch (403-406) that prints `error.message` and exits 1. There is no transaction, no ordering guarantee, and no summary of what was already pushed. If key 4 of 9 fails (auth token expired mid-run, network blip, rate limit), keys 1-3 are already mutated on the remote environment and keys 4-9 are not.

**Impact:** A failed `just secrets-sync-vercel production --apply` leaves the production environment in a half-updated state with zero indication of which keys landed. The operator cannot tell from the output whether to re-run (safe, since `--force`/`--yes` on vercel and per-key set on railway are idempotent) or whether some keys silently diverged. Because the dry-run/apply banner (assertApply, 304-312) prints the full intended key list BEFORE any mutation, the successful-looking preview does not reflect the partial-failure reality.

**Fix:** Wrap the apply loop to collect per-key success/failure and print a final `pushed: [...] / failed: [...]` summary, exiting non-zero only after attempting all keys (or after the first failure, but reporting the completed subset). Since both remote set operations are idempotent, continuing past a single failure and reporting the aggregate is safer than aborting silently mid-list.

<a id="s-scripts-parity"></a>
#### Scripts — parity/integration batteries

_scripts-parity · 2 findings_

<a id="f-scripts-parity--parity-02"></a>
##### MED — Hard-coded chromium-1228 macOS executable path is copy-pasted across both pixel harnesses (17 scripts total) with no env override or shared resolver

- Category: `config / base-URL-and-binary handling` · Verification: `verified`
- Locations: `scripts/contact-chat-parity.mjs`, `scripts/site-parity-harness.mjs`

**Problem:** contact-chat-parity.mjs:10 and site-parity-harness.mjs:113 both inline the identical absolute path `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/...`. The `chromium-1228` revision segment is version-pinned to one Playwright build, and the same literal is duplicated across 17 scripts in scripts/. There is no `PLAYWRIGHT_*`/env fallback and no `chromium.launch()` without executablePath.

**Impact:** The next `playwright-core` bump renames the cache folder (e.g. chromium-1230); every one of these harnesses then fails at launch with an ENOENT that looks like a broken environment, not a version drift, and a maintainer must sed 17 files to recover. It also hard-blocks running on Linux/CI or any non-arm64 mac, so the parity proof cannot move off one developer's laptop.

**Fix:** Resolve the executable once: prefer no `executablePath` (let playwright-core find its own managed browser) or read `process.env.PLAYWRIGHT_CHROMIUM_PATH` with the current literal as fallback, in a single shared `scripts/lib/browser.mjs` both harnesses import. This removes the 17-way pin without changing the intended real-browser proof surface.

<a id="f-scripts-parity--parity-03"></a>
##### LOW — Both Playwright harnesses leak the headless browser on any mid-run exception (no try/finally around browser.close)

- Category: `error handling / resource cleanup` · Verification: `verified`
- Locations: `scripts/contact-chat-parity.mjs`, `scripts/site-parity-harness.mjs`

**Problem:** In contact-chat-parity.mjs the browser is launched at line 38 and only closed at line 93 on the straight-line happy path; in site-parity-harness.mjs launched at 165 and closed at 206. Any throw in between — a `waitForSelector('#mal-panel')` timeout (line 46), a `page.goto` networkidle timeout, or an evaluate against a missing `#mal-launcher`/`#mal-panel` element (lines 55-68 call `.getBoundingClientRect()` on a possibly-null `getElementById`) — propagates past `browser.close()`. There is no try/finally.

**Impact:** On a flaky run (server slow to serve the panel, selector renamed), the script exits non-zero (correct) but leaves an orphaned `Google Chrome for Testing` process holding the profile/port. Repeated failing runs during debugging stack up zombie Chromium processes and can wedge the next run. Under a CI loop this accumulates until the box is out of handles.

**Fix:** Wrap the capture/assertion body in `try { ... } finally { await browser.close(); }` in both harnesses. Small, local, and it also guarantees a clean exit code on the throw path.

## Scope, Method, and Caveat

### Scope & method — and one honest caveat

**In scope:** the working code that is staying — `packages/core/src` (engine, validator, planners, signals, Hell Week, stochastic, simulation, lab, CLI), `contracts`, `site-nuxt`, `integrated-poc`, `mcp-server`, the demo/review widgets, lab UI, and the 19 wired `.mjs` tooling scripts.

**Excluded** (per the 2026-07-05 cleanup review): the Astro `site/` build/deploy path, the one-shot `dc*`/`dr*`… proof scripts marked for burning, standalone IPOC deploy config, `artifacts/`, `docs/`, and dead code (that review owns it). Deliberate decisions were held sacred: the intentionally-separate demo/review widgets were *not* flagged for deduping, and the support-bot framing, OpenAI mandate, and quality-not-security scope were respected.

**Method:** a per-subsystem staff-level reviewer surfaced candidate findings; each was then handed to an independent adversarial verifier that read the cited code and could reject, downgrade, or confirm it. 70 findings survived that pass. Every finding is anchored at `file:line` with a concrete failure/maintenance scenario — unfalsifiable observations were rejected.

> **Caveat:** the run hit a session usage limit near the end. Three things did not complete their automated pass: the 4 dedicated cross-cutting lenses, the independent *verify* step for the three front-end slices (nuxt lib/server, integrated-poc, widgets/lab-ui), and the automated synthesis/critic. Those 20 front-end findings are therefore marked **review-stage** — single-agent, not yet adversarially verified (the headline one, IPOC’s cross-app session store, was spot-verified by hand and holds). The synthesis and work packs above are hand-authored from the full finding set. A clean automated pass can be resumed once the limit resets.

---

loanslam design-patterns audit · 90 findings (70 verified, 20 review-stage) · generated 2026-07-06 · severities on verified findings are the adversarially-adjusted values, not the reviewer’s originals.
