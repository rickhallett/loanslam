# Phase 0 Engine Stakeholder Readiness PRD

## Problem Statement

The Phase 0 TurnPlanner engine is real enough to inspect, but not yet credible enough
to productise. Current evidence shows the core loop can retrieve knowledge, call a
real model-backed `TurnPlanner`, enforce policy through the validator, and emit local
traces. It also shows the system is still too fragile and too handoff-heavy for a
stakeholder demo: vague customers do not get clarification, model schema failures can
abort comparison runs, manual CLI probing has an argument-passing footgun, and the
validator still rescues too many planner proposals.

Stakeholders are not going to care about the existence of a validator, a CLI, or a
local lab API on their own. They need to see evidence that the engine can safely handle
realistic support traffic: answer grounded general questions, ask useful clarifying
questions, route unsafe or account-specific requests to a human, and explain the
remaining failure modes without collapsing mid-run.

## Solution

Make Phase 0 evidence runs robust, behaviorally sharper, and readable enough to support
a productisation decision. The work proceeds through four slices:

1. Harden the evidence machinery so malformed model output becomes report evidence
   instead of an aborted run.
2. Improve vague-message behavior so the engine clarifies before routing when the
   customer has not given enough information.
3. Reduce validator rescues by making the planner contract, prompt, and policy
   boundaries produce cleaner first-pass plans.
4. Generate a stakeholder evidence pack from real current-head model runs.

This remains a Phase 0 engine proof. It does not build the widget, production API,
SQL audit store, ticket webhook, AWS deployment, real PII intake, or production
compliance approval process.

## User Stories

1. As a product stakeholder, I want one evidence pack that explains what the engine can
   safely do, so that I can decide whether it is worth productising.
2. As an operations stakeholder, I want to see how often the engine answers, clarifies,
   hands off, refuses, and falls back, so that I can judge likely support load.
3. As a compliance stakeholder, I want unsafe planner proposals to be caught and
   counted, so that I can inspect whether the hard rules are protecting customers.
4. As a compliance stakeholder, I want malformed model output to be recorded as a
   failure mode, so that the evidence does not hide model instability.
5. As a technical stakeholder, I want comparison runs to complete even when one journey
   has bad model output, so that one malformed response does not destroy the run.
6. As a technical stakeholder, I want manual CLI probes to preserve full customer
   messages, so that local demos are not distorted by shell argument handling.
7. As a reviewer, I want every simulated turn to include retrieved item IDs, selected
   serving mode, proposed action, final action, flags, overrides, and customer copy, so
   that I can reconstruct why the engine behaved as it did.
8. As a reviewer, I want vague customer requests to receive clarifying questions when
   safe, so that the bot does not unnecessarily pass low-risk ambiguity to humans.
9. As a customer with a clear FAQ question, I want a direct grounded answer, so that I
   do not get pushed to a human for simple public information.
10. As a customer with an account-specific question, I want the bot to route me to a
    human instead of guessing, so that personal account data is not invented.
11. As a customer in hardship or distress, I want the bot to route me to a person
    early, so that sensitive situations are not handled as normal FAQ traffic.
12. As a customer who offers card or bank credentials, I want the bot to block that
    path and request only approved handoff fields, so that unsafe data is not collected.
13. As a customer asking for excluded advice, I want the bot to refuse or signpost
    safely, so that the system does not provide regulated advice it is not allowed to
    provide.
14. As an engineer, I want planner schema failures represented in the same report model
    as journey failures, so that the simulation harness is useful for regression work.
15. As an engineer, I want focused tests around malformed plans, clarification, and
    override reduction, so that the next fixes are not only prompt vibes.
16. As an engineer, I want the planner adapter to keep OpenAI structured output quirks
    behind one boundary, so that the rest of the engine can stay provider-neutral.
17. As an engineer, I want the validator to remain a hard-rule backstop, so that UX
    tuning does not weaken account, credential, grounding, or vulnerability rules.
18. As an engineer, I want each slice to be independently verifiable and commit-safe,
    so that review can proceed without one large mixed change.
19. As a future widget implementer, I want the final evidence to identify the UI
    primitives actually used, so that Phase 1 does not build speculative frontend
    states.
20. As a future backend implementer, I want the final evidence to identify trace fields
    that proved useful, so that production audit design is based on observed behavior.

## Implementation Decisions

- Keep Phase 0 engine-first. Do not start product widget, production API, persistence,
  ticket webhook, or deployment work.
- Treat malformed planner output as evidence. The comparison and simulation harnesses
  should finish runs and record failures where possible.
- Keep the `TurnPlanner` interface as the model boundary. Provider-specific structured
  output normalization stays inside the OpenAI planner adapter.
- Keep `processTurn` as the deterministic engine entry point. It should return a
  safe validated result even when the planner returns a contract-invalid proposal.
- Preserve `TurnPlan` as untrusted model output and `ValidatedTurnResult` as enforced
  engine output.
- Keep the validator focused on hard rules: grounding, serving mode, forbidden
  credentials, account-specific promises, vulnerability routing, and UI/action
  compatibility.
- Add clarification behavior as a planner/policy outcome rather than a new production
  router. Phase 0 still uses one planner call with validator enforcement.
- Do not weaken vulnerability, account-specific, excluded, or credential safety to
  improve metrics.
- Generate the evidence pack from real model-backed runs using the default planner
  model unless a stronger comparison is explicitly needed by observed failure modes.
- Store generated evidence under ignored `artifacts/phase0/`; store the stakeholder
  note under tracked docs so the decision record is durable without committing raw
  run artifacts.

## Testing Decisions

- Use test-first development for each behavior change.
- Tests should verify external behavior of the engine, CLI, planner adapter, reports,
  and simulation harnesses rather than internal implementation details.
- Existing prior art lives in core tests for CLI behavior, planner adapter
  normalization, validator overrides, journey reports, persona reports, and runner
  behavior.
- Slice 1 tests should prove malformed planner output is converted to a safe/reportable
  failure and that CLI argument passing preserves multi-word messages through the
  documented path.
- Slice 2 tests should prove vague requests clarify while account-specific and
  vulnerability requests still route safely.
- Slice 3 tests should prove avoidable validator overrides are reduced without
  removing hard-rule enforcement.
- Slice 4 verification should use real model-backed runs plus deterministic local
  gates, and should explicitly record any model quota or provider failure.

## Out of Scope

- Vue widget or browser UI.
- Production Express API.
- SQL Server persistence or production audit store.
- Real ticket webhook side effects.
- Real customer PII intake.
- AWS deployment.
- CRM or loan-database integration.
- Production compliance sign-off.
- Online or autonomous self-learning.
- Replacing the synthetic corpus with real private customer content.

## Further Notes

Prototype Mode applies. The current caution classes are:

- Blocker: evidence tooling aborts, unsafe credential/account/vulnerability regression,
  raw private data, or a report that overstates what synthetic evidence proves.
- Timebox: prompt wording, borderline vague-route cases, model drift, and owner wording
  for stakeholder summaries.
- Parking Lot: polished UI, production audit design, comprehensive corpus expansion,
  visual dashboards, and fixed production model approval.

The decision gate after Slice 4 is whether the engine has earned Phase 1
productisation. A reasonable productisation candidate should complete evidence runs,
answer grounded FAQ turns, clarify at least some vague low-risk requests, preserve
hard safety boundaries, and produce a concise failure-mode list that stakeholders can
understand.
