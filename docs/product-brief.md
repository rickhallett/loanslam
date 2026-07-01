# Regulated Customer Support Chat Widget - Product Brief

> Revised. This version supersedes the original brief. The original described a
> stateless, verbatim-copy deflection widget. Expectations for the MVP have been
> raised: the bot must now hold a conversation (memory and adaptivity), collect
> information intelligently, and answer from an operationalised call-centre
> knowledge base — while keeping the same safety boundary and routing the hard,
> account-specific work to humans. The original brief included a 30-day live AWS
> deployment target. For the current implementation, that deadline and deployment
> shape are historical context; Phase 0 first proves the engine and evidence
> boundary before product deployment work resumes. Full auditability of everything
> the bot receives and sends remains the non-negotiable product requirement.
>
> The current Phase 0 engine architecture lives in
> `docs/llm-turn-planner-architecture.md`. This brief owns the product boundary,
> safety constraints, and later productisation expectations.
>
> Delivery update: the original all-layer delivery sequence in §14 is superseded
> for current implementation by `docs/llm-turn-planner-architecture.md`. Phase 0
> proves the TurnPlanner engine, retrieval, policy/grounding validation, trace
> evidence, journey simulation, and model comparison before the widget, deployment,
> production audit store, real PII intake, or ticket webhook are built.

## 1. Product Aim

Build an embeddable customer-support chat widget for a regulated financial-services (consumer loans) business.

The widget works **alongside** the existing offshore (India-based) call-centre team. That team currently handles repetitive customer queries using a corpus of canned responses. The bot's job is to take the front line of that same traffic: greet the customer, work out what they need, answer it when the knowledge base supports an answer, and hand off to a human when it does not. Over time the business hopes the bot can absorb more of the team's volume; full replacement is explicitly **not** an MVP goal.

The widget must not become an account-servicing tool in this release. It must not answer customer-specific account questions, verify customers, make eligibility decisions, or update customer records. CRM and loan-database integration is a third-party dependency that will not land inside the 30-day window and is out of scope here.

## 2. MVP Outcome

The MVP succeeds if it can:

- start an anonymous customer conversation
- **hold context across the conversation** — remember what the customer has said and adapt, rather than treating each message in isolation
- **collect information intelligently and conversationally** to understand what help the customer needs
- answer general / business-operations questions **grounded in the approved knowledge base** — reassurance and general process answers count as success, since they take load off the UK and India support desks
- detect vulnerability, distress, complaints, legal threats, accessibility needs, and similar escalation signals, and route them to a human early
- route account-specific or unsafe questions, and any request to change a loan application, to **human handoff via a ticket webhook**
- collect standard handoff PII when a handoff or ticket needs it — name, DOB, address, phone, email, and situational context — so the human agent can locate the customer (the bot does not collect or action bank/payment credentials)
- **persist a full, reviewable audit trail of every inbound and outbound message** (the one non-negotiable compliance requirement)
- avoid direct customer-record mutation
- keep all business and safety decisions on the backend
- for the original MVP baseline, be deployable to the owned production surface;
  the historical 30-day AWS target is not the current Phase 0 implementation
  gate

## 3. Target Users

Primary users:

- customers looking for quick help from a website or portal
- the call-centre / support team receiving handoff and ticket requests, and working the resulting queue
- product, compliance, and operations teams reviewing trial behaviour

The customer may be anonymous, unidentified, vulnerable, confused, angry, or asking for account-specific support. The system should bias toward safe routing over confident automation.

## 4. Product Boundary

### In Scope

- anonymous chat session creation
- **conversational memory of the user/assistant thread within a session**
- **intelligent, conversational information collection**
- answers grounded in the approved knowledge base (call-centre canned-response corpus + public FAQ/product/process content)
- vulnerability-first routing
- intent/action classification
- safe fallback for ambiguous or unsupported requests
- handoff and ticket intake
- **ticket creation via webhook to the human team's queue**
- identity/contact intake for handoff only
- full transcript and audit storage for review
- audit events explaining routing decisions
- **an offline feedback loop**: instrumentation and review data to learn what works (see §17)

### Out of Scope

- verified account access inside the widget
- **CRM / loan-database integration** (third-party dependency; deferred to post-MVP)
- customer database reads for personalised answers
- balance, payment, application, eligibility, or account-status answers
- direct CRM/customer-record updates
- bank detail changes
- payment changes or any modification to a loan application
- full KYC or MFA inside the widget
- **online / autonomous self-learning** — the system adjusting its own behaviour in production without human review (see §17)

## 5. Core Principles

- Sessions are anonymous by default.
- The conversation is **stateful**: the backend holds the thread and a small structured conversation state, and the bot adapts to it.
- General and business-operations information can be answered without identification, **provided the answer is grounded in the approved knowledge base**.
- Customer-specific information, and any request to change a loan application, require handoff to a human via the ticket webhook.
- Vulnerability and safety checks run before normal intent routing.
- Identity collection is intake only, not verification.
- Human agents perform KYC/MFA where required.
- **Customer-facing answers must be grounded in approved knowledge. The model may phrase responses, but must not invent facts. If an answer is not grounded, the system routes to a human instead of guessing.**
- If the system is uncertain, it routes safely instead of guessing.
- The frontend renders state; the backend owns decisions.
- The browser must not store raw identity answers, contact details, account data, or transcripts.
- The trial must not mutate customer records directly.
- **Everything the bot receives and sends is auditable.**

## 6. Customer Journeys

### General / Operational Question

1. Customer opens the chat widget.
2. The backend creates an anonymous session.
3. Customer asks a question; the bot may ask follow-up questions to clarify what they need.
4. The system checks for vulnerability or escalation signals.
5. The system classifies the safe action, using the conversation so far for context.
6. If the approved knowledge base grounds an answer, the widget returns it (phrased by the model, grounded in retrieved content).
7. If no grounded answer exists, the system routes to fallback or handoff.
8. The system records the full transcript and routing evidence.

### Account-Specific Or Change Request

1. Customer asks about their balance, payment, application, account status, eligibility, or asks to change something on their loan application.
2. The system does not answer or perform the change from the anonymous chat surface.
3. The widget explains the handoff and, if useful, collects the minimum facts needed.
4. The backend **creates a ticket via the webhook**, adding the request to the human team's queue.

### Vulnerability Or Escalation

1. Customer message contains vulnerability, distress, complaint, legal, accessibility, language-barrier, or similar risk signals.
2. The system routes this before normal classification.
3. The widget shows approved escalation copy.
4. The backend may collect a small amount of additional context before handoff.
5. A ticket / human handoff is created and the route is audited for review.

## 7. Functional Requirements

### Frontend

The frontend must:

- embed as a website chat widget
- create an anonymous session on mount
- send structured session, message, intake, and reset requests
- include browser credentials and CSRF/session protection as required
- render backend-provided messages, prompts, forms, fallbacks, and handoff confirmations
- clear form values after submit, reset, expiry, or cancellation
- expose iframe lifecycle events where needed, such as ready, resize, and close

The frontend must not:

- classify customer intent
- decide vulnerability, escalation, identity, or handoff policy
- call customer databases
- create CRM tickets directly
- read, store, or submit a raw session ID
- persist identity answers, contact details, account data, or chat transcripts in browser storage

### Backend

The backend must:

- create and manage anonymous server-owned sessions
- **maintain conversation history and a structured conversation state per session** (what the customer wants, what has been collected, vulnerability flags, whether the question is answerable)
- validate requests
- protect session-backed calls against CSRF where needed
- run vulnerability detection before normal routing
- classify the next safe action using conversation context
- **retrieve from the approved knowledge base and gate on answerability** — only answer when retrieval grounds the response
- return fallback or handoff when grounded content is missing, ambiguous, or unsafe
- manage conversational and form-based intake for handoff paths
- **create tickets / handoff requests by calling the team's webhook, through a replaceable adapter**
- store full chat transcripts and a complete audit trail of inbound and outbound messages
- emit audit events for routing decisions and failure paths
- keep model, retrieval, and ticket/webhook providers behind replaceable adapters (CRM/loan-DB adapters defined now, implemented post-MVP)

## 8. API Shape

The browser-facing API should stay small:

- create session
- send message
- submit handoff/identity intake
- reset conversation

Every successful response should include:

- a non-secret conversation reference for support/debug correlation
- a per-request correlation reference
- the current conversation state
- customer-facing copy or form configuration selected by the backend

The frontend should route UI using only backend-provided state, not local business rules.

## 9. Conversation States

The MVP needs a small set of states:

- anonymous session active
- collecting information / clarifying
- awaiting handoff/identity intake
- handoff pending human follow-up (ticket created)
- safe fallback

Any state requiring a form must include the matching backend-provided form config.

## 10. Routing Requirements

The router should choose safe actions, not merely label customer intent, and should use the conversation so far as context.

Allowed actions:

- answer from grounded knowledge-base content
- ask a clarifying / information-collection question
- ask for handoff/intake details
- create ticket / handoff via webhook
- show safe fallback
- refuse unsupported or unsafe requests
- escalate to human support

Routing must consider:

- vulnerability and distress
- complaints and legal threats
- accessibility or language barriers
- general / operational questions
- account-specific requests
- change requests to a loan application
- acknowledgements
- noisy, short, or ambiguous messages
- **what has already been said in the conversation**

Unsupported or unclear cases should route to fallback or human clarification.

## 11. Response Requirements

Customer-facing responses do **not** have to be verbatim pre-approved copy — there is already accepted human variance in how the call-centre team responds, around a required corpus. The model may phrase responses, but **every customer-facing answer must be grounded in approved knowledge**:

- the approved knowledge base (call-centre canned-response corpus, public FAQ/product/process content)
- deterministic templates for fallback, refusal, vulnerability, complaint, rate-limit, and identity-failure cases
- approved handoff and ticket confirmation copy

When no grounded answer exists, the system routes to fallback or human handoff rather than generating one.

The system must not invent:

- account values
- payment amounts or dates
- SLA commitments
- policy rules
- eligibility decisions
- complaint outcomes
- vulnerability guidance
- ticket outcomes

Model use is permitted for routing, classification, retrieval gating, answerability checks, information collection, and phrasing grounded answers. It must not author regulated facts or advice that the knowledge base does not support.

## 12. Content And Evaluation Inputs

The approved knowledge base is built from the call-centre's operationalised canned-response corpus plus public content:

- the canned-response corpus (the primary source of grounded answers)
- public-information Q&A
- scenario-based canned responses
- fallback and refusal templates
- vulnerability and complaint copy
- handoff and ticket copy

The seed intent/action taxonomy is the six contact categories observed in real inbound traffic, each with its MVP disposition:

1. **Application status / chasing** — answerable now (generic reassurance/ETA, no integration).
2. **Payment / Direct Debit issues** — handoff; requires loan integration (deferred).
3. **Financial difficulty / repayment support** — vulnerability handoff.
4. **Settlement figure requests** — handoff; the live figure requires integration.
5. **Withdrawal / cancellation** — handoff; requires integration.
6. **Account verification / detail updates** — handoff; verification, not done in-widget.

Only category 1 is a direct bot answer in the initial response set; the rest are handoff (or vulnerability) routes until loan integration lands. Note this sample is collections-only (existing applicants/borrowers) and under-represents the prospective-customer and general-public traffic the widget will also see.

Historical support messages should be used to build:

- intent/action taxonomy
- phrase variants
- ambiguity clusters
- vulnerability and escalation examples
- regression eval cases
- delivery priorities based on real contact volume

Deflection, handoff reasons, and fallback rate should be measured during the trial against real contact volume. No fixed deflection target is set for the MVP; the trial is exploratory.

Any examples used in prompts, evals, docs, or durable assets must be minimised and redacted.

## 13. Privacy, Audit, And Observability

**Full auditability is the crucial compliance requirement for this MVP.** Every message the bot receives and every message it sends must be persisted and reviewable, correlated by conversation and request reference.

Required signals:

- complete inbound/outbound message log per conversation
- transcript history for trial review
- routing/audit events with conversation and request references
- routing config or policy version where applicable
- failure-path events for unsafe, fallback, ticket, and handoff errors
- response mode, grounding source, and reason codes where useful

Before live customer traffic, the business must decide:

- transcript retention
- audit retention
- access controls
- secure audit storage location
- allowed analytics events
- data-processing position for the model provider

## 14. Delivery Slices

> Superseded for current implementation. Use the Phase 0 engine-proof sequence in
> `docs/llm-turn-planner-architecture.md` first. Resume these all-layer product
> slices only after the TurnPlanner exit gate has produced enough evidence to
> productise the engine.

Delivered as narrow vertical slices. The historical MVP plan treated deployment
as a hard pass/fail gate; the current Phase 0 sequence defers that deployment
slice until the TurnPlanner evidence gate is credible.

1. Anonymous session, basic message flow, and a deployable walking skeleton
2. Conversation memory and structured per-session state
3. Knowledge-base retrieval and grounded answer path (with answerability gating)
4. Vulnerability-first routing
5. Intelligent information collection / clarification
6. Ticket-via-webhook handoff route (account-specific and change requests)
7. Audit trail: complete inbound/outbound logging and routing evidence
8. Trial hardening: reset, rate limits, observability, escalation copy, analytics, deployment controls

Each slice should include product behaviour, safety boundary, backend decisioning, frontend rendering, audit evidence, and tests.

## 15. Open Decisions

The core product cannot be safely released beyond Phase 0 / integrated POC
demonstration until these decisions are owned:

- **the production deployment surface** (AWS was the original assumption; the
  owner must still choose services and deployment ownership before release)
- **the ticket webhook contract** (payload, queue, priority, auth, confirmation copy)
- **the canned-response corpus** (format, size, how it is delivered and refreshed)
- the approved knowledge base and grounding policy
- routing/action taxonomy
- vulnerability taxonomy and escalation copy
- handoff/intake fields
- transcript and audit retention
- analytics scope
- model provider and data-processing posture

## 16. Non-Negotiable Release Rules

- Do not answer personal account questions anonymously.
- Do not perform or promise changes to a loan application.
- Do not update customer records directly.
- Do not expose raw session IDs to browser JavaScript.
- Do not store identity answers or transcripts in browser storage.
- Do not let the frontend make business or safety decisions.
- Do not return a customer-facing answer that is not grounded in approved knowledge; route to a human instead.
- Do not invent account values, amounts, dates, policy, eligibility, or outcomes.
- Do not continue normal routing after vulnerability detection.
- The vulnerability gate fails closed: if the model-backed check errors or times out, treat the turn as a possible vulnerability and route to a human.
- Do not treat identity intake as customer verification.
- Do not collect or action bank/payment credentials (sort code, account number); standard handoff PII (name, DOB, address, phone, email, situational context) is permitted.
- **Do not drop any inbound or outbound message from the audit trail.**
- Before production release, the deployment surface, owner, and operational
  controls must be explicitly owned. The original 30-day AWS deadline is
  historical context, not the current Phase 0 gate.

## 17. Learning Over Time

The team wants a bot that learns what works and what does not for customers. For a solo developer inside 30 days, this splits in two:

- **In scope — an offline feedback loop.** Instrument everything (deflection rate, handoff reasons, fallback rate, where grounding failed), persist it via the audit trail, and use it to review transcripts and tune the corpus, prompts, and eval set. This is human-in-the-loop iteration and is where most of the value lies. It comes nearly free if auditability is built well.
- **Out of scope — online / autonomous self-learning.** The system modifying its own behaviour in production without review is not a 30-day solo build and carries regulatory risk in this domain. The MVP promises the feedback loop and the data to drive it, not a self-improving model.
