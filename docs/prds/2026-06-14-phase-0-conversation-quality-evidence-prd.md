# Phase 0 Conversation Quality Evidence PRD

## Problem Statement

Phase 0 now exposes a more useful class of failure than the original safety
journeys covered: the engine can remain inside hard policy boundaries while still
leaving a customer confused, stuck, or poorly supported.

Recent live lab sessions showed the difference clearly. The engine can collect
handoff intake fields, avoid leaking stored details, answer public FAQ questions,
and preserve hard safety. It can also repeat stale completion copy, fail to explain
why a handoff is needed, route general loan-application language too eagerly into
handoff, and let `handoff_intake_complete` swallow sensitive follow-up moments.

The current harness is still too shallow for this behavior. Most generated and fixed
scenarios top out at two customer turns, while live lab sessions naturally produced
13 and 28 customer turns. The next Phase 0 slice should make conversation quality
visible and replayable without turning the validator into a subjective UX critic or
building production ticketing.

## Solution

Upgrade Phase 0 conversation behavior and evidence around handoff intake,
follow-up recovery, and UX review.

The target shape is:

```text
TurnPlanner
-> proposes a useful customer-facing turn
Validator / engine
-> enforce hard policy and state guarantees
Harness
-> records long replayable journeys and UX findings
Optional model-backed UX evaluator
-> judges understandability and actionability from transcript evidence
```

This is not a rewrite. Keep the existing engine boundary, validator, local lab, STS,
and trace artifacts. Add targeted behavior and evidence where the live sessions
proved the current system is thin:

1. Preserve code-owned guarantees for handoff field disclosure.
2. Improve prompt guidance for handoff explanation, confusion recovery, and
   post-intake follow-up.
3. Ensure urgent vulnerability or crisis turns cannot be reduced to stale
   ticket-completion copy.
4. Extend harness coverage to longer, messy, replayable lab-style journeys.
5. Add a `gpt-5.4-mini` UX evaluator for structured findings where language judgment
   is required.

The outcome is better Phase 0 evidence, not production approval.

## Evidence

Two live lab sessions are the motivating evidence.

### Session `affafd0d-ab73-4bb0-98a6-f5afa5901be8`

Raw evidence artifact:

```text
artifacts/phase0/lab-session-affafd0d-2026-06-14.json
```

Observed behavior:

- 28 customer turns, far beyond current fixed journey coverage.
- Field-disclosure copy materially improved the visible intake flow.
- The bot tolerated hostile/noisy/fake input while collecting intake state.
- Public FAQ turns for regulation and Open Banking were answered.
- Attempts to retrieve stored personal details were not served back to the user.
- After intake completion, many turns collapsed into the same completion copy:
  "Thanks. I have the details needed to pass this to the Loanslam team."
- Financial difficulty, self-harm language, and "call the police" were detected by
  flags, but the user-facing response remained stale completion copy.

### Session `4ae34629-a501-4042-a32f-b93d7e7df2a9`

Raw evidence artifact:

```text
artifacts/phase0/lab-session-4ae34629-2026-06-14.json
```

Observed behavior:

- 13 customer turns.
- Field-disclosure copy again made intake understandable.
- Implausible date-of-birth input was not accepted as final; the bot asked again.
- The bot collected the standard handoff fields and completed the intake path.
- "What can I take a loan out for?" fell to safe fallback despite feeling
  answerable or at least explainable.
- "Can I take out a loan for debt consolidation?" routed to vulnerability handoff,
  which may be defensible, but the bot did not explain why.
- "Why do you need to pass me to the Loanslam team?" repeated the field list instead
  of answering the handoff rationale.
- "What happens now?" after completion repeated stale completion copy.

### Evaluator Spike

A throwaway evaluator probe compared model-backed UX evaluation candidates. The
useful result was:

```text
gpt-5.4-mini
  expected finding recall: 100%
  clean-case false positives: 0%
  observed cost: about $0.008 for five probe calls
```

Decision: use `gpt-5.4-mini` for the UX evaluator unless later evidence disproves
the choice. Do not use a regex-heavy UX evaluator.

## User Stories

1. As a customer starting a loan conversation, I want the bot to tell me what it can
   do next, so that I am not pushed into a vague handoff flow.
2. As a customer asked for handoff details, I want to know which details are needed,
   so that I can decide whether and how to provide them.
3. As a customer midway through intake, I want the bot to ask only for the fields
   still missing, so that I do not repeat myself.
4. As a customer who asks "what details?", I want the bot to answer the question
   directly, so that the form state is understandable without reading diagnostics.
5. As a customer who asks "why do you need to pass me to the team?", I want a short
   reason, so that the handoff feels justified rather than evasive.
6. As a customer who asks "what happens now?", I want a practical next-step answer,
   so that completion copy does not leave me stuck.
7. As a customer who gives an implausible or ambiguous field value, I want the bot to
   ask again plainly, so that bad data is not treated as confirmed.
8. As a customer who provides multiple fields in one message, I want the bot to use
   the fields it can safely identify, so that I do not have to retype obvious
   information.
9. As a customer asking a general public-information question, I want a grounded
   answer where the corpus supports it, so that I am not handed off unnecessarily.
10. As a customer asking about a potentially sensitive or excluded loan purpose, I
    want a careful explanation of why a person is needed, so that handoff does not
    feel arbitrary.
11. As a customer in financial difficulty, I want the bot to acknowledge the concern
    and route me to human support, so that my message is not treated as normal intake
    housekeeping.
12. As a customer expressing distress or crisis language, I want the bot to respond
    with appropriate human-support copy, so that stale completion text is not served
    at the worst moment.
13. As a customer using profanity or hostile language, I want the bot to remain
    steady and useful, so that the conversation can recover where possible.
14. As a customer trying prompt injection, I want the system not to reveal internal
    instructions or private stored details, so that privacy and policy boundaries
    remain intact.
15. As a compliance reviewer, I want hard safety failures separated from UX findings,
    so that safe-but-bad behavior does not get mislabeled as compliance failure.
16. As a product reviewer, I want long messy lab-style journeys in the harness, so
    that Phase 0 evidence reflects realistic conversation recovery.
17. As a product reviewer, I want UX findings with replay commands, so that I can
    inspect the exact turn sequence that caused a problem.
18. As an engineer, I want state guarantees enforced in code, so that required field
    disclosure, missing-field narrowing, and completion behavior do not depend only
    on prompt adherence.
19. As an engineer, I want conversational guidance in the planner prompt, so that the
    model can handle handoff explanation and user confusion without overfitting code
    to phrases.
20. As an engineer, I want `gpt-5.4-mini` to judge conversation quality from
    transcript evidence, so that the harness does not grow a brittle pile of
    regex-based NLP.
21. As an engineer, I want the UX evaluator to be optional or clearly scoped, so that
    every STS run does not silently double the model-call budget.
22. As a future product engineer, I want this work to stop short of production
    ticketing, real PII intake, and service-level promises, so that Phase 0 remains
    an engine proof.

## Implementation Decisions

- Keep Phase 0 engine-first. Do not build the widget, production API, ticket webhook,
  production audit store, deployment, or real customer PII infrastructure.
- Keep `processTurn` as the central boundary under test.
- Keep `TurnPlanner` as the model proposal interface. The planner remains untrusted.
- Keep `TurnPlan` as the model proposal and `ValidatedTurnResult` as the enforced
  engine result.
- Keep the validator focused on hard policy: grounding, serving modes, forbidden
  credentials, account-specific promises, vulnerability routing, excluded advice,
  malformed plans, and UI/action compatibility.
- Do not turn the validator into a broad UX critic.
- Use code for state guarantees:
  - requested handoff fields must be visible in customer-facing copy
  - only missing handoff fields should remain requested
  - completed intake must not keep showing intake requests
  - crisis or vulnerability priority must not be swallowed by completion overrides
- Use prompt guidance for conversational behavior:
  - explain why handoff is needed
  - answer "why handoff?" directly
  - answer "what happens now?" directly
  - acknowledge vulnerability or distress before continuing intake
  - avoid treating every handoff follow-up as a request to repeat the field list
- Review retrieval and corpus behavior for general apply, debt consolidation, loan
  purpose, and "what can I borrow for?" language before deciding that all such turns
  belong in handoff.
- Preserve the code-owned handoff field-disclosure improvement already prototyped on
  the branch.
- Add or update completion behavior so post-intake follow-up can produce useful
  next-step copy without becoming production ticketing.
- Add a vulnerability/crisis priority path so urgent support language receives
  appropriate copy even after all intake fields are present.
- Enrich STS and lab-derived traces with enough evidence for UX review: transcript,
  final action, selected serving mode, safety flags, validator overrides, requested
  fields, collected fact keys, UI primitive, and replay identifiers.
- Add a model-backed UX evaluator using `gpt-5.4-mini`.
- The UX evaluator should produce structured findings with category, severity,
  turn indexes, concise evidence, and optional suggested fix.
- UX evaluator categories should start with:
  - `next_step_not_actionable`
  - `requested_fields_not_communicated`
  - `confusion_not_resolved`
  - `handoff_reason_not_explained`
  - `premature_handoff_for_general_apply`
  - `post_intake_followup_not_answered`
  - `vulnerability_acknowledgement_missing`
  - `stale_completion_copy`
- Treat UX findings as evidence findings, not hard failures, unless they coincide
  with an existing hard safety boundary.
- Keep evaluator execution cost visible in artifacts: model, calls, token usage,
  estimated cost, and latency.
- Default evaluator execution remains an open operational decision. The PRD assumes
  evaluator support exists before deciding where it runs by default.

## Testing Decisions

- Test external behavior, not implementation details.
- Keep deterministic tests around engine state guarantees and validator hard policy.
- Add focused engine tests for:
  - full handoff field disclosure
  - partial/missing field disclosure
  - completed intake next-step behavior
  - vulnerability/crisis priority after intake completion
- Add prompt or planner contract tests where possible for:
  - "why handoff?" explanation
  - "what happens now?" follow-up
  - general apply language not becoming arbitrary handoff
  - debt-consolidation handoff explanation when handoff is chosen
- Add long fixed regression journeys derived from the live lab sessions.
- At least one regression journey should exceed 10 customer turns.
- Regression journeys should assert behavioral envelopes rather than exact wording.
- STS should preserve replay commands for long-journey findings.
- Use `gpt-5.4-mini` evaluator tests with a fake evaluator in unit tests and real
  model-backed runs only as evidence generation.
- Do not require the UX evaluator to agree with exact category sets in all cases.
  Measure useful recall, clean-case false positives, and finding evidence quality.
- Do not build a regex-heavy UX evaluator. Regex may be used only for simple hard
  anchors where code must not infer language nuance.
- Keep raw lab session artifacts ignored under `artifacts/phase0/`; durable tracked
  docs should cite them and summarize the behavior.

## Acceptance Criteria

- A "what details?" handoff path tells the user which fields are needed and which
  field to start with.
- A "why do you need to pass me to the team?" path explains the handoff reason before
  continuing intake.
- A "what happens now?" path after completed intake gives a useful next-step answer
  instead of repeating generic completion copy.
- A financial-difficulty turn receives a human-support response and does not get
  reduced to stale completion copy.
- A crisis-style distress turn receives priority support copy even if intake is
  already complete.
- Attempts to retrieve stored personal details still do not leak collected facts.
- General public FAQ turns continue to answer from `serving_mode: answer` corpus
  items when supported.
- Account-specific, excluded, vulnerability, and credential boundaries remain hard
  policy boundaries.
- The harness contains at least one fixed replayable long journey derived from the
  live lab sessions.
- STS or the evidence harness can report UX findings separately from hard failures.
- The `gpt-5.4-mini` evaluator can run on captured transcripts and emit structured
  findings with turn indexes and concise evidence.
- Evidence artifacts include evaluator model, token usage, estimated cost, and
  latency when model-backed UX evaluation is run.

## Out of Scope

- Production launch approval.
- Customer-facing Vue widget work.
- Production API design.
- Ticket webhook side effects.
- SQL Server or production persistence work.
- Real PII intake infrastructure.
- AWS or deployment work.
- Production audit store design.
- SLA or response-time promises to customers.
- Model-generated customer journey generation.
- A second model-backed vulnerability detector in the runtime path.
- Replacing deterministic hard safety checks with LLM judgment.
- Building a comprehensive copy-quality scorer for tone, charm, or style.
- Regex-heavy NLP grading.
- A fake planner baseline for Phase 0 evidence.

## Further Notes

The most important distinction is:

```text
Hard policy safety is not the same as user success.
```

The validator can keep the system safe while the conversation remains confusing. This
PRD makes that gap visible and fixes the most obvious state-machine failures without
weakening hard policy boundaries.

The recommended implementation order is:

1. Preserve and test code-owned handoff field disclosure.
2. Fix completion-state follow-up and vulnerability priority.
3. Add prompt guidance for handoff reasons and confusion recovery.
4. Add long fixed regression journeys from the two lab sessions.
5. Add `gpt-5.4-mini` UX evaluation as an evidence layer.

Open owner decisions:

- Should UX evaluation run by default for `smoke`, `review`, both, or only behind a
  flag at first?
- Should UX findings ever block `promote_to_v2_planning`, or should they keep the run
  at `useful_with_findings`?
- What exact customer-facing crisis copy is acceptable for Phase 0 evidence, given
  that Phase 0 is not a production support channel?
- How much post-intake "what happens next" detail can be stated without implying a
  production ticketing SLA?
