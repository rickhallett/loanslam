# Loanslam Customer Support Chat Widget

An embeddable, anonymous customer-support chat widget for Loanslam, a regulated UK
consumer-loans business. The widget helps customers with general and
business-operations questions, detects vulnerability and escalation signals early,
and routes anything account-specific to the human support team — it does not service
accounts itself.

> **Status: Phase 0 engine proof.** This repository now includes the TurnPlanner
> core workspace, contracts, retrieval, validator, trace simulation, and model
> comparison harness. The product widget, production API, persistence, deployment,
> and ticket side effects are intentionally not scaffolded yet. Treat the documents
> in `docs/` as the source of truth for scope and design.

> **Confidential and proprietary.** This is private client work. See
> [LICENSE](./LICENSE). The repository must not be copied, modified, repurposed, or
> redistributed.

## What it is

A conversational front line that works alongside the existing support team. It is
designed to be live and deployed on AWS within a fixed 30-day MVP window, run for a
trial period, and have its performance measured. The trial is exploratory; no
success-rate target is set.

The current implementation priority is **Phase 0: TurnPlanner engine proof**. Build
the core processing engine, retrieval, policy/grounding validator, local trace
evidence, journey simulation suite, and model comparison harness before building the
widget, AWS deployment, production audit store, real PII intake, or ticket webhook.
See [`docs/llm-turn-planner-architecture.md`](./docs/llm-turn-planner-architecture.md).
Phase 0 evidence must come from real model-backed planner behaviour, not a fake
planner baseline, and the journey suite must be broad enough for extended stakeholder
probing across multiple customer personalities.

Core behaviour:

- Anonymous, server-owned sessions — no account access in the widget.
- Stateful conversation: it remembers the thread and collects information
  intelligently, rather than treating each message in isolation.
- Answers general and operational questions grounded in an approved knowledge base.
- Vulnerability-first routing: safety signals are handled before normal classification.
- Account-specific requests and changes are passed to a human via a ticket webhook.
- Full auditability of every inbound and outbound message.

## Safety boundaries (non-negotiable)

- Does not answer personal account questions anonymously, or invent account values,
  amounts, dates, policy, eligibility, or outcomes.
- Does not update customer records or take payment/bank credentials.
- Returns only answers grounded in approved knowledge; otherwise routes to a human.
- Does not continue normal routing after a vulnerability signal; the vulnerability
  gate fails closed.
- Frontend renders backend-decided state only; it makes no business or safety decisions.

The full set lives in [`docs/product-brief.md`](./docs/product-brief.md) §16.

## Repository layout

```
docs/                              Source-of-truth design documents
  product-brief.md                 Product scope, journeys, requirements, release rules
  architecture.md                  Stack and architectural decisions
  llm-turn-planner-architecture.md Current Phase 0 engine-first direction
packages/
  contracts/                       Shared Zod contracts for Phase 0
  core/                            TurnPlanner engine, retrieval, planner adapters, simulation
data/
  public-info/
    loan-slam-faq.json             Mock public FAQ corpus
    loanslam-synthetic-kb.json     Synthetic 60-item knowledge base (treated as real)
```

`reference/` holds local working notes and is not tracked.

## Planned architecture

The eventual product remains a TypeScript npm-workspace monorepo. Full stack detail
and rationale live in [`docs/architecture.md`](./docs/architecture.md). The first
implementation phase is narrower: prove the TurnPlanner engine described in
[`docs/llm-turn-planner-architecture.md`](./docs/llm-turn-planner-architecture.md).

- **Widget:** Vue 3 iframe widget (Vite), thin — rendering and transport only.
- **API:** Node 24, Express 5, TypeScript; Helmet/CORS/CSRF; route-local OpenAPI.
- **Contracts:** shared Zod schemas and the `ServiceResponse` envelope.
- **Domain:** Phase 0 proves a local `processTurn` engine — conversation context →
  retrieval → constrained `TurnPlanner` → policy/grounding validator → validated
  trace/result. `ChatService` is the later production wrapper around the proven engine.
- **Persistence:** SQL Server via Prisma (sessions, transcripts, audit, evidence).
- **AI / retrieval:** managed knowledge-base retrieval and model-backed checks behind
  runtime switches.
- **Infra:** Node Alpine container, OpenTofu; registry → managed container service →
  managed SQL Server → static assets behind CDN.
- **Tooling:** Justfile as the operator front door; Vitest, ESLint, Prettier.
  TypeScript source imports do not use `.js` specifiers.

The widget is embedded in the client's WordPress site via an iframe; the session
cookie strategy is CHIPS partitioned cookies now, moving to a same-site subdomain
closer to deploy (see `architecture.md`).

## Knowledge base

`data/public-info/loanslam-synthetic-kb.json` is a synthetic corpus modelled on the
mock FAQ and the observed support voice, treated as real for build and review. Each
item carries a `serving_mode` discriminator that drives the answerable-vs-route gate:

| serving_mode               | Meaning                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `answer`                   | Safe public/general info or policy/process; carries `answer_text`.                                                          |
| `handoff_account_specific` | Needs the customer's real account data; routes to the team.                                                                 |
| `route_vulnerability`      | Vulnerability/distress signal; routes to a human.                                                                           |
| `excluded`                 | Recognised subject that must not be answered substantively; refuse/signpost with approved links or route to human fallback. |

Canonical brand throughout is **Loanslam** (`loanslam.co.uk`).

## Development

Install workspace dependencies:

```bash
npm install
```

Run the Phase 0 core quality gates:

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```

These commands do not call a model. They prove the local TypeScript workspace still
parses, type-checks, builds, and passes its unit tests.

### Phase 0 command guide

The `core-*` commands run the engine proof from the terminal. They are for reviewing
the TurnPlanner's behaviour before any widget, production API, database, or ticket
webhook exists. Phase 0 evidence is not just pass/fail fixtures: it should include
the actual message/response sequences produced across different customer
personalities, plus a way for a human reviewer to drive the same core engine by
hand.

They all use the same local pipeline:

```text
customer message or fixture
-> synthetic corpus retrieval
-> real TurnPlanner model call
-> policy/grounding validator
-> validated response plus trace evidence
```

Real planner-backed commands require `OPENAI_API_KEY`. `OPENAI_MODEL` can override
the default planner model. Generated evidence is written under `artifacts/phase0/`
unless a command-specific output path is supplied.

Use `core-turn` when you want to manually probe one customer message and inspect the
full engine result:

```bash
just core-turn -- --message "How do I apply?"
```

This prints the `ValidatedTurnResult`: the proposed model plan, final enforced
action, customer-facing copy, retrieved corpus items, selected `serving_mode`,
validator overrides, and trace IDs.

Use `core-simulate` when you want to run the representative journey suite against
one configured planner:

```bash
just core-simulate -- --trace-output artifacts/phase0/traces.jsonl
```

This runs the broad Phase 0 fixtures and writes one JSONL trace row per turn. It is
the quickest way to inspect what the engine did across answerable, handoff,
vulnerability, excluded, repeated, topic-change, and malformed-plan journeys.

Use `core-compare` when you want a stakeholder-readable report for a configured
planner run:

```bash
just core-compare -- --output artifacts/phase0/comparison.json
```

This writes a comparison JSON report plus a sibling JSONL trace file. The report
summarises pass/fail envelopes, validator overrides, vulnerability misses,
grounded-answer rate, unnecessary handoff rate, average turns, failure modes, and a
recommendation. It is evidence for Phase 0 review, not production model approval.

Use `core-persona-simulate` when you want hard data across customer personalities:

```bash
just core-persona-simulate -- \
  --transcripts-output artifacts/phase0/persona-transcripts.jsonl \
  --report-output artifacts/phase0/persona-report.json
```

The persona suite covers cooperative, adversarial, confused, terse, impatient,
vulnerable, oversharing, legal-threat, topic-switching, low-literacy, and
hostile-but-valid customers. The transcript JSONL preserves every user message,
bot response, final action, proposed action, retrieved item IDs, safety flags,
validator override codes, requested handoff fields, safe collected facts,
validated UI plan, selected `serving_mode`, route reason, trace ID, and request
reference. The report aggregates hard data such as handoff rate, answer
rate, clarification rate, validator override rate, caught unsafe proposals,
vulnerability handling, per-persona action counts, and failure modes.

Use `core-chat` when you want to be the customer yourself, turn by turn:

```bash
just core-chat -- --trace
```

The chat loop keeps conversation state between turns and sends each message through
`processTurn`. `--trace` prints compact trace details after each bot response.
Type `/exit` or `/quit` to leave.

Use `core-serve` when you want a thin local client/server relationship over the
core engine:

```bash
just core-serve -- --port 8787
```

This is a dev-only lab API, not the production Express service. It stores sessions
in memory and exposes only:

```text
POST /sessions
POST /sessions/:conversationRef/messages
GET  /sessions/:conversationRef
POST /sessions/:conversationRef/reset
```

It exists so reviewers can get a feel for the engine over HTTP without pulling in
SQL Server, auth, cookies, CSRF, ticket webhooks, widget state, or deployment.

Use `lab` when you want the local API and Vue engineer console together:

```bash
just lab
```

Use the split commands when you need separate terminals or custom server flags:

```bash
just core-serve -- --port 8787
just lab-ui
```

The console is separate from the customer widget. It keeps one server-owned
session until reset and visualizes each turn's action, serving mode, retrieval,
validator overrides, safety flags, requested fields, and raw trace JSON.

Useful commands:

```bash
just test              # run Vitest
just typecheck         # type-check workspaces
just build             # build workspaces
just format-check      # check Prettier formatting
just core-chat -- --trace
just core-persona-simulate -- --transcripts-output artifacts/phase0/persona-transcripts.jsonl --report-output artifacts/phase0/persona-report.json
just core-stochastic -- --profile review
just lab
just core-serve -- --port 8787
just lab-ui
```

Defaults live in [`.env.example`](./.env.example). The SQL Server compose file is
kept in the repository for later productisation, but it is intentionally not part
of the active Justfile front door during Phase 0.

## Documentation

- [Product brief](./docs/product-brief.md)
- [Architecture & technical decisions](./docs/architecture.md)
- [LLM Turn Planner architecture](./docs/llm-turn-planner-architecture.md)
- [Phase 0 human validation guide](./docs/phase-0-human-validation-guide.md)
- [StochasticTestSimulator PRD](./docs/prds/2026-06-14-stochastic-test-simulator-prd.md)
- [StochasticTestSimulator guide](./docs/stochastic-test-simulator-guide.md)
- [StochasticTestSimulator implementation plan](./docs/superpowers/plans/2026-06-14-stochastic-test-simulator.md)

## License

Proprietary and confidential. All rights reserved. See [LICENSE](./LICENSE). No
permission is granted to use, copy, modify, repurpose, or distribute this software
or its materials without prior written permission of the copyright holder.
