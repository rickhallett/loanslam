# PRD: Structured Signal Routing Evidence

## Problem Statement

Phase 0 evidence shows that regex-heavy lexical routing is the wrong place to
interpret customer meaning. It helped as a first safety floor, but the lab API
battery now shows the failure mode clearly: weak words such as "cant", "pay",
"who", "service", and negated phrases such as "not complaining" or "not
struggling to pay" can still select vulnerability routes and force handoff copy.

The user needs the engine to prove real TurnPlanner behavior without becoming a
hand-maintained dictionary of every possible customer phrase. The historical
lesson matters: regex is useful for hard syntax and forbidden terms, but brittle
for intent, negation, correction, and route meaning.

## Solution

Use structured signal extraction as current-turn route evidence before retrieval
and validation decide whether a turn is actively vulnerability, account-specific,
excluded, or answerable.

The signal bundle should constrain retrieval by serving mode. A fulfilled signal
that says the current turn is answerable should prevent weak vulnerability matches
from winning. A fulfilled signal that says the current turn is account-specific,
excluded, or actively vulnerable should boost matching corpus evidence and suppress
unrelated route matches. Deterministic validation remains responsible for hard
rules such as forbidden credentials, account-specific promises, grounding, schema
validity, and safe fallback.

## User Stories

1. As an operator, I want the engine to use structured signal evidence for route
   meaning, so that customer intent is not decided by weak word overlap.
2. As a reviewer, I want negated hardship and complaint phrases to recover safely,
   so that traces do not falsely mark vulnerability.
3. As a customer asking a public FAQ after handoff, I want the bot to answer when
   safe, so that completed-ticket state does not swallow a new intent.
4. As a customer with genuine hardship, I want the bot to route me to a person, so
   that removing regex route authority does not weaken the safety envelope.
5. As an engineer, I want a compact API battery subset, so that the most important
   paths can be rerun without the full 40-scenario review cost.
6. As an engineer, I want regression tests to mirror API-simulator failures, so
   that unit tests protect behavior rather than implementation trivia.
7. As a future maintainer, I want regex retained only for bounded syntax and hard
   safety terms, so that the code does not regrow a route-language DSL.
8. As a stakeholder, I want historical docs explaining why the project moved away
   from lexical route patches, so that future changes do not repeat the same drift.

## Implementation Decisions

- Keep `processTurn` as the engine boundary.
- Treat a fulfilled signal bundle as current-turn route evidence.
- Use signal route evidence to filter and boost retrieval matches before planning.
- Feed the same signal evidence into validation so stale planner safety flags do
  not override a fresh public FAQ turn.
- Keep deterministic validators for hard syntax and compliance blockers.
- Do not add a second vulnerability model call in this slice.
- Do not remove the existing shadow-signal trace fields yet; the trace schema can
  be renamed after the behavior is proven.
- Keep the compact battery separate from the broad review battery and manual QA
  failure-mode battery.

## Testing Decisions

- Add regression tests at the engine boundary for the four failed API scenarios:
  weak "cant/pay" correction, negated complaint, false hardship correction, and
  post-ticket public FAQ sidequest.
- Add retrieval tests that prove fulfilled signal evidence suppresses unrelated
  route matches.
- Keep the API simulator battery as the more informative evidence layer for live
  model behavior.
- Use unit tests for fast guardrails and the compact API subset for review-grade
  trace evidence.
- Avoid asserting exact model wording in live API runs; assert action, route,
  safety flags, and customer-visible failure markers.

## Out of Scope

- Production widget, production API, persistence, ticket webhook, and real PII
  handling.
- Replacing the TurnPlanner contract.
- Full prompt redesign.
- Removing all regex. Regex remains appropriate for labelled intake fields,
  forbidden credential terms, and obvious promise/credential blockers.

## Further Notes

The important distinction is authority. The model may interpret customer meaning,
but code still enforces allowed behavior. Retrieval should stop using raw lexical
coincidence as policy authority.
