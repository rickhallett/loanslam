# Loanslam Customer Support Chat Widget

An embeddable, anonymous customer-support chat widget for Loanslam, a regulated UK
consumer-loans business. The widget helps customers with general and
business-operations questions, detects vulnerability and escalation signals early,
and routes anything account-specific to the human support team — it does not service
accounts itself.

> **Status: runnable local POC.** The TypeScript monorepo (backend, widget,
> contracts) is implemented and runs locally end-to-end against an OpenAI-compatible
> model, with a file-backed store as the demo default. The fail-closed pipeline,
> knowledge-base grounding, vulnerability-first routing, ticket-via-webhook handoff,
> and the full audit trail are all in place and tested. AWS infrastructure is NOT
> provisioned yet — that is deliberately deferred until the POC is signed off (see
> [`docs/poc-status.md`](./docs/poc-status.md)). The documents in `docs/` remain the
> source of truth for scope and design.

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

An npm-workspaces TypeScript monorepo. The Justfile is the operator command front
door; `just` lists every recipe.

```
just setup          # install all workspace dependencies
cp .env.example .env # add your OPENAI_API_KEY (any OpenAI-compatible endpoint)

just demo           # drive the pipeline through every customer journey + print
                    # the transcript and audit trail (the flagship demo)

just dev-backend    # run the API on :8787 (file-backed store, hot reload)
just dev-widget     # run the Vue iframe widget on :5173
# then open demo/embed.html to see the widget embedded in a mock host page

just check          # the full local gate: typecheck + lint + test + build
just test           # 181 tests across contracts, backend, widget
```

Configuration lives in `.env` (see `.env.example`). The model provider is any
OpenAI-compatible endpoint (`OPENAI_BASE_URL` / `OPENAI_MODEL`); set `AI_ENABLED=false`
to run fully offline on the deterministic fallbacks. Persistence defaults to a
file-backed store under `.data/`; the SQL Server/Prisma path (the production target)
is wired behind the same seam and selected with `PERSISTENCE=sqlserver` plus a
`DATABASE_URL` (`just sqlserver-up` starts a local SQL Server in Docker).

See [`docs/poc-status.md`](./docs/poc-status.md) for what is built, what is verified,
and what is deferred.

## Documentation

- [Product brief](./docs/product-brief.md)
- [Architecture & technical decisions](./docs/architecture.md)

## License

Proprietary and confidential. All rights reserved. See [LICENSE](./LICENSE). No
permission is granted to use, copy, modify, repurpose, or distribute this software
or its materials without prior written permission of the copyright holder.
