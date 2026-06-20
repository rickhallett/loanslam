# PRD: Intake Form as Conversational-Collection Fallback

## Problem Statement

The engine collects standard handoff details (full name, date of birth, address,
phone, email, situation summary) and is being tuned to do this conversationally:
it extracts `collectedFacts` from free-text replies and only re-asks for what is
still missing. Its intake copy is already a conversational ask —
`buildHandoffIntakeMessage` returns "To pass this to the team, I need {fields}.
Let's start with {first field}." (`packages/core/src/engine.ts:311`).

Despite that, the engine surfaces a structured `intake_form` UI primitive as the
*primary* collection surface. `buildMissingHandoffFragment`
(`packages/core/src/engine.ts:264`) emits `intake_form` whenever a handoff is in
progress (`request_handoff_intake` / `create_ticket` / `escalate`) and any
standard field is still missing. There is no notion of "try conversation first,
fall back to a form." The contract cannot even express the difference: the
primitive is only `{ primitive, message, fields }`
(`packages/contracts/src/schemas.ts:93`).

A structured form is a good *fallback* — it is precise, accessible, and resolves
a stalled conversation in one step. It is a poor *default*: it short-circuits the
NLP collection the engine is being tuned for, and it pushes a form at customers
who would have just answered in chat.

The customer-facing review widget currently hard-suppresses the form
(`packages/review-widget/src/components/MessagePrimitive.vue`,
`SHOW_INTAKE_FORM = false`) as a stopgap. That is a blunt instrument applied at
the wrong layer: the widget is guessing at collection strategy that the engine
owns. The decision of *when* a form is the right surface belongs in the engine.

## Solution

Make the engine present `intake_form` only as a fallback, after conversational
collection has stalled. In the normal path the engine asks for the next missing
field(s) as a plain conversational turn and extracts the answer from free text.
Only when the conversation is not making progress does it emit `intake_form`.

The mere presence of `intake_form` then *means* "fallback" — so no consumer needs
new logic to interpret it. The widget renders the form whenever it appears
(because it now only appears as a fallback) and the hard suppression flag is
removed.

```text
Handoff needs fields
        │
        ▼
Ask conversationally  ──► customer answers in chat ──► extract collectedFacts
        │                                                      │
        │  (no progress: same required fields still missing    │ fields complete
        │   after the stall threshold)                         ▼
        ▼                                              complete handoff
Emit intake_form (fallback) listing only still-missing fields
```

### Trigger: what counts as a stall

The fallback fires when conversational collection is not converging. Candidate
definition (to be finalised — see Open Questions):

- Track, per conversation, how many consecutive handoff-intake turns have asked
  for the same required field(s) without `collectedFacts` gaining any of them.
- When that count reaches a threshold `N` (start with `N = 2`), switch the next
  handoff-intake turn from a conversational ask to `intake_form`.
- Reset the count whenever a new required fact is successfully extracted.

The form lists only the still-missing fields (current behaviour already narrows
`ui.fields` to `missingStandardFields`), so a partially-completed conversation
hands a short form to the customer, not the full set.

### Contract decision

Prefer **presence-as-intent**: keep the `intake_form` shape unchanged and change
only *when* the engine emits it. This matches the repo's "cut authority, not
information" philosophy and adds no surface. A `validatorOverride` /trace code
(e.g. `intake_form_fallback_after_stall`) records *why* the form was shown, for
evidence and debugging, without putting interpretation logic in the client.

A secondary option — adding an explicit field to the primitive (e.g.
`collectionMode: "conversational" | "form"`) — is recorded under Further Notes
but is not recommended unless a consumer genuinely needs to distinguish a
fallback form from some future always-on form.

## Authority Boundary

Consistent with the policy-authority PRD:

- The **engine/orchestration layer** owns collection strategy: whether this turn
  asks conversationally or presents a form, and the stall bookkeeping that drives
  it. This is collection *strategy*, not hard safety policy.
- The **validator** remains the hard authority for whether `intake_form` is even
  permitted for the chosen action (`packages/core/src/policy.ts:43-45`,
  `packages/core/src/validator.ts:364,487`). The fallback change must not weaken
  those checks; a fallback form is still only legal where a form was legal before.
- The **planner prompt** keeps instructing the model not to tell the customer to
  "complete the form below" unless the turn's UI is actually an `intake_form`
  (`packages/core/src/planners/prompt.ts:40`). Under this PRD that guard becomes
  more important, since most handoff-intake turns will no longer carry a form.
- **Consumers (widgets)** render whatever primitive arrives. They do not decide
  collection strategy. The review widget's `SHOW_INTAKE_FORM` flag is deleted
  once the engine owns the decision.

## User Stories

1. As a customer, I want to answer for my details in plain chat, so that I am not
   forced into a form when a sentence would do.
2. As a customer who is going in circles, I want a clear form to appear, so that I
   can finish in one step instead of being re-asked.
3. As a product owner, I want the form reserved for stalled conversations, so that
   the assistant demonstrates real conversational collection rather than a form
   wrapper.
4. As an engineer, I want the "conversation vs form" decision to live in the
   engine, so that every consumer behaves consistently without its own flag.
5. As a compliance reviewer, I want the fallback recorded as a trace/override
   code, so that I can see why a form was presented in any given conversation.
6. As a widget developer, I want form presence to mean "fallback," so that I can
   render it unconditionally and delete the suppression flag.
7. As an evaluator, I want to measure conversational-only completions versus
   form-fallback completions, so that NLP-collection tuning has a target metric.

## Implementation Decisions

- Change the emission point, not the primitive shape. The work centres on the
  handoff-intake path in `packages/core/src/engine.ts` (the block around
  `:180-234`, `buildMissingHandoffFragment` `:264`, `buildHandoffIntakeMessage`
  `:311`) and the policy builders that construct `intake_form`
  (`packages/core/src/policy.ts:153,174`).
- Default a handoff-intake turn with missing fields to a conversational ask
  (a `message` / `clarifying_prompt` primitive carrying the existing intake copy),
  not `intake_form`.
- Add per-conversation stall bookkeeping to `ConversationState` (e.g. a counter of
  consecutive same-field asks with no extraction progress). `collectedFacts`,
  `requestedFields`, and `handoffPending` already exist and are the inputs.
- Emit `intake_form` only when the stall threshold is reached; list only
  still-missing fields (preserve current narrowing).
- Record a `validatorOverride`/trace code such as
  `intake_form_fallback_after_stall` when the form is presented.
- Keep the form-completion path intact: submitting the form still maps values back
  to `collectedFacts` and completes the handoff
  (`buildCompletedHandoffFragment`, `packages/core/src/engine.ts:236`).
- Preserve vulnerability-aware copy on both the conversational ask and the
  completion message (`hasVulnerabilitySafetyFlag` branch).
- In the review widget, once the engine owns the decision: delete
  `SHOW_INTAKE_FORM` and render `intake_form` whenever it arrives
  (`packages/review-widget/src/components/MessagePrimitive.vue`). The
  `hasRenderableContent` guard stays for empty/plain primitives.

## Testing Decisions

- Behavioural, not transcript-exact. Assert primitive type and which fields are
  requested, not the precise wording.
- First handoff-intake turn with missing fields emits a non-form primitive.
- A conversation where the customer supplies fields in free text completes the
  handoff with `intake_form` never emitted.
- A conversation where the customer keeps failing to supply a required field emits
  `intake_form` once the stall threshold is reached, listing only the missing
  fields, and carries the fallback trace/override code.
- Submitting the fallback form completes the handoff (existing completion test
  stays green).
- Vulnerability-flagged handoffs keep the careful copy in both the conversational
  ask and the completion message.
- Validator tests unchanged: `intake_form` remains permitted only for the actions
  that already allow it; no action gains or loses form permission.
- Add an evidence counter to the simulator/STS output: share of handoffs completed
  conversationally vs via form fallback.

## Out of Scope

- Building or restyling the widget form UI (already built;
  `packages/review-widget`).
- Changing which fields are "standard handoff fields," or their validation.
- Real customer PII intake, persistence, or ticket side effects.
- An explicit customer-initiated "let me fill a form instead" affordance (noted as
  an open question, not committed here).
- Adding a new primitive or a `collectionMode` field unless Open Questions resolve
  toward needing one.
- Weakening any validator safety check to make the fallback fire or not fire.

## Open Questions

- **Threshold `N`.** One stalled ask or two? Counted per missing field or per
  handoff-intake turn? Start at 2-per-turn and tune from STS evidence.
- **Progress definition.** Is "no progress" strictly "no new required fact
  extracted," or also "customer asked an unrelated question mid-intake"?
- **Field-specific shortcuts.** Should high-precision fields (date of birth,
  email) jump to a form sooner because free-text extraction is error-prone?
- **Customer-initiated form.** Should "can I just fill in a form" force the
  fallback immediately, independent of the stall counter? (Accessibility +
  preference argument for yes.)
- **Conversational primitive.** Use `message` or `clarifying_prompt` for the
  non-form ask? `clarifying_prompt` carries `questions[]`, which maps cleanly to
  "the fields I still need."

## Further Notes

The steelman for today's always-form behaviour is that a form is unambiguous and
gets every field in one pass. That was reasonable while proving the handoff path.
But the engine is now being tuned for conversational collection, and an
always-present form undercuts the very capability being demonstrated — most
visibly to stakeholders evaluating the assistant.

The cleanest version of this change moves a decision, not data: the engine already
knows the missing fields, already has the conversational copy, and already tracks
collected facts. It just needs to wait before reaching for the form. Keeping the
primitive shape unchanged means consumers inherit the new behaviour for free —
the form simply stops appearing until it is actually the right tool.

The alternative explicit-signal design (`collectionMode` on the primitive) buys a
distinction no consumer needs yet: there is only one reason a form would appear.
Add it only if a second reason ever exists.
