# Design Pattern Refactor Implementation Log

Date: 2026-07-06
Branch: `codex/ref/design-pattern-refactor-latest`
Spec: `docs/prds/2026-07-06-design-pattern-refactor-spec.md`

This note records the implementation slices that now back the spec. It is not a
behavior-readiness claim; route, planner, validator, demo, or stakeholder
behavior still requires the integration proof bar described in `AGENTS.md` and
the refactor spec.

## Applied MAL-Style Boundaries

| Area | Boundary Type | What Changed | Proof Run |
| --- | --- | --- | --- |
| Site route policy | Domain model/service without persistence | `packages/site-nuxt/lib/siteRoutePolicy.ts` became the canonical first-party host, local-path, URL rewrite, and nav-offer policy. Existing `sitePolicy.ts` is a compatibility re-export. | Focused site policy tests, site typecheck, site build, `source-policy:check`, `gate-slice` |
| Integrated POC | Model/store/service/controller-by-Nitro-handler | IPOC now has `models/ipoc.model.ts`, `stores/ipocSession.store.ts`, and focused services for turn, lookup, intake, account answer, admin ticket actions, and session lifecycle. Route handlers parse transport input and map HTTP errors. | IPOC service tests, IPOC typecheck, IPOC build, `source-policy:check`, `gate-slice` |
| Concierge | Model/store/service/client with existing Nitro handlers | The live concierge path now has a server domain model, session store, rate-limit service, prompt service, and OpenAI client service. The existing route handlers remain the controllers/transport adapters. | Focused concierge domain tests, site typecheck, site build, `source-policy:check`, `gate-slice` |

## Deliberate Non-Adoption

| Area | Decision | Reason |
| --- | --- | --- |
| Phase 0 core engine | Keep ports and pipeline instead of controller/repository layering. | The engine orchestrates retrieval, an untrusted model plan, deterministic validation, rendering, and trace evidence. CRUD-shaped layering would obscure the product risk model. |
| Evidence projection in `packages/core/src` | Deferred. | This is high-value, but core evidence changes trigger the full Hell Week plus judge plus floor-delta proof bar. No synthetic or stale receipt was created for this branch. |
| Demo/review widget surfaces | Not deduplicated. | The operator guardrails mark this separation as deliberate; cross-boundary imports are blocked by `gate-slice`. |
| Full route/live behavior claims | Not claimed from this refactor alone. | Typecheck, build, and focused tests prove wiring and regression coverage. They do not replace endpoint/live-flow evidence for behavior claims. |

## Harry-Facing Summary

LoanSlam has adopted the MAL model/store-or-repository/service/controller
preference where the boundary has transport, state, workflow, or persistence:
Integrated POC, the retained concierge surface, and site-route policy.

LoanSlam intentionally keeps the Phase 0 conversation engine as a typed
AI-safety pipeline, because its primary boundary is not CRUD over stored
entities. The same separation principle is applied there through contracts,
ports, policy catalogs, validators, and trace/evidence projections rather than
literal controller/repository names.
