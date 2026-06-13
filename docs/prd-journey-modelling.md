# PRD: User Journey Modelling & Conversational Data Collection

> Status: proposed. Targets the POC's weakest layer — conversational
> intelligence — not deployment or UI. Builds on the existing fail-closed
> pipeline (`docs/poc-build-spec.md`) and the product brief's "hold a
> conversation / collect information intelligently" goals (brief §2, §10).
> The aim is not higher per-turn accuracy; it is making the agent's behaviour
> across the whole journey space a **known, enumerable, testable quantity** —
> safe and predictable even when the model is wrong.

## 1. Problem

The current agent is **form / not-form**. When it needs handoff data it emits one
fixed six-field form (`accountHandoffForm()`) and validates it all-at-once in
`submitIntake`; otherwise it either answers, refuses, escalates, or asks a single
generic clarify prompt. There is no piecemeal, conversational data capture: the
`collected` map is only ever filled in one shot, `customerGoal` is a one-line
summary, and the router re-decides mostly from retrieval each turn.

Consequence: the agent is flexible in *phrasing* (the model rephrases) but rigid
in *journey*. It cannot gather a fact here, a fact there, handle a question asked
mid-collection, accept a correction, or recover gracefully from the long tail of
ways real people converse. And because that journey behaviour isn't modelled
explicitly, its edge-case behaviour is **unknown** rather than merely imperfect —
which is unacceptable in a regulated domain.

This PRD defines how to model user journeys systematically so that the behaviour
space is finite, covered, and verifiable.

## 2. Goals / Non-goals

**Goals**

- Mixed-initiative, piecemeal data collection in natural conversation (not just
  a form), while keeping the form as a fast-path affordance.
- An explicit, enumerable model of journeys, states, and the cross-cutting
  interrupts that can hit any state.
- Behaviour that is a **known quantity**: every modelled state × interrupt has a
  defined, tested disposition; coverage is measurable and reportable.
- Safety invariants that hold across all journeys regardless of model accuracy.
- A conversation-level evaluation harness that asserts on *dispositions and
  invariants*, not exact wording.

**Non-goals**

- Higher raw NLU accuracy as the headline metric (we optimise *safe disposition*
  rate instead).
- Free-form autonomous agency. The model never decides policy; it extracts
  signals (brief §16, "frontend renders, backend decides" — extended to dialogue).
- UI fanciness, deployment, or the SQL Server path (out of scope here).

## 3. Core principle: flexible understanding, bounded journey

Split the problem cleanly:

- **The model = flexible understanding.** Its only job is to turn natural
  language into structured signals: intent/goal, slot values extracted from free
  text, vulnerability, frustration, correction, refusal-to-provide, off-topic,
  and a confidence score.
- **A deterministic dialogue policy = bounded journey.** A small explicit state
  machine decides what happens next from those signals.

The behaviour space then equals the state machine — finite and enumerable — not
the model's imagination. A model error degrades to "wrong slot value" or "wrong
intent," which the policy can detect, confirm, and recover from, rather than
unbounded behaviour. This is the architecture's existing principle pushed down
into the dialogue layer; the bones already support it.

## 4. The model — five artifacts

### 4.1 Journey taxonomy

Enumerate `goal × stage`. Seed from the six observed contact categories
(brief §12) **plus** the under-represented classes the brief flags: prospective
customers and general public. Each goal carries a disposition
(answer / collect-then-handoff / vulnerability / refuse), reusing and extending
the KB `serving_mode` discriminator rather than reinventing it.

Each journey is a small state machine with states such as: `greeting`,
`clarifying_intent`, `collecting_slot`, `confirming`, `handed_off`, `answered`,
`escalated`. Every state must have at least one exit (no dead ends).

### 4.2 Slot schemas + mixed-initiative collection

For each data-gathering journey, define a typed slot set. Each slot has:

- a type and validation,
- required / optional,
- a conversational elicitation prompt ("how do I ask for this naturally?").

Replace "throw a form" with a slot-filling loop:

1. The extractor pulls **whatever slots the user volunteered this turn** — one,
   several, or via the form.
2. The deterministic policy tracks remaining required slots, asks for the next
   missing one conversationally, accepts corrections to earlier slots, and only
   creates the ticket when the required set is satisfied — or escalates if the
   user cannot or will not provide them.
3. The form remains one fast-path affordance, not the only path. Both "fill the
   form" and "I'm John, born 1990, email john@…" must work.

**Regulated-domain rule:** there is no slot for card / sort code / account
number. The extractor cannot store what it has nowhere to put. The existing
credential filter remains as defence in depth on any free-text slot.

### 4.3 The state × interrupt matrix (the "known quantity" engine)

A 2-D matrix. Rows = journey states. Columns = the universal interrupts that can
hit *any* state:

> vulnerability mid-flow · topic change · question asked mid-collection ·
> several slots at once · zero info given · refuses a field · corrects an earlier
> field · gibberish · abandons / goes quiet · pastes a credential · repeats ·
> gets angry · language barrier · "are you a bot?" · jailbreak / prompt injection

Every cell gets a defined behaviour. **The filled matrix is the spec.** Empty
cells are undefined behaviour — i.e. the edge cases we are worried about.
Coverage = fraction of cells defined and tested. This is the literal mechanism
for "widest number of edge cases as a known quantity."

### 4.4 Invariants (hold across every journey, independent of accuracy)

Asserted regardless of the matrix or model correctness:

- Vulnerability always pre-empts the current journey and escalates.
- Never return an ungrounded customer-facing answer.
- Never collect or forward a bank/payment credential.
- Every inbound and outbound turn is audited.
- Every state has an exit; no dead ends.
- **Bounded collection:** a clarification / turn budget; after N failed
  understandings the agent escalates to a human rather than looping.

These convert "the model got it wrong" into "safely handed off," which is what
keeps behaviour bounded when accuracy is below 100%.

### 4.5 Conversation-level evaluation harness

The assertion surface already exists: the audit trail with reason codes. Build
multi-turn scripted transcripts — golden journeys plus one per matrix cell — run
through the real pipeline, asserting on the **disposition and invariants**, not
the wording. Then fuzz it: generate many synthetic user variants per journey
(paraphrases, partial info, interruptions, an LLM "simulated user"). Report:

- **safe-disposition rate** (did the turn land a safe route?),
- **non-negotiable violations** (must be zero),
- **coverage** (matrix cells with a passing test).

This reframes "accuracy" into the metrics that matter in a regulated setting.

## 5. How it plugs into the current code

- `backend/src/domain/conversation.ts` — grow `ServerConversationState` with a
  `journey` id and a `slots` record (filled / remaining / validated), alongside
  the existing `collected`, `pendingForm`, and `handoff`.
- `backend/src/ports/model.port.ts` — add a structured `extract` capability
  (slots + signals + confidence) beside `classify`; the deterministic adapter
  keeps a keyword fallback.
- `backend/src/chat/services/` — a new `collection` policy module that owns the
  slot-filling loop; `router.ts` gains journey-aware transitions; `responder.ts`
  gains a "ask for next slot" / "confirm" mode; `intake.ts`'s form becomes the
  fast-path affordance over the same slot schema.
- Audit — extend reason codes for slot-asked / slot-filled / slot-corrected /
  confirmation / budget-exhausted-escalation, so the trial can measure journey
  progress and escapes (brief §17).
- Eval — extend `backend/scripts/demo.ts` into a transcript-driven harness that
  asserts dispositions + invariants over the audit trail.

The architecture (backend-owned deterministic decisions, model behind adapters)
needs deepening, not redesign.

## 6. Coverage and "known quantity" reporting

The matrix + invariants + eval suite produce a coverage map: "N journeys × M
interrupts defined and tested; these cells remain open." Because every turn is
audited with reason codes, the **live trial measures where real conversations
escape the modelled journeys** — unmodelled traffic surfaces as fallback /
low-confidence / no-grounding clusters, rankable by volume. The unmodelled tail
becomes visible and prioritisable instead of silent. This is the §17 offline
feedback loop doing real work.

## 7. Success metrics

- Coverage: % of state × interrupt cells with a passing eval (target: a defined
  bar, e.g. all critical cells; full matrix over time).
- Safe-disposition rate across fuzzed journeys (high, and trending up).
- Non-negotiable violations across the entire eval suite: **zero**.
- Escape rate in the live trial (share of turns hitting fallback / low
  confidence), trending down as journeys are modelled from real data.
- No unbounded conversations (every journey terminates in answer, handoff, or
  escalation within the turn budget).

## 8. Delivery slices

Narrow vertical slices, ordered by dependency and risk:

1. Journey taxonomy + slot schemas, seeded from real transcripts (depends on the
   real corpus; synthetic KB as interim).
2. `journey` + `slots` in conversation state; a slot-filling collection engine
   (deterministic policy + model extractor) alongside the form.
3. The state × interrupt matrix authored as the spec.
4. The multi-turn eval harness asserting dispositions + invariants per cell.
5. Confidence-gated confirmation + the turn / clarification budget.
6. Audit reason-code extensions wired to a coverage / escape-rate view for the
   trial.

## 9. Risks and dependencies

- **Real conversation data.** The taxonomy and slot schemas need the real
  operationalised corpus and transcripts; the synthetic KB only proxies them.
  Journeys modelled on synthetic data may miss real-traffic shapes — especially
  the prospective-customer / general-public families that today's data
  under-represents.
- **LLM dialogue managers rot without discipline.** The matrix and eval suite are
  what keep the added flexibility a known quantity; skipping them reintroduces
  the unknown-behaviour problem with more surface area.
- **Cost / latency.** Per-turn extraction adds model calls; budget for it and
  keep the deterministic fallback viable.
- **Confirmation friction.** Over-confirming is annoying; under-confirming acts
  on wrong extractions. Confidence thresholds need tuning from trial data.

## 10. Open questions / decisions to own

- How constrained should journeys be? Recommended posture: flexible NLU +
  bounded policy (this PRD). Confirm the business is comfortable with that point
  on the rigid-script ↔ free-agent spectrum.
- Required vs optional slots per journey, and the minimum set that justifies a
  ticket.
- The turn / clarification budget before mandatory human escalation.
- Confidence threshold for act-vs-confirm.
- Whether to model journeys on the synthetic KB now or hold for the real corpus.
- Which interrupt columns are launch-critical vs trial-deferred.
