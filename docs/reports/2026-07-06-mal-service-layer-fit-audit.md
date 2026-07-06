# MAL Service Layer Pattern Fit Audit - 2026-07-06

Practical takeaway: Harry's model/repository/service/controller preference is
already the right direction for LoanSlam's API-like product boundaries, but it
should not be copied literally into the Phase 0 conversation engine. The clean
translation is:

- Use MAL-style layering where a domain has an HTTP boundary, request/response
  contract, persistence or mock store, and business workflow.
- Keep the core engine as a port-and-pipeline module: contracts -> retrieval ->
  planner -> validator -> trace.
- Add small domain modules where the code is already re-deriving API, state, or
  policy decisions locally: IPOC ticket/session, concierge session/turn,
  site-route policy, handoff-intake state, and evidence projection.

No source behavior was changed for this report.

## Scope

Reference repo reviewed:

- `/Users/mrkai/code/archive/mal/mal-solosight`
- Branch: `rickhallett/docs/engineering-standards`
- Important caveat: that checkout has existing dirty/untracked docs and local
  files. This audit reads source/docs only.

LoanSlam repo reviewed:

- `/Users/mrkai/code/loanslam`
- Branch: `codex/chore/commit-dirty-cleanup`
- Worktree already contained an untracked design-pattern report:
  `docs/reports/2026-07-06-design-patterns-audit.md`. I treated it as prior
  working material and wrote this report separately.

Tools and evidence:

- Source read of MAL `ENGINEERING_STANDARDS.md`, `docs/api-module-patterns.md`,
  representative admin module, `server.ts`, and `ServiceResponse`.
- Source read of LoanSlam contracts, core engine, planner/signal adapters,
  validator, IPOC routes/store/adapter/shared types, Nuxt concierge, site route
  policy, lab server, MCP lab client, demo/review widgets, and proof/report code.
- Fallow static sanity pass. Current LoanSlam score was `B/80.4`; duplication
  was about `10.65%`. This was used as a weak signal only, not as proof of a
  design claim.

## What Harry's Pattern Means In MAL

The MAL/SoloSight pattern is a feature-domain API module:

```text
api/<module>/
  routes/        # Express router and OpenAPI registry
  controllers/   # HTTP handlers
  services/      # business rules and ServiceResponse creation
  repositories/  # Prisma queries and transactions
  models/        # Zod schemas, inferred types, mappers
  helpers/       # pure utilities
  __tests__/     # module-local tests
```

That structure is explicit in the standards doc
(`/Users/mrkai/code/archive/mal/mal-solosight/ENGINEERING_STANDARDS.md:22`) and
the API module guide
(`/Users/mrkai/code/archive/mal/mal-solosight/docs/api-module-patterns.md:13`).

The normal request path is:

```text
server.ts route mount
  -> routes/<module>.routes.ts
  -> validateRequest(...)
  -> controller method
  -> service method
  -> repository method
  -> prisma
```

MAL's admin module is the compact live example:

- Route owns Express wiring and OpenAPI registration:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/api/admin/routes/admin.routes.ts:17`
- Controller is a thin HTTP adapter:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/api/admin/controllers/admin.controller.ts:6`
- Service owns business rules, hashing, error mapping, and `ServiceResponse`:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/api/admin/services/admin.service.ts:12`
- Repository owns Prisma access and explicit async query methods:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/api/admin/repositories/admin.repository.ts:4`
- Model is a Zod schema tied to Prisma with `satisfies z.ZodType<...>`:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/api/admin/models/admin.model.ts:8`

The pattern's most important conventions are:

- Feature/domain foldering, not file-type foldering.
- Zod schemas at the HTTP boundary and OpenAPI co-location with routes.
- Controllers stay thin.
- Services own error boundaries and safe user-facing responses.
- Repositories throw and expose explicit `Async` persistence methods.
- `ServiceResponse` is the transport envelope:
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/models/serviceResponse.ts:4`
- Runtime singleton ownership is a known standards-vs-live-code gap: standards
  say config modules should own `prisma`/logger, but live code still exports
  them from `server.ts`
  (`/Users/mrkai/code/archive/mal/mal-solosight/app/src/server.ts:25` and
  `/Users/mrkai/code/archive/mal/mal-solosight/app/src/server.ts:79`).

## Translation To LoanSlam

LoanSlam has a different center of gravity. The core is not a CRUD API over
database entities. The current architecture doc says the engine flow is:

```text
conversation context -> retrieval -> LLM turn plan -> policy/grounding validator -> validated response and trace
```

See `docs/llm-turn-planner-architecture.md:10`.

So the mapping is:

| MAL concept | LoanSlam equivalent | Fit |
| --- | --- | --- |
| Model | Zod contracts in `packages/contracts`, IPOC shared types, site-route policy data | Strong |
| Repository | Persistence/mock stores, corpus loaders, artifact readers/writers, lab session stores | Strong where state exists |
| Service | `processTurn`, IPOC engine adapter, concierge turn runner, route/audit/evidence projection modules | Strong, but often function/port based |
| Controller | Nuxt/Nitro route handlers, lab route-table handlers, CLI command dispatch | Partial |
| ServiceResponse | Not generally used; h3 errors and typed result objects are native to Nuxt/Nitro and engine callers | Usually not a good fit |

The core design already has strong boundaries, but names them differently:

- `packages/contracts/src/schemas.runtime.ts:3` defines the shared domain
  language.
- `TurnPlanner` and `SignalExtractor` are small ports
  (`packages/contracts/src/schemas.runtime.ts:413`).
- `processTurn` is the deterministic orchestration service
  (`packages/core/src/engine.ts:50`).
- `OpenAiTurnPlanner` and `OpenAiSignalExtractor` are provider adapters
  (`packages/core/src/planners/openaiPlanner.ts:50`,
  `packages/core/src/signals/openaiSignalExtractor.ts:51`).
- `validateTurnPlan` is an ordered policy pipeline
  (`packages/core/src/validator.ts:93`).

That is not failure to adopt the MAL preference. It is the same separation goal
applied to a non-CRUD, model-mediated engine.

## Fit Matrix

| Area | Could use MAL pattern? | Current degree | Judgment |
| --- | --- | --- | --- |
| Core engine (`packages/core/src/engine.ts`) | No, not literally | High architectural separation through ports/pipeline | Keep `processTurn` as the core service/orchestrator. Do not split into CRUD-style controllers/repositories. |
| Contracts (`packages/contracts`) | Model layer only | High | Already models the domain with Zod and exported types. This is the closest equivalent to MAL `models/`, but deliberately shared across packages. |
| Planner/signal adapters | Service/adapter layer | High | Current `OpenAiTurnPlanner` and `OpenAiSignalExtractor` are good service adapters. They should not become repositories because they are external inference adapters, not persistence. |
| Validator and policy | Domain service/catalog | Medium | `validator.ts` is strong, but policy doctrine is repeated across policy, prompts, and judge rubrics. A `PolicyRuleCatalog` would align with MAL's "one domain concept owns its rules" preference. |
| Handoff facts/intake | Domain model/service | Medium-low | Raw `ConversationState.collectedFacts` is still a string bag (`packages/contracts/src/schemas.runtime.ts:173`). A `HandoffIntakeState` module should own candidate vs confirmed facts, missing fields, and readiness. |
| IPOC HTTP/API surface | Yes, strongly | Medium | Shared types, store, and engine adapter exist, but handlers still perform session lookup, validation, service work, and response shaping locally. Split into route/controller/service/repository-style modules as this grows. |
| IPOC mock ticket/session store | Repository pattern | Medium | `ipocStore.ts` is effectively a repository over in-memory maps (`packages/integrated-poc/server/utils/ipocStore.ts:56`). It should be named and tested as a repository/store boundary if kept. |
| IPOC engine integration | Service/adapter pattern | Medium | `engineAdapter.ts` wraps `processTurn` and ticket creation (`packages/integrated-poc/server/utils/engineAdapter.ts:57`), but corpus loading happens at module init (`engineAdapter.ts:43`). Prefer a runtime factory for request-safe config errors. |
| Nuxt concierge API | Yes, lightly | Medium-low | Route handlers validate, rate-limit, session-check, stream, and shape responses in one file. A small controller/service/session-store split would help if concierge continues. Keep it light because it is demo-only. |
| Concierge turn runner | Service pattern | Medium | `runConciergeTurn` owns model prompt, session mutation, page/form context, URL rewriting, and streaming concerns (`packages/site-nuxt/server/utils/concierge.ts:156`). It should split into turn service, prompt builder, session store, stream client if retained. |
| Site route/navigation policy | Model/service pattern | Medium | `siteMap.ts` says it is the single source of truth, but nav offers and URL rewriting duplicate policy. A `SiteRoutePolicy` module is a good MAL-style domain model/service without database. |
| Chat widget panel | Frontend service/adapter pattern | Low-medium | `ChatWidgetPanel.vue` chooses between concierge and engine paths in one submit function (`packages/site-nuxt/components/ChatWidgetPanel.vue:895`). Use `AssistantBrain`, stream client, and transcript store rather than controller/repository names. |
| Lab API server | Controller/router pattern | Medium | The route-table dispatcher is intentional and strong (`packages/core/src/lab/server.ts:353`). Extract session stores/static responder/recorders only if the file keeps widening. |
| MCP lab client | Adapter/service pattern | High | This is already a boundary adapter with allowed local base URLs and typed session dumps (`packages/mcp-server/src/labApiClient.ts:78`). Do not force controller/repository layering here. |
| Hell Week, STS, route-audit | Projection/report services | Medium | They should not be CRUD modules. The right MAL-style move is shared models/projections, especially `TurnEvidenceProjection`, so proof tools stop reconstructing trace facts differently. |
| Demo/review widget packages | Host-adapter/core pattern | Medium-low | The old PRD calls for one widget core and host adapters; current demo/review widgets are duplicated twins. Either freeze for sunset or extract widget core if both survive. |
| CLI and operator scripts | Not MAL service pattern | Medium | These are deterministic operations and proof gates. The operator architecture intentionally uses dispatcher/reference/script tiers, documented in `docs/loanslam-operator/02-architecture.md:5`. |
| Static site/content pages | No | Not applicable | These are view/content surfaces. Applying service/repository/controller layers would add ceremony without isolating real domain change. |

## Where To Incorporate Harry's Preference Next

### 1. IPOC domain modules

This is the strongest match. The closed Integrated POC card already explicitly
allowed "thin route/controller/service/repository layering at API-like
boundaries" for API handlers, mock persistence, external adapters, engine
integration, and session/context boundaries
(`docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md:103`).

Current state:

- Handlers are thin-ish but still own too much repeated logic:
  `packages/integrated-poc/server/api/ipoc/sessions/[conversationRef]/messages.post.ts:19`,
  `lookup.post.ts:16`, `intake.post.ts:16`.
- Shared request/response types exist:
  `packages/integrated-poc/shared/ipoc.ts:9`.
- In-memory session/ticket persistence exists:
  `packages/integrated-poc/server/utils/ipocStore.ts:56`.
- Engine adapter exists:
  `packages/integrated-poc/server/utils/engineAdapter.ts:57`.

Recommended shape if we continue IPOC:

```text
packages/integrated-poc/server/domains/ipoc/
  models/ipoc.model.ts              # request/response schemas and domain types
  repositories/ipocSession.store.ts # current Map-backed session/ticket store
  services/ipocTurn.service.ts      # run engine, append messages, build ticket
  services/ipocLookup.service.ts    # mock customer lookup and account answers
  controllers/ipoc.controller.ts    # h3 event adapters
```

Do this incrementally. Start with helpers like `requireIpocSession(event)` and
typed request validation before moving files.

### 2. Handoff intake state

The engine currently keeps handoff facts in a plain record
(`packages/contracts/src/schemas.runtime.ts:173`). The architecture doc already
states that the Phase 0 field set differs from the product target and must stay
explicit (`docs/llm-turn-planner-architecture.md:162`).

Recommended module:

```text
packages/core/src/handoff/
  intakeState.ts
```

Responsibilities:

- confirmed facts vs candidate facts
- missing fields
- conflict resolution
- readiness for ticket creation
- mapping to IPOC/admin display

This is a better Harry-pattern application than renaming `processTurn` to a
service class.

### 3. Evidence projection

Trace facts are projected differently by Hell Week, STS, route audit, demo
telemetry, and MCP summaries. The right domain object is a shared projection
module, not a controller.

Recommended module:

```text
packages/core/src/evidence/turnEvidenceProjection.ts
```

Responsibilities:

- raw trace view
- scoring view
- normalized display view
- signal error/timeout propagation
- selected/effective/score route calculation

This aligns with the MAL principle that one domain concept should own its
representation.

### 4. Site route policy

The site already has a model-like source of truth in `siteMap.ts`, but nav
offers and URL rewriting carry separate policies:

- `packages/site-nuxt/lib/siteMap.ts:1`
- `packages/site-nuxt/lib/navOffer.ts:18`
- `packages/site-nuxt/lib/siteUrls.ts:49`

Recommended module:

```text
packages/site-nuxt/lib/siteRoutePolicy.ts
```

Responsibilities:

- known pages and excluded pages
- nav offer metadata
- legacy host/path normalization
- fail-closed display URL rewriting
- prompt lines for concierge

This is MAL-style domain ownership without database ceremony.

### 5. Concierge session/turn service

The concierge is explicitly demo-only and prompt-guarded, with no validator
(`packages/site-nuxt/server/utils/concierge.ts:8`). That is a documented product
choice, not an architecture accident. But the current route and utility module
are getting large:

- route does kill switch, rate limit, session lookup, body validation, streaming,
  and response shaping (`messages.post.ts:19`).
- utility does session store, prompt construction, model call, context packing,
  URL rewriting, and transcript mutation (`concierge.ts:27`,
  `concierge.ts:156`).

If concierge remains after the demo arc, use a small split:

```text
server/domains/concierge/
  concierge.model.ts
  conciergeSession.store.ts
  conciergeTurn.service.ts
  concierge.controller.ts
  conciergeStream.client.ts
```

Keep it thinner than MAL/SoloSight because there is no Prisma, OpenAPI, or
production audit contract here yet.

## Where Not To Force The Pattern

### Core engine

Harry's pattern would be harmful if copied literally into `processTurn`. The
architecture doc says the current proof is engine-first, and the core question is
whether `processTurn` can safely handle conversations across retrieval, prompts,
models, and validation rules (`docs/llm-turn-planner-architecture.md:5`).

The current core already separates:

- model contracts: `packages/contracts/src/schemas.runtime.ts`
- provider adapters: planner and signal extractor
- retrieval: `packages/core/src/retriever.ts`
- service/orchestration: `packages/core/src/engine.ts`
- validator/policy: `packages/core/src/validator.ts` and `policy.ts`
- evidence: `TurnTrace` and proof tools

Adding `controllers/` and `repositories/` inside the engine would make the
actual engine less legible.

### Proof tools and judges

Hell Week, STS, route-audit, and report renderers are not request/response API
domains. They are evidence/projection tools. The right abstraction is shared
evidence models and projections, not MAL-style HTTP controllers.

Relevant docs:

- `docs/llm-turn-planner-architecture.md:174`
- `docs/llm-turn-planner-architecture.md:195`
- `docs/llm-turn-planner-architecture.md:211`

### Operator scripts

The operator surface is intentionally a four-tier dispatcher/reference/script
system. It exists to make agent operations deterministic and proof-oriented, not
to model business domains. See `docs/loanslam-operator/02-architecture.md:5`.

### Static site pages

Static content routes and page templates should not grow repositories or
controllers. The domain boundary belongs around route/navigation policy and the
assistant/page context contract, not around every page component.

## Harry-facing Explanation

Use this as the concise explanation:

> I reviewed SoloSight's live pattern rather than only copying the written
> standards. The pattern I took from it is feature-domain ownership: a domain
> should keep its model, HTTP boundary, business workflow, persistence adapter,
> and tests close together, with controllers thin and services owning business
> errors. I have used that principle where LoanSlam has API-like product
> boundaries, especially the Integrated POC session/ticket/admin surfaces, and
> I have documented the next thin splits for those modules.
>
> I did not force the same route/controller/service/repository names into the
> Phase 0 conversation engine because that engine is not CRUD over persisted
> entities. Its real architecture is a typed port-and-pipeline: contracts,
> retrieval, an untrusted model `TurnPlan`, deterministic validation, and trace
> evidence. That is the same separation principle, but applied to model-mediated
> decisioning rather than an Express/Prisma API. The detailed rationale is in
> `docs/llm-turn-planner-architecture.md`.
>
> The areas I would still move closer to your preferred shape are the IPOC API
> surface, concierge session/turn handling if it survives the demo phase,
> site-route policy, handoff-intake state, and shared evidence projection.
> The areas I would not convert are the core engine, proof batteries, operator
> scripts, and static content pages, because their boundaries are pipeline,
> evidence, or view boundaries rather than API domain boundaries.

## Documents To Point Harry To

- `docs/llm-turn-planner-architecture.md`:
  explains why the engine is `conversation context -> retrieval -> LLM turn plan
  -> validator -> trace`, and why the model does not own compliance.
- `docs/prds/closed/2026-07-01-integrated-poc-implementation-agenda-card.md`:
  explicitly authorizes thin route/controller/service/repository layering at
  API-like boundaries for the Integrated POC.
- `docs/prds/2026-06-20-site-widget-integration-architecture-prd.md`:
  explains the core-vs-adapter distinction for the website/chat widget boundary.
- `docs/reports/2026-07-01-widget-adapter-sunset-assessment.md`:
  explains why the older demo/review widget adapter stack is transitional and
  should be frozen or sunset rather than heavily refactored.
- `docs/loanslam-operator/02-architecture.md`:
  explains why repo operations use dispatcher/reference/script tiers rather than
  business-domain service layering.

## Recommended Next Work

1. Add `HandoffIntakeState` in `packages/core/src/handoff/` and route engine,
   IPOC ticket creation, and display telemetry through it.
2. Add `TurnEvidenceProjection` in `packages/core/src/evidence/` and switch Hell
   Week plus route-audit to consume it.
3. Add `SiteRoutePolicy` in `packages/site-nuxt/lib/` and derive site map lines,
   nav offer paths, and URL rewriting from it.
4. For IPOC, extract request/session validation and rename the current in-memory
   store as an explicit repository/store boundary before adding any more admin
   behavior.
5. For concierge, only split into controller/service/store if the surface
   survives the current demo phase; otherwise avoid investing in a temporary
   prompt-only surface.

## Bottom Line

For Harry: yes, the architecture preference has been incorporated where it fits.
The strongest fit is Integrated POC and future product API boundaries. The
current core engine deliberately uses a pipeline/ports pattern because it is a
model-mediated decision engine, not a Prisma-backed domain API. The remaining
gaps are named and bounded, and the repo already has docs that explain the
intentional deviations.
