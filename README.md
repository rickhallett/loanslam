# Loanslam Customer Support Chat Widget

An embeddable, anonymous customer-support chat widget for Loanslam, a regulated UK
consumer-loans business. The widget helps customers with general and
business-operations questions, detects vulnerability and escalation signals early,
and routes anything account-specific to the human support team — it does not service
accounts itself.

> **Status: implementation in progress.** The shared contracts, SQL Server
> persistence, backend chat API, and OpenAI provider boundaries are scaffolded. The
> widget is still pending. Treat the documents in `docs/` as the source of truth for
> scope and design.

> **Confidential and proprietary.** This is private client work. See
> [LICENSE](./LICENSE). The repository must not be copied, modified, repurposed, or
> redistributed.

## What it is

A conversational front line that works alongside the existing support team. It is
designed to be live and deployed on AWS within a fixed 30-day MVP window, run for a
trial period, and have its performance measured. The trial is exploratory; no
success-rate target is set.

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
data/
  public-info/
    loan-slam-faq.json             Mock public FAQ corpus
    loanslam-synthetic-kb.json     Synthetic 60-item knowledge base (treated as real)
```

`reference/` holds local working notes and is not tracked.

## Planned architecture

A TypeScript npm-workspace monorepo. Full detail and rationale in
[`docs/architecture.md`](./docs/architecture.md).

- **Widget:** Vue 3 iframe widget (Vite), thin — rendering and transport only.
- **API:** Node 24, Express 5, TypeScript; Helmet/CORS/CSRF; route-local OpenAPI.
- **Contracts:** shared Zod schemas and the `ServiceResponse` envelope.
- **Domain:** `ChatService` fail-closed pipeline — vulnerability gate → classifier →
  router → response generation.
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

The local SQL Server dependency is in place so backend work can run against the
same persistence shape from day one.

Start the local database from the repo root:

```bash
just local-db
```

This starts `loanslam-mssql`, waits for SQL Server to become healthy, creates the
default `loanslam` database if needed, and prints the matching `DATABASE_URL`.

Useful commands:

```bash
just install           # install npm workspace dependencies
just verify            # run format, lint, typecheck, tests, and build
just mssql-up          # start SQL Server
just mssql-wait        # wait for healthcheck
just mssql-url         # print the local Prisma/app SQL Server URL
just mssql-stop        # stop container, keep data volume
just mssql-down        # remove container and data volume
```

Defaults live in [`.env.example`](./.env.example). The SQL Server host port
defaults to `1434` so it can run alongside the reference `mal-ai-chat` local DB,
which commonly uses `1433`.

## Provider Setup

Configure the real OpenAI retrieval path before using the backend outside tests:

```bash
npm install
cp .env.example .env
just kb-sync
# paste the printed OPENAI_VECTOR_STORE_ID into .env
just verify
```

`just kb-sync` reads `data/public-info/loanslam-synthetic-kb.json`, creates or
updates the OpenAI vector store named by `OPENAI_VECTOR_STORE_NAME`, uploads a
generated Markdown knowledge-base file, and prints only:

```text
OPENAI_VECTOR_STORE_ID=<id>
```

The external ticket webhook contract is still pending. Until that contract is
supplied, local handoff references are audit records; when `TICKET_WEBHOOK_URL` is
configured, the backend posts a conservative signed envelope from the adapter.

## Documentation

- [Product brief](./docs/product-brief.md)
- [Architecture & technical decisions](./docs/architecture.md)

## License

Proprietary and confidential. All rights reserved. See [LICENSE](./LICENSE). No
permission is granted to use, copy, modify, repurpose, or distribute this software
or its materials without prior written permission of the copyright holder.
