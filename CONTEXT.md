# Loanslam Support Chat Context

This context defines the shared product and engine language for the Loanslam support chat work. It keeps Phase 0 engine proof terms distinct from later productisation terms.

## Language

**Phase 0 Engine Proof**:
The pre-productisation build that proves the conversation engine, retrieval, validation, traces, journey simulation, and model comparison before the widget or production stack.
_Avoid_: MVP app, widget build, full product slice

**TurnPlanner**:
The swappable planner interface that proposes the next conversational move from conversation context and retrieved policy data.
_Avoid_: ChatService, router, classifier

**TurnPlan**:
The untrusted next-turn proposal produced by a **TurnPlanner** before policy and grounding validation.
_Avoid_: final response, audited response

**Validated Turn Result**:
The enforced next-turn result after policy, safety, and grounding validation have accepted or overridden the proposed **TurnPlan**.
_Avoid_: TurnPlan, model response

**Validator**:
The policy and contract backstop that accepts or overrides a proposed **TurnPlan** when hard product rules are violated.
_Avoid_: copy reviewer, UX judge, second planner

**Serving Mode**:
The corpus policy discriminator that says whether a matched knowledge item can be answered, needs handoff, needs vulnerability routing, or must be excluded from substantive answer generation.
_Avoid_: intent label, retrieval score

**Grounded Answer**:
A customer-facing answer constrained to facts and links from matched corpus items whose **Serving Mode** permits answering.
_Avoid_: generated answer, best-effort answer

**Safety Flags**:
The **TurnPlanner**-proposed markers for vulnerability, distress, complaint, legal, accessibility, hardship, or similar escalation risk.
_Avoid_: separate vulnerability model, intent label

**Excluded Item**:
A corpus item whose subject may be recognisable but whose substance must not be answered by the bot.
_Avoid_: unsupported item, generic handoff

**Handoff Intake**:
The minimal customer-provided contact and situation details needed to route a case to a human team.
_Avoid_: verification, KYC, account access

**Journey Envelope**:
The allowed behavioral bounds for a simulated customer journey, covering safe actions, forbidden behaviors, required safety signals, and UX notes without freezing exact wording.
_Avoid_: golden transcript, exact script

**Model Comparison Report**:
The Phase 0 evidence artifact that compares planner configurations against the same journey suite to identify a current baseline and failure modes.
_Avoid_: production model approval, fixed score gate

**Representative Journey Suite**:
A broad simulated conversation set that exercises realistic customer journeys, personality types, ambiguity, frustration, safety risks, and topic changes strongly enough to support a productisation decision.
_Avoid_: smoke test, few curated journeys, fake-planner baseline

**ChatService**:
The later production backend wrapper around the proven turn engine.
_Avoid_: Phase 0 engine name

## Relationships

- A **TurnPlanner** produces one **TurnPlan** per customer turn.
- A **TurnPlan** carries **Safety Flags** that the **Validator** enforces.
- A **TurnPlan** becomes one **Validated Turn Result** only after the **Validator** checks hard policy and contract rules.
- A **Serving Mode** constrains what a **Validated Turn Result** may do with a matched corpus item.
- A **Grounded Answer** requires at least one matched `answer` item and must not rely on retrieval scores alone.
- **Handoff Intake** supports human follow-up but does not verify identity or grant account access.
- A **Journey Envelope** measures whether a simulated conversation stayed inside the intended behavioral bounds.
- A **Model Comparison Report** uses **Journey Envelopes** from the **Representative Journey Suite** to compare real planner configurations without approving a production model.
- The **Phase 0 Engine Proof** must prove the turn flow before **ChatService** is productised.

## Example dialogue

> **Dev:** "Should the Phase 0 **ChatService** call the model directly?"
> **Domain expert:** "No — in Phase 0 the engine entrypoint calls a **TurnPlanner**, treats the **TurnPlan** as untrusted, then emits a **Validated Turn Result** with trace evidence. **ChatService** is a later production wrapper."

## Flagged ambiguities

- "ChatService" was used for both the future production service and the Phase 0 engine; resolved: Phase 0 uses the turn engine language, while **ChatService** is reserved for later productisation.
- "excluded" can look like handoff, refusal, or fallback; resolved: an **Excluded Item** must not be answered substantively, and its exclusion reason must remain visible in traces and reports.
- "PII safety" can pull Phase 0 toward production hardening; resolved: Phase 0 blocks forbidden credential collection but prioritises decision-engine quality and flexible customer handling over production-grade privacy infrastructure.
- "grounding threshold" can imply a brittle release gate; resolved: Phase 0 records scores as evidence but relies on citations, **Serving Mode**, validation, and journey tests rather than hard score thresholds.
- "validator" can imply a second taste-based bot; resolved: the **Validator** enforces hard policy and schema rules, while conversational quality is measured in journey reports and model comparison.
- "vulnerability gate" can imply a separate Phase 0 model call; resolved: Phase 0 uses **Safety Flags** from the single **TurnPlanner** call plus deterministic validation, while a separate vulnerability model remains a later hardening option.
- "journey test" can imply golden transcripts; resolved: Phase 0 uses **Journey Envelopes** that assert safe behavior and report UX quality without locking exact wording.
- "model comparison" can imply production model approval; resolved: the first **Model Comparison Report** ranks Phase 0 planner configurations and exposes failure modes without fixed score gates.
- "representative journey suite" can be watered down to a few happy paths; resolved: it must be broad enough to support an hour of credible C-suite probing across multiple customer personalities.
- "fake planner" can look useful for baseline tests; resolved: Phase 0 product confidence must come from real model-backed planner behavior, not a deterministic fake planner.
