# Loanslam Support Chat Context

This context defines the shared product and engine language for the Loanslam support chat work. It keeps Phase 0 engine proof terms distinct from later productisation terms.

## Language

**Phase 0 Engine Proof**:
The pre-productisation build that proves the conversation engine, retrieval, validation, traces, journey simulation, and model comparison before the widget or production stack.
_Avoid_: MVP app, widget build, full product slice

**Integrated POC**:
The next product proof surface that wraps the proven engine in a believable customer journey, mock business integrations, human handoff, admin readback, and deployment story.
_Avoid_: FAQ widget, final production system, website refresh

**Deployable Surface**:
The demoable and reviewable customer-facing application surface intended to replace the old demo/widget deployment once the **Integrated POC** is complete.
_Avoid_: production artifact, long-term enterprise system, test harness, lab UI

**Integrated POC App**:
The separate app/package that will host the **Integrated POC** and become the new **Deployable Surface** once complete.
_Avoid_: existing `site/`, demo host, review host, widget adapter

**Boundary Layering**:
Repository/service/controller-style structure used at API-like boundaries such as API handlers, persistence access, mock external-system adapters, auth/session seams, and engine integration.
_Avoid_: blanket architecture rule, UI ceremony, retrofitted pattern

**In-Repo Roadmap**:
The committed machine-readable issue map that controls agent execution order, dependencies, slice boundaries, and verification bars for the **Integrated POC**.
_Avoid_: chat-only plan, external tracker as source of truth, speed-optimised backlog

**Agentic First-Light Arc**:
A development arc that aims for increasingly long human-out-of-the-loop engineering spans, with human touchpoints reserved for judgement, opinion, and acceptance calls.
_Avoid_: unsupervised autonomy claim, fake handoff, human bypass

**Agentic Slice**:
The scoped work unit intended to be completed inside one **Agentic First-Light Arc**, with enough definition of good behavior and proof fabric for an agent to finish without continuous human steering.
_Avoid_: vague task, open-ended epic, arbitrary commit batch

**Agenda Card**:
The approved start artifact for an **Agentic Slice**, containing the slice's good-look definition, proof bar, human gate, allowed autonomy, stop condition, checkpoint plan, and failure triggers.
_Avoid_: loose prompt, chat approval, hidden plan

**AFK Execution Assumption**:
The operating assumption that once an **Agenda Card** is confirmed green and the slice starts, the human is unavailable until the next planned checkpoint or a predefined failure trigger fires.
_Avoid_: keep-going relay, ad hoc check-in, token-pressure stop

**Proof-of-Work Labels**:
The commit and roadmap labels that tie work to epics, items, **Agentic Slices**, and arcs so the history shows what was built, whether it was part of an agentic arc, and where human verification occurred.
_Avoid_: vanity metadata, Jira cosplay, noisy commit prefix

**Roadmap Touchstone**:
A coarse future waypoint after the first proof chain that gives direction without pretending the later scope is ready for granular implementation.
_Avoid_: locked issue, detailed spec, fake certainty

**Context Hygiene**:
The discipline of keeping agent-visible project docs small, focused, task-oriented, and layered so agent behaviour stays as repeatable as possible.
_Avoid_: more context by default, top-level archive, instruction accretion

**Lazy-Loaded Documentation**:
A documentation structure where agents load detailed or historical material only when the active task calls for it.
_Avoid_: always-loaded archive, omnibus instruction files, context dumping

**Documentation Cleanup Gate**:
The pre-implementation **Integrated POC** cleanup that classifies documentation across the repository into kept, lazy-loaded, rewritten, archived, or deleted context before permanent migration doctrine lands.
_Avoid_: stale doctrine, cleanup after implementation, archive near working context

**Archive Layer**:
A clearly non-operational storage layer for stale material with real historical or evidential value, placed deep enough or outside the repo so agents do not treat it as active guidance.
_Avoid_: top-level archive, working-context clutter, zombie docs

**Cleanup Classification Matrix**:
The non-operational proof artifact that records each documentation cleanup classification and action without becoming active agent guidance.
_Avoid_: live doctrine, backlog substitute, agent instruction source

**High-Risk Cleanup Doc**:
A documentation artifact whose cleanup could change agent behaviour, deployment or promotion rules, secret handling, verification evidence, stakeholder commitments, product or compliance doctrine, or active roadmap decisions.
_Avoid_: every uncertain doc, ordinary stale notes, low-risk clutter

**Cleanup Proof Bar**:
The acceptance standard for closing the **Documentation Cleanup Gate** with a committed classification matrix, applied cleanup diff, active-context pointer updates, closeout counts, and any deferred high-risk docs.
_Avoid_: matrix only, tidy-looking diff, undocumented deferrals

**Integrated POC Implementation Agenda Card**:
The post-cleanup start artifact that unlocks **Integrated POC** implementation by referencing the cleanup matrix, final doctrine, in-repo roadmap first chain, and first **Golden Path Slice**.
_Avoid_: chat-thread start, reference memo as plan, implementation before cleanup closeout

**Golden Path Slice**:
The first **Integrated POC** slice that proves the end-to-end infrastructure through one complete customer-to-admin journey before adding richer undeveloped flows.
_Avoid_: full roadmap, feature-complete POC, broad account-service build

**Read-Only First**:
The early **Integrated POC** capability posture that prioritises observable context, lookup, navigation, handoff, and admin readback before any account, application, or decision mutation.
_Avoid_: action-authoritative bot, eligibility decisioning, account mutation

**Quality POC**:
A functional, polished-enough proof of concept that demonstrates product value and integration shape without pretending to be the long-term production implementation.
_Avoid_: production system, throwaway toy, enterprise clone

**Behavior Proof Bar**:
The acceptance standard that proves an **Integrated POC** slice through real app behavior, usually a local browser flow plus server/admin readback, with tests used only when they prove or protect valid behavior.
_Avoid_: testing cosplay, seriousness proxy, detached deep tests

**Migration-First Slice**:
A first slice that ports current proven behaviour into the new infrastructure before adding new product capability, diverging only where the new infrastructure needs it.
_Avoid_: bespoke demo goal, speculative optimisation, rewrite for its own sake

**Customer-Visible Contract**:
The behaviour, journey shape, and evidence a customer or reviewer can observe from the current site, application journey, assistant, handoff, and demo/session surfaces.
_Avoid_: iframe transport, package split, review-host quirk, implementation topology

**Widget-Adapter Architecture**:
The transitional host/widget delivery model that keeps the existing iframe/native adapter code usable until the **Integrated POC** is complete.
_Avoid_: long-term default architecture, new deployable target

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
- The **Integrated POC** becomes the new **Deployable Surface** when complete, but its deployability is about demoability and reviewability rather than production permanence.
- The **Integrated POC App** is a separate app/package that consumes current engine/contracts and useful site/application assets rather than mutating existing transitional surfaces.
- **Boundary Layering** is mandatory at API-like seams and optional elsewhere only when it has demonstrated value.
- The **In-Repo Roadmap** controls **Integrated POC** execution until an external tracker proves enough QA or review value to justify being added.
- **Agentic First-Light Arcs** should be measured now but not prematurely optimized; **Agentic Slices** are expected to complete, and **Proof-of-Work Labels** preserve the arc and human-touchpoint trail in commits.
- An **Agenda Card** must be unambiguous before an **Agentic Slice** starts; after it is green, the **AFK Execution Assumption** applies.
- **Roadmap Touchstones** beyond the first proof chain provide context for why the first chain exists without becoming granular commitments.
- The **Documentation Cleanup Gate** protects **Context Hygiene** by keeping only operationally necessary docs near the first few repository layers, rewriting misleading but necessary docs, and moving stale material into **Lazy-Loaded Documentation**, the **Archive Layer**, or deletion.
- Implementation of the **Integrated POC** waits for the **Documentation Cleanup Gate**; ADR outlines may proceed, but final doctrine should not be treated as settled until cleanup is complete.
- The **Documentation Cleanup Gate** covers the whole repository, but it should audit and report in context-risk order so always-loaded and linked docs are resolved first.
- The **Documentation Cleanup Gate** runs as one **Agenda Card** with two internal phases: classify repository docs, then apply unambiguous cleanup actions while escalating operationally significant ambiguity.
- The **Archive Layer** is not the default fate for stale docs; ordinary stale docs should be deleted and recovered from git history if needed.
- The **Cleanup Classification Matrix** records cleanup proof under a non-operational path and should not be treated as active doctrine by future agents.
- A **High-Risk Cleanup Doc** requires human judgement before delete, move, or rewrite; lower-risk docs can be acted on by the cleanup agent when the classification is clear.
- The **Documentation Cleanup Gate** closes only when the **Cleanup Proof Bar** is met.
- The **Integrated POC Implementation Agenda Card** is the artifact that starts implementation after cleanup; the chat thread and reference memo are not enough.
- **Lazy-Loaded Documentation** supports **Agentic First-Light Arcs** by reducing always-loaded context before agents execute slices.
- The **Golden Path Slice** proves one complete customer-to-admin path before second-slice features such as richer existing-customer lookup or account actions.
- Early **Integrated POC** slices are **Read-Only First**: read/context/review operations come before write/action operations.
- The **Golden Path Slice** is also a **Migration-First Slice**: it should replicate the current **Customer-Visible Contract** in the new infrastructure before adding undeveloped features.
- Mock Aryza/SoloSight/support-ticket surfaces support the **Quality POC** and should stay thin, simple, and functional.
- The **Behavior Proof Bar** for **Integrated POC** work is valid behavior through the real app path; tests are support fabric, not a substitute proof surface.
- The **Widget-Adapter Architecture** remains usable transitional code until the **Integrated POC** replaces it, then it is due for sunset.

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
- "integrated POC" can look like either a side demo or a website rewrite; resolved: the **Integrated POC** is the next **Deployable Surface** once complete, while the **Widget-Adapter Architecture** stays only as transitional code due for sunset.
- "first integrated POC" can invite too much scope; resolved: the **Golden Path Slice** proves the end-to-end infrastructure with one customer-to-admin journey, while undeveloped richer flows wait for the second slice.
- "golden path" can sound like an invented demo target; resolved: the first slice is migration-first and should reproduce current proven behaviour in the new infrastructure unless there is a concrete reason to diverge.
- "what we already have" can mean either behaviour or old plumbing; resolved: replicate the **Customer-Visible Contract**, not iframe transport, package boundaries, or review-host implementation details.
- "new deployable" can invite mutation of `site/` or existing demo hosts; resolved: build the **Integrated POC App** as a separate app/package, leaving current transitional surfaces intact until sunset.
- "roadmap" can imply optimizing for iteration speed through an external tracker; resolved: start with an **In-Repo Roadmap** because QA/review externalities matter more than unproven speed gains right now.
- "page-aware" can imply the assistant may act on application state; resolved: early slices are **Read-Only First**, so page/journey awareness supports context, navigation, handoff, and readback before any mutation or decisioning.
- "deployable" can imply production-grade or long-lived implementation; resolved: for the **Integrated POC**, deployability means demoability/reviewability for a **Quality POC**, not a claim that the artifact should be employed unchanged in the long run.
- "Harry-style layering" can imply retrofitting repository/service/controller structure everywhere; resolved: use **Boundary Layering** at API-like seams, and use it elsewhere only for easy, demonstrable wins.
- "good tests" can imply more tests or deeper tests by default; resolved: tests are good only when they prove valid behaviour or help agents preserve it, and tests detached from the **Behavior Proof Bar** should be de-escalated or abandoned.
- "agentic arc" can imply optimizing autonomy metrics before they matter; resolved: **Agentic First-Light Arcs** should be measured and labeled now, then optimized only after the touchpoint data proves where intervention is useful.
- "slice" can imply a generic chunk of work; resolved: an **Agentic Slice** is scoped so completion is likely for current frontier models, and incomplete slices indicate a scoping, complexity, good-look definition, or verification-fabric problem.
- "checkpoint" can turn into a keep-going relay; resolved: an **Agenda Card** defines checkpoints and failure triggers before work starts, then the **AFK Execution Assumption** prevents ad hoc next-slice approvals from becoming the workflow.
- "future roadmap" can invite LLM overfitting; resolved: later work should be written as **Roadmap Touchstones** until each touchstone is ready to become a proof-bearing slice.
- "more context" can sound like safer agent guidance; resolved: **Context Hygiene** treats every always-loaded token as a behaviour-shaping cost, so active docs should stay small, focused, and task-oriented.
- "archive" can look like a top-level repo folder; resolved: stale or historical material belongs in an **Archive Layer** that is clearly non-operational and not near the working context.
- "archive" can become delete avoidance; resolved: default stale-doc handling is DELETE, and ARCHIVE is reserved for real historical or evidential value.
- "cleanup matrix" can become another source of active context; resolved: the **Cleanup Classification Matrix** is a non-operational proof artifact, not guidance.
- "high-risk cleanup" can become a blanket stop condition; resolved: only **High-Risk Cleanup Docs** require human judgement before cleanup actions.
- "cleanup done" can mean matrix-only or cosmetic tidying; resolved: the **Cleanup Proof Bar** requires both proof artifacts and applied cleanup changes.
- "ready to implement" can be inferred from chat agreement; resolved: implementation starts only from the **Integrated POC Implementation Agenda Card** after cleanup closes.
- "before or as part of the move" can leave cleanup too late; resolved: the **Documentation Cleanup Gate** is pre-implementation work, though ADR outlines may be drafted before it closes.
- "rewrite" can become a mercy bucket for stale docs; resolved: REWRITE is only for necessary-but-misleading docs, and it must not make DELETE harder when context clarity needs removal.
- "agent-visible cleanup" can leave stale docs elsewhere in the repo; resolved: the cleanup scope is whole-repository, ordered by context risk rather than limited to first-layer files.
- "clarify every deep doc edge case" can become its own context burden; resolved: clarify only where ambiguity changes operational behaviour, risk, reversibility, proof, or active context structure.
