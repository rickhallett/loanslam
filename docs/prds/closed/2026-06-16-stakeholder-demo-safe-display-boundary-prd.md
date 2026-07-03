# PRD: Stakeholder Demo Safe Display Boundary

## Problem Statement

The stakeholder demo needs to show the LoanSlam assistant's behavior, route
changes, and state-machine movement without exposing the engine internals that
make the prototype valuable intellectual property.

The current review demo already has the right customer-facing shape: a mock
contact page, a chat widget, and an optional state-machine console. The problem
is that the browser currently receives a full validated engine result and then
strips it down inside the widget before posting compact telemetry to the host
page. That is fine for local development, but it is not acceptable for a
protected stakeholder demo.

The demo should avoid unnecessary persistence, database setup, iframe proof,
CHIPS hardening, or production API work. It should prove the behavior, not the
deployment architecture.

## Solution

Add a demo-safe response boundary that maps the full engine result into a compact
display model on the server side. The browser should receive only the data needed
to render the chat and animate the state-machine console.

The engine can keep producing full `ValidatedTurnResult` objects internally for
tests, local evidence, Hell Week, and future portfolio/product work. The deployed
demo API should not return that full object. It should return customer-facing UI
plus content-free decision telemetry.

For a serverless demo, conversation continuity should use an opaque server-sealed
state token or a similarly non-readable server-owned mechanism. The browser may
carry that token between turns, but it must not be able to inspect or modify raw
conversation state, collected fact values, traces, planner output,
prompt-adjacent metadata, or retrieval evidence. For a short VPS demo, the same
display boundary still applies, but state can remain server memory.

The standalone lab console should remain a local developer/evidence tool and
should not be part of the stakeholder deployment.

## User Stories

1. As the prototype owner, I want stakeholders to interact with the assistant through a polished demo surface, so that they evaluate product behavior rather than internal implementation.
2. As the prototype owner, I want the browser to receive only display data, so that prompts, policy logic, planner proposals, retrieval details, and trace internals are not exposed before a working contract exists.
3. As a stakeholder, I want to chat with the bot and see the visible state machine move, so that I can understand the engine's routing behavior without reading code or raw traces.
4. As a stakeholder, I want to see when the model proposal is upheld or overridden, so that I can understand the safety value without seeing validator reason text.
5. As a stakeholder, I want to see routing categories, safety flags, retrieval strength, and handoff state, so that the demo feels transparent without exposing raw evidence.
6. As a stakeholder, I want to read selected Hell Week or route stability reports, so that I can inspect broader evidence without receiving full raw run artifacts.
7. As an engineer, I want the core engine to keep returning full internal results to trusted server-side callers, so that tests and evidence tooling do not lose fidelity.
8. As an engineer, I want a server-side mapper from engine result to demo display model, so that the IP-sensitive filtering is centralized and testable.
9. As an engineer, I want the review widget to consume the demo response directly, so that it no longer has to receive and strip full engine results.
10. As an engineer, I want the state-machine console to keep its existing visual protocol, so that this slice does not become a diagram rewrite.
11. As an engineer, I want the demo API to omit raw trace data, so that DevTools cannot reveal planner proposals, route reasons, matched terms, shadow signal notes, or collected fact values.
12. As an engineer, I want the demo API to expose only field names for intake progress, so that the console can show progress without exposing identity or contact values.
13. As an engineer, I want the demo API to expose only validator override codes and action transitions, so that the console can explain safety movement using host-side labels.
14. As an engineer, I want retrieval displayed as counts, scores, serving modes, and safe item identifiers only, so that the console can show grounding strength without exposing customer-derived matched terms.
15. As an engineer, I want shadow signal display limited to status, primary intent, recommended serving mode, uncertainty, and comparison status, so that the state machine can animate without revealing signal prompt output or query hints.
16. As a demo operator, I want reset to clear the visible session, so that each stakeholder walkthrough can start cleanly.
17. As a demo operator, I want source maps and local trace-export affordances absent from the deployed demo, so that the browser bundle does not invite inspection.
18. As a future maintainer, I want local lab and evidence tooling to keep full trace access, so that demo hardening does not weaken Phase 0 review evidence.
19. As a future maintainer, I want the deployed demo route to be distinct from the local lab route, so that accidental exposure of developer endpoints is less likely.
20. As the prototype owner, I want this work to defer persistence choices, so that a one- or two-day stakeholder demo does not force Prisma, Neon, SQL Server, or any production database decision.

## Implementation Decisions

- Keep the TurnPlanner engine unchanged for this slice.
- Add a demo display-model contract that is separate from the full validated engine result.
- Move the existing telemetry mapping from the browser side to the server side.
- Keep the state-machine console protocol content-free: action names, serving mode, override codes, safety flag names, retrieval counts/scores/safe identifiers, signal status/intent, intake field names, UI primitive, and turn number.
- Add a demo response contract containing customer-facing message, UI primitive, terminal-session status, host context, display telemetry, and any opaque state continuation token required by the chosen deployment shape.
- Do not return full conversation state, state history, collected fact values, `TurnPlan`, full `TurnTrace`, validator reason text, route reason text, matched terms, shadow-signal notes, shadow-signal retrieval queries, prompt text, policy source text, or raw JSON dumps to the browser.
- Preserve the local lab API and lab console for trusted development and evidence review, but do not expose them in the stakeholder deployment.
- For a serverless deployment, use an opaque server-sealed state token if no database is used. The token is a transport mechanism for server state, not a display model, and the demo should not ship without this or an equivalent server-owned continuity mechanism.
- For a short-lived VPS deployment, server memory is acceptable for session continuity, but the HTTP response boundary should still be demo-safe.
- Keep selected Hell Week and route stability reports as static demo artifacts, and publish only sanitized report views rather than raw evidence packets unless the owner explicitly approves sharing them.
- Treat access control, source-map suppression, endpoint allowlisting, and opaque continuation tokens as P1 demo-readiness requirements, not follow-up polish.
- The stakeholder demo server must be able to run in demo-only mode where trusted lab endpoints are not mounted.
- On a persistent VPS, write owner-only demo interaction logs to a server-local SQLite database outside any public/static path.
- Demo interaction logs may store full internal per-turn evidence for owner debugging, but those records must be queryable only through local/server-side commands and must never be returned by the browser-facing `/demo` API.
- Do not add persistence or database adapters in this slice.
- Do not make iframe architecture, cookies, CHIPS, CSRF, WordPress integration, or production audit storage part of this slice.

## Testing Decisions

- Test the server-side display mapper directly with representative validated engine results.
- Tests should assert that the mapper preserves all fields needed by the state-machine console: actions, serving mode, action-changed flag, override codes and transitions, safety flags, retrieval counts/scores/safe identifiers, signal status/intent, intake field names, UI primitive, source, and turn number.
- Tests should assert absence of forbidden response fields, including full trace, full state, state history, collected fact values, turn plan, validator reason text, selected route reason, matched terms, shadow-signal notes, shadow-signal route hints, shadow-signal retrieval queries, prompt text, and raw JSON dumps.
- Test the demo API behavior, not the exact implementation path: a customer message should return customer-facing UI plus display telemetry, not the full engine result.
- Test structured intake responses separately because they produce telemetry without a planner trace.
- Test reset behavior for the chosen deployment shape: in-memory reset for the short-lived server process or token reset for a stateless serverless route.
- Test that the local lab route can still return full internal evidence in trusted local mode.
- Test that demo-only mode does not expose trusted `/sessions` lab endpoints.
- Test that the opaque continuation token is not readable in the browser and cannot be modified successfully.
- Test any configured demo access gate before sharing the stakeholder URL.
- Test that demo endpoints write queryable decision receipts for owner review without storing opaque continuation tokens in display/query payloads.
- Run typecheck and focused API/widget tests before deployment.
- Run a build check before deployment and verify no production source maps are emitted.
- Use one live review-demo smoke path before sharing the URL: public FAQ answer, account-specific handoff, vulnerability/hardship route, forbidden-credential refusal/handoff, reset.

## Out of Scope

- Prisma, Neon, SQL Server, SQLite, or any persistent database.
- Production audit storage or retention decisions.
- Real customer PII intake, real account access, real ticket webhooks, CRM or loan-database integration, payment changes, or customer-record mutation.
- Proving iframe architecture, CHIPS cookies, CSRF, WordPress plugin behavior, or a same-site subdomain strategy.
- Rewriting the state-machine diagram.
- Rewriting the TurnPlanner, retriever, validator, prompt, or Hell Week evaluator.
- Publishing raw Hell Week evidence, raw traces, raw scenario packets, or full lab session dumps to stakeholders.
- Making the lab console safe for public deployment.
- Long-term portfolio persistence and analytics. Those belong in a later product or portfolio-readiness slice.

## Further Notes

The important boundary is not "hide everything." The stakeholder should still
see that the assistant is grounded, routed, and safety-checked. The boundary is
that they see those facts through a deliberately small display model, not through
the engine's working papers.

This slice keeps the future product path open. The same server-side display model
can sit in front of a later Postgres-backed API, while local Phase 0 evidence
keeps using full traces.
