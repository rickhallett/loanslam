# Integrated POC Reference - 2026-06-30

## Practical Takeaway

The current priority is to stop treating the chatbot engine as the whole product
and start wrapping it in a believable integrated proof of concept. The engine is
good enough for POC purposes; the next value comes from showing Loans for Now a
joined-up system: customer journey, bot, mock CRM/decision integration, human
handoff, admin ticket view, and proof-friendly agent workflow.

Status: confirmed understanding from the 2026-06-30 audio memo. This is a
reference note, not a locked implementation plan.

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

## Architecture Direction

The likely direction is a full-stack Nuxt/Vue application with Prisma/Postgres,
moving away from a detached WordPress iframe/widget posture for this integrated
POC.

Reasoning:

- A native app can share page state, customer journey state, and bot state.
- The assistant can become page-aware and journey-aware without a bespoke iframe
  transport protocol growing in every direction.
- Cookies, returning-user recognition, navigation, and admin views are simpler
  in one managed application.
- Vue/Nuxt aligns better with Harry's stated preferences and with the SoloSight
  style of convention-based implementation.

This does not erase the prior widget-host-adapter work. It reframes it: iframe
delivery remains useful for the current WordPress-style surface, but the
integrated POC likely wants native mounting and shared state.

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

## Verification Doctrine

Unit and mocked tests are scaffolding. They can prove wiring, invariants, and
small operations, but they are not behavioral proof for the integrated product.

Behavioral proof should come from full-flow evidence:

- Real local app flows.
- Browser-level checks.
- End-to-end interactions through the customer journey.
- Bot turns that hit the actual integration path.
- Admin readback of handoff/ticket state.

For browser work, local Chrome DevTools MCP/CDP-style verification is the
preferred direction because it gives agents visibility into the page, network,
JavaScript, and state without pretending a mocked test is the real experience.

## Operating Model

The next phase should be checkpointed and roadmap-driven.

Needed operating artifacts:

- A concise agent-facing doctrine file.
- A decision log.
- A machine-readable roadmap or issue map, probably YAML unless Linear clearly
  buys enough human QA leverage to justify the integration.
- Epics broken into dependency-aware slices.
- Explicit parallel versus sequential work boundaries.
- Worktree and branch discipline visible through PRs/promotions.
- Verification requirements attached to each slice.

Agents should update the roadmap/decision files as committed project state, not
leave decisions only in chat.

## Documentation Reset

Existing agent instructions and docs should be audited in light of this memo.
The bias should be toward deletion/replacement rather than incremental pruning
when old context creates distraction.

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

- Nuxt/Vue full-stack app versus preserving Astro plus native Vue islands.
- In-repo YAML issue map versus Linear or another issue UI.
- Exact epic boundaries and dependency chain.
- Which flows are mandatory for the first integrated POC.
- How much page-aware application assistance is safe to demonstrate.
- How thin the mock Aryza/SoloSight/support-ticket schemas should be.
- Where Harry-style repository/service/controller layering is mandatory,
  useful, or unnecessary.
- What the first proof bar is for "this is demoable."

## Recommended Next Step

Run a clarification/grill pass against this reference note, recording answers
into a decision log. Stop when questions stop materially changing scope,
architecture, proof bars, or roadmap order.
