# POC Status

A runnable, local-first proof of concept of the regulated chat-widget MVP. It is
built to be demonstrated and reviewed before any AWS spend. This document is the
sign-off reference: what it does, how it honours the safety boundary, what is
verified, and what is deliberately deferred.

## What it demonstrates

Run `just demo` to see all of this drive end-to-end against a live model, printing
the transcript and the full audit trail for each conversation.

| MVP outcome (brief §2)                          | Demonstrated by |
|-------------------------------------------------|-----------------|
| Anonymous, server-owned session                 | `POST /api/session` issues an HttpOnly session cookie + CSRF token; no account access |
| Conversational memory + adaptivity              | Per-session thread + structured state; multi-turn journeys carry context |
| Intelligent information collection              | Clarify route + backend-driven intake forms |
| Grounded answers from the approved KB           | Lexical retrieval + grounding gate; answers are model-phrased but cited and faithfulness-checked |
| Vulnerability-first routing                     | Fail-closed gate runs before classification; distress → escalation + urgent ticket, pipeline stops |
| Account-specific & change requests → human      | Routed to handoff intake → ticket via a replaceable webhook adapter |
| Handoff PII intake (never credentials)          | Account-handoff form; a defensive filter strips card/sort-code/account numbers |
| Full, reviewable audit trail                    | Every inbound/outbound message + every routing decision persisted with conversation/request refs |
| No direct customer-record mutation              | The widget services nothing; it only routes |
| Backend owns all business/safety decisions      | The frontend renders backend-provided state and reply mode only |

The six seed contact categories (brief §12) route as specified: application-status
is answered; payment/Direct-Debit, settlement, withdrawal/cancellation, and
account-verification go to handoff; financial difficulty goes to vulnerability.

## How it is built

Faithful to `docs/architecture.md`: a TypeScript npm-workspace monorepo —
`contracts` (Zod wire contracts + `ServiceResponse` envelope), `backend` (Node 24 /
Express 5, feature-local `chat` module, thin controllers, the fail-closed
`ChatService` pipeline, ports/adapters at every real boundary), and `widget` (a thin
Vue 3 iframe). `server.ts` is composition wiring only; runtime singletons live under
`config`. The model, retrieval, ticket, and persistence providers are all behind
replaceable seams with deterministic fallbacks.

The full module map and the routing policy table are in
[`docs/poc-build-spec.md`](./poc-build-spec.md).

## Safety boundary (brief §16) — how each non-negotiable is held

- **No anonymous account answers / no invented values** — only the `answer` reply
  mode carries facts; it requires a grounded KB hit AND passes a faithfulness gate
  that rejects any fabricated amount, rate, link, or figure. Otherwise the turn
  routes to a human.
- **No change to a loan application** — change requests route to handoff *before* the
  grounded-answer branch, so the bot never answers (and so implicitly promises) a
  change.
- **Vulnerability gate fails closed** — it runs first; a model error/timeout is
  treated as a possible vulnerability and routed to a human. A retrieval outage does
  not bypass it.
- **Session id never in JS** — it lives in an HttpOnly cookie; the browser only holds
  a non-secret conversation reference and the CSRF token (in memory). Cookie/auth
  headers are redacted from logs.
- **No bank/payment credentials** — the intake form requests standard PII only, and a
  defensive filter strips card/sort-code/account numbers even from free-text fields.
- **No dropped audit messages** — every inbound and outbound is recorded; failure,
  duplicate, intake, and vulnerability paths all keep the trail complete.
- **Frontend makes no decisions** — it renders backend-selected state and reply mode.

## What is verified

- **181 automated tests** across contracts, backend, and widget (`just test`), green
  from a clean install. Full gate (`just check`: typecheck + lint + test + build)
  passes.
- **Live end-to-end demo** against OpenAI `gpt-4o-mini` exercising all seven journeys,
  with the audit trail printed as evidence.
- **HTTP transport** verified: HttpOnly session cookie, CSRF double-submit (missing
  token → 403), input validation (bad body → 400), origin-locked CORS.
- **Adversarial review**: a multi-agent compliance/correctness/security review raised
  19 confirmed findings (2 critical compliance, plus pipeline/audit/grounding/
  security/widget issues); all 19 were fixed and locked in with regression tests.

## Deliberately deferred (not in this POC)

- **AWS infrastructure** — no infra is provisioned. The deployment shape (registry →
  managed container → managed SQL Server → static assets behind CDN, via OpenTofu) is
  the documented target for after sign-off.
- **SQL Server persistence (live)** — the Prisma schema, repositories, and Docker
  Compose exist behind the persistence seam; the demo runs on the file-backed store.
  Bringing up the live SQL path is a config switch (`PERSISTENCE=sqlserver`).
- **CRM / loan-database integration** — out of scope per the brief; adapters are
  defined, not implemented.
- **Online/autonomous self-learning** — out of scope; the offline feedback loop is
  served by the audit trail + reason codes.

## Known limitations / tunables (for the trial)

- Retrieval is lexical (IDF-weighted) over 60 synthetic items; a managed semantic
  retriever can slot in behind the same adapter. The grounding threshold
  (`GROUNDING_THRESHOLD`, default 0.42) is tunable from the audit data.
- The vulnerability keyword backstop is English-only and conservative; broaden it from
  real escalation examples during the trial.
- File-backed durability is single-process (atomic snapshot writes); the SQL Server
  path is the answer for production durability.
