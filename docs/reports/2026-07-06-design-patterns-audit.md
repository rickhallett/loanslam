# Working Code Design Patterns Audit - 2026-07-06

Practical takeaway: the working architecture has a strong core, but the repo is
past the point where more local patches will buy much leverage. The next staff
level move is to deepen a few load-bearing Interfaces: handoff fact confidence,
turn evidence projection, policy doctrine, and site route policy. Those seams
already exist implicitly; the risk is that they are still reimplemented by
engine, proofs, prompts, reports, widgets, and operator scripts.

No source behavior was changed for this report.

## Baseline

- Repo: `/Users/mrkai/code/loanslam`
- Branch during review: `codex/chore/commit-dirty-cleanup`
- Worktree state at start: clean working tree
- Exclusion source: `docs/reports/2026-07-05-adversarial-cleanup-review.md`
- Static signals used:
  - `fallow check_health`: health score `B/79.0`; top hotspots were
    `packages/core/src/engine.ts`, `packages/core/src/cli.ts`,
    `packages/core/src/validator.ts`, `packages/core/src/retriever.ts`, and
    `packages/site-nuxt/server/utils/concierge.ts`.
  - `fallow find_dupes`: 11.48 percent duplicated lines across analyzed files;
    largest clone groups were report renderers and the demo/review widget pair.
  - `fallow` dead-code output was treated as a signal only, not deletion truth,
    because scripts, package entrypoints, generated outputs, and proof surfaces
    create false positives here.
- Behavior tests, local servers, model-backed evals, deploy commands, and
  secret-dependent commands were not run. This is a design-pattern and
  source-architecture audit, not behavior verification.

## Scope

Reviewed working code surfaces:

- Contract schemas and public types: `packages/contracts/src/**`
- Core engine, retrieval, planner, signal, validator, policy, CLI:
  `packages/core/src/**`
- Hell Week, stochastic, simulation, lab API, demo display/logging:
  `packages/core/src/hellweek/**`, `packages/core/src/stochastic/**`,
  `packages/core/src/simulation/**`, `packages/core/src/lab/**`
- Current Nuxt site and concierge assistant: `packages/site-nuxt/**`
- Integrated POC source still imported by Nuxt: `packages/integrated-poc/**`
- Transitional widgets not yet burned: `packages/demo-widget/**`,
  `packages/review-widget/**`
- MCP lab API adapter: `packages/mcp-server/**`
- Active operator scripts: `scripts/branch-risk.ts`, `scripts/gate-slice.ts`,
  `scripts/floor-delta.ts`, `scripts/digest.ts`, `scripts/build-reports.mjs`,
  and adjacent active proof helpers.

Skipped by design because the cleanup report documents them as going, raw, or
quarantine candidates:

- Raw `artifacts/phase0` sessions, tracked screenshot/proof artifacts, live
  capture source archives, and public/generated report output bodies.
- Closed one-shot demo-concierge proof scripts such as `dc002` through `dc2-003`
  and retired restart/proof scripts.
- Old Railway/Astro deploy paths, root `railway-build` / `railway-start`, and
  standalone IPOC deploy packaging.
- Dead-code candidates already classified as safe deletion candidates by the
  cleanup review, unless they still sit on a live code path.

## Design Bar

I used this bar:

- A deep Module hides changing implementation detail behind a small Interface.
- A good Seam has one source of truth, one projection path, and testable
  invariants at the boundary.
- An Adapter is justified when it isolates an external system, format, runtime,
  or retained legacy surface.
- A refactor only earns its keep when it improves Leverage and Locality: fewer
  places must change for the next policy, proof, or product requirement.
- One adapter is hypothetical; two adapters are real. Where two active consumers
  already exist, an Interface is fair game.

## Architectural Judgment

The repo's strongest shape is still:

`ConversationState -> retrieval -> TurnPlanner -> Validator -> ValidatedTurnResult -> TurnTrace -> proof/display adapters`

That is good. The main failure mode is that several important concepts escaped
that shape and now exist as repeated local rules:

- handoff facts versus candidate facts
- raw trace versus normalized audit/proof row
- policy detector versus prompt instruction versus judge rubric
- known site route versus displayed link versus nav chip
- engine-support brain versus concierge brain
- full run identity versus replay identity

The best next architecture work is not a broad cleanup sweep. It is a small set
of deeper Modules that make those concepts harder to re-derive incorrectly.

## P1 Findings

### 1. Handoff fact confidence is not an Interface

The contracts expose `ConversationState.collectedFacts` as a plain
`Record<string, string>` (`packages/contracts/src/schemas.runtime.ts:173`). The
planner prompt distinguishes confirmed fields from `*_candidate` values and says
candidates require confirmation (`packages/core/src/planners/prompt.ts:42`), but
the engine's collection check accepts either exact or candidate facts as present
(`packages/core/src/engine.ts:942`).

That is not just a bug. It is a shallow Seam. The domain has at least three fact
states - absent, candidate, confirmed - but the Interface only models "string in
a bag." Every caller must remember the confidence policy.

Recommendation:

- Introduce a `HandoffFactState` or `HandoffIntakeState` Module that owns:
  confirmed facts, candidate facts, missing fields, conflict resolution, and
  ticket-completion readiness.
- Keep `ConversationState` serializable, but stop asking raw
  `collectedFacts` whether handoff is complete.
- Route planner-collected facts, regex-extracted text facts, structured intake,
  IPOC ticket creation, demo telemetry, and tests through the same Module.

Expected leverage: this prevents confirmation policy drift across engine,
planner prompt, lab demo, IPOC, and future admin readback.

### 2. Proof surfaces project traces inconsistently

`processTurn` records a rich trace, including load-bearing signal status and
comparison data (`packages/core/src/engine.ts:129`). Hell Week builds a narrower
turn-evidence object (`packages/core/src/hellweek/runner.ts:44`) and does not
project the signal error path. Route audit then normalizes current safety flags
(`packages/core/src/routeAudit.ts:674`) before a classifier checks for
carryover-on-answer leakage (`packages/core/src/routeAudit.ts:462`).

The pattern problem: proof code is both deriving and judging its own facts. That
lets a report named to detect a class of leak normalize away the evidence needed
to detect it.

Recommendation:

- Add a `TurnEvidenceProjection` Module with two explicit views:
  - `raw`: exactly what the engine trace and state said.
  - `scoring`: derived fields for grading, with every normalization labeled.
- Make Hell Week, route-audit, demo interaction logging, STS, and MCP summaries
  consume that projection instead of reconstructing route/safety/intake state.
- Include signal extraction error, timeout, latency, and comparison status in
  the shared projection.

Expected leverage: behavior proof becomes more trustworthy, and future audit
tools stop inventing slightly different rows from the same trace.

### 3. Policy doctrine is split across code, prompts, and judge rubrics

The validator has a strong ordered guard pipeline
(`packages/core/src/validator.ts:93`), and that ordering is a real safety
invariant. But the doctrine feeding it is scattered:

- policy constants, regex detectors, and customer copy in
  `packages/core/src/policy.ts:90`
- planner instructions in `packages/core/src/planners/prompt.ts:24`
- signal-extractor instructions in `packages/core/src/signals/prompt.ts:26`
- judge rubric and extra regex backstops in
  `packages/core/src/hellweek/openaiJudge.ts:149`

The current pattern is "policy by repetition." It works only while people keep
four representations synchronized by hand.

Recommendation:

- Introduce a `PolicyRuleCatalog` for the high-risk rule families:
  credential boundary, account fact invention, account mutation, approval
  estimate, regulated debt advice, internal-data/privacy, language barrier,
  vulnerability/hardship/complaint/legal/accessibility.
- Each rule should own its stable id, detector, safety flags, final action,
  trace/override code, customer-copy snippets, proof scenario tags, and prompt or
  rubric bullets.
- Do not over-generate prompts immediately. Start by co-locating the doctrine
  and adding tests that compare catalog ids to validator overrides, prompt
  bullets, and judge triage labels.

Expected leverage: new safety rules become one policy addition plus generated or
checked projections, not a prompt/validator/judge archaeology exercise.

### 4. Current site route policy is duplicated and fail-open in one path

`siteMap.ts` explicitly says it is the curated site map and single source of
truth (`packages/site-nuxt/lib/siteMap.ts:1`). But navigation offers define their
own whitelist and regexes (`packages/site-nuxt/lib/navOffer.ts:18`), URL rewriting
has its own host/path policy (`packages/site-nuxt/lib/siteUrls.ts:49`), and the
concierge prompt embeds the site map as text (`packages/site-nuxt/server/utils/concierge.ts:106`).

Worse, `pathForDisplayUrl` maps an unknown first-party path on known site hosts
to `/` (`packages/site-nuxt/lib/siteUrls.ts:69`). That makes stale or invented
first-party links look safe.

Recommendation:

- Add a `SiteRoutePolicy` Module that owns known pages, excluded pages,
  application/login aliases, URL rewriting, and nav-offer metadata.
- Derive `siteMapLines`, `navOfferPaths`, nav-chip labels, and display URL
  rewriting from that one policy.
- Fail closed for unknown first-party paths. Preserve the original text or flag
  an invalid-route event instead of rewriting to homepage.

Expected leverage: concierge, UI chips, tests, and URL rendering all agree about
what exists.

### 5. The Nuxt chat widget mixes two assistant brains in one component

`ChatWidgetPanel.vue` now chooses between concierge mode and IPOC/engine mode in
the same submit path (`packages/site-nuxt/components/ChatWidgetPanel.vue:895`).
The same component owns session boot, transcript resurrection, SSE parsing,
stream bubble mutation, nav offers, handoff offers, telemetry, intake, reset,
persistence, and UI state. The concierge server module is explicitly a separate
demo-only, prompt-guarded surface with no validator
(`packages/site-nuxt/server/utils/concierge.ts:8`), but the client-side Module
does not yet reflect that separation.

This is the highest-risk frontend design smell because it makes "support engine"
and "site concierge" behavior local branches in a large Vue component rather
than two adapters behind a stable UI contract.

Recommendation:

- Introduce an `AssistantBrain` client Interface with implementations for:
  `engineSupportBrain` and `conciergeBrain`.
- Move SSE parsing into a small `ConciergeStreamClient`.
- Move transcript persistence/resurrection into a `ChatTranscriptStore`.
- Keep `ChatWidgetPanel.vue` as composition and rendering state, not transport
  and business logic.

Expected leverage: future product decisions can change concierge, support chat,
or handoff behavior without editing a thousand-line component.

## P2 Findings

### 6. STS artifact identity conflates full runs and scenario replays

The stochastic runner builds artifact paths from seed before it knows whether the
run is full or narrowed to one replay scenario (`packages/core/src/stochastic/runner.ts:73`).
The artifact path builder then emits seed-only filenames
(`packages/core/src/stochastic/artifacts.ts:34`).

Recommendation: introduce `StochasticRunIdentity` with
`mode: "full" | "replay"`, seed, profile, optional scenario slug, and run id.
Artifact paths should include that identity or require an explicit output
directory for replay.

Expected leverage: targeted debugging cannot overwrite, shadow, or be mistaken
for full-run evidence.

### 7. Report renderers duplicate low-level HTML primitives

Fallow found the largest clone group across Hell Week HTML, Jasmine-style Hell
Week HTML, and stochastic HTML report renderers. The code confirms repeated page
chrome and escaping helpers, for example `renderHellWeekReportHtml`
(`packages/core/src/hellweek/htmlReport.ts:15`) and a separate `escapeHtml`
implementation in `jasmineReport.ts` (`packages/core/src/hellweek/jasmineReport.ts:214`).

Recommendation: extract a narrow `EvidenceReportKit` with escaping, table rows,
metric cards, section shells, and severity/tone helpers. Do not centralize domain
semantics; centralize the boring renderer primitives.

Expected leverage: lower duplication without flattening Hell Week and STS into
one vague report abstraction.

### 8. Operator command surfaces know less than the codebase now knows

`runCli` is a long command dispatcher (`packages/core/src/cli.ts:115`). The
top-level `justfile` is an overgrown front door that still exposes Astro site
recipes (`justfile:248`), while `branch-risk.ts` classifies active surfaces by
path and misses current `packages/site-nuxt/**` and `packages/integrated-poc/**`
work (`scripts/branch-risk.ts:33`).

Recommendation:

- Add a command registry for CLI commands and proof bars.
- Add a path-classification registry shared by `branch-risk` and `gate-slice`.
- Keep top-level `just` to the small active operator surface: orientation,
  gates, Hell Week/floor-delta/digest, reports, secrets, and current Nuxt
  operations.

Expected leverage: future agents get the right proof bar from the path they
touched, and old surfaces stop looking equal to live ones.

### 9. IPOC boundaries are clear but too handler-local

The IPOC shared types are useful (`packages/integrated-poc/shared/ipoc.ts:9`),
and the store boundary is readable (`packages/integrated-poc/server/utils/ipocStore.ts:16`).
The weak pattern is in the route layer: session lookup, body validation, error
translation, and response shaping repeat across handlers
(`packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/messages.post.ts:19`,
`packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/lookup.post.ts:16`,
`packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/intake.post.ts:16`).

`engineAdapter.ts` also does corpus loading at module initialization
(`packages/integrated-poc/server/utils/engineAdapter.ts:43`), which makes
configuration and runtime dependency failures happen before a request-level
adapter can decide how to report them.

Recommendation:

- Add `requireIpocSession(event)` and typed body validators for each request.
- Add an `IpocRuntime` or `IpocEngineAdapter` factory that owns corpus/config
  loading, planner construction, and error mapping.
- Share the telemetry projection with lab/demo display instead of mirroring by
  comment (`packages/integrated-poc/server/utils/turnTelemetry.ts:9`).

Expected leverage: IPOC can grow from demo to believable product proof without
copying every handler concern again.

### 10. Demo and review widgets are forked twins

`demo-widget` and `review-widget` share effectively identical engine clients
(`packages/demo-widget/src/engineClient.ts:20`,
`packages/review-widget/src/engineClient.ts:20`) and nearly identical chat state
machines (`packages/demo-widget/src/WidgetApp.vue:87`,
`packages/review-widget/src/WidgetApp.vue:96`). The review widget adds telemetry
and review chrome; the core transport/session/intake logic is the same.

The cleanup report says not to burn the pair without a human decision, so this
should not be a sweeping refactor. But if both packages survive, the design
should become explicit.

Recommendation:

- Either freeze one package for sunset, or extract `@loanslam/widget-core` with
  engine client, session state, intake validation, host bridge protocol, and
  message rendering primitives.
- Keep visual skins and stakeholder-specific chrome as adapters.

Expected leverage: bug fixes to demo transport and handoff state do not need to
be double-applied.

### 11. Lab server is strong, but the Module is too wide

The lab server's route tables are good design: method, matcher, handler rows are
explicit, and the comments explain ordering as an invariant
(`packages/core/src/lab/server.ts:353`). But the file also owns trusted lab
routes, demo routes, static serving, access-token auth, state-token persistence,
interaction logging, structured intake, and engine calls.

Recommendation:

- Preserve the route-table pattern.
- Extract only the already-real adapters:
  - `LabSessionStore`
  - `DemoSessionStateTokenStore`
  - `DemoRouteRecorder`
  - `StaticAssetResponder`
  - shared dispatch helper for route tables

Expected leverage: the lab/demo serving boundary becomes easier to harden
without losing the simplicity that currently makes it testable.

## Patterns To Preserve

- `packages/contracts` is deep in the right way. Zod runtime schemas define the
  shared vocabulary, and `TurnPlanner` / `SignalExtractor` are narrow ports
  (`packages/contracts/src/schemas.runtime.ts:413`).
- `processTurn` is still the correct orchestration center. It sequences signal,
  retrieval, planning, validation, handoff state, state merge, and trace emission
  in one understandable path (`packages/core/src/engine.ts:50`).
- The OpenAI planner and signal extractor adapters are good Adapters. They hide
  Responses API structured-output quirks and use `store: false`
  (`packages/core/src/planners/openaiPlanner.ts:68`,
  `packages/core/src/signals/openaiSignalExtractor.ts:72`).
- The validator's ordered guard pipeline is a real safety invariant, not
  incidental code shape (`packages/core/src/validator.ts:93`).
- `floor-delta.ts` and `digest.ts` are good proof-tool Modules: they read typed
  summaries, avoid raw transcripts where appropriate, and produce falsifiable
  receipts (`scripts/floor-delta.ts:154`, `scripts/digest.ts:66`).
- The MCP lab client has the right trust boundary: explicit allowed local base
  URLs, validated session dumps, and artifact writes constrained under
  `artifacts/phase0` (`packages/mcp-server/src/labApiClient.ts:78`).

## Recommended Order

1. `TurnEvidenceProjection` first. It protects the proof surface and lets every
   later design change be measured honestly.
2. `HandoffFactState` second. It closes a real customer-sensitive seam and gives
   the engine, IPOC, and demo display one shared intake truth.
3. `SiteRoutePolicy` third. It is small, bounded, and will reduce concierge/UI
   drift quickly.
4. `PolicyRuleCatalog` fourth. It is higher leverage but higher blast radius;
   start with catalog ids and drift tests before trying to generate prompts.
5. Frontend brain split fifth. Do it after route policy so the extracted
   concierge adapter consumes a stable navigation contract.

## First Safe Work Pack

A good first implementation slice would be:

1. Add `TurnEvidenceProjection` and switch route-audit plus Hell Week evidence to
   consume it.
2. Include signal error/timeout in the projection and make route-audit classify
   raw state before normalized display fields.
3. Add focused tests for the state-carryover case and signal-error propagation.
4. Do not touch raw artifacts, retired scripts, old Railway deploy surfaces, or
   `ChatWidgetPanel.vue` in the same slice.

That gives immediate proof-discipline leverage without mixing in deletion work
or a large UI refactor.
