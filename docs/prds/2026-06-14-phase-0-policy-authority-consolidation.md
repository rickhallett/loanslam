# PRD: Phase 0 Policy Authority Consolidation

## Problem Statement

The Phase 0 TurnPlanner work has successfully proved something important: the engine can retrieve corpus evidence, call a real model-backed planner, validate unsafe proposals, emit traces, and produce stakeholder-readable evidence.

The problem is that the proof has now accumulated more surface area than the next phase should carry forward. Policy behavior is spread across retrieval, prompt text, planner safety flags, validator logic, reports, and docs. That makes failures harder to diagnose and makes future agents more likely to preserve or extend scaffolding that was useful for discovery but should not become product architecture.

The core decision is not “was the implementation bad?” It was useful. The decision is whether discovery scaffolding should now be consolidated before it hardens into product surface.

## Solution

Reduce the Phase 0 implementation down to a clearer engine proof while preserving the safety and evidence it created.

The target model is:

```text
Retriever = evidence only
Prompt/planner = untrusted proposal only
Validator = sole hard policy authority
Reports/docs = observation only
```

This keeps the system safe without letting every layer become a partial router. The validator remains the compliance backstop. The retriever should find relevant knowledge, not quietly decide policy. The model may reason, but its output remains untrusted. Reports should describe outcomes, not introduce new policy concepts or stale steering.

The recommended path is consolidation, not a rewrite.

## User Stories

1. As an engineer, I want one hard policy authority, so that over-handoff and unsafe-answer failures have a clear owner.
2. As an engineer, I want retrieval to return evidence rather than policy decisions, so that ranking and routing can be debugged separately.
3. As a compliance reviewer, I want the validator to keep enforcing grounding, credentials, vulnerability, account-specific, and UI/action rules, so that safety does not depend on model behavior.
4. As a product stakeholder, I want one credible evidence harness, so that Phase 0 behavior is inspectable without maintaining duplicate simulation frameworks.
5. As a future agent, I want completed implementation plans marked as history or removed, so that I do not execute stale instructions.
6. As a reviewer, I want docs to avoid hardcoded “current” metrics, so that evidence comes from fresh artifacts.
7. As an operator, I want fewer advertised commands, so that the repo front door reflects what is actually essential.
8. As a future product engineer, I want prototype internals not exported as public package API, so that exploratory code remains easy to delete.
9. As a stakeholder, I want the existing evidence preserved before cuts, so that consolidation does not erase what Phase 0 learned.
10. As an engineer, I want tests to protect safety behavior rather than implementation detail, so that deletion is possible without lowering confidence.
11. As a model evaluator, I want reports to distinguish planner failure, retrieval failure, validator override, and corpus gap, so that tuning decisions are grounded.
12. As a maintainer, I want markdown treated as runtime steering surface, so that docs do not accidentally shape future behavior.

## Implementation Decisions

- Keep `processTurn`, `TurnPlanner`, `TurnPlan`, `ValidatedTurnResult`, corpus `serving_mode`, the real planner adapter, traces, and validator.
- Do not weaken the validator to reduce metrics. Safety boundaries stay load-bearing.
- Review retrieval boosts for vulnerability/advice/excluded routing. Keep lexical retrieval; remove or narrow anything that makes retrieval a second policy router.
- Consolidate journey and persona simulation into one evidence harness. Personality variance should be fixture metadata, not a separate framework unless it proves unique value.
- Preserve one model-backed evidence path and one manual probing path. Demote extra lab/operator surfaces unless they are actively needed.
- Archive or delete completed implementation plans with unchecked task lists and mandatory agent workflow instructions.
- Replace stale metric examples with instructions to inspect generated artifacts.
- Narrow exported package surface so simulation, reports, and lab internals do not look like stable product APIs.
- Keep stakeholder evidence concise: what works, what fails, what remains risky, what decision it supports.
- Make the decision explicit: Phase 0 evidence can justify productisation planning, not production launch.

## Testing Decisions

- Keep tests around hard safety boundaries: grounding, forbidden credentials, account-specific promises, vulnerability routing, excluded advice, malformed planner output, and UI/action mismatch.
- Prefer behavioral envelope tests over exact transcript wording.
- Avoid tests that only preserve current fixture shape, command count, or report formatting unless those are genuine review contracts.
- Before cutting a harness or command, capture current evidence output and verify the remaining path still produces equivalent decision support.
- Use model-backed evidence for product confidence; use direct `TurnPlan` fixtures only for deterministic validator and engine boundary tests.
- Treat docs checks as part of verification: no stale metric names, no unchecked active implementation plans, no contradictory Phase 0 guidance.

## Out of Scope

- Building the Vue widget.
- Building the production API.
- SQL Server persistence or production audit store.
- Ticket webhook side effects.
- AWS/deployment work.
- Real customer PII intake.
- Choosing a production model.
- Removing the validator.
- Weakening safety behavior to improve handoff or answer-rate metrics.
- Creating a new abstraction layer to hide the existing complexity.

## Further Notes

The steelman for the current implementation is strong: it optimized for safety, evidence, and continuity in a regulated model-driven system. That was reasonable during discovery.

The reason to reduce now is equally strong: once the proof has taught the team what matters, broad discovery scaffolding becomes liability. The right next move is to keep the safety core and evidence value, then cut duplicate authority, duplicate harnesses, stale docs, and accidental public API surface.