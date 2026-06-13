# POC Build Spec

The concrete, buildable specification for the demonstration POC. It turns the
product brief and architecture decisions into module contracts, a routing
policy table, the API/transport contract, and the audit-event map. The wire and
seam types are frozen in `contracts/` and `backend/src/ports/`; this document
pins the *behaviour* those types carry.

Scope note: this is local-development-first. No AWS infra is provisioned until
the POC is signed off. Persistence defaults to a file-backed store; the
SQL Server/Prisma path is written as the production target behind the same seam.

## Pipeline (per message turn)

The fail-closed order is non-negotiable (architecture.md):

```
resolve session (cookie) -> idempotency check -> record inbound
  -> VULNERABILITY GATE (fail closed)
       -> if vulnerable: escalate + create ticket, STOP
  -> retrieval (scored grounding signal)
  -> classifier (model, with retrieval context)
  -> router (pure policy: grounding + classification + state -> decision)
  -> responder (build Reply; only 'answer' carries KB facts + citations)
  -> record outbound + decision audits -> persist state
```

Every customer-facing answer that asserts facts is `mode: 'answer'` and MUST
carry at least one citation. Everything else is template copy or a handoff. If
nothing grounds an answer, the turn routes safely — it never guesses.

## Routing policy table

Let `topMode`/`topScore` be the top retrieval hit's serving mode and score,
`thr` the grounding threshold, and `grounded = topScore >= thr && topMode == 'answer'`.

| Condition (first match wins)                                   | replyMode        | reasonCode             | Side effects |
|----------------------------------------------------------------|------------------|------------------------|--------------|
| Vulnerability gate fires (model/det/KB) or gate errored        | `vulnerability`  | `vulnerability_signal` / `model_error_failclosed` | flag state, create urgent ticket, phase `handoff_pending` |
| `grounded`                                                     | `answer`         | `grounded_answer`      | phrase from KB `answer_text`, attach citation(s)+links |
| `topMode == 'excluded'` && `topScore >= thr`                   | `refusal`        | `excluded_topic`       | point to application form / team; never quote the excluded fact |
| `topMode == 'handoff_account_specific'` && `topScore >= thr`   | `intake_request` | `account_specific`     | request account-handoff form; phase `awaiting_intake` |
| classifier action `change_request`                             | `intake_request` | `change_request`       | request account-handoff form; phase `awaiting_intake` |
| short/ambiguous/noisy, or classifier `clarify`                 | `clarify`        | `clarify_needed` / `ambiguous_or_noisy` | phase `collecting_info` |
| nothing grounded, nothing matched                              | `fallback`       | `no_grounding`         | offer to connect to a human; phase `safe_fallback` |

On intake submit (`submitIntake`): validate against the requested form, store
allowed PII only, create the ticket, set `phase: 'handoff_pending'`, reply
`handoff` with the ticket ref. Reason code carries through (`account_specific`,
`change_request`, or `vulnerability_signal`); `intake_complete` is also audited.

## Customer journeys (demo targets)

1. **Grounded answer** — "How much can I borrow?" -> `answer` with citation
   (`how-much-can-i-borrow`), phrased but faithful to `answer_text`.
2. **Account-specific** — "What's my balance?" -> `intake_request` (account
   handoff form) -> submit -> `handoff` + ticket ref.
3. **Change request** — "Cancel my loan application" -> `intake_request` ->
   `handoff` + ticket.
4. **Vulnerability** — "I can't pay this month" -> `vulnerability` escalation
   copy + StepChange/MoneyHelper links + urgent ticket, pipeline STOPS.
5. **Excluded** — "What's your APR?" -> `refusal`, points to application form,
   never quotes a rate.
6. **Fallback / clarify** — "asdf" or off-topic -> `clarify`/`fallback`, never
   a fabricated answer.

## API / transport contract

Base path `/api`. JSON in/out, uniform `ServiceResponse<T>` envelope. The
browser sends credentialed fetch (`credentials: 'include'`).

| Method | Path            | Body schema               | Response object              |
|--------|-----------------|---------------------------|------------------------------|
| GET    | `/api/health`   | —                         | `HealthResponse`             |
| POST   | `/api/session`  | `CreateSessionRequest`    | `SessionCreatedResponse`     |
| POST   | `/api/message`  | `MessageRequest`          | `ChatTurnResponse`           |
| POST   | `/api/intake`   | `IntakeRequest`           | `ChatTurnResponse`           |
| POST   | `/api/reset`    | `ResetRequest`            | `ChatTurnResponse`           |

Session/CSRF mechanics (architecture.md "iframe session / cookie strategy"):

- On `POST /api/session` the backend sets the session id in an **HttpOnly,
  Secure, SameSite=None, Partitioned** cookie named `ls_sid`. It is never
  exposed to JS. (In local dev over http, `Secure` is relaxed.)
- The same response returns a **CSRF token** in the `x-csrf-token` response
  header and also sets a readable `ls_csrf` cookie (double-submit).
- The widget echoes the CSRF token on every state-changing request via the
  `x-csrf-token` request header. The backend rejects mismatches.
- The non-secret `conversationRef` in the body is for support correlation only,
  never for auth.

## Audit-event map (per turn)

Persist, never drop (brief §13, §16). A normal answered turn writes:
`message_inbound` -> `vulnerability_check` -> `grounding_check` ->
`classification` -> `routing_decision` -> `message_outbound`. Handoff turns add
`ticket_created`; intake adds `intake_submitted`; failures add `failure`. Every
event carries `conversationRef`, `requestRef`, `policyVersion`, and (where
relevant) `reasonCode`, `replyMode`, `groundingServingMode`.

## Module ownership map

Each module owns a disjoint directory, depends only on `@loanslam/contracts`,
`backend/src/ports/*`, and shared `config`/`common` utilities — never on another
module's concrete implementation.

| Module | Directory | Implements |
|--------|-----------|------------|
| AI model adapter | `backend/src/ai/` | `ModelAdapter` (+ deterministic fallback, fail-closed) |
| Retrieval | `backend/src/retrieval/` | `RetrievalAdapter` (lexical scoring + grounding signal) |
| Pipeline | `backend/src/chat/services/`, `backend/src/chat/templates/` | `IChatService`, router policy, copy |
| HTTP edge | `backend/src/chat/routes/`, `controllers/`, `backend/src/middleware/`, `backend/src/config/openapi.ts`, `server.ts` | routes, controllers, CSRF, `createApp(deps)` |
| Persistence | `backend/src/persistence/`, `backend/prisma/` | `Repositories` (file-backed + Prisma/SQL Server) |
| Ticket | `backend/src/ticket/` | `TicketAdapter` (webhook POST / demo record) |
| Widget | `widget/` | Vue iframe UI, transport, forms |

Composition root (`backend/src/composition/composition.ts`), `index.ts`, and the
`scripts/demo.ts` harness are wired by the orchestrator after modules land.
