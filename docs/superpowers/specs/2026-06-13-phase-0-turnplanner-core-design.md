# Phase 0 TurnPlanner Core Design

## Practical Takeaway

Build the Phase 0 core as a Node 24-compatible TypeScript npm workspace that proves the TurnPlanner engine without productising the widget or API. The engine takes conversation state plus a customer message, retrieves policy-bearing corpus items, asks a real model-backed `TurnPlanner` for an untrusted `TurnPlan`, validates hard safety and grounding rules, and emits a `ValidatedTurnResult` plus JSONL trace evidence.

## Scope

In scope:

- Shared Zod contracts for corpus items, `TurnPlan`, UI primitives, traces, journeys, reports, and validated results.
- Corpus loading and local lexical retrieval over `data/public-info/loanslam-synthetic-kb.json`.
- `processTurn` orchestration with deterministic IDs, trace fields, and conversation state updates.
- A hard-rule validator for serving mode, grounding, safety flags, forbidden credential requests, account-specific answers, unsupported UI primitives, and malformed plans.
- A real OpenAI-backed `TurnPlanner` adapter using structured outputs.
- CLI commands for probing one turn, running the representative journey suite, and comparing planner configurations.
- Unit tests that construct direct `TurnPlan` fixtures only for engine and validator behavior.

Out of scope:

- Vue widget, Express production API, SQL Server persistence, Prisma schema, production audit store, AWS/OpenTofu, CHIPS cookies, CSRF/session product code, real ticket webhook side effects, and real customer PII intake.
- A deterministic fake planner as product evidence or a model-comparison baseline.

## Architecture

Use a small npm workspace:

- `packages/contracts`: Zod schemas and inferred TypeScript types.
- `packages/core`: corpus loader, retriever, validator, engine, OpenAI planner adapter, journey runner, report builder, and CLI.

The core flow is:

```text
conversation state + user message
-> corpus retrieval
-> TurnPlanner.planTurn(input)
-> validateTurnPlan(plan, retrieval, policy)
-> ValidatedTurnResult + trace
```

The validator is the compliance boundary. Model output is untrusted until validated, and validator overrides are traceable. Retrieval scores are evidence, not release gates.

## Evidence

Every simulated turn writes a JSONL trace containing conversation/request references, retrieved item IDs, selected serving mode, proposed/final actions, safety flags, validator overrides, policy version, planner metadata, and customer-facing message. Journey reports aggregate pass/fail envelopes and metrics such as grounded answer rate, unsafe answer attempts, vulnerability misses, validator override rate, malformed plans, repeated questions, and rough cost/latency where provided by the adapter.

Trace and report output must preserve `excluded` item route reasons rather than collapsing them into generic handoff. That reason is part of the policy evidence stakeholders need to review.

## Real Planner Boundary

The shipped planner adapter is model-backed. Tests may use inline planner objects only to exercise deterministic engine behavior, but CLI simulation and model comparison require configured real planner providers. If credentials are missing, commands fail with a clear configuration error instead of silently falling back to a fake baseline. The Phase 0 exit claim requires a successful configured real-model simulation/comparison run; a no-credential failure check proves configuration safety, not product evidence.
