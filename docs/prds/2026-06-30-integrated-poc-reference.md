# Integrated POC Reference - 2026-06-30

## Practical Takeaway

The current priority is to stop treating the chatbot engine as the whole product
and start wrapping it in a believable integrated proof of concept. The engine is
good enough for POC purposes; the next value comes from showing Loans for Now a
joined-up system: customer journey, bot, mock CRM/decision integration, human
handoff, admin ticket view, and proof-friendly agent workflow.

Status: confirmed understanding from the 2026-06-30 audio memo, with the
deployable-direction decision accepted in `docs/core-product-decision-log.yaml`
as D012. This is a reference note, not a complete implementation plan.

Source: local audio memo `loanslam-integrated-poc.m4a`, transcribed and
summarized on 2026-06-30. The source audio and raw transcript are not committed
here.

## Core Constraint

Do not keep optimizing Hell Week/classifier behavior toward an imagined final
bar. Without a renewed contract and stakeholder decisions, polishing copy,
compliance posture, and edge-case behavior risks creating complexity that will
be invalidated by later feedback.

For now, proof-of-concept value is more important than keeping every measured
quality bar green. The system should demonstrate credible product potential
without pretending the final business, compliance, or integration rules are
already known.

## Product Direction

The demo should show the bot as part of the business system, not just an FAQ
widget.

Key flows to demonstrate:

- Deflect routine contact-page questions with useful answers.
- Route new applicants toward the application journey when that is the right
  outcome.
- Assist users while they are inside the application flow.
- Recognize existing customers through a mock authentication/customer lookup.
- Answer simple account questions, such as next payment date, from mock records.
- Optionally demonstrate a simple account action, such as changing a payment
  date, if it can stay lightweight.
- Hand off to a human when the bot cannot or should not continue.
- Show the resulting handoff in an admin/human-agent view.

The point is not to recreate Loans for Now's real operations. The point is to
make the integration shape visible enough that non-technical stakeholders can
see the business value.

First-slice scope is intentionally narrow: prove one golden path through the
end-to-end infrastructure before broadening the product. The first slice should
show a customer entering through the integrated surface, the bot using enough
journey context to help or hand off, server-side state being created, and an
admin/human-agent view reading back the resulting ticket/customer context.

This is a migration-first slice, not an invitation to over-optimize around an
invented demo goal. The default implementation posture is to replicate current
proven behaviour in the new infrastructure, then add the richer integrated
features on top. Replicate the customer-visible contract, not the old
architecture: preserve the current site/application journey shape, current
assistant behaviour for FAQ/help/handoff/safe refusal, and current server-side
demo/session evidence. Do not preserve iframe transport, package splits, or
review-host quirks unless they are needed as temporary compatibility. Diverge
only where the new infrastructure requires it or where there is a concrete
product, verification, or stakeholder reason.

Richer undeveloped flows are second-slice work once the end-to-end
infrastructure is proven. That includes mock existing-customer lookup, simple
account answers, and lightweight account actions unless one of those becomes
essential to the first stakeholder demo.

## Mock Integration Shape

The POC should mock the external systems rather than solve them.

Assumed systems:

- Aryza/Ariza: CRM/customer-record system.
- SoloSight: loan decision engine.
- Customer support/ticket system: human-agent queue for handoffs.

The mock server should stay thin. It likely needs customers, loans, tickets, and
handoff payloads, but it should not grow into a detailed fake enterprise data
model. Its main job is to receive a bot handoff, create a ticket, and let an
admin-only route list and inspect those tickets.

Real integration details are commission-phase work. The POC should leave a
clean adapter-shaped skeleton where the real systems could later plug in.

The mock systems should emphasize that this is a quality proof of concept, not a
production artifact or long-term enterprise implementation. "Deployable" in this
phase means demoable and reviewable: stakeholders can run it, inspect the flow,
and understand the integration shape. It does not mean the mock schemas, mock
systems, or app structure are production-ready or should be employed unchanged
in the long run.

## Architecture Direction

The likely direction is a separate full-stack Nuxt/Vue application with
Prisma/Postgres, moving away from a detached WordPress iframe/widget posture for
this integrated POC.

Reasoning:

- A native app can share page state, customer journey state, and bot state.
- The assistant can become page-aware and journey-aware without a bespoke iframe
  transport protocol growing in every direction.
- Cookies, returning-user recognition, navigation, and admin views are simpler
  in one managed application.
- Vue/Nuxt aligns better with Harry's stated preferences and with the SoloSight
  style of convention-based implementation.

This does not erase the prior widget-host-adapter work. It reframes it: iframe
delivery remains useful for the current WordPress-style surface until the
integrated POC is ready, but the widget-adapter architecture is now transitional
code due for sunset rather than the long-term deployable target.

The integrated POC should live as its own app/package. It can consume current
engine/contracts and reuse current site/application assets where useful, but it
should not be built by mutating `site/`, the demo host, the review host, or the
widget-adapter stack into the new product surface. Those surfaces stay alive as
transitional code until the integrated POC can replace them.

## Audience Fit

The POC needs to satisfy two different audiences.

Non-technical stakeholders need to see:

- A more alive customer assistant.
- Support deflection.
- Better routing into application and service flows.
- Reduced operational load without adding headcount.
- A credible path toward a unified customer-service surface.

Technical review needs to see:

- Predictable structure.
- Vue/Nuxt-friendly implementation.
- Repository/service/controller-style layering where it fits.
- Thin API/controller boundaries.
- Reasonable testability without fake rigor.
- Git/worktree/branch discipline visible in the project history.

The code should meet Harry halfway where the pattern is useful, but not force
every experimental POC surface into ceremony that does not prove behavior.

Repository/service/controller-style layering is mandatory at API-like
boundaries: API handlers/controllers, persistence access, mock external-system
adapters, auth/session seams if introduced, and engine integration points. Use
the same pattern elsewhere only when it is an easy win or its value has been
demonstrated. Do not retrofit it through thin UI/demo composition just to satisfy
a style preference.

## Verification Doctrine

Unit and mocked tests are scaffolding. They can prove wiring, invariants, and
small operations, but they are not behavioral proof for the integrated product.
They are useful where they provide verification fabric for agents or prove valid
behavior. They are not useful as testing cosplay, as a proxy for seriousness, or
as a representational substitute for good engineering. Tests that go deep while
drifting away from the behavior proof priority should be de-escalated or
abandoned.

Behavioral proof should come from full-flow evidence:

- Real local app flows.
- Browser-level checks.
- End-to-end interactions through the customer journey.
- Bot turns that hit the actual integration path.
- Admin readback of handoff/ticket state.

For browser work, local Chrome DevTools MCP/CDP-style verification is the
preferred direction because it gives agents visibility into the page, network,
JavaScript, and state without pretending a mocked test is the real experience.

The first demoability proof bar is a captured local browser flow through the
real app path plus server/admin readback. A reviewer should be able to run the
new app, complete the migration-first customer-visible path, see assistant
behavior through the real route, create or read back demo handoff/ticket state,
and inspect the admin view.

The first few slices should be read-only first. Page and journey awareness may
include route, page type, current application step, declared journey state, and
server-side context. The assistant may answer, explain, navigate, hand off, and
support admin readback. It must not mutate application data, update accounts,
infer eligibility, make loan decisions, or perform account/application actions
until the read-only infrastructure path is proven and a later slice explicitly
accepts that extra product and compliance risk.

## Operating Model

The next phase should be checkpointed and roadmap-driven.

Needed operating artifacts:

- A concise agent-facing doctrine file.
- A decision log.
- A committed machine-readable roadmap or issue map as the source of truth for
  agent execution, probably YAML.
- Epics broken into dependency-aware slices.
- Lightweight proof-of-work labels tying commits to epic, item or issue,
  agentic slice, and agentic arc.
- Explicit parallel versus sequential work boundaries.
- Worktree and branch discipline visible through PRs/promotions.
- Verification requirements attached to each slice.

Agents should update the roadmap/decision files as committed project state, not
leave decisions only in chat.

Do not optimize the operating model around iteration speed before there is
evidence that iteration speed is the important variable. Add Linear or another
external tracker only if it proves enough human QA, review, or stakeholder
coordination value to justify another surface.

The first roadmap chain is proof-ordered: new integrated app scaffold plus
roadmap/doctrine, customer-visible contract port, current assistant through the
real app route, thin read-only mock state plus handoff/ticket readback, admin
view, then captured browser proof flow. Existing-customer lookup, account
answers, and account actions wait behind that first infrastructure proof.

Post-first-chain roadmap touchstones should remain coarse until each is ready to
become a proof-bearing slice:

- Read-only existing-customer/context work.
- Read-only account-answer work.
- Agent/admin workflow improvements for handoff review and human readback.
- Widget-adapter sunset once the integrated POC is demoable enough.
- Carefully scoped action capability only if stakeholder value later proves it
  is worth the risk.

These touchstones should explain the why and where of the current chain without
becoming fake-granular implementation commitments.

Throughout the migration, emphasise an agentic first-light development arc.
The aim is increasingly long human-out-of-the-loop engineering spans, with human
touchpoints reserved for verification that needs judgement or opinion. Measure
touchpoints now, but do not optimize for them yet. Commit history and the
in-repo roadmap should carry lightweight proof-of-work labels that show whether
each commit happened inside an agentic arc, plus the epic, item or issue,
agentic slice, arc number, and where human verification happened. Slices should
be scoped so completion is highly likely for current frontier models when the
definition of good behavior and verification fabric are concrete enough. If an
agentic slice is not completed, treat that as a signal about scoping, complexity,
good-look definition, or verification fabric before treating it as model failure.

Every agentic slice must have an agenda card before development starts. The card
must define `good_look`, `proof_bar`, `human_gate`, `allowed_autonomy`, and
`stop_condition`. If any field is ambiguous, the agent should push back before
starting. Once the card is confirmed green and work begins, assume the human is
AFK until a predefined checkpoint or failure trigger. This is meant to avoid the
"okay, next slice" relay and to keep LLM context pressure from deciding when
work stops.

This should reuse the existing Loanslam operator four-touchpoint model:
plan-lock, never-suppressed ping, batched digest, and end-of-arc PR. The
integrated POC roadmap should make those touchpoints concrete for each active
arc rather than creating a parallel communication workflow.

## Documentation Reset

Existing agent instructions and docs should be audited in light of this memo.
The bias should be toward deletion/replacement rather than incremental pruning
when old context creates distraction.

The ADR and migration agenda should not land on top of stale top-level context.
Before or as part of the integrated POC move, run a documentation cleanup gate:
keep only operationally necessary docs near the first few repository layers,
make deeper reference material explicitly lazy-loaded, and move historical or
stale material into a clearly non-operational archive layer, outside the repo, or
another tracking system. More skills, more instructions, and more always-loaded
docs are not automatically safer. Every always-loaded token shapes stochastic
agent behaviour, so repeatability depends on small, focused, task-oriented
context.

Sequencing: make the documentation cleanup gate the first agenda-card slice
before implementation begins. ADR thinking and outline drafting may proceed
before the gate closes, but the ADR and migration doctrine should not be treated
as final until repository docs have been classified into keep, lazy-load, rewrite,
archive, or delete.

Scope: audit the whole repository, not only the files most likely to enter agent
context first. Order the work and report by context risk: always-loaded files,
root docs, directly linked docs, active PRDs and decision logs, operator docs,
then deeper historical material. This keeps the cleanup complete without letting
lower-risk archaeology distract from the context surfaces that most affect agent
behaviour.

Agenda shape: run cleanup as one agenda-card slice with two internal phases.
Phase 1 produces the whole-repo classification matrix. Phase 2 applies the
unambiguous moves, deletions, rewrites, and lazy-load changes in the same slice.
Stop for human judgement only on ambiguous or high-risk docs, especially where
the ambiguity is operationally significant.

Cleanup states:

- KEEP: still operationally necessary near the active context.
- LAZY-LOAD: useful only when a specific task calls for it.
- REWRITE: necessary subject matter, but current wording, placement, or framing
  would damage context clarity if kept as-is.
- ARCHIVE: historical or evidential material that should stay browsable but must
  not guide active agent behaviour.
- DELETE: stale, misleading, duplicated, or context-noisy material.

REWRITE is not a mercy bucket. A larger taxonomy must not make docs harder to
delete when deletion best preserves context clarity.

ARCHIVE is also not the default fate for stale docs. Default to DELETE and rely
on git history for ordinary recovery. Use ARCHIVE only when the material has
real historical or evidential value, and place it somewhere deliberately
non-operational and deep, such as
`docs/non-operational/archive/<cleanup-date>-doc-cleanup/`, with a blunt README
that tells agents not to treat it as active guidance. Do not create the archive
directory until the cleanup slice has files worth archiving.

Store the cleanup classification matrix as a non-operational proof artifact at
`docs/non-operational/doc-cleanup/<cleanup-date>-classification.yaml`, with only
a short summary in the agenda-card closeout. The matrix should make the cleanup
auditable without becoming live doctrine or a new agent instruction source.

Clarification also has a point of diminishing returns. The cleanup slice should
make operationally significant ambiguity explicit, but it should not keep asking
questions about deep historical material unless the answer changes operational
behaviour, scope, risk, reversibility, proof, or active context structure.

Stop for human judgement before deleting, moving, or rewriting docs whose cleanup
could change agent behaviour, deployment or promotion rules, secret handling,
verification evidence, stakeholder commitments, product or compliance doctrine,
or active roadmap decisions. Do not stop for ordinary stale notes or low-risk
clutter when the cleanup state is clear.

The cleanup slice is done only when the proof bar is met:

- Committed classification matrix.
- Applied cleanup diff.
- No top-level archive.
- No stale docs linked from active context.
- Updated `README`, `AGENTS`, and `CONTEXT` pointers where needed.
- Agenda-card closeout with counts for deleted, rewritten, archived, kept, and
  lazy-loaded docs.
- Any deferred high-risk docs listed explicitly for human judgement.

A matrix alone is not enough, and a tidy diff without the matrix and closeout is
not enough.

After cleanup closes, integrated POC implementation starts from a new Integrated
POC Implementation Agenda Card. That card must reference the cleanup matrix, the
final ADR or doctrine, the in-repo roadmap first chain, and the first Golden Path
Slice. Implementation does not start from this chat thread or this reference memo
alone.

The new agent-facing context should preserve:

- Why this POC exists.
- What has already been proven.
- What is deliberately mocked.
- What must not be over-optimized yet.
- What counts as behavioral proof.
- Where human judgment is needed.
- How to keep responses concise and decision-focused.

## Open Clarifications

These should be resolved before implementation fans out:

- Resolved in D012: the integrated POC becomes the new deployable surface when
  complete; the existing widget-adapter architecture remains transitional code
  due for sunset.
- Resolved in D013: first integrated POC scope is one golden customer-to-admin
  path; richer undeveloped flows move to a second slice after infrastructure
  proof.
- Resolved in D014: the first golden path is migration-first; replicate current
  proven behaviour in the new infrastructure before optimizing around new
  product features.
- Resolved in D015: the migration baseline is the customer-visible contract, not
  the old widget-adapter architecture or package topology.
- Resolved in D016: the integrated POC lives as a separate app/package and
  consumes current assets/contracts rather than mutating existing transitional
  surfaces.
- Resolved in D017: the in-repo machine-readable roadmap is the source of truth;
  Linear or another tracker can be added later only if it proves QA/review value.
- Resolved in D018: early integrated POC slices are read-only first; page and
  journey awareness supports context, navigation, handoff, and readback before
  mutation or decisioning.
- Resolved in D019: mock systems stay thin, simple, and functional; deployability
  means demoability/reviewability for a quality POC, not production permanence.
- Resolved in D020: repository/service/controller-style layering is mandatory at
  API-like boundaries and optional elsewhere only when value is demonstrated.
- Resolved in D021: demoability is proven by local browser flow plus
  server/admin readback; tests are support fabric only when they prove valid
  behavior.
- Resolved in D022: the first roadmap chain is app scaffold and doctrine,
  customer-visible contract port, real assistant route, thin read-only mock
  state and handoff readback, admin view, then browser proof.
- Resolved in D023: agentic first-light arcs should be measured and labeled in
  roadmap and commits, but not optimized before touchpoint data proves value.
- Resolved in D024: post-first-chain roadmap touchstones stay coarse until they
  are ready to become proof-bearing slices.
- Resolved in D025: slice means agentic execution unit, and incomplete arcs are
  evidence about scope or proof clarity before they are evidence about model
  failure.
- Resolved in D026: every agentic slice needs an agenda card before work starts;
  once green, assume the human is AFK until a checkpoint or failure trigger.
- Resolved in D027: the integrated POC move needs a documentation cleanup gate;
  active context should stay small, focused, task-oriented, and lazy-loaded, with
  stale or historical material moved out of the top-level working context.
- Resolved in D028: documentation cleanup is pre-implementation work; it is the
  first agenda-card slice before implementation, while ADR outlines may proceed
  before the cleanup gate closes.
- Resolved in D029: REWRITE is the fifth cleanup state, but it must not reduce
  deletion pressure where removal best protects context clarity.
- Resolved in D030: documentation cleanup audits the whole repository, ordered by
  context risk rather than limited to the first agent-visible layer.
- Resolved in D031: cleanup runs as one two-phase agenda-card slice; clarify only
  operationally significant ambiguity and apply unambiguous changes in the same
  slice.
- Resolved in D032: stale docs default to DELETE; ARCHIVE is only for historical
  or evidential value and belongs in a deep non-operational archive path.
- Resolved in D033: the cleanup classification matrix is a non-operational proof
  artifact under `docs/non-operational/doc-cleanup/`, not active doctrine.
- Resolved in D034: only high-risk cleanup docs require human judgement before
  delete, move, or rewrite; low-risk stale docs can be acted on when clear.
- Resolved in D035: cleanup is complete only when the classification matrix,
  applied diff, active-context pointer updates, closeout counts, and deferred
  high-risk list are all present.
- Resolved in D036: integrated POC implementation starts only from a post-cleanup
  Integrated POC Implementation Agenda Card that references the cleanup matrix,
  final doctrine, roadmap first chain, and first Golden Path Slice.

## Recommended Next Step

Run a clarification/grill pass against this reference note, recording answers
into a decision log. Stop when questions stop materially changing scope,
architecture, proof bars, or roadmap order.
