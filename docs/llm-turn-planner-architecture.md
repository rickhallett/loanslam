# LLM Turn Planner Architecture

> Proposed companion architecture note. This document does not replace
> `product-brief.md` or `architecture.md`; it describes a simpler variant for review.

## Practical Takeaway

The first phase should prove the TurnPlanner engine before building the product
surface around it. No widget, no AWS deployment, no production audit store, no real
PII intake, and no ticket webhook. Start with the smallest useful core: a turn
processing engine, a tiny local request surface, a swappable model adapter, and an
extensive journey simulation suite.

This is not a weaker MVP. It is a sharper risk reduction strategy. If the engine
cannot reliably handle messy, broadly predictable customer journeys in a controlled
test harness, the deployed widget will not make a meaningful dent in support volume.

## Why This Fits The Brief

The product brief asks for a bot that can hold context, collect information
intelligently, and answer from an approved knowledge base. It also sets hard
constraints:

- customer-facing answers must be grounded in approved knowledge
- vulnerability and escalation are handled before normal routing
- account-specific requests and change requests go to human handoff
- the frontend renders backend-provided state only
- every inbound and outbound message is auditable

Those constraints do not require a large hand-coded intent router. They require a
small set of enforceable backend contracts.

The current product brief puts a deployable AWS walking skeleton early in the
sequence. That is sensible when integration risk is the dominant risk. Here, the
dominant risk is different: whether the conversation engine can safely absorb the
real shape of customer inbound at all. A vertical slice across every layer can make
early assumptions look like architecture before the core behaviour has been tested.

The revised sequence should therefore put an explicit engine proof before the
all-layers product build.

## Rationale For A Phase 0 Engine Proof

Previous all-layer builds start with useful integration discipline, but they also
force premature decisions. Frontend states, endpoint shapes, persistence tables,
ticket payloads, audit fields, and deployment constraints begin to harden while the
central question is still open: can the TurnPlanner make good next-turn decisions
across messy support conversations?

Phase 0 keeps the work aimed at that question.

The rationale:

- **Avoid fossilised assumptions.** Early integration code turns guesses into
  implicit rules. Keeping the first phase engine-only makes assumptions visible in
  tests and traces before they become product contracts.
- **Measure the actual product risk.** The CEO does not mainly need an iframe, a
  database schema, or a deployment pipeline. He needs evidence that the bot can
  absorb predictable support volume without unsafe answers, pointless handoff, or
  brittle conversation flow.
- **Isolate non-determinism.** Model behaviour must be evaluated under repeatable
  journeys. A controlled harness makes it possible to compare runs, seeds, prompts,
  models, and policy changes without UI or infrastructure noise.
- **Keep iteration cheap.** The engine will need prompt, schema, corpus, and policy
  changes. Those are faster to make before every turn is coupled to browser state,
  real persistence, webhook semantics, and deployment.
- **Create a defensible demo.** A command-line or curl demo that shows good traces
  through hard journeys is more valuable than a polished widget that cannot explain
  its decisions.
- **Inform the real architecture.** Once the engine proves itself, the API, widget,
  audit store, and deployment surface can be designed around observed behaviour
  rather than around guesses.

## Core Model

Replace the mental model of:

```text
vulnerability gate -> classifier -> router -> response generation
```

with:

```text
conversation context -> retrieval -> LLM turn plan -> policy/grounding validator -> response renderer
```

The LLM is allowed to reason over the conversation. It is not allowed to become the
compliance boundary.

Canonical Phase 0 terminology:

- `processTurn`: the deterministic engine entrypoint
- `TurnPlanner`: the swappable planner interface
- `TurnPlan`: the untrusted proposed plan from the planner
- `ValidatedTurnResult`: the enforced output after policy and grounding validation
- `ChatService`: the later production backend wrapper, not the Phase 0 engine name

## Backend Responsibilities

The eventual backend owns everything that must be deterministic, auditable, or
enforceable:

- anonymous server-owned sessions
- request validation, CSRF, rate limits, and idempotency
- transcript persistence for every inbound and outbound message
- retrieval from the approved knowledge base
- validation of the model's proposed turn plan
- grounding enforcement for customer-facing answers
- fail-closed handling for vulnerability, model, retrieval, and validation failures
- ticket creation through the webhook adapter
- audit events with route, reason, policy version, grounding source, and correlation ids

The backend may ask the LLM for judgment. It does not outsource authority.

In Phase 0, only the engine-facing subset is built:

- in-memory or file-backed conversation state
- local request validation
- local trace output
- retrieval from the approved/synthetic corpus
- model-backed TurnPlanner adapters
- policy and grounding validation
- journey simulation and model comparison tooling

Production concerns are represented as actions and traces, not implemented as full
product infrastructure.

Handoff intake in Phase 0 uses canonical field names only: `fullName`,
`dateOfBirth`, `address`, `phone`, `email`, and `situationSummary`. These may appear
in simulated turns, requested fields, collected-fact maps, and traces. Phase 0 must
block requests for payment or bank credentials, but it should not spend its
complexity budget on production-grade PII infrastructure before the decision engine
has been proved.

## LLM Responsibilities

The model proposes the next conversational move inside a typed contract:

```ts
type TurnAction =
  | "answer"
  | "ask_clarifying_question"
  | "request_handoff_intake"
  | "create_ticket"
  | "escalate"
  | "refuse"
  | "fallback";
```

A turn plan should include:

```ts
type TurnPlan = {
  action: TurnAction;
  customerMessage: string;
  ui: UiPlan;
  reasonCode: string;
  collectedFacts: Record<string, string>;
  requestedFields: IntakeField[];
  grounding: GroundingDecision | null;
  safetyFlags: SafetyFlag[];
  traceSummary: string;
};
```

The model can:

- interpret messy customer language
- use conversation history to avoid repetitive questions
- decide whether to answer, clarify, hand off, refuse, or fallback
- choose an allowed UI primitive
- phrase grounded answers in a natural support voice
- summarize the reason for trace/review output
- propose safety flags for vulnerability, distress, complaint, legal, accessibility,
  hardship, and similar escalation risks

The model cannot:

- invent regulated facts
- answer without approved grounding
- collect forbidden bank/payment credentials
- verify identity
- decide to mutate customer records
- promise ticket outcomes, eligibility, rates, dates, balances, or payment changes
- continue normal routing after vulnerability or escalation is detected

In Phase 0, vulnerability handling uses the same `TurnPlanner` call and its
`safetyFlags`; it does not start with a separate model-backed vulnerability
detector. A separate gate can be added later if trace evidence shows the single
planner misses risk.

## UI Contract

The LLM may choose from a small set of backend-approved UI primitives. It must not
return arbitrary frontend instructions.

Allowed primitives:

- `message`: customer-facing text, optionally with approved links
- `clarifying_prompt`: one or more plain text follow-up questions
- `choice_list`: a small set of safe backend-defined options
- `intake_form`: a backend-defined form for handoff details
- `handoff_confirmation`: copy confirming human follow-up or ticket creation
- `safe_fallback`: approved fallback copy

Every UI primitive is rendered by the widget using shared Zod contracts. The widget
does not infer business policy from the primitive. It only renders what the backend
returns.

## Policy And Grounding Validator

Treat model output as untrusted until it passes validation.

The validator is a policy and contract backstop, not a taste-based conversation
critic. It should enforce hard product rules and schema contracts. It should not
override merely because a response could be warmer, shorter, more natural, or ask a
better clarification question; those UX-quality signals belong in journey reports
and model comparison.

The validator should reject or override a turn plan when:

- `action: "answer"` has no approved grounding source
- the cited knowledge item is not in `serving_mode: "answer"`
- the answer adds unsupported facts not present in the retrieved source
- the plan asks for sort code, account number, card details, or payment credentials
- the plan attempts to verify identity rather than collect handoff intake
- vulnerability, complaint, legal threat, distress, accessibility, or hardship flags
  are present but the action is normal answer/routing
- the plan promises a loan change, repayment change, eligibility outcome, rate,
  balance, payment date, settlement figure, or account status
- the requested UI primitive is not in the allowed set

Phase 0 grounding should stay conservative and inspectable without brittle score
thresholds. A customer-facing `answer` requires at least one cited retrieved corpus
item with `serving_mode: "answer"`, and the phrased response must stay within that
item's `answer_text` and approved links. Retrieval scores can be emitted as evidence,
but they are not release gates until observed runs prove a threshold is useful.

On rejection, the backend should route to the safest valid action and record the
override. In Phase 0 that means a local trace entry; in the production product that
becomes an audit event.

## Knowledge Base As Policy Data

The synthetic knowledge base already carries the right discriminator:

```text
serving_mode: answer | handoff_account_specific | route_vulnerability | excluded
```

That should be treated as policy data, not just retrieval metadata.

Suggested behaviour:

- `answer`: model may phrase an answer, using the retrieved item as grounding
- `handoff_account_specific`: collect standard handoff details and route to the team
- `route_vulnerability`: route through the vulnerability/escalation path
- `excluded`: do not answer the substance; use safe refusal or approved signposting
  when the item has approved links, otherwise route to a human fallback. Preserve the
  exclusion reason in traces and reports rather than collapsing it into generic handoff.

This keeps the router small. Most of the release behaviour becomes data plus
validation rather than branching code.

## Trace Evidence Now, Audit Later

Each Phase 0 turn should produce local reviewable evidence:

- inbound message id
- outbound message id
- conversation reference
- request correlation reference
- model/provider/prompt or policy version
- retrieved knowledge item ids
- selected `serving_mode`
- proposed turn action
- final enforced action
- validator overrides, if any
- safety flags
- handoff/ticket result, if any

This is not the production audit store. It is a lightweight precursor that proves
which fields are worth preserving later. The team can inspect not only what the bot
said, but why that response path was chosen.

## Failure Behaviour

Failure should be boring and safe:

- model timeout: route to safe fallback or handoff
- retrieval timeout: do not answer; fallback or handoff
- grounding missing: do not answer; fallback or handoff
- validator rejection: override to the safest valid action
- ticket webhook failure: show approved failure copy and record the failure
- vulnerability check uncertainty: treat as possible vulnerability and route to human

The customer experience may be less clever in failure paths. That is acceptable. A
regulated MVP needs safe degradation more than conversational bravado.

## Phase 0: TurnPlanner Engine Proof

Phase 0 is a deliberately small build focused on the engine. It should answer one
question:

```text
Can the TurnPlanner safely and usefully handle the important customer journeys when
the model, prompt, retrieval set, and policy validator are varied?
```

### In Scope

- `TurnPlan`, `UiPlan`, grounding, safety flag, and trace schemas
- a core `processTurn` function that accepts conversation state plus a user message
- a local corpus retriever using the approved/synthetic knowledge base
- a policy and grounding validator
- a swappable model adapter interface
- at least one real model-backed planner
- a local CLI and/or tiny HTTP server for manual probing
- a representative journey suite covering broad, messy, multi-turn customer paths
- comparative reports across model/prompt/config variants
- JSONL trace artifacts for every simulated turn

Do not build a deterministic fake planner as a baseline or product-evidence path.
Narrow unit tests may construct `TurnPlan` objects directly to exercise validator
rules, but Phase 0 confidence must come from real model-backed planner behavior.

### Out Of Scope

- Vue widget
- production API surface
- AWS deployment
- SQL Server persistence
- production audit store
- real ticket webhook
- real customer PII
- iframe/session/cookie work
- CRM or loan-database integration
- polished customer-facing UI

These are not deleted from the product. They are deferred until the engine earns
them.

### Minimal Runtime Shape

The Phase 0 runtime can be plain:

```text
CLI or local HTTP request
-> conversation state
-> corpus retrieval
-> TurnPlanner adapter
-> policy/grounding validator
-> next turn plan
-> JSON trace
```

The local HTTP server, if present, should be a demo and test convenience only. It
should not pull the project toward production API design.

Example trace:

```json
{
  "journeyId": "application-status-chase",
  "turn": 3,
  "model": "candidate-model-a",
  "action": "request_handoff_intake",
  "servingMode": "handoff_account_specific",
  "matchedSources": ["whats-the-status-of-my-application"],
  "safetyFlags": [],
  "validatorOverrides": [],
  "reasonCode": "account_specific_status_requires_handoff",
  "customerMessage": "I can help pass this to the team so they can check your application."
}
```

### Journey Simulation

The journey suite should not only assert one-turn classification or a few curated
happy paths. It should be broad enough that the full C-suite could talk to it for an
hour across multiple personality types and come away feeling the system does what
was promised. It should simulate the paths customers actually take:

- clear answerable FAQ question
- vague first message followed by clarification
- application status chase
- payment or Direct Debit issue
- settlement figure request
- change request
- vulnerability disclosure after an ordinary opening
- vulnerability hinted indirectly
- complaint or legal threat
- excluded regulated-advice request
- repeated, impatient, or contradictory customer messages
- customer provides too much sensitive information
- customer changes topic mid-flow
- model returns malformed or unsafe output

Each journey should assert the expected safety and UX envelope rather than exact
wording. Fixtures should define customer turns, expected final action or allowed
actions, expected or forbidden `serving_mode`, required safety flags when relevant,
forbidden behaviours, max clarification turns where relevant, and UX-quality notes
that are reported but not hard-gated unless safety-relevant.

Core envelope assertions include:

- correct final action
- no ungrounded regulated answer
- no forbidden PII request
- no normal routing after vulnerability
- no invented account value, date, rate, balance, or outcome
- reasonable number of clarification turns
- handoff when the corpus says handoff
- fallback when grounding is absent

The suite should produce aggregate reports, not just pass/fail output. Useful
metrics include:

- grounded answer rate
- unnecessary handoff rate
- unsafe answer attempts
- validator override rate
- vulnerability miss rate
- malformed plan rate
- repeated-question rate
- average turns to resolution
- model cost and latency per journey

### Model Comparison

The engine should make model swapping boring. The TurnPlanner depends on an
interface, not a specific provider:

```ts
type TurnPlanner = {
  planTurn(input: TurnPlannerInput): Promise<TurnPlan>;
};
```

Candidate models should run against the same journey suite and produce comparable
trace output. The first comparison report ranks candidate planner configurations for
Phase 0 decision quality; it does not approve a production model or impose a fixed
score threshold. This lets the team answer concrete questions:

- Which model best distinguishes answerable general questions from account-specific
  requests?
- Which model handles vague, emotional, or contradictory turns safely?
- Which model requires the fewest validator overrides?
- Which model gives useful clarification without creating support dead-ends?
- Which model is good enough for the expected support volume at acceptable cost?

Without this evidence, choosing a model is taste dressed as engineering.

The report should identify the current baseline, obvious failure modes, corpus gaps,
prompt or policy changes, and whether the engine is credible enough to productise.

### Phase 0 Success Criteria

Phase 0 succeeds when the team can demo and inspect:

- a representative journey suite broad enough to support credible extended probing
- repeatable local runs
- model comparison reports
- structured traces for every turn
- validator overrides for unsafe model plans
- grounded answers only when the corpus supports them
- handoff/refusal/fallback when the corpus or policy requires it
- a clear list of failure modes that remain before productisation

It does not need a production UI to be valuable. A credible CLI demo can show the
thing the business actually needs: the decision engine absorbing realistic support
journeys safely enough to justify building the rest.

### Phase 0 Exit Gate

Do not start the full widget/deployment build until Phase 0 has produced enough
evidence to answer:

- Which model/prompt/policy combination is the current baseline?
- Which journeys pass, fail, or remain ambiguous?
- Where does the corpus need more approved content?
- What actions and UI primitives are actually needed?
- What trace fields are genuinely useful for review?
- Which failure modes must be designed into the production backend?

The exit gate is not satisfied by a short suite that only works for a few journeys.
It needs enough breadth, personality variance, and failure evidence to support a
serious productisation decision.

This exit gate is the point of the phase. It turns observed engine behaviour into
product architecture.

## What This Avoids

This architecture avoids:

- a giant intent taxonomy becoming the product
- separate model calls for every pseudo-step when one structured turn plan is enough
- code that tries to encode all possible conversational nuance
- frontend business logic
- arbitrary model-generated UI
- unauditable "the model thought it was fine" decisions

The codebase stays smaller because it validates decisions instead of trying to
pre-write every path.

## Delivery Shape

Recommended Phase 0 slices:

1. Define the shared `TurnPlan`, `UiPlan`, grounding, safety flag, and trace schemas.
2. Add retrieval over the approved knowledge base and enforce `serving_mode`.
3. Add the policy/grounding validator and prove override behaviour with direct
   `TurnPlan` fixtures where useful.
4. Add the real LLM-backed turn planner behind a runtime switch.
5. Add the representative journey simulation harness and JSONL trace output.
6. Add model comparison reports for candidate planner adapters.
7. Add a small CLI and/or local HTTP server for demos and manual probes.

Recommended Phase 1 productisation slices, after the Phase 0 exit gate:

1. Stabilise the production API around the proven turn contract.
2. Add persistence and production audit storage using the trace fields that proved
   useful in Phase 0.
3. Add handoff intake and ticket webhook side effects.
4. Build the thin widget to render the proven UI primitives.
5. Add iframe/session/cookie hardening.
6. Deploy the smallest AWS walking skeleton around the proven engine.
7. Run trial hardening, observability, and retention/access-control work.

## Open Decisions

This variant still needs owner decisions before release:

- which model/provider is approved for customer data
- exact prompt and policy versioning strategy
- production grounding/citation policy after Phase 0 evidence
- vulnerability/escalation taxonomy and approved copy
- handoff intake fields and webhook contract
- approved refusal/signpost/fallback copy for excluded items
- transcript/audit retention and access controls

## Suggested Architecture Wording

If this variant is accepted, update the architecture summary from:

```text
ChatService owns the fail-closed message pipeline:
vulnerability gate -> classifier -> router -> response generation.
```

to:

```text
ChatService eventually owns the fail-closed turn pipeline:
conversation context -> retrieval -> constrained LLM turn planner ->
policy/grounding validator -> audited response or handoff.
```

That keeps the same safety boundary while reducing the pull toward a complex
hand-coded routing system.
