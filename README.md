# Loanslam Customer Support Chat Widget

An embeddable, anonymous customer-support chat widget for Loanslam, a regulated UK
consumer-loans business. The widget helps customers with general and
business-operations questions, detects vulnerability and escalation signals early,
and routes anything account-specific to the human support team — it does not service
accounts itself.

> **Status: pre-implementation.** This repository currently holds the product brief,
> architecture decisions, a TurnPlanner engine-first companion architecture, and a
> synthetic knowledge-base corpus. Application code (backend, widget, contracts) is
> not yet scaffolded. Treat the documents in `docs/` as the source of truth for
> scope and design.

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
- **Domain:** `ChatService` fail-closed turn pipeline — conversation context →
  retrieval → constrained LLM turn planner → policy/grounding validator → audited
  response or handoff.
- **Persistence:** SQL Server via Prisma (sessions, transcripts, audit, evidence).
- **AI / retrieval:** managed knowledge-base retrieval and model-backed checks behind
  runtime switches.
- **Infra:** Node Alpine container, OpenTofu; registry → managed container service →
  managed SQL Server → static assets behind CDN.
- **Tooling:** Justfile as the operator front door; Vitest, ESLint, Prettier.

The widget is embedded in the client's WordPress site via an iframe; the session
cookie strategy is CHIPS partitioned cookies now, moving to a same-site subdomain
closer to deploy (see `architecture.md`).

## Knowledge base

`data/public-info/loanslam-synthetic-kb.json` is a synthetic corpus modelled on the
mock FAQ and the observed support voice, treated as real for build and review. Each
item carries a `serving_mode` discriminator that drives the answerable-vs-route gate:

| serving_mode | Meaning |
|---|---|
| `answer` | Safe public/general info or policy/process; carries `answer_text`. |
| `handoff_account_specific` | Needs the customer's real account data; routes to the team. |
| `route_vulnerability` | Vulnerability/distress signal; routes to a human. |
| `excluded` | Public but must not be served (e.g. rates, regulated advice); routes safely. |

Canonical brand throughout is **Loanslam** (`loanslam.co.uk`).

## Development

Application code is not yet scaffolded. The local SQL Server dependency is in
place so backend work can start against the same persistence shape from day one.

Start the local database from the repo root:

```bash
just local-db
```

This starts `loanslam-mssql`, waits for SQL Server to become healthy, creates the
default `loanslam` database if needed, and prints the matching `DATABASE_URL`.

Useful commands:

```bash
just mssql-up          # start SQL Server
just mssql-wait        # wait for healthcheck
just mssql-url         # print the local Prisma/app SQL Server URL
just mssql-stop        # stop container, keep data volume
just mssql-down        # remove container and data volume
```

Defaults live in [`.env.example`](./.env.example). The SQL Server host port
defaults to `1434` so it can run alongside the reference `mal-ai-chat` local DB,
which commonly uses `1433`.

## Documentation

- [Product brief](./docs/product-brief.md)
- [Architecture & technical decisions](./docs/architecture.md)
- [LLM Turn Planner architecture](./docs/llm-turn-planner-architecture.md)

## License

Proprietary and confidential. All rights reserved. See [LICENSE](./LICENSE). No
permission is granted to use, copy, modify, repurpose, or distribute this software
or its materials without prior written permission of the copyright holder.
