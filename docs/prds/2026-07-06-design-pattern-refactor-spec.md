# Design Pattern Refactor Spec

Date: 2026-07-06
Status: proposed
Owner: architecture/refactor

Source inputs:

- `docs/reports/2026-07-06-design-patterns-audit-staff-bar.md`
- `docs/reports/2026-07-06-mal-service-layer-fit-audit.md`
- `docs/llm-turn-planner-architecture.md`
- `docs/prds/2026-07-06-lsops-operator-tools-spec.md`

## Summary

Refactor LoanSlam toward clearer design ownership without pretending every part
of the system is the same kind of application.

The staff-bar design audit says the codebase is fundamentally sound, but its
best patterns are unevenly applied: contracts and discriminated unions exist,
yet load-bearing classifications are still re-derived as strings; proof tools
exist, yet several can look green while the property they claim to prove was not
measured; strong boundaries exist, yet some API/product surfaces still mix
transport, state, business rules, and rendering.

The MAL/SoloSight audit gives the architectural preference to apply where it
fits: feature-domain ownership with model, repository/store, service, and
controller boundaries. LoanSlam should adopt that preference at API-like product
boundaries such as Integrated POC, concierge if retained, site-route policy,
handoff intake, and evidence projection. The core Phase 0 conversation engine
should not be converted into CRUD-style layers; its correct shape remains a
typed port-and-pipeline:

```text
conversation context
  -> retrieval
  -> untrusted LLM TurnPlan
  -> deterministic policy/grounding validator
  -> response renderer and trace evidence
```

This spec is a refactor runway. It does not claim any behavior has changed.

## Problem Statement

LoanSlam has enough working architectural material to avoid a rewrite, but the
current code has six repeated design problems:

1. One fact has many homes. Safety vocabularies, URL policy, severity ordering,
   judge metadata, report primitives, serving-mode precedence, and handoff
   decisions are copied across modules.
2. The proof surface can lie. Evidence, probe, judge, replay, and report paths
   can silently drop failures, exit successfully on broken runs, or score stale
   data against newer definitions.
3. Classification is stringly typed where the compiler should help most:
   route-audit rows, collected facts, scenario categories, finding categories,
   forbidden behaviors, and action predicates.
4. Failure policy points in the wrong direction in places: observability writes
   can fail closed on serving paths, while evidence and safety checks sometimes
   fail open or silently coerce.
5. Boundaries leak. Consumers reach into producer internals and re-derive
   serving-mode, handoff, telemetry, or contract rules instead of using the
   producer's domain model.
6. Some monoliths are large enough to conceal the above: ChatWidgetPanel,
   Integrated POC `app.vue`, lab UI `App.vue`, concierge utils, CLI dispatch,
   and the engine handoff cascade.

The architectural risk is not aesthetic. For this product, design drift becomes
evidence drift, and evidence drift can make a stakeholder believe a safety or
route property is proven when it is not.

There is also a stakeholder alignment problem. Harry's preferred MAL pattern is
valuable, but applying the file names literally everywhere would be incorrect.
We need a documented rule for when model/repository/service/controller layering
is the right move, and when a port/pipeline, proof-tool, or view/component
boundary is the better expression of the same separation principle.

## Goals

- Make shared product facts have one typed home.
- Make proof and evidence paths fail honestly and preserve provenance.
- Use MAL-style model/repository-or-store/service/controller layering at
  API-like product boundaries.
- Keep the Phase 0 engine as a port-and-pipeline with deterministic validation
  as the hard authority.
- Move stringly-typed classifications into exported unions, schemas, predicates,
  or catalogs.
- Refactor large modules only behind existing behavioral seams and after the
  higher-leverage taxonomy/evidence work is underway.
- Keep the result easy to explain to Harry: adopted where relevant, deliberately
  not forced where the domain boundary is different.

## Non-Goals

- Do not rewrite the core engine.
- Do not introduce a generic enterprise layering framework.
- Do not wrap every function in classes.
- Do not add `ServiceResponse` envelopes to Nitro/h3 routes unless a specific
  route family needs that contract.
- Do not merge intentionally separate demo/review widget surfaces as part of
  this spec.
- Do not change customer-facing behavior without full integration evidence.
- Do not fold operator tooling into product runtime packages.
- Do not use this PRD as proof that any refactor has shipped.

## User Stories

- As Harry from MAL, I can see where LoanSlam adopts the model/repository or
  store/service/controller preference and where it uses an equivalent boundary
  for a non-CRUD AI engine.
- As a developer, I can change a safety vocabulary, route policy, handoff field,
  or judge metadata field in one canonical place and get compile/test feedback
  when consumers drift.
- As an operator, I can trust that a green proof run means the intended property
  was actually exercised, or that the evidence says exactly why it was not.
- As a reviewer, I can review small refactor slices with clear behavior-preserved
  proof instead of a broad architecture rewrite.
- As a future implementation agent, I can pick one work pack without needing to
  rediscover why some areas use MAL-style layering and others do not.

## Architectural Decision

Adopt the separation goal, not the folder names blindly.

### Use MAL-style domain layering when the boundary has HTTP, state, workflow, or persistence

Good fits:

- Integrated POC sessions, tickets, lookup, intake, and admin readback.
- Concierge sessions and turns, if the concierge survives the demo phase.
- Site route and navigation policy, even without a database.
- Handoff intake state, because it owns a closed field vocabulary and readiness
  lifecycle.
- Evidence projection, because multiple tools need the same trace facts shaped
  for display, scoring, summaries, and artifacts.

Recommended naming can be pragmatic:

```text
models/ or *.model.ts       typed schemas, unions, parsed boundary data
stores/ or repositories/    state, persistence, artifact reads/writes
services/                   domain workflow and business decisions
controllers/ or handlers/   transport adapters kept thin
```

For in-memory or Nitro storage, `store` is often clearer than `repository`. The
important point is that state access becomes a named boundary.

### Keep the core engine as ports and pipeline

The engine is not CRUD over persisted entities. It is a deterministic
orchestrator around an untrusted model plan:

- contracts define the domain language;
- retrieval supplies evidence;
- planner and signal extractor are provider ports/adapters;
- validator and policy enforce deterministic constraints;
- trace captures the proof surface.

Do not add controllers or repositories inside `processTurn`. Instead, improve
the engine with typed subdomains where the staff-bar audit found load-bearing
strings or duplicated predicates:

- `HandoffIntakeState`
- policy/rule catalog or registry
- typed handoff/action predicates
- `TurnEvidenceProjection`

### Treat proof surfaces as product surfaces

Hell Week, STS, route-audit, MCP summaries, lab display, and probe scripts are
not secondary housekeeping. They shape the evidence stakeholders use to decide
whether the product is safe and ready. Their refactors must be held to the same
design standard as runtime code.

## Work Packs

### Pack 0 - Lock the refactor contract

Purpose: prevent architectural drift before code starts moving.

Deliverables:

- This spec as the plan of record for design-pattern refactors.
- A short note in future implementation PRs stating which boundary type the
  slice uses: API domain, engine pipeline, evidence projection, operator tool,
  or view/component.
- Each implementation slice names its source finding(s) from the staff-bar audit
  and whether it applies the MAL pattern literally or by analogy.

Acceptance:

- Docs clearly say this is runway-only until implementation commits land.
- Implementation PRs do not cite this doc as behavioral proof.

### Pack 1 - Close latent correctness and honesty bugs first

Purpose: handle issues where design debt is already a product-risk bug.

Target areas:

- Integrated POC session/ticket store currently behaves like a repository but is
  exposed through module-level maps and deep route re-exports.
- Serving-path audit logging must not convert a completed successful turn into a
  failed customer response.
- Probe, proof, and judge scripts must not exit successfully on failed or
  all-error runs.
- Re-grade/replay paths must preserve run scope and scenario provenance.

Pattern decision:

- IPOC gets a real store/repository boundary and thin route handlers.
- Logging/proof fixes stay in service/tooling code; no controller ceremony.

Acceptance:

- Any serving-path observability failure is recorded or dropped without
  changing the completed user response.
- Any broken probe/proof/judge run exits non-zero or emits an explicit
  inconclusive/blocked result.
- IPOC state ownership is resolved through one named store boundary, not by
  relying on bundler module identity.

Proof:

- `just branch-risk -- --base dev`
- `just gate-slice`
- Full integration path for any route, lab, planner, validator, demo, or
  stakeholder behavior claim.

### Pack 2 - Canonicalize domain vocabularies and policy facts

Purpose: make one fact have one home.

Target facts:

- unsafe proposal codes and vulnerability flags
- safe/fallback action families
- serving-mode precedence
- handoff action predicates
- route-audit action and safety fields
- severity ordering
- judge metadata and rubric identity
- first-party host/path/alias policy
- scenario and finding categories

Pattern decision:

- Contracts and policy catalogs are the model layer.
- Site-route policy is a domain model/service even though it has no database.
- Validator/policy remains engine-adjacent, not an HTTP module.

Candidate modules:

```text
packages/contracts/src/
  taxonomy.ts
  evidence.ts

packages/core/src/policy/
  ruleCatalog.ts
  handoffPredicates.ts

packages/site-nuxt/lib/
  siteRoutePolicy.ts
```

Acceptance:

- Consumers import the canonical vocabulary instead of redeclaring literals.
- New vocabulary members fail loudly in relevant exhaustive switches, mapped
  records, or schema tests.
- `siteUrls`, `content`, `navOffer`, and brand host rewriting consume one route
  policy source.

### Pack 3 - Make evidence projection honest and shared

Purpose: stop each evidence surface from reconstructing engine facts
differently.

Target areas:

- `ValidatedTurnResult.trace` projection for lab UI, IPOC telemetry, MCP
  summaries, Hell Week, route-audit, simulation, and reports.
- Deterministic violation merge behavior in judge paths.
- Planner/signal parsing failures and model-field coercions.
- Stochastic and Hell Week artifact provenance.

Pattern decision:

- This is a model/service projection boundary, not a controller/repository
  boundary.

Candidate module:

```text
packages/core/src/evidence/
  turnEvidenceProjection.ts
```

Responsibilities:

- normalize selected vs effective serving mode;
- expose safety flags, override codes, and signal extraction status;
- preserve signal timeout/error/coercion notes;
- shape trace facts for display vs scoring vs report output;
- carry run/scope/provenance metadata without silent substitution.

Acceptance:

- IPOC telemetry and core lab display stop maintaining hand-copied projection
  logic.
- Evidence surfaces do not discard deterministic content violations.
- Report/re-grade paths state which scenario source and artifact scope they
  used.
- Inconclusive evidence is represented as inconclusive, not as green.

### Pack 4 - Make illegal states unrepresentable at classification boundaries

Purpose: replace raw strings and correlated booleans with types that encode the
domain shape.

Target areas:

- `ConversationState.collectedFacts`
- route-audit rows
- approved link destination shape
- state token payloads
- telemetry payloads crossing package or transport boundaries
- scenario/finding categories
- UI primitive render exhaustiveness
- widget turn lifecycle and mutually exclusive offer state

Pattern decision:

- Shared contracts and schemas are the model layer.
- Runtime adapters parse at trust boundaries.
- Frontend state may use composables/state machines rather than repositories.

Acceptance:

- Handoff intake fields are keyed by a closed field union.
- `ApprovedLink` has one valid destination representation.
- State-token and telemetry payloads parse through schemas instead of unchecked
  casts.
- UI primitive render code has an exhaustive fallback that fails in development
  or compile/test paths when a primitive is added.

### Pack 5 - Apply domain layering to API/product surfaces

Purpose: put the MAL pattern where it has the highest fit.

#### Integrated POC

Target shape:

```text
packages/integrated-poc/server/domains/ipoc/
  models/ipoc.model.ts
  stores/ipocSession.store.ts
  services/ipocTurn.service.ts
  services/ipocLookup.service.ts
  services/ipocAdmin.service.ts
  controllers/ipoc.controller.ts
```

First slices:

- `requireIpocSession(event)` shared guard.
- One request parser/response shaper for messages/intake/lookup.
- Store interface over the current in-memory implementation.
- Typed handoff/ticket predicate imported from contracts/core.
- Server-owned status transition metadata consumed by the UI.

Acceptance:

- Route handlers become thin transport adapters.
- Site-nuxt either mounts IPOC routes through one explicit route group/export or
  documents a single allowlist for the intended subset.
- Ticket creation and admin activity use typed predicates and store methods, not
  private helper reach-through.

#### Concierge, if retained

Target shape:

```text
packages/site-nuxt/server/domains/concierge/
  concierge.model.ts
  conciergeSession.store.ts
  conciergeTurn.service.ts
  concierge.controller.ts
  conciergeStream.client.ts
```

First slices:

- Promote `packages/site-nuxt/lib/concierge.ts` into a real client/server
  contract or delete the misleading stub.
- Split session store, rate-limit helper, prompt builder, and OpenAI transport.
- Collapse streaming/non-streaming request assembly into one transport path.

Acceptance:

- No extra investment if concierge is being sunset.
- If retained, request and stream frames are typed on both client and server.

#### Site route policy

Target shape:

```text
packages/site-nuxt/lib/siteRoutePolicy.ts
```

Responsibilities:

- first-party hosts;
- source-host to local-path mappings;
- aliases such as `/faqs/` to `/faq/`;
- known local paths from one authority;
- display rewrite outcomes as discriminated results;
- nav-offer eligibility.

Acceptance:

- Unknown-path behavior is named and tested rather than hidden behind `?? '/'`.
- `siteUrls`, `content`, `navOffer`, and brand host text share policy data.

### Pack 6 - Collapse duplicated scaffolding after the facts are canonical

Purpose: remove duplicated implementation machinery once types and policies have
one home.

Target areas:

- HTML escaping, duration formatting, report verdict tone.
- Hell Week and stochastic report primitives.
- Judge escalation ladder.
- Simulation runner/persona runner orchestration.
- MCP wire types.
- Browser/proof harness check/exit/report plumbing.

Pattern decision:

- Product evidence projection belongs in `packages/core`.
- Operator harness machinery belongs in the future `@loanslam/lsops` package,
  as specified in `docs/prds/2026-07-06-lsops-operator-tools-spec.md`.

Acceptance:

- Shared report helpers have one implementation and are consumed by both
  Hell Week and stochastic outputs where appropriate.
- Judge escalation logic is parameterized rather than copied.
- Browser/proof script dedup is handled through the lsops runway, not scattered
  new helper files.

### Pack 7 - Decompose monoliths behind stable seams

Purpose: reduce change cost without creating churn before the load-bearing facts
are stable.

Target areas:

- `ChatWidgetPanel.vue`
- Integrated POC `app.vue`
- lab UI `App.vue`
- `server/utils/concierge.ts`
- `applyHandoffStateRules`
- CLI command dispatch

Pattern decision:

- Frontend modules should use composables and focused components, not forced
  controller/repository names.
- Engine handoff logic should become an ordered rule pipeline/catalog, not an
  HTTP-style service stack.
- CLI command dispatch can mirror the lab server route-table pattern.

Acceptance:

- Each decomposition slice is behavior-preserving.
- State moves behind named composables/services before presentation is split.
- Existing integration and operator proof paths still pass.

## Implementation Decisions

1. **Order matters.** Correctness and evidence honesty come before aesthetic
   decomposition.
2. **One boundary, one owner.** Do not create parallel helpers that restate
   existing policy. Move callers to the canonical owner.
3. **Prefer exported functions and typed records over classes by default.**
   Introduce classes only where lifecycle/state ownership makes them clearer.
4. **Use `store` when persistence is in-memory or Nitro-backed.** Use
   `repository` only where the implementation is genuinely persistence-query
   shaped.
5. **Keep route handlers thin.** They parse transport input, call services, and
   shape transport output. Business decisions live in services/models.
6. **Keep core service/orchestration explicit.** `processTurn` may call smaller
   domain services, but it remains the readable top-level engine flow.
7. **Do not let docs outrun behavior.** Every implementation PR must say what
   changed, what stayed behavior-preserving, and what proof was run.

## Testing Decisions

Docs-only changes under this spec need markdown/file sanity checks only.
Implementation slices need proof based on blast radius:

- Type/model/catalog changes: TypeScript, schema tests, exhaustive switch tests,
  and consumers importing canonical exports.
- Route/controller/service/store changes: request-level tests plus live route or
  full integration evidence before behavior claims.
- Engine/validator/planner/handoff changes: unit tests are support scaffolding;
  the full lab/API integration path is required for behavior claims.
- Evidence/judge/report changes: fixture tests plus a real or replayed evidence
  run showing the new provenance/failure behavior.
- Frontend decomposition: component/unit checks where useful, plus browser or
  endpoint proof for the workflow touched.
- Operator tooling: `just gate-slice` and the relevant `just` proof target, with
  failures exiting non-zero.

## Out of Scope

- Choosing a durable IPOC database or production persistence backend.
- Reworking pricing, corpus, retrieval strategy, or product copy.
- Replacing Nuxt/h3 idioms with Express-style controllers.
- Refactoring retired Astro/dead-code surfaces owned by cleanup docs.
- Rebuilding the old demo/review widget stack if the accepted path is sunset.
- Creating public architecture documentation from internal proof details.

## Open Questions

1. Is Integrated POC still intended to survive as a product/admin surface, or is
   it only a proof host? This determines how far to take the store/service split.
2. Will concierge remain after the current demo phase? If not, only fix safety
   and contract bugs; do not invest in a full domain module.
3. Should route policy authority be `siteMap.ts` alone, or a generated merge of
   site map plus content records? Pick one before implementing `SiteRoutePolicy`.
4. What is the canonical handoff field set for the next product slice:
   `fullName`, `dateOfBirth`, `postcode`, `email`, `phone`, or the broader
   product wording with `address` and `situationSummary`?
5. Should evidence projection live entirely in `packages/core`, or should some
   public projection types move to `packages/contracts` for MCP/site consumers?

## Harry-Facing Position

LoanSlam has incorporated the MAL architectural preference where the boundary is
the same kind of boundary: API-like domains with request contracts, state,
workflow, and persistence or store concerns. Integrated POC is the strongest
candidate, followed by concierge if retained, site-route policy, handoff-intake
state, and evidence projection.

LoanSlam has not copied the pattern literally into the Phase 0 conversation
engine because that engine is not a database-backed CRUD API. Its correct
boundary is the deterministic AI safety pipeline: contracts, retrieval,
untrusted model plan, validation, rendering, and trace evidence. That is the
same architectural intent, expressed in the terms of this product's risk model.

The durable rule is:

- use model/store/service/controller layering where transport and state meet a
  product workflow;
- use ports, catalogs, and projections where the domain is inference,
  validation, or evidence;
- keep view and operator surfaces simple unless a real shared boundary appears.

## References

- `docs/reports/2026-07-06-design-patterns-audit-staff-bar.md`
- `docs/reports/2026-07-06-mal-service-layer-fit-audit.md`
- `docs/llm-turn-planner-architecture.md`
- `docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md`
- `docs/prds/2026-07-06-lsops-operator-tools-spec.md`
- `docs/reports/2026-07-01-widget-adapter-sunset-assessment.md`
- `docs/loanslam-operator/02-architecture.md`
