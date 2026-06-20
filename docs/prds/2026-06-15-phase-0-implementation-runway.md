# Phase 0 Implementation Runway

## Practical takeaway

We have enough repository understanding to proceed, but not by jumping straight
into broad productisation. The safest next move is a narrow Phase 0 runway:
protect the current engine boundary, make evidence easier to produce, and stop
before changing customer-visible contracts such as handoff intake fields.

## Current state

The repo now has three master docs aligned around the same architecture:

- `README.md` is the operator map.
- `docs/architecture.md` separates current Phase 0 from later productisation.
- `docs/llm-turn-planner-architecture.md` is the canonical engine and evidence flow.

The current engine shape is:

```text
conversation state + user message
-> optional shadow signal extraction
-> corpus retrieval
-> TurnPlannerInput
-> untrusted TurnPlan
-> policy/grounding validator
-> deterministic handoff state rules
-> ValidatedTurnResult + TurnTrace
```

## Runway forecast

### Phase 1: Evidence operator clarity

Make it easier for a reviewer or agent to produce high-value live lab evidence.

Scope:

- keep `processTurn` as the only engine boundary
- keep the lab API and MCP session dumps as primary evidence surfaces
- document the minimum credible lab session receipt
- avoid new product-side persistence or ticket side effects

Proof receipt:

- one lab API session dump or route-audit artifact that shows retrieved matches,
  selected/effective serving mode, proposed/final action, overrides, and safety flags

### Phase 2: Handoff-intake contract alignment

Resolve the current field mismatch before behaviour depends on it.

Known mismatch:

- product wording: `fullName`, `dateOfBirth`, `address`, `phone`, `email`,
  `situationSummary`
- live Phase 0 contracts: `fullName`, `dateOfBirth`, `postcode`, `email`, `phone`

Decision gate:

- either update contracts and lab surfaces to the product wording
- or record the smaller Phase 0 field set as deliberate and temporary

Do not silently build more handoff logic on top of the mismatch.

### Phase 3: Retrieval and signal evidence review

Use real traces to decide whether shadow signal extraction is improving retrieval
and routing evidence.

Scope:

- compare `shadowSignalComparison` to final route outcomes
- look for recurring mismatches by serving mode and safety flag
- keep signal extraction advisory, not authoritative
- avoid brittle retrieval score gates unless observed runs justify them

Proof receipt:

- a short route-audit or trace summary that identifies specific mismatch patterns
  with replayable artifacts

### Phase 4: Productisation readiness checkpoint

Only after the evidence loop is credible, decide whether to wrap the engine with
the production API/widget/persistence/ticket layers.

Decision questions:

- which model/prompt/policy combination is the baseline?
- which journeys remain unsafe, ambiguous, or low quality?
- which corpus gaps block safe answers?
- which UI primitives are actually needed?
- which trace fields should become production audit fields?
- is the handoff intake contract stable enough for real PII design?

## Recommended immediate next slice

Start with Phase 1. The implementation should be small:

1. define a minimum credible lab evidence receipt in docs
2. run or collect one live lab API session only when verification is requested
3. use the receipt to decide whether the next code change should target evidence
   export, handoff alignment, or signal/retrieval review

## Stop conditions

Pause before:

- changing `IntakeField` or customer-visible intake copy
- treating signal extraction as policy authority
- adding production persistence, ticketing, or deployment code
- converting exploratory evidence labels into release gates
- committing raw private or regulated data as fixtures or artifacts

## Risk classification

- Blocker: raw customer data, unsafe account promises, production side effects,
  or hidden contract changes
- Timebox: wording polish, exact receipt formatting, one-off ambiguous trace labels
- Parking lot: broad taxonomy cleanup, polished dashboards, comprehensive eval
  coverage, and future production stack details
