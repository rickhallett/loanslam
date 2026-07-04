# Convergence Campaign 001 Card - 2026-07-04

Status: PROPOSED - not authorized. This card is a dossier: it is complete
enough to authorize and execute, but no D-entry has been accepted and no arc
may start past convergence-arc-000 until one is. Under
`docs/campaign-workflow-protocol.md`.

Single human checkpoint: client-facing UAT/demo of the unified surface plus
campaign closeout report. Endpoint: a human decision point (the client
accepts the unified surface as the product direction).

Intended sequencing: authorized post-signing as the first paid campaign,
with the client present at the D-entry gate. Arc 000 is behavior-preserving
cleanup consistent with the D042 recorded invariant ("the widget stays a
dumb terminal; the server owns routing and safety") and may be authorized
independently at any time.

## Proposed D-entry (draft for docs/core-product-decision-log.yaml)

```yaml
- id: D0XX
  date: <acceptance date>
  topic: Concierge convergence - one conversational brain, engine as toolset
  question: Does the concierge graduate from demo-only deviation (D045) to
    the product's single conversational surface, with the validated engine's
    transactional flows exposed behind a validated boundary?
  accepted_answer: <complete at acceptance. Default offered - end the D045
    demo-only stance. The concierge becomes the only conversational brain on
    every route including /contact/. The validated engine stops serving free
    conversation and becomes the transactional toolset (FAQ retrieval,
    handoff intake, ticketing, safety signals) invoked behind it. The kill
    switch inverts in meaning - killing the concierge degrades to engine-only
    chat sitewide (today's /contact/ behavior), so the engine conversational
    path is retained as fallback, not deleted. Authorized as campaign
    convergence-001 under the campaign protocol.>
```

## Outcome

One assistant, one session, one transcript, one voice. Every transactional
or safety-relevant capability is still executed by deterministic, validated
machinery; the customer-visible seam shipped on `feature/contact-seam-01`
(badges, header temperature, dividers) is retired because the seam itself is
gone. The campaign closes with a probe/battery comparison against the
split-surface baseline and a client-facing demo/UAT of the unified surface.

## Arc Chain

Campaign label: `convergence-001`. Roadmap: create
`docs/roadmaps/<auth-date>-convergence-001-roadmap.yaml` at authorization
(cross-epic: site-nuxt, core, contracts; list the epic roadmaps touched).
Branch: `feature/convergence-01` off dev, worktree per worktree discipline.

| Chain id | Slice label | Arc | Summary |
| --- | --- | --- | --- |
| cv-001 | chat-session-unify-01 | convergence-arc-000 | Unified `/api/chat` session surface: one chatRef mapping to the ipoc/concierge session refs server-side; server derives the serving brain per turn from pageContext.route + forceEngine flag + kill switch (the exact rule the widget applies today in ChatWidgetPanel submit()) |
| cv-002 | chat-response-contract-01 | convergence-arc-000 | Discriminated turn response `{brain, message, ui?, telemetry?}` plus SSE frames for streamed turns; widget renders by `brain` and deletes its routing conditional |
| cv-003 | resume-server-side-01 | convergence-arc-000 | Server-held transcript becomes the dr-001 resurrection source; delete client transcript replay; client-fabricated lines (availability notes, topic primers, seam dividers) can never enter either brain's history |
| cv-004 | seam-from-server-01 | convergence-arc-000 | Badges and seam dividers driven by `response.brain` (server truth); delete client `lastSeamBrain` persistence special-casing |
| cv-005 | safety-prepass-01 | convergence-arc-001 | Engine signal detection runs on every customer turn before the concierge sees it; flagged turns are served by the engine, never by prompt-only handling |
| cv-006 | retrieval-context-01 | convergence-arc-001 | Engine retrieval (top-k matches with itemIds) injected into the concierge turn as grounding context; audit line records the matches |
| cv-007 | handoff-offer-structured-01 | convergence-arc-001 | Concierge emits a structured handoff_offer (replaces the client `/support team/i` regex); acceptance transfers the turn loop to the engine's existing intake sub-flow unchanged; completion/cancel returns control (see Appendix A) |
| cv-008 | contact-concierge-01 | convergence-arc-001 | /contact/ served by the concierge; route-finder topics seed concierge prompts; contact battery rewritten for the unified surface |
| cv-009 | contracts-merge-01 | convergence-arc-002 | UiPlan + streaming coexistence formalized in @loanslam/contracts; ipoc/concierge client types collapse into the chat contract |
| cv-010 | widget-thin-01 | convergence-arc-002 | Delete dual-session client machinery, route-keyed labels/welcomes, mode-derived copy; single-voice copy pass |
| cv-011 | audit-toolcalls-01 | convergence-arc-003 | D049 audit line gains sub-flow/tool fields (what was invoked, what was dropped, why) |
| cv-012 | probe-rebaseline-01 | convergence-arc-003 | Full probe battery re-run on the unified surface, judged per the D047 OpenAI ladder, scored against the split-surface baseline |
| cv-013 | hellweek-toolturns-01 | convergence-arc-003 | Hell Week additions for sub-flow-invocation turns, including a handoff-misfire scenario set with an explicit misfire threshold |
| cv-014 | devtools-port-01 | convergence-arc-003 | D043 devtools telemetry obligation ported to the unified surface or formally vetoed; campaign closeout report |

Commit label shape: `Epic: convergence / Slice: <label> / Arc: <arc> /
Campaign: convergence-001 / Human checkpoint: campaign-closeout`.

## Contract Defaults (vetoable at authorization)

- Handoff intake is a triggered deterministic sub-flow owned by the engine,
  not per-field model tool calls (Appendix A carries the reasoning and the
  revisit trigger).
- Safety binding point: engine signals run pre-concierge on every customer
  turn; a flagged turn is engine-served. Prompt-only guardrails are never
  the sole handling for flagged content on the unified surface.
- Kill switch semantics invert as described in the D-entry draft; the
  engine conversational path is retained as the degraded mode.
- Session durability stance unchanged (in-memory server sessions plus
  client sessionStorage restore, per D043); a real store stays out of scope.
- Model ladder unchanged: concierge on `gpt-5.5`, engine on nano, judges per
  the D047 ladder. No Anthropic inference (provider mandate).
- The navigation offer remains a deterministic UI affordance; the model
  never navigates.

## Non-Goals / Preserved Human Gates

- No auth, PII persistence, CRM, webhooks, or write-capable account flows;
  no secrets/DNS moves; no Astro retirement execution. All existing roadmap
  human gates stand; campaign authorization implies passage through none.
- No durable conversation store.
- No adversarial hardening iteration inside this campaign. cv-012 is
  measurement; if scores regress, that is a stop condition and a new
  decision, not a tuning loop.
- demo-widget and review-widget remain separate surfaces (recorded stance).
- No model-tier changes to chase routing precision (recorded A/B evidence:
  tier swaps did not fix misrouting).

## Proof Bar

- convergence-arc-000: contact-assistant proof 23/23, seam-walk proof 7/7,
  and the dc2/dr batteries green and UNCHANGED - this arc makes no behavior
  claims, so existing evidence is the entire bar.
- convergence-arc-001: probe battery on the unified surface scores at or
  above the split baseline in every category; live-flow proof of
  safety-prepass routing (flagged turn lands on the engine); handoff
  sub-flow proven end-to-end (offer, intake form, ticket, readback) on a
  live build; rewritten contact battery green.
- convergence-arc-002: typecheck, unit, and all batteries green after the
  contract collapse; no orphaned client machinery (fallow audit clean).
- convergence-arc-003: full battery green against a production-mode build;
  audit lines validated judge-compatible; closeout report with baseline
  deltas committed and delivered at the human checkpoint.

## Stop Conditions

Union of the touched epics' roadmap stop conditions, plus (campaign halts):

- The D-entry is not accepted: nothing past convergence-arc-000 starts.
- Any probe category regresses against the split-surface baseline.
- Handoff-misfire rate in cv-013 exceeds the threshold set in the roadmap
  (tickets created on non-handoff intents).
- The engine-fallback degraded mode cannot be preserved through the kill
  switch.
- Work creates pressure to weaken the validator or bypass the safety
  prepass.
- Card, roadmap, diff, and receipts disagree.

## Appendix A - Decision memo: handoff intake shape

Question: when the unified concierge must collect handoff details, is intake
(a) a deterministic sub-flow owned by the engine - the concierge emits a
structured handoff_offer, the engine's existing intake_form UiPlan flow runs
unchanged, control returns on completion or cancel - or (b) real model tool
calls (collect_field / create_ticket) invoked by the concierge with
validator checks per call?

Recommendation: (a), as the contract default above.

- (a) reuses intake validation, ticket creation, and server readback that
  are already battle-tested (dc-006, Hell Week, the contact battery). Zero
  new validated surface is created.
- (a) keeps PII collection entirely off the frontier-model path: the model
  never sees or shapes intake fields. That is the cleanest compliance story
  and the smallest probe surface - option (b) would add tool-argument
  injection as a new probe category and a larger Hell Week matrix.
- (b) buys conversational flexibility mid-intake ("actually, use my other
  email") for five fixed fields. The price is a per-call validation layer
  and a new misfire class where the model invokes ticket creation on
  non-handoff intents.
- The known routing weakness in this codebase is intent precision. (b)
  moves that weakness onto the transactional path; (a) keeps it on the
  conversational path where a miss costs a clarifying turn, not a ticket.

Revisit trigger: if UAT shows measurable intake abandonment at the form
step, authorize a scoped follow-up campaign for (b) with its own probe
categories. Do not fold it into this campaign.
