import type { IntakeFieldName, ReasonCode } from '@loanslam/contracts';
import { requiredSlotNames, type JourneySpec, type SlotSpec } from '../../domain/journey.js';
import type { SlotCollectionState } from '../../domain/conversation.js';
import type { ExtractResult } from '../../ports/model.port.js';
import { looksLikeCredential } from '../../domain/credentials.js';

/**
 * Deterministic slot-filling policy (PRD §4.2). The model extracts; THIS decides.
 * Given the collection progress, the journey, what is already collected, and this
 * turn's extraction, it returns the next step: ask the next missing required slot,
 * complete (required set satisfied), or escalate to a human (refusal of a required
 * field, or the clarification budget exhausted — the bounded-collection invariant
 * §4.4). Pure: no I/O, exhaustively unit-tested.
 */

/** Clarification/turn budget: after this many unproductive turns, escalate. */
export const MAX_CLARIFY_TURNS = 3;

export type CollectionOutcome = 'ask' | 'complete' | 'escalate';

export interface CollectionInput {
  journey: JourneySpec;
  /** Collection progress from conversation state; null before collection starts. */
  state: SlotCollectionState | null;
  /** Values already collected (the single PII store). */
  collected: Partial<Record<IntakeFieldName, string>>;
  /** This turn's extraction (slots + signals + confidence). */
  extract: ExtractResult;
}

export interface CollectionStep {
  outcome: CollectionOutcome;
  /** Updated collection progress to persist on the conversation state. */
  state: SlotCollectionState;
  /** Credential-free slot values to merge into `collected` this turn. */
  accepted: Partial<Record<IntakeFieldName, string>>;
  /** Set when outcome === 'ask': which slot to ask for, and its prompt. */
  ask: { slot: IntakeFieldName; prompt: string } | null;
  /** Primary audit reason code for this step. */
  reasonCode: ReasonCode;
  /** True when a value for an already-collected slot was changed. */
  corrected: boolean;
}

/** Fresh collection progress when a collect-then-handoff journey begins. */
export function initialSlotState(journey: JourneySpec): SlotCollectionState {
  return {
    asked: null,
    remainingRequired: requiredSlotNames(journey),
    clarifyTurns: 0,
    confirmed: false,
  };
}

function firstMissingRequiredSlot(
  journey: JourneySpec,
  collected: Partial<Record<IntakeFieldName, string>>,
): SlotSpec | null {
  for (const slot of journey.slots) {
    if (!slot.required) continue;
    const value = collected[slot.name];
    if (value === undefined || value === '') return slot;
  }
  return null;
}

export function stepCollection(input: CollectionInput): CollectionStep {
  const prev = input.state ?? initialSlotState(input.journey);
  const required = requiredSlotNames(input.journey);
  const journeySlotNames = new Set<IntakeFieldName>(input.journey.slots.map((s) => s.name));

  // 1. Accept volunteered slot values — but only known journey slots, never an
  //    empty string, and never anything credential-shaped (defence in depth over
  //    the extractor's own filtering; brief §16).
  const accepted: Partial<Record<IntakeFieldName, string>> = {};
  let corrected = false;
  for (const [key, rawValue] of Object.entries(input.extract.slots)) {
    if (rawValue === undefined) continue;
    const name = key as IntakeFieldName;
    if (!journeySlotNames.has(name)) continue;
    const value = rawValue.trim();
    if (value.length === 0) continue;
    if (looksLikeCredential(value)) continue;
    accepted[name] = value;
    const existing = input.collected[name];
    if (existing !== undefined && existing !== value) corrected = true;
  }
  if (input.extract.signals.correction && Object.keys(accepted).length > 0) corrected = true;

  const merged: Partial<Record<IntakeFieldName, string>> = { ...input.collected, ...accepted };
  const remainingRequired = required.filter((s) => {
    const v = merged[s];
    return v === undefined || v === '';
  });

  const filledRequiredThisTurn = required.some(
    (s) => input.collected[s] === undefined && accepted[s] !== undefined,
  );
  const filledAnyThisTurn = Object.keys(accepted).length > 0;
  const progress = filledRequiredThisTurn || corrected;

  // 2. Complete: required set satisfied.
  if (remainingRequired.length === 0) {
    return {
      outcome: 'complete',
      state: { asked: null, remainingRequired: [], clarifyTurns: prev.clarifyTurns, confirmed: prev.confirmed },
      accepted,
      ask: null,
      reasonCode: corrected ? 'slot_corrected' : 'intake_complete',
      corrected,
    };
  }

  // 3. Refusal of the required field we just asked for: cannot complete -> human.
  const refusedRequired =
    input.extract.signals.refusal &&
    prev.asked !== null &&
    required.includes(prev.asked) &&
    accepted[prev.asked] === undefined;
  if (refusedRequired) {
    return {
      outcome: 'escalate',
      state: { asked: prev.asked, remainingRequired, clarifyTurns: prev.clarifyTurns, confirmed: prev.confirmed },
      accepted,
      ask: null,
      reasonCode: 'slot_refused',
      corrected,
    };
  }

  // 4. Bounded collection: escalate once the clarification budget is spent.
  const clarifyTurns = progress ? 0 : prev.clarifyTurns + 1;
  if (clarifyTurns >= MAX_CLARIFY_TURNS) {
    return {
      outcome: 'escalate',
      state: { asked: null, remainingRequired, clarifyTurns, confirmed: prev.confirmed },
      accepted,
      ask: null,
      reasonCode: 'budget_exhausted',
      corrected,
    };
  }

  // 5. Ask for the next missing required slot.
  const next = firstMissingRequiredSlot(input.journey, merged);
  // remainingRequired is non-empty here, so `next` is always defined; guard anyway.
  const reasonCode: ReasonCode = corrected ? 'slot_corrected' : filledAnyThisTurn ? 'slot_filled' : 'slot_asked';
  return {
    outcome: 'ask',
    state: { asked: next?.name ?? null, remainingRequired, clarifyTurns, confirmed: prev.confirmed },
    accepted,
    ask: next ? { slot: next.name, prompt: next.prompt } : null,
    reasonCode,
    corrected,
  };
}
