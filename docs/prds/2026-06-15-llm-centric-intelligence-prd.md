# PRD: Phase 0 LLM-Centric Intelligence

## Problem Statement

The Phase 0 TurnPlanner engine has exposed a structural tension. The original
direction was to keep classifying logic out of code as much as possible, but the
current route-safety behavior has started accumulating lexical patches, negation
patterns, weak-term lists, retrieval boosts, validator message inference, and
test-driven phrase tuning.

That work has been useful. It found real leaks and made the engine safer. The
problem is that continuing down that path creates the thing the project was trying
to avoid: a hand-maintained mini-language for customer intent, vulnerability,
negation, account specificity, excluded advice, and support routing. It will need
constant tuning, broad phrase batteries, and human attention every time a new
failure shape appears.

The user has a low appetite for continually tuning this magical policy layer. The
product should therefore move toward model-owned interpretation while keeping code
responsible for orchestration, schemas, traceability, and hard compliance gates.

The goal is not to make the LLM the compliance authority. The goal is to stop code
from pretending to understand messy customer language better than a model, while
keeping deterministic enforcement around the things that must never be negotiable.

## Solution

Introduce an LLM-centric intelligence layer inside the Phase 0 engine.

The new shape should be:

- one or more structured LLM calls extract customer meaning, active safety signals,
  negations, account-specific intent, excluded-advice risk, and retrieval intent
- retrieval uses those structured signals to search and rank approved corpus
  evidence instead of leaning on raw lexical coincidences
- the TurnPlanner uses the signal bundle, conversation state, and retrieved evidence
  to propose the next turn
- a verifier may assess whether a proposed customer-facing answer is supported by
  the cited evidence
- deterministic validation remains the hard policy backstop for schema, forbidden
  credentials, grounding, serving mode, unsafe promises, UI/action compatibility,
  and fail-closed behavior

This changes where intelligence lives. It does not remove authority boundaries.

The desired runtime model is:

- **Signal extraction:** model-owned interpretation of the current message and
  conversation context
- **Retrieval planning:** model-assisted query shaping and route-aware evidence
  selection
- **Turn planning:** model-owned proposal of the customer-facing next action
- **Verification:** optional model-owned support check for generated answers
- **Validation:** deterministic code-owned enforcement of non-negotiable rules

This should replace broad lexical policy tuning with small, typed, observable model
contracts. The code should become less clever and more boring: call model, validate
shape, route to next boundary, record trace, fail closed when the model or evidence
is not good enough.

## User Stories

1. As a product owner, I want the system to understand messy customer language
   without constant phrase-by-phrase tuning, so that the product can improve through
   model and prompt selection rather than an expanding regex layer.
2. As a compliance reviewer, I want deterministic validation to remain in place, so
   that model intelligence cannot bypass grounding, credential, account-specific, or
   vulnerability rules.
3. As an engineer, I want retrieval to use structured model signals rather than raw
   token coincidences, so that filler words and negated safety terms do not distort
   route evidence.
4. As an engineer, I want the active meaning of a message captured in a typed signal
   bundle, so that traces explain what the model thought the customer meant.
5. As an engineer, I want negation and correction handling to be model-interpreted,
   so that code does not need to enumerate every form of "not hardship", "pasted by
   mistake", or "ignore that".
6. As a customer with a public FAQ question, I want the bot to answer from approved
   knowledge, so that I am not unnecessarily handed off.
7. As a customer asking for account-specific information, I want the bot to route me
   safely to a person, so that the anonymous chat does not invent personal data.
8. As a customer in hardship, distress, vulnerability, complaint, legal, or
   accessibility difficulty, I want the bot to detect the active concern and route
   me to a person early.
9. As a customer who says a risk phrase was accidental or negated, I want the bot to
   recover when safe instead of treating stale state as current intent.
10. As an operator, I want traces to show signal extraction, retrieval intent,
    planner output, verification outcome, validator overrides, and final action, so
    that failures can be diagnosed at the right layer.
11. As a model evaluator, I want to compare cheaper and stronger models per
    responsibility, so that the system can use the lowest acceptable model for each
    task rather than one model for everything by default.
12. As a model evaluator, I want small structured probes for model compatibility,
    latency, output length, and cost, so that model choice is evidence-led.
13. As an engineer, I want model calls behind replaceable ports, so that GPT-4,
    GPT-5, and future providers can be tested without rewriting the engine.
14. As a reviewer, I want the validator to distinguish "the model thought this" from
    "the system allowed this", so that traces do not overstate model authority.
15. As a compliance reviewer, I want fail-closed behavior when a signal extractor,
    verifier, or planner returns malformed output, so that model instability routes
    safely.
16. As an engineer, I want fewer lexical policy tests, so that the test suite guards
    behavior instead of becoming a corpus of spelling variants.
17. As a future maintainer, I want prompts and model contracts to be small and
    versioned, so that changes are reviewable and rollback is possible.
18. As a product stakeholder, I want an explicit evidence gate before replacing
    current deterministic patches, so that the move to model-centric intelligence is
    not a leap of faith.
19. As an engineer, I want the corpus to keep clear policy metadata such as serving
    mode, so that approved answerability remains data-driven even when models assist
    interpretation.
20. As an operator, I want the system to record cost, latency, token usage, and
    model ID per intelligence call, so that production tradeoffs are visible.
21. As a customer, I want the bot to avoid asking repetitive intake questions after
    a handoff, so that the conversation feels coherent.
22. As a support agent, I want human handoff summaries to include model-interpreted
    issue type and safety signals, so that I can understand why the ticket was
    created.
23. As a product owner, I want model intelligence to be evaluated against realistic
    support journeys, so that "works on three examples" does not become product
    confidence.
24. As an engineer, I want the system to keep deterministic blockers for bank
    details, payment credentials, promises, and unsupported advice, so that model
    improvements do not weaken safety boundaries.

## Implementation Decisions

- Preserve the engine-first Phase 0 boundary. This PRD does not start the widget,
  production API, SQL audit store, ticket webhook, real PII intake, or deployment.
- Preserve `processTurn` as the orchestration boundary. The engine still owns the
  turn lifecycle, state merge, retrieval, planner call, validation, trace, and final
  result.
- Preserve `TurnPlanner` and `TurnPlan` as the proposal boundary. A model proposal
  is still untrusted until validated.
- Add a structured `SignalExtractor` responsibility. It should classify the active
  customer meaning, active safety signals, negated or corrected signals,
  account-specific intent, excluded-advice risk, language or accessibility needs,
  customer objective, and uncertainty.
- Keep signal extraction model-owned and typed. Do not rebuild the signal extractor
  as regexes, scoring tables, or a custom DSL.
- Add retrieval planning as a small structured output, either as part of signal
  extraction or as a separate call if evidence shows separation is useful. It should
  produce normalized retrieval queries, route hints, and evidence constraints.
- Improve retrieval by using normalized model-generated intent and route hints before
  corpus matching. Retrieval should stop treating weak raw tokens as strong policy
  evidence.
- Keep corpus `serving_mode` as policy data. Model intelligence may interpret the
  customer; it does not erase the corpus answerability boundary.
- Keep deterministic validation for hard rules: schema validity, grounding
  requirement, serving-mode compatibility, forbidden credentials, account-specific
  promises, unsupported advice, unsafe commitments, and allowed UI/action
  compatibility.
- Add an optional structured `AnswerVerifier` responsibility only for generated
  customer-facing answers. It should judge whether the proposed answer is fully
  supported by cited evidence, identify unsupported claims, and return uncertainty.
- Treat verifier output as advisory evidence for validation, not as sole authority.
  Deterministic grounding requirements still apply.
- Consider separate models per responsibility. Cheap structured-output models may be
  acceptable for signal extraction, while planning or verification may need a
  stronger model depending on evidence.
- Use current model-probe artifacts as the first model-selection input. Early probe
  evidence suggests the cheapest "nano" label is not automatically reliable and that
  structured-output support differs across GPT-4/GPT-5 models.
- Add model configuration by responsibility: signal extractor, planner, verifier,
  and fallback. Each responsibility should record model ID, prompt version, schema
  version, latency, token usage, and estimated cost.
- Version every model contract. Signal schema, planner schema, verifier schema,
  prompt version, policy version, and corpus fingerprint should appear in traces.
- Fail closed on malformed model output. If signal extraction fails, use conservative
  routing and record the failure. If planning fails, fallback safely. If verification
  fails for an answer, do not answer the substance.
- Reduce lexical policy code only after the model-centric path proves equivalent or
  better on the safety envelope. Existing deterministic patches may remain during the
  transition as comparison baselines.
- Do not remove the validator. The validator is the compliance backstop and the place
  where hard product rules remain enforceable.
- Do not make tests assert exact model wording. Tests should assert behavior, route,
  safety flags, trace shape, and grounding envelope.
- Keep model prompts short enough to maintain cost discipline. Move stable policy
  context into reusable prompt prefixes and keep retrieved evidence concise.
- Record all model-call outputs needed for review while avoiding raw sensitive data
  in cache keys or summary metadata.
- Prefer deletion after proof. Once the signal extractor reliably owns interpretation,
  remove duplicated weak-term and lexical route-scoring code instead of maintaining
  both indefinitely.

## Testing Decisions

- Use behavioral envelope tests for the model-centric engine path. The test target is
  safe external behavior, not matching implementation details or exact phrasing.
- Test the signal extractor contract with injected model outputs. It should accept
  valid structured signals, reject malformed outputs, and fail closed when the model
  output is absent or invalid.
- Test negation and correction at the behavior boundary. Examples should include
  negated hardship, accidental pasted content, stale vulnerability state, and fresh
  active hardship.
- Test account-specific detection at the behavior boundary. Balance, payment,
  application, reference, and change requests should route to handoff unless they are
  clearly public FAQ questions.
- Test excluded-advice handling. IVA, legal, debt advice, and regulated advice
  requests should refuse or signpost safely rather than answer the substance.
- Test vulnerability and escalation handling. Hardship, distress, complaint, legal,
  accessibility, language barrier, and vulnerable-customer cues should route before
  normal FAQ behavior.
- Test public FAQ recovery. After stale or corrected safety state, a fresh public FAQ
  should be answerable when grounding exists.
- Test retrieval planning separately from final routing. Given the same message and
  signal bundle, retrieval should produce stable evidence candidates without choosing
  the final action.
- Test verifier behavior with injected outputs. Unsupported generated claims should
  block customer-facing answers; supported answers should pass when deterministic
  grounding also passes.
- Test model-call observability. Each intelligence call should record model ID,
  prompt version, schema version, latency, token usage, estimated cost where known,
  and parse status.
- Test fallback behavior. Signal, planner, retrieval, and verifier failures should
  route safely and produce diagnosable traces.
- Keep a small phrase battery for known high-risk edges, but avoid expanding it into
  the main implementation method. The phrase battery is evidence, not the product
  intelligence layer.
- Use live model probes for model selection. Three-run probes are acceptable for
  initial compatibility and cost screens; journey and stochastic runs are required
  before replacing existing behavior.
- Compare the current lexical path and the model-centric path on the same scenarios
  during migration. Do not delete deterministic lexical safety patches until the
  new path has evidence for the same safety cases.
- Run standard local gates for deterministic code changes and separate live-model
  gates for model behavior changes.

## Out of Scope

- Building the Vue widget.
- Building the production API.
- SQL Server persistence or production audit storage.
- Ticket webhook side effects.
- AWS or deployment work.
- Real customer PII intake.
- CRM or loan-database integration.
- Online self-learning or autonomous production prompt changes.
- Removing deterministic validation.
- Using an LLM to authorize forbidden credentials, unsupported advice, account
  answers, customer-record changes, or payment changes.
- Building a large custom policy DSL to replace the current lexical patches.
- Replacing all tests with live model calls.
- Selecting the final production model solely from the small compatibility probe.
- Treating semantic caching or fuzzy answer reuse as part of this change.

## Further Notes

This PRD intentionally changes the frame from "make retrieval/classification
cleverer" to "make code less responsible for language understanding." That is the
right trade if the team has little appetite for endless DSL tuning.

The key risk moves from hand-coded lexical brittleness to model reliability,
latency, cost, and explainability. That is a better-shaped risk for this product
only if the contracts are typed, traces are rich, models are compared by
responsibility, and the validator remains hard-edged.

The first implementation slice should be a shadow-mode signal extractor. It should
run beside the current engine path, emit traces, and compare its signal bundle
against current final behavior. The second slice can let retrieval consume the
signal bundle. The third slice can simplify lexical retrieval and validator message
inference where evidence shows the model-centric path has taken over safely.

The model probe already created in this branch should be kept as a disposable
operator tool, not product code. Its useful lesson is methodological: live model
IDs, structured-output compatibility, latency, token usage, and per-call cost should
be measured before assigning responsibilities to models.
