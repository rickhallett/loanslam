# Architecture & Technical Decisions

Technology stack and architectural conventions for the chat-widget MVP. The stack and conventions are largely mandated by the senior developer to standardise practice across the company's projects; follow them unless a decision below pins something specific.

## Stack

A TypeScript npm-workspace monorepo: a Vue 3 iframe widget, an Express 5 API, shared Zod contracts, SQL Server persistence via Prisma, and optional cloud AI/RAG adapters behind runtime switches.

Current implementation starts with the Phase 0 TurnPlanner engine proof in
`docs/llm-turn-planner-architecture.md`. The stack below remains the eventual
productisation target after the engine, journey simulation suite, and model
comparison harness have proved the core behaviour.

- **Monorepo:** npm workspaces — `backend`, `widget`, `contracts`. TypeScript ES modules throughout, with TypeScript source imports that do not use `.js` specifiers. Justfile is the operator command front door.
- **Widget:** Vue 3 iframe widget built with Vite. Uses shared contract schemas. Credentialed fetch with session cookies and CSRF headers. Intentionally thin: rendering, transport, local interaction state only.
- **Contracts:** Zod schemas define request/response contracts; export chat response states and the `ServiceResponse` envelope; shared by backend and widget to keep wire behaviour aligned.
- **API:** Node 24, Express 5, TypeScript. Middleware: Helmet, CORS, cookie parsing, JSON body parsing, pino HTTP logging. OpenAPI generated from route-local Zod registration. Endpoints: health, session create, message turn, identity intake, reset.
- **Domain:** `ChatService` eventually owns the fail-closed turn pipeline: conversation context -> retrieval -> constrained LLM turn planner -> policy/grounding validator -> audited response or handoff. Phase 0 proves this as a local `processTurn` engine and trace harness before the production API/widget/deployment layers.
- **Persistence:** SQL Server via Prisma 7 (MSSQL adapter): sessions, transcript entries, client-message idempotency, audit events, UAT/evidence rows. Dockerized SQL Server for local dev and scratch verification.
- **AI/RAG:** real API mode uses a managed knowledge-base retrieval path for grounded answers; classifier and vulnerability checks can switch to managed model services when enabled. All behind runtime switches.
- **Infra:** backend builds into a Node 24 Alpine container; OpenTofu describes dev deployment. Shape: container registry -> managed container service -> managed SQL Server -> private static asset buckets behind CDN. Secrets and AI/RAG access injected via environment/config, never hardcoded.
- **Testing:** Vitest (backend, contracts, widget); Vue type-check + Vite production build for the frontend; ESLint + Prettier as style gates.

SQL Server is a deliberate standardisation requirement, not a default. Keep it; do not substitute Postgres.

## Conventions 

A feature-module, layered Express API with Zod-owned contracts and a uniform `ServiceResponse` envelope. Pragmatic, not framework-heavy: route files wire HTTP and OpenAPI, controllers translate HTTP into service calls, services own business flow and error boundaries, repositories own Prisma access.

- **Feature folders by domain,** each owning its routes, controllers, services, repositories, models, helpers, and tests.
- **Route-local contracts:** routes register Express handlers and nearby OpenAPI `registerPath` docs in the same file.
- **Zod is the boundary source of truth:** schemas validate requests, infer TS types, and feed OpenAPI. Entity schemas mirror Prisma models; input schemas are derived by `omit`/`extend`.
- **Uniform envelope:** everything returns `{ success, message, responseObject, statusCode }` via `ServiceResponse`, including business outcomes.
- **Thin controllers, service-owned errors:** controllers call services and return the envelope; services catch exceptions, log detail, and return safe failures.
- **Repositories are explicit Prisma accessors:** async methods, declared return types, includes/omits close to the query.
- **Manual composition over a DI framework:** classes plus module-level singleton exports, with constructor defaults where test seams are needed.

### Where we pin specifics

1. **`server.ts` is composition wiring only.** Runtime singletons (logger, prisma, model/RAG clients) live under `config`, not exported from `server.ts`. The reference repo still exports them from `server.ts`; that is its cleanup debt, and as a greenfield project we start clean. Spirit, not sprawl.
2. **Feature modules matched to this app's size.** This is essentially one domain — the conversation — not many. Use one `chat` (or `conversation`) feature module, plus `audit`, and apply the layer conventions inside it. Do not manufacture a separate feature module per endpoint.

## Decision: iframe session / cookie strategy

The widget is embedded as an iframe on the client's WordPress site (a different origin) to avoid fighting WordPress CSS. That makes the session cookie third-party by default, which Safari and Firefox block — a silent session failure that only shows up off localhost.

- **Now, and as the flexible default: CHIPS partitioned cookies.** The session cookie is set `HttpOnly; Secure; SameSite=None; Partitioned`. This keeps the session ID out of JavaScript, works while embedded, and scopes the cookie per embedding site (fine — there is effectively one). Must be tested in Safari, not just localhost Chrome.
- **Closer to deploy: same-site subdomain.** The client agreed to point `chat.<their-domain>` at our infrastructure (a DNS delegation, not a WordPress change). Serving the widget and API from that subdomain makes the cookie first-party and removes third-party blocking entirely. Needs an ACM cert for the subdomain.
- Rationale for ordering: CHIPS first gives flexibility during the build and a fallback if the subdomain hits an unexpected snag; the subdomain is the stronger end state and the client agreed to it closer to deploy.
- CSRF protection (custom header + double-submit token) applies in both cases. The session ID is never exposed to browser JavaScript; the non-secret conversation reference returned in responses is for support correlation only, not authentication.

## Decision: vulnerability handling fails closed

The production vulnerability gate runs before normal routing. When it is model-backed and the model errors or times out, it must fail **closed**: treat the turn as a possible vulnerability and route to a human. Uncertainty routes to safety, never to normal flow. This backs a non-negotiable release rule in the product brief.

Phase 0 proves the same safety boundary through one `TurnPlanner` call that proposes `safetyFlags`, followed by deterministic validation. Do not add a separate model-backed vulnerability detector during Phase 0 unless trace evidence shows the single-planner approach misses risk.

## Decision: grounding-adapter contract

Every customer-facing answer must be grounded in retrieved knowledge, or the turn routes to handoff. The retrieval adapter must therefore return a **grounding signal** (match scores and/or citations), not just text, so the router can decide answerable-vs-handoff. If retrieval returns bare text, the grounding gate has nothing to act on.
